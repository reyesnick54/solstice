/**
 * HELIOS Open-Source Integration OS05 — Strategy Genome foundation qualification.
 */

export const HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED =
  'HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED' as const;

export const HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_BLOCKED =
  'HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_BLOCKED' as const;

export type Os05QualificationChecks = {
  readonly genomeTypesPresent: boolean;
  readonly nodeCatalogValidated: boolean;
  readonly declarativeNoCodeExecution: boolean;
  readonly genomeHashStable: boolean;
  readonly lineageFieldsPresent: boolean;
  readonly exampleGenomeMaterializes: boolean;
  readonly compilerNeverLiveExecution: boolean;
  readonly capsuleCandidateResearchOnly: boolean;
  readonly strategyCapsuleNotReplaced: boolean;
};

export type Os05QualificationResult = {
  readonly marker:
    | typeof HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED
    | typeof HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'FOUNDATION_QUALIFIED' | 'FOUNDATION_BLOCKED';
};

export function evaluateOs05StrategyGenomeQualification(
  checks: Os05QualificationChecks,
): Os05QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Os05QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'FOUNDATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'FOUNDATION_QUALIFIED',
  });
}
