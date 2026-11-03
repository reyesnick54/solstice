import type { CoverageBiasAssessment } from '../feature-fabric/aaf06/coverage-bias-types.ts';
import type { PointInTimeDatasetManifest } from '../feature-fabric/compiler/manifest.ts';
import type { CoverageManifest } from '../feature-fabric/feature-coverage/types.ts';
import type {
  AdaptiveAlphaControlledWarningReview,
  AdaptiveAlphaGateVerdict,
  AdaptiveAlphaMandatoryGate,
  AdaptiveAlphaQualificationPolicy,
} from './types.ts';

export type AdaptiveAlphaGateEvaluationInput = {
  readonly pitManifest: PointInTimeDatasetManifest;
  readonly coverageManifest: CoverageManifest | null;
  readonly biasAssessment: CoverageBiasAssessment | null;
  readonly entityResolutionVersion: string;
  readonly pitIntegrityProven: boolean;
  readonly lineageFingerprint: string | null;
  readonly entitlementUsableRatioBps: number | null;
  readonly reproductionVerified: boolean;
  readonly missingnessPolicy: string;
  readonly missingnessRateBps: number | null;
};

function verdict(
  gate: AdaptiveAlphaMandatoryGate,
  status: AdaptiveAlphaGateVerdict['status'],
  detail: string,
): AdaptiveAlphaGateVerdict {
  return Object.freeze({ gate, status, detail });
}

export function evaluateAdaptiveAlphaMandatoryGates(
  input: AdaptiveAlphaGateEvaluationInput,
): readonly AdaptiveAlphaGateVerdict[] {
  const results: AdaptiveAlphaGateVerdict[] = [];

  results.push(
    input.pitIntegrityProven
      ? verdict('POINT_IN_TIME_INTEGRITY', 'PASS', 'point-in-time compiler integrity proven')
      : verdict('POINT_IN_TIME_INTEGRITY', 'FAIL', 'point-in-time integrity not proven'),
  );

  results.push(
    input.entityResolutionVersion.length > 0
      ? verdict('ENTITY_RESOLUTION_INTEGRITY', 'PASS', `entity resolution version ${input.entityResolutionVersion}`)
      : verdict('ENTITY_RESOLUTION_INTEGRITY', 'FAIL', 'entity resolution version missing'),
  );

  results.push(
    input.pitManifest.revisionPolicy.length > 0
      ? verdict('REVISION_INTEGRITY', 'PASS', `revision policy ${input.pitManifest.revisionPolicy}`)
      : verdict('REVISION_INTEGRITY', 'FAIL', 'revision policy missing on dataset manifest'),
  );

  results.push(
    input.lineageFingerprint && input.lineageFingerprint.length > 0
      ? verdict('FEATURE_LINEAGE_INTEGRITY', 'PASS', 'feature lineage fingerprint present')
      : verdict('FEATURE_LINEAGE_INTEGRITY', 'FAIL', 'feature lineage fingerprint missing'),
  );

  if (!input.coverageManifest) {
    results.push(verdict('COVERAGE_INTEGRITY', 'WARNING', 'coverage manifest absent'));
  } else if (input.coverageManifest.metrics.coverageRatioBps < 5000) {
    results.push(
      verdict(
        'COVERAGE_INTEGRITY',
        'FAIL',
        `coverage ratio ${input.coverageManifest.metrics.coverageRatioBps} bps below minimum`,
      ),
    );
  } else {
    results.push(
      verdict(
        'COVERAGE_INTEGRITY',
        'PASS',
        `coverage ratio ${input.coverageManifest.metrics.coverageRatioBps} bps`,
      ),
    );
  }

  if (input.missingnessRateBps === null) {
    results.push(verdict('MISSINGNESS_INTEGRITY', 'WARNING', 'missingness rate not computed'));
  } else if (input.missingnessRateBps > 3000) {
    results.push(verdict('MISSINGNESS_INTEGRITY', 'FAIL', `missingness ${input.missingnessRateBps} bps`));
  } else {
    results.push(verdict('MISSINGNESS_INTEGRITY', 'PASS', `missingness ${input.missingnessRateBps} bps`));
  }

  if (!input.biasAssessment) {
    results.push(verdict('BIAS_INTEGRITY', 'WARNING', 'bias assessment absent'));
  } else if (input.biasAssessment.severity === 'SEVERE') {
    results.push(verdict('BIAS_INTEGRITY', 'FAIL', 'statistical bias sentinel SEVERE'));
  } else if (input.biasAssessment.severity === 'WARNING') {
    results.push(verdict('BIAS_INTEGRITY', 'WARNING', 'statistical bias sentinel WARNING'));
  } else if (input.biasAssessment.severity === 'INSUFFICIENT_DATA') {
    results.push(verdict('BIAS_INTEGRITY', 'FAIL', 'insufficient data for bias assessment'));
  } else {
    results.push(verdict('BIAS_INTEGRITY', 'PASS', 'bias sentinel PASS'));
  }

  if (input.entitlementUsableRatioBps === null) {
    results.push(verdict('ENTITLEMENT_INTEGRITY', 'WARNING', 'entitlement ratio not computed'));
  } else if (input.entitlementUsableRatioBps < 8000) {
    results.push(verdict('ENTITLEMENT_INTEGRITY', 'FAIL', `entitlement usable ${input.entitlementUsableRatioBps} bps`));
  } else {
    results.push(verdict('ENTITLEMENT_INTEGRITY', 'PASS', `entitlement usable ${input.entitlementUsableRatioBps} bps`));
  }

  results.push(
    input.reproductionVerified
      ? verdict('REPRODUCIBILITY', 'PASS', 'manifest reproduction verified')
      : verdict('REPRODUCIBILITY', 'FAIL', 'manifest reproduction failed'),
  );

  return Object.freeze(results);
}

export function gateBlocksPromotion(
  verdicts: readonly AdaptiveAlphaGateVerdict[],
  policy: AdaptiveAlphaQualificationPolicy,
  warningReview?: AdaptiveAlphaControlledWarningReview | null,
): boolean {
  for (const row of verdicts) {
    if (row.status === 'FAIL') {
      return true;
    }
    if (row.status === 'WARNING') {
      if (!policy.allowWarningWithControlledReview) {
        return true;
      }
      if (!warningReview || warningReview.warningGate !== row.gate) {
        return true;
      }
    }
  }
  return false;
}
