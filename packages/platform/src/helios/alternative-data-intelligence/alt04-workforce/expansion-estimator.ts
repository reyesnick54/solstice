import type { HiringMotiveEstimate } from './taxonomy.ts';
import type { JobPostingFeatureBundle, WorkforceExpansionState, WorkforceProviderHistoryWindow } from './types.ts';
import type { UtcInstant } from '@solstice/domain';
import { HELIOS_ALT04_WORKFORCE_AUTHORITY, HELIOS_ALT04_WORKFORCE_SCHEMA } from './taxonomy.ts';

function bandFromGrowth(growthMoMBps: number | null): WorkforceExpansionState['band'] {
  if (growthMoMBps == null) return 'FLAT';
  if (growthMoMBps >= 2_500) return 'RAPID';
  if (growthMoMBps >= 500) return 'EXPANDING';
  if (growthMoMBps <= -500) return 'SHRINKING';
  return 'FLAT';
}

export function estimateHiringMotive(input: {
  readonly features: JobPostingFeatureBundle;
  readonly history: WorkforceProviderHistoryWindow | null;
}): {
  readonly motive: HiringMotiveEstimate;
  readonly confidenceBps: number;
  readonly rationale: readonly string[];
} {
  const rationale: string[] = [];
  const { features, history } = input;

  if (features.locationBreadth > 3 && features.postingGrowthMoMBps != null && features.postingGrowthMoMBps > 0) {
    rationale.push('location_expansion_with_positive_posting_momentum');
  }
  if (features.repostRateBps != null && features.repostRateBps > 3_000) {
    rationale.push('elevated_repost_rate_suggests_replacement_or_turnover');
  }
  if (features.roleBreadth <= 2 && features.postingCount >= 5) {
    rationale.push('repeated_role_postings');
  }
  if (history?.industryHiringCycleIndexBps != null && history.industryHiringCycleIndexBps > 6_000) {
    rationale.push('industry_hiring_cycle_elevated');
  }
  if (history && history.priorMonthCount > 0) {
    const baselineRatio = features.postingCount / history.priorMonthCount;
    if (baselineRatio > 1.5) rationale.push('above_company_historical_baseline');
  }

  let motive: HiringMotiveEstimate = 'UNKNOWN';
  let confidence = 2_500;

  if (rationale.includes('industry_hiring_cycle_elevated') && features.postingGrowthMoMBps != null && features.postingGrowthMoMBps > 0) {
    motive = 'SEASONAL';
    confidence = 4_000;
  } else if (rationale.includes('elevated_repost_rate_suggests_replacement_or_turnover')) {
    motive = rationale.includes('above_company_historical_baseline') ? 'TURNOVER' : 'REPLACEMENT';
    confidence = 5_500;
  } else if (rationale.includes('location_expansion_with_positive_posting_momentum')) {
    motive = 'EXPANSION';
    confidence = 6_000;
  } else if (features.postingGrowthMoMBps != null && features.postingGrowthMoMBps > 800) {
    motive = 'EXPANSION';
    confidence = 3_500;
    rationale.push('momentum_heuristic_low_confidence');
  }

  if (motive === 'UNKNOWN') {
    rationale.push('insufficient_evidence_no_certainty_claim');
    confidence = Math.min(confidence, 2_000);
  }

  return Object.freeze({ motive, confidenceBps: confidence, rationale: Object.freeze(rationale) });
}

export function buildWorkforceExpansionState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly features: JobPostingFeatureBundle;
  readonly history: WorkforceProviderHistoryWindow | null;
}): WorkforceExpansionState {
  const estimate = estimateHiringMotive({ features: input.features, history: input.history });
  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `expansion:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    band: bandFromGrowth(input.features.postingGrowthMoMBps),
    estimatedMotive: estimate.motive,
    motiveConfidenceBps: estimate.confidenceBps,
    motiveRationale: estimate.rationale,
    features: input.features,
  });
}
