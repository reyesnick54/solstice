/**
 * HELIOS M12 — multi-leg strategy proposal materialization.
 * Proposals describe coordinated legs; Execution Authority remains external.
 */

import type { UtcInstant } from '@solstice/domain';
import { resolveM12PairDefinition, type M12PairId } from './ids.ts';
import type {
  M12ExitReason,
  M12ProposalAction,
  M12RelationshipSnapshot,
  M12StrategyLeg,
  M12StrategyProposal,
} from './types.ts';

export function buildM12ProposalId(pairId: M12PairId, action: M12ProposalAction, at: UtcInstant): string {
  return `m12_prop_${pairId}_${action}_${Date.parse(at)}`;
}

function legsForSpreadDirection(input: {
  readonly pairId: M12PairId;
  readonly direction: 'LONG_SPREAD' | 'SHORT_SPREAD';
  readonly hedgeRatioScaled: bigint;
}): readonly M12StrategyLeg[] {
  const pair = resolveM12PairDefinition(input.pairId);
  const hedgeWeight = Number(input.hedgeRatioScaled) / 100;
  const legBWeight = Math.min(10_000, Math.max(1_000, Math.round(hedgeWeight * 100)));

  if (input.direction === 'LONG_SPREAD') {
    return Object.freeze([
      Object.freeze({
        instrumentId: pair.legAInstrumentId,
        direction: 'BUY' as const,
        relativeWeightBps: 10_000,
      }),
      Object.freeze({
        instrumentId: pair.legBInstrumentId,
        direction: 'SELL' as const,
        relativeWeightBps: legBWeight,
      }),
    ]);
  }

  return Object.freeze([
    Object.freeze({
      instrumentId: pair.legAInstrumentId,
      direction: 'SELL' as const,
      relativeWeightBps: 10_000,
    }),
    Object.freeze({
      instrumentId: pair.legBInstrumentId,
      direction: 'BUY' as const,
      relativeWeightBps: legBWeight,
    }),
  ]);
}

export function buildM12StrategyProposal(input: {
  readonly pairId: M12PairId;
  readonly action: M12ProposalAction;
  readonly spreadDirection: 'LONG_SPREAD' | 'SHORT_SPREAD' | null;
  readonly relationship: M12RelationshipSnapshot | null;
  readonly evidence: readonly string[];
  readonly invalidatingConditions: readonly string[];
  readonly exitReason: M12ExitReason;
  readonly rationale: string;
  readonly decidedAt: UtcInstant;
  readonly parameterVersion: string;
}): M12StrategyProposal {
  const hedgeRatioScaled = input.relationship?.hedgeRatioScaled ?? 10_000n;
  const legs =
    input.spreadDirection === null
      ? Object.freeze([] as const)
      : legsForSpreadDirection({
          pairId: input.pairId,
          direction: input.spreadDirection,
          hedgeRatioScaled,
        });

  const pair = resolveM12PairDefinition(input.pairId);
  const hedgeDesc =
    pair.hedgeMethod === 'FIXED_RATIO'
      ? `fixed-ratio hedge on ${pair.legAInstrumentId} vs ${pair.legBInstrumentId}`
      : `rolling-beta hedge ratio ${hedgeRatioScaled.toString()} scaled`;

  return Object.freeze({
    proposalId: buildM12ProposalId(input.pairId, input.action, input.decidedAt),
    pairId: input.pairId,
    action: input.action,
    legs,
    expectedHedgeRelationship: hedgeDesc,
    evidence: Object.freeze([...input.evidence]),
    invalidatingConditions: Object.freeze([...input.invalidatingConditions]),
    spreadZScoreScaled: input.relationship?.spreadZScoreScaled ?? null,
    rollingCorrelationScaled: input.relationship?.rollingCorrelationScaled ?? null,
    exitReason: input.exitReason,
    rationale: input.rationale,
    decidedAt: input.decidedAt,
    parameterVersion: input.parameterVersion,
    grantsFinancialEffect: false,
    sizingAuthority: 'EXTERNAL_META_ALLOCATOR',
  });
}
