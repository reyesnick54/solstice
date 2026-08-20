/**
 * REHEARSAL_ONLY conversion fixtures. Never production rates.
 */

import { createProductionConversionPolicyCandidate } from './conversion.ts';
import { COMPLETE_SETTLEMENT_EVIDENCE } from './evidence.ts';
import type {
  MoonReyProductionSettlementConversionPolicyCandidate,
  ProductionCandidateSettlementEvidence,
  ProductionCandidateUsage,
} from './types.ts';

export function rehearsalConversionPolicy(): MoonReyProductionSettlementConversionPolicyCandidate {
  const created = createProductionConversionPolicyCandidate({
    policyId: 'moonrey.gpuv-settlement.rehearsal.v1',
    conversionNumerator: 2n,
    conversionDenominator: 5n,
    roundingRule: 'FLOOR',
    perContributionCeiling: 1_000n,
    perEventCeiling: 2_000n,
    perObjectCeiling: 4_000n,
    perControllerCeiling: 8_000n,
    perCategoryEpochCeiling: 20_000n,
    globalEpochCeiling: 50_000n,
    governanceReference: 'chunk-146.rehearsal.conversion',
    sourceClass: 'REHEARSAL_ONLY',
    fixture: true,
  });
  if (!created.ok) {
    throw new Error(created.detail);
  }
  return created.value;
}

export function rehearsalUsage(overrides: Partial<ProductionCandidateUsage> = {}): ProductionCandidateUsage {
  return Object.freeze({
    eventIssued: 0n,
    objectIssued: 0n,
    controllerIssued: 0n,
    categoryEpochIssued: 0n,
    globalEpochIssued: 0n,
    canonicalSupply: 0n,
    category: 'ENERGY',
    ...overrides,
  });
}

export function rehearsalEvidence(
  overrides: Partial<ProductionCandidateSettlementEvidence> = {},
): ProductionCandidateSettlementEvidence {
  return Object.freeze({
    ...COMPLETE_SETTLEMENT_EVIDENCE,
    ...overrides,
  });
}
