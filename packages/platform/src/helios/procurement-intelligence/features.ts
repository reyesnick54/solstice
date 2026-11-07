/**
 * Government demand features with normalization denominators.
 */

import type { UtcInstant } from '@solstice/domain';

import type { GovernmentDemandFeatureSnapshot, GovernmentDemandState, ProcurementNormalizationContext } from './types.ts';
import { HELIOS_PROCUREMENT_DEMAND_SCHEMA, PROCUREMENT_DEMAND_FEATURE_IDS } from './taxonomy.ts';

function ratio(numerator: bigint, denominator: bigint | null): number | null {
  if (denominator === null || denominator === 0n) {
    return null;
  }
  return Number(numerator) / Number(denominator);
}

function concentration(exposure: Readonly<Record<string, bigint>>, total: bigint): number {
  if (total === 0n) {
    return 0;
  }
  let max = 0n;
  for (const value of Object.values(exposure)) {
    if (value > max) {
      max = value;
    }
  }
  return Number(max) / Number(total);
}

export function computeGovernmentDemandFeatures(input: {
  readonly state: GovernmentDemandState;
  readonly priorState: GovernmentDemandState | null;
  readonly priorYearState: GovernmentDemandState | null;
  readonly normalization: ProcurementNormalizationContext;
}): GovernmentDemandFeatureSnapshot {
  const { state, priorState, priorYearState, normalization } = input;

  const newAwards =
    priorState === null
      ? state.activeAwardCount
      : Math.max(0, state.activeAwardCount - priorState.activeAwardCount);

  const awardMomentum =
    priorState === null || priorState.totalAwardCeilingMinor === 0n
      ? 0
      : Number(state.totalAwardCeilingMinor - priorState.totalAwardCeilingMinor) /
        Number(priorState.totalAwardCeilingMinor);

  const obligationMomentum =
    priorState === null || priorState.totalObligatedMinor === 0n
      ? 0
      : Number(state.totalObligatedMinor - priorState.totalObligatedMinor) /
        Number(priorState.totalObligatedMinor);

  const backlogProxy =
    state.backlogRemainingObligationMinor !== null
      ? Number(state.backlogRemainingObligationMinor)
      : Number(state.totalAwardCeilingMinor - state.totalObligatedMinor);

  const agencyConcentration = concentration(state.agencyExposure, state.totalAwardCeilingMinor);
  const programConcentration = concentration(state.programExposure, state.totalAwardCeilingMinor);

  const renewalRate =
    priorYearState === null || priorYearState.activeAwardCount === 0
      ? 0
      : state.activeAwardCount / priorYearState.activeAwardCount;

  const modificationRate =
    state.activeAwardCount === 0 ? 0 : state.modificationCount / state.activeAwardCount;

  const cancellationRate =
    state.modificationCount === 0 ? 0 : state.cancellationCount / state.modificationCount;

  const rawByFeature: Record<(typeof PROCUREMENT_DEMAND_FEATURE_IDS)[number], number> = {
    newAwards,
    awardMomentum,
    obligationMomentum,
    backlogProxy,
    agencyConcentration,
    programConcentration,
    renewalRate,
    modificationRate,
    cancellationRate,
  };

  const scaleMinor =
    state.totalAwardCeilingMinor > 0n ? state.totalAwardCeilingMinor : state.totalObligatedMinor;

  const features = PROCUREMENT_DEMAND_FEATURE_IDS.map((featureId) =>
    Object.freeze({
      featureId,
      rawValue: rawByFeature[featureId],
      normalizedBy: Object.freeze(['companyRevenue', 'marketCap', 'existingGovernmentBusiness'] as const),
      companyRevenueRatio: ratio(scaleMinor, normalization.companyRevenueMinor),
      marketCapRatio: ratio(scaleMinor, normalization.marketCapMinor),
      existingGovernmentBusinessRatio: ratio(scaleMinor, normalization.existingGovernmentBusinessMinor),
    }),
  );

  return Object.freeze({
    schema: HELIOS_PROCUREMENT_DEMAND_SCHEMA,
    decisionTimeUtc: state.decisionTimeUtc as UtcInstant,
    attributionEntityId: state.attributionEntityId,
    features: Object.freeze(features),
    grantsExecutionAuthority: false as const,
  });
}
