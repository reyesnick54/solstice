/**
 * HELIOS EVOL03 — population archive and research-ledger qualification.
 */

export const HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED =
  'HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED' as const;

export const HELIOS_EVOL03_POPULATION_ARCHIVE_BLOCKED = 'HELIOS_EVOL03_POPULATION_ARCHIVE_BLOCKED' as const;

export type Evol03QualificationChecks = {
  readonly appendOnlyTrials: boolean;
  readonly failedTrialRetained: boolean;
  readonly lineageQueriesImplemented: boolean;
  readonly inbreedingGuardImplemented: boolean;
  readonly geneAttributionWithoutCausality: boolean;
};

export type Evol03QualificationResult = {
  readonly marker:
    | typeof HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED
    | typeof HELIOS_EVOL03_POPULATION_ARCHIVE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEvol03PopulationArchiveQualification(
  checks: Evol03QualificationChecks,
): Evol03QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Evol03QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EVOL03_POPULATION_ARCHIVE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
