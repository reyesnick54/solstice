import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { CoverageBiasAssessment } from '../feature-fabric/aaf06/coverage-bias-types.ts';
import type { PointInTimeDatasetManifest } from '../feature-fabric/compiler/manifest.ts';
import type { CoverageManifest } from '../feature-fabric/feature-coverage/types.ts';
import { evaluateAdaptiveAlphaMandatoryGates, gateBlocksPromotion, type AdaptiveAlphaGateEvaluationInput } from './gates.ts';
import {
  ADAPTIVE_ALPHA_V2_SCHEMA,
  type AdaptiveAlphaControlledWarningReview,
  type AdaptiveAlphaDatasetCertification,
  type AdaptiveAlphaFailure,
  type AdaptiveAlphaQualificationPolicy,
  type AdaptiveAlphaValueOfInformationSummary,
} from './types.ts';

function certificationId(material: string): string {
  return `aaf-v2-cert:${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
}

function failuresFromVerdicts(
  verdicts: AdaptiveAlphaDatasetCertification['gateVerdicts'],
): readonly AdaptiveAlphaFailure[] {
  const out: AdaptiveAlphaFailure[] = [];
  for (const row of verdicts) {
    if (row.status === 'FAIL') {
      out.push(
        Object.freeze({
          code: `AAF_GATE_${row.gate}`,
          message: row.detail,
          gate: row.gate,
          severity: 'BLOCKING',
        }),
      );
    } else if (row.status === 'WARNING') {
      out.push(
        Object.freeze({
          code: `AAF_GATE_${row.gate}_WARNING`,
          message: row.detail,
          gate: row.gate,
          severity: 'WARNING',
        }),
      );
    }
  }
  return Object.freeze(out);
}

function buildVoiSummary(input: {
  readonly coverageManifest: CoverageManifest | null;
  readonly biasAssessment: CoverageBiasAssessment | null;
  readonly missingnessRateBps: number | null;
  readonly pitManifest: PointInTimeDatasetManifest;
}): AdaptiveAlphaValueOfInformationSummary {
  return Object.freeze({
    coverageRatioBps: input.coverageManifest?.metrics.coverageRatioBps ?? null,
    missingnessRateBps: input.missingnessRateBps,
    biasSeverity: input.biasAssessment?.severity ?? null,
    uncertaintyNotes: Object.freeze([
      input.coverageManifest === null ? 'coverage manifest missing' : 'coverage manifest sealed',
      input.biasAssessment === null ? 'bias assessment missing' : `bias severity ${input.biasAssessment.severity}`,
    ]),
    counterfactualManifestReady: input.pitManifest.observationRefs.length > 0,
  });
}

export function certifyAdaptiveAlphaDataset(input: {
  readonly pitManifest: PointInTimeDatasetManifest;
  readonly coverageManifest: CoverageManifest | null;
  readonly biasAssessment: CoverageBiasAssessment | null;
  readonly gateInput: AdaptiveAlphaGateEvaluationInput;
  readonly policy: AdaptiveAlphaQualificationPolicy;
  readonly certifiedAt: UtcInstant;
  readonly warningReview?: AdaptiveAlphaControlledWarningReview | null;
}): AdaptiveAlphaDatasetCertification {
  const gateVerdicts = evaluateAdaptiveAlphaMandatoryGates(input.gateInput);
  const blocked = gateBlocksPromotion(gateVerdicts, input.policy, input.warningReview ?? null);
  const material = JSON.stringify({
    pit: input.pitManifest.contentHash,
    coverage: input.coverageManifest?.manifestFingerprint ?? null,
    bias: input.biasAssessment?.assessmentId ?? null,
    gates: gateVerdicts,
  });
  const contentHash = createHash('sha256').update(material).digest('hex');
  const voiSummary = buildVoiSummary({
    coverageManifest: input.coverageManifest,
    biasAssessment: input.biasAssessment,
    missingnessRateBps: input.gateInput.missingnessRateBps,
    pitManifest: input.pitManifest,
  });
  return Object.freeze({
    schema: ADAPTIVE_ALPHA_V2_SCHEMA,
    certificationId: certificationId(material),
    contentHash,
    pitManifest: input.pitManifest,
    coverageManifest: input.coverageManifest,
    biasAssessment: input.biasAssessment,
    certifiedAt: input.certifiedAt,
    gateVerdicts,
    certified: !blocked,
    voiSummary,
    grantsExecutionAuthority: false,
  });
}

export function adaptiveAlphaCertificationFailures(
  certification: AdaptiveAlphaDatasetCertification,
): readonly AdaptiveAlphaFailure[] {
  return failuresFromVerdicts(certification.gateVerdicts);
}
