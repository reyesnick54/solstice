import type { CapitalAllocationRecommendation } from '../types.ts';
import { bridgeMetaAllocatorToPositionSizing } from './pipeline.ts';
import type {
  MetaAllocatorSizingBridgeResult,
  PositionSizingInput,
  PositionSizingResult,
} from './types.ts';

export type MetaAllocatorPositionSizingOutcome = {
  readonly capitalRecommendation: CapitalAllocationRecommendation;
  readonly sizing: PositionSizingResult;
  readonly approvedNotionalMinor: bigint;
  readonly sizingApplied: boolean;
};

function parseMinor(value: string): bigint {
  return BigInt(value);
}

/**
 * Applies M19 dynamic position sizing to a Meta Allocator capital recommendation.
 * Meta Allocator proposes capital assignment; risk sizing determines permissible size.
 * Execution Authority receives only the approved size.
 */
export function applyPositionSizingToCapitalRecommendation(input: {
  readonly capitalRecommendation: CapitalAllocationRecommendation;
  readonly sizingInput: PositionSizingInput;
}): MetaAllocatorPositionSizingOutcome {
  const proposedMinor = parseMinor(input.capitalRecommendation.recommendedMaxCapitalMinor);
  const bridge = bridgeMetaAllocatorToPositionSizing({
    sizingInput: input.sizingInput,
    metaAllocatorRecommendedMinor: proposedMinor,
  });
  const approvedMinor = bridge.executionApprovedNotionalMinor;
  const pctBps =
    input.sizingInput.availableCapitalMinor > 0n
      ? Number((approvedMinor * 10_000n) / input.sizingInput.availableCapitalMinor)
      : 0;

  const updatedRecommendation: CapitalAllocationRecommendation = Object.freeze({
    ...input.capitalRecommendation,
    recommendedMaxCapitalMinor: approvedMinor.toString(),
    recommendedPercentageBps: pctBps,
    reasonCodes: Object.freeze([
      ...input.capitalRecommendation.reasonCodes,
      ...(approvedMinor <= 0n ? (['INFEASIBLE_DEPLOYMENT'] as const) : ([] as const)),
    ]),
  });

  return Object.freeze({
    capitalRecommendation: updatedRecommendation,
    sizing: bridge.sizing,
    approvedNotionalMinor: approvedMinor,
    sizingApplied: true,
  });
}

export type { MetaAllocatorSizingBridgeResult, PositionSizingInput, PositionSizingResult };
