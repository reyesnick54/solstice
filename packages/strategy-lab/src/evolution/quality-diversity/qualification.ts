/**
 * EVOL04 — Quality-diversity evolution track qualification (research / simulation).
 */

export const HELIOS_EVOL04_QUALITY_DIVERSITY_QUALIFIED =
  'HELIOS_EVOL04_QUALITY_DIVERSITY_QUALIFIED' as const;

export const HELIOS_EVOL04_QUALITY_DIVERSITY_BLOCKED = 'HELIOS_EVOL04_QUALITY_DIVERSITY_BLOCKED' as const;

export type Evol04QualityDiversityChecks = {
  readonly mapElitesArchiveUsed: boolean;
  readonly nicheLocalFitnessOnly: boolean;
  readonly multiDimensionalFitness: boolean;
  readonly behaviorDescriptorsComplete: boolean;
  readonly emptyNicheExplorationBudgeted: boolean;
  readonly diversityCollapseMonitored: boolean;
  readonly qualificationMarkerPresent: boolean;
};

export type Evol04QualityDiversityQualificationResult = {
  readonly marker:
    | typeof HELIOS_EVOL04_QUALITY_DIVERSITY_QUALIFIED
    | typeof HELIOS_EVOL04_QUALITY_DIVERSITY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'EVOL04_QUALITY_DIVERSITY_QUALIFIED' | 'EVOL04_QUALITY_DIVERSITY_BLOCKED';
};

export function evaluateEvol04QualityDiversityQualification(
  checks: Evol04QualityDiversityChecks,
): Evol04QualityDiversityQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Evol04QualityDiversityChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EVOL04_QUALITY_DIVERSITY_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'EVOL04_QUALITY_DIVERSITY_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_EVOL04_QUALITY_DIVERSITY_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'EVOL04_QUALITY_DIVERSITY_QUALIFIED',
  });
}
