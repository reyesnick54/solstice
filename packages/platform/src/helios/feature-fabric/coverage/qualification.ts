import type { CoverageManifest, CoverageQualificationThresholds } from './types.ts';

export const HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED = 'HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED' as const;

export const HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED = 'HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED' as const;

export type Aaf05QualificationChecks = {
  readonly denominatorSurvivesFiltering: boolean;
  readonly coverageChangesVisible: boolean;
  readonly providerOutageDistinctFromStructuralAbsence: boolean;
  readonly entitlementFailureNotInterpretedAsZero: boolean;
  readonly restartPreservesCoverageState: boolean;
  readonly strategyEvaluationContainsCoverageEvidence: boolean;
};

export type Aaf05QualificationResult = {
  readonly marker: typeof HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED | typeof HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf05Qualification(checks: Aaf05QualificationChecks): Aaf05QualificationResult {
  const blockers: string[] = [];
  if (!checks.denominatorSurvivesFiltering) blockers.push('denominator_survives_filtering');
  if (!checks.coverageChangesVisible) blockers.push('coverage_changes_visible');
  if (!checks.providerOutageDistinctFromStructuralAbsence) {
    blockers.push('provider_outage_distinct_from_structural_absence');
  }
  if (!checks.entitlementFailureNotInterpretedAsZero) {
    blockers.push('entitlement_failure_not_interpreted_as_zero');
  }
  if (!checks.restartPreservesCoverageState) blockers.push('restart_preserves_coverage_state');
  if (!checks.strategyEvaluationContainsCoverageEvidence) {
    blockers.push('strategy_evaluation_contains_coverage_evidence');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED : HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function assessCoverageManifestQualification(input: {
  readonly manifest: CoverageManifest;
  readonly thresholds: CoverageQualificationThresholds;
  readonly trainingManifest?: CoverageManifest | null;
}): { readonly passed: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (input.manifest.metrics.coverageRatioBps < input.thresholds.minimumCoverageRatioBps) {
    blockers.push('coverage_ratio_below_minimum');
  }
  const drift = input.manifest.metrics.driftFromBaselineBps;
  if (drift !== null && Math.abs(drift) > input.thresholds.maximumCoverageDriftBps) {
    blockers.push('coverage_drift_exceeds_maximum');
  }
  if (input.trainingManifest) {
    const trainingRatio = input.trainingManifest.metrics.coverageRatioBps;
    const evalRatio = input.manifest.metrics.coverageRatioBps;
    const trainDrift = Math.abs(evalRatio - trainingRatio);
    if (trainDrift > input.thresholds.maximumCoverageDriftBps) {
      blockers.push('evaluation_training_coverage_drift');
    }
  }
  return Object.freeze({ passed: blockers.length === 0, blockers: Object.freeze(blockers) });
}
