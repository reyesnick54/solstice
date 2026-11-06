/**
 * HELIOS EVOL06 — Population-based research scheduler qualification (research compute only).
 */

export const HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED =
  'HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED' as const;
export const HELIOS_EVOL06_POPULATION_SCHEDULER_BLOCKED =
  'HELIOS_EVOL06_POPULATION_SCHEDULER_BLOCKED' as const;

export type Evol06QualificationChecks = {
  readonly populationSchedulerPresent: boolean;
  readonly evolutionWorkerTracksLineage: boolean;
  readonly lateBloomerGuardActive: boolean;
  readonly islandTaxonomyComplete: boolean;
  readonly researchAllocationsNeverGrantCapital: boolean;
};

export type Evol06QualificationResult = {
  readonly marker:
    | typeof HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED
    | typeof HELIOS_EVOL06_POPULATION_SCHEDULER_BLOCKED;
  readonly blockers: readonly string[];
};

export function evaluateEvol06PopulationSchedulerQualification(
  checks: Evol06QualificationChecks,
): Evol06QualificationResult {
  const blockers: string[] = [];
  if (!checks.populationSchedulerPresent) blockers.push('population_scheduler_missing');
  if (!checks.evolutionWorkerTracksLineage) blockers.push('lineage_not_tracked');
  if (!checks.lateBloomerGuardActive) blockers.push('late_bloomer_guard_missing');
  if (!checks.islandTaxonomyComplete) blockers.push('island_taxonomy_incomplete');
  if (!checks.researchAllocationsNeverGrantCapital) blockers.push('capital_grant_leak');

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EVOL06_POPULATION_SCHEDULER_BLOCKED,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED,
    blockers: Object.freeze([]),
  });
}
