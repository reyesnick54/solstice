/**
 * HELIOS multi-leg coordinated execution risk hooks.
 * Architecture-only risk assessment — not a parallel order manager.
 */

import type { HeliosMultiLegProposalLeg } from './types.ts';

export const HELIOS_MULTI_LEG_EXECUTION_RISK_KINDS = [
  'FIRST_LEG_FILL',
  'SECOND_LEG_FAILURE',
  'PARTIAL_FILL',
  'HEDGE_SLIPPAGE',
  'TIMEOUT',
  'UNWIND_REQUIRED',
] as const;
export type HeliosMultiLegExecutionRiskKind = (typeof HELIOS_MULTI_LEG_EXECUTION_RISK_KINDS)[number];

export type HeliosMultiLegLegFillStatus = {
  readonly legIndex: number;
  readonly instrumentId: string;
  readonly requestedQuantity: bigint;
  readonly filledQuantity: bigint;
  readonly status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'FAILED' | 'TIMED_OUT';
};

export type HeliosMultiLegExecutionRiskAssessment = {
  readonly proposalId: string;
  readonly riskKind: HeliosMultiLegExecutionRiskKind;
  readonly requiresUnwind: boolean;
  readonly legStatuses: readonly HeliosMultiLegLegFillStatus[];
  readonly hedgeSlippageBps: number | null;
  readonly rationale: string;
};

export type HeliosMultiLegExecutionSimulationInput = {
  readonly proposalId: string;
  readonly legs: readonly HeliosMultiLegProposalLeg[];
  readonly legFillOutcomes: readonly {
    readonly legIndex: number;
    readonly filledQuantity: bigint;
    readonly requestedQuantity: bigint;
    readonly status: HeliosMultiLegLegFillStatus['status'];
  }[];
  readonly timeoutMs: number;
  readonly elapsedMs: number;
  readonly hedgeSlippageBps?: number;
};

export function assessMultiLegExecutionRisk(
  input: HeliosMultiLegExecutionSimulationInput,
): HeliosMultiLegExecutionRiskAssessment {
  const legStatuses: HeliosMultiLegLegFillStatus[] = input.legFillOutcomes.map((row) =>
    Object.freeze({
      legIndex: row.legIndex,
      instrumentId: input.legs.find((leg) => leg.legIndex === row.legIndex)?.instrumentId ?? 'unknown',
      requestedQuantity: row.requestedQuantity,
      filledQuantity: row.filledQuantity,
      status: row.status,
    }),
  );

  const filledLegs = legStatuses.filter((row) => row.status === 'FILLED' || row.status === 'PARTIAL');
  const failedLegs = legStatuses.filter((row) => row.status === 'FAILED' || row.status === 'TIMED_OUT');
  const partialLegs = legStatuses.filter((row) => row.status === 'PARTIAL');

  if (input.elapsedMs >= input.timeoutMs && filledLegs.length > 0 && filledLegs.length < legStatuses.length) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'TIMEOUT',
      requiresUnwind: true,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'Multi-leg proposal timed out with incomplete hedge',
    });
  }

  if (partialLegs.length > 0) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'PARTIAL_FILL',
      requiresUnwind: partialLegs.length !== legStatuses.length,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'One or more legs partially filled',
    });
  }

  if (filledLegs.length === 1 && legStatuses.length > 1 && failedLegs.length > 0) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'SECOND_LEG_FAILURE',
      requiresUnwind: true,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'First leg filled but subsequent leg failed',
    });
  }

  if (filledLegs.length === 1 && legStatuses.length > 1 && filledLegs.length < legStatuses.length) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'FIRST_LEG_FILL',
      requiresUnwind: true,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'First leg filled awaiting hedge completion',
    });
  }

  if ((input.hedgeSlippageBps ?? 0) > 50) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'HEDGE_SLIPPAGE',
      requiresUnwind: false,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'Hedge slippage exceeds tolerance',
    });
  }

  if (failedLegs.length > 0 && filledLegs.length > 0) {
    return Object.freeze({
      proposalId: input.proposalId,
      riskKind: 'UNWIND_REQUIRED',
      requiresUnwind: true,
      legStatuses: Object.freeze(legStatuses),
      hedgeSlippageBps: input.hedgeSlippageBps ?? null,
      rationale: 'Incomplete hedge requires unwind',
    });
  }

  return Object.freeze({
    proposalId: input.proposalId,
    riskKind: 'FIRST_LEG_FILL',
    requiresUnwind: false,
    legStatuses: Object.freeze(legStatuses),
    hedgeSlippageBps: input.hedgeSlippageBps ?? null,
    rationale: 'No coordinated execution risk detected',
  });
}

export function simulatePartialFillScenario(input: {
  readonly proposalId: string;
  readonly legs: readonly HeliosMultiLegProposalLeg[];
}): HeliosMultiLegExecutionRiskAssessment {
  return assessMultiLegExecutionRisk({
    proposalId: input.proposalId,
    legs: input.legs,
    legFillOutcomes: Object.freeze([
      Object.freeze({
        legIndex: 0,
        requestedQuantity: 1_000_000n,
        filledQuantity: 1_000_000n,
        status: 'FILLED' as const,
      }),
      Object.freeze({
        legIndex: 1,
        requestedQuantity: 800_000n,
        filledQuantity: 0n,
        status: 'FAILED' as const,
      }),
    ]),
    timeoutMs: 30_000,
    elapsedMs: 5_000,
  });
}
