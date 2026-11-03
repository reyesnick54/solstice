/**
 * HELIOS NATIVE06 — BYTEX strategy document + indicator assimilation qualification.
 */

export const HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED =
  'HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED' as const;

export const HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_BLOCKED =
  'HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_BLOCKED' as const;

export type Native06BytexQualificationChecks = {
  readonly bytexDocumentSchemaValidated: boolean;
  readonly genomeNodeFamiliesComplete: boolean;
  readonly declarativeNoCodeExecution: boolean;
  readonly indicatorCatalogBound: boolean;
  readonly genomeHashStable: boolean;
  readonly exampleEmaCrossTranslates: boolean;
  readonly capsuleCandidateMaterializes: boolean;
  readonly compilerReachesPaperNotLive: boolean;
  readonly historicalHoldoutWalkForwardStagesPresent: boolean;
  readonly featureFabricIndicatorsPorted: boolean;
};

export type Native06BytexQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED
    | typeof HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'BYTEX_ASSIMILATION_QUALIFIED' | 'BYTEX_ASSIMILATION_BLOCKED';
};

export function evaluateNative06BytexQualification(
  checks: Native06BytexQualificationChecks,
): Native06BytexQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Native06BytexQualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'BYTEX_ASSIMILATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'BYTEX_ASSIMILATION_QUALIFIED',
  });
}
