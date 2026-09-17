import type { UtcInstant } from '../../domain/src/time.ts';
import { freezePromotionCapsule, type PromotionCapsule } from './promotion-capsule.ts';
import type { StrategyPromotionRecord } from './promotion-store.ts';

/** H14 reference Grow rule observed as a Strategy Capsule for qualification tracking. */
export const HELIOS_H14_STRATEGY_CAPSULE_ID = 'str_helios_h14_reference_price_entry_v1' as const;
export const HELIOS_H14_STRATEGY_CAPSULE_VERSION = 'v1' as const;

export type H14CapsuleQualificationObservation = {
  readonly capsuleId: string;
  readonly strategyId: typeof HELIOS_H14_STRATEGY_CAPSULE_ID;
  readonly version: typeof HELIOS_H14_STRATEGY_CAPSULE_VERSION;
  readonly fingerprint: string;
  readonly promotionState: StrategyPromotionRecord['promotionState'] | 'UNREGISTERED';
  readonly paperEligible: boolean;
  readonly liveEligible: false;
  readonly policyVersion: string | null;
  readonly policyHash: string | null;
  readonly observedAt: UtcInstant;
};

export function observeH14CapsuleQualification(input: {
  readonly promotion?: StrategyPromotionRecord | null;
  readonly capsule?: PromotionCapsule | null;
  readonly observedAt: UtcInstant;
}): H14CapsuleQualificationObservation {
  const promotion = input.promotion;
  return Object.freeze({
    capsuleId: input.capsule?.capsuleId ?? 'scap_unregistered',
    strategyId: HELIOS_H14_STRATEGY_CAPSULE_ID,
    version: HELIOS_H14_STRATEGY_CAPSULE_VERSION,
    fingerprint: input.capsule?.fingerprint ?? 'unregistered',
    promotionState: promotion?.promotionState ?? 'UNREGISTERED',
    paperEligible:
      promotion?.promotionState === 'PAPER_ELIGIBLE' || promotion?.promotionState === 'PAPER_ACTIVE',
    liveEligible: false,
    policyVersion: promotion?.policyVersion ?? null,
    policyHash: promotion?.policyHash ?? null,
    observedAt: input.observedAt,
  });
}

export function buildH14ReferenceCapsule(input: {
  readonly subjectId: string;
  readonly frozenAt: UtcInstant;
}): ReturnType<typeof freezePromotionCapsule> {
  return freezePromotionCapsule({
    specification: Object.freeze({
      specificationId: 'ssp_helios_h14_v1' as never,
      strategyId: HELIOS_H14_STRATEGY_CAPSULE_ID as never,
      version: HELIOS_H14_STRATEGY_CAPSULE_VERSION as never,
      instrumentUniverse: Object.freeze(['SIM-GROW-ETF']),
      eligibilityFilters: Object.freeze([{ requireMembership: true as const }]),
      approvedSignalRefs: Object.freeze([]),
      rebalanceCadence: 'DAILY' as const,
      targetAllocation: Object.freeze({
        op: 'ALLOCATION' as const,
        weightsBps: Object.freeze({ 'SIM-GROW-ETF': 9000, CASH: 1000 }),
      }),
      entryConditions: Object.freeze({
        op: 'COMPARE' as const,
        left: { kind: 'CLOSE' as const, instrumentId: 'SIM-GROW-ETF' },
        comparator: 'LTE' as const,
        right: { kind: 'THRESHOLD' as const, minorUnits: 10_100n },
      }),
      exitConditions: Object.freeze({
        op: 'COMPARE' as const,
        left: { kind: 'CLOSE' as const, instrumentId: 'SIM-GROW-ETF' },
        comparator: 'GTE' as const,
        right: { kind: 'THRESHOLD' as const, minorUnits: 10_300n },
      }),
      cashAllocationBps: 1000,
      riskBudgetId: 'rb_h14' as never,
      mandateCompatibility: Object.freeze(['GROW']),
      transactionCosts: Object.freeze({
        mode: 'EXPLICIT_COSTS' as const,
        commissionMinorPerShare: 2n,
        spreadMinor: 5n,
        slippageMinor: 3n,
        otherCostMinor: 0n,
        namedExplicitly: true as const,
      }),
      requiredData: Object.freeze(['reference_mid']),
      requiredModels: Object.freeze([]),
      createdAt: input.frozenAt,
      executableCode: false as const,
    }),
    plan: null,
    evidenceRefs: Object.freeze([
      { evidenceKind: 'EXTERNAL' as const, refId: 'helios_h14_paper_grow', hash: 'h14_rule_v1' },
    ]),
    subjectId: input.subjectId,
    frozenAt: input.frozenAt,
  });
}
