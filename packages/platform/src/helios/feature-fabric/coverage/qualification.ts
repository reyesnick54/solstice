/**
 * AAF05 qualification gate.
 */

import type { CoverageManifest, CoverageQualificationThresholds, CoverageQualificationVerdict } from './types.ts';

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
  readonly marker:
    | typeof HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED
    | typeof HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED;
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
    blockers.push('entitlement_failure_not_zero');
  }
  if (!checks.restartPreservesCoverageState) blockers.push('restart_preserves_coverage_state');
  if (!checks.strategyEvaluationContainsCoverageEvidence) {
    blockers.push('strategy_evaluation_coverage_evidence');
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
}): CoverageQualificationVerdict {
  const blockers: string[] = [];
  if (input.manifest.metrics.coverageRatioBps < input.thresholds.minimumCoverageRatioBps) {
    blockers.push('minimum_coverage_ratio');
  }
  if (input.trainingManifest) {
    const drift =
      input.manifest.metrics.coverageDriftBps ??
      Math.abs(
        input.manifest.metrics.coverageRatioBps - input.trainingManifest.metrics.coverageRatioBps,
      );
    if (drift > input.thresholds.maximumCoverageDriftBps) {
      blockers.push('maximum_coverage_drift');
    }
  }
  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    eligibleUniverseCount: input.manifest.eligibleUniverseCount,
    usableFeatureCount: input.manifest.usableFeatureCount,
  });
}
