import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { assertAdaptiveAlphaActorMayCertify, type AdaptiveAlphaActorKind } from './authority.ts';
import { adaptiveAlphaCertificationFailures, certifyAdaptiveAlphaDataset } from './certification.ts';
import type { AdaptiveAlphaGateEvaluationInput } from './gates.ts';
import { sealAdaptiveAlphaEvidenceBundle, appendAdaptiveAlphaEvidenceToVault } from './evidence.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { CoverageBiasAssessment } from '../feature-fabric/aaf06/coverage-bias-types.ts';
import type { PointInTimeDatasetManifest } from '../feature-fabric/compiler/manifest.ts';
import type { CoverageManifest } from '../feature-fabric/feature-coverage/types.ts';
import type { AdaptiveAlphaControlledWarningReview } from './types.ts';
import {
  ADAPTIVE_ALPHA_V2_SCHEMA,
  type AdaptiveAlphaQualification,
  type AdaptiveAlphaQualificationPolicy,
} from './types.ts';

export const HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED =
  'HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED' as const;

export const HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_BLOCKED =
  'HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_BLOCKED' as const;

export type AdaptiveAlphaQualificationMarker =
  | typeof HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED
  | typeof HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_BLOCKED;

export function qualifyAdaptiveAlphaForStrategy(input: {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly pitManifest: PointInTimeDatasetManifest;
  readonly coverageManifest: CoverageManifest | null;
  readonly biasAssessment: CoverageBiasAssessment | null;
  readonly gateInput: AdaptiveAlphaGateEvaluationInput;
  readonly policy: AdaptiveAlphaQualificationPolicy;
  readonly qualifiedAt: UtcInstant;
  readonly actorKind: AdaptiveAlphaActorKind;
  readonly warningReview?: AdaptiveAlphaControlledWarningReview | null;
  readonly evidenceVault?: EvidenceVault | null;
}): AdaptiveAlphaQualification {
  const actorBlock = assertAdaptiveAlphaActorMayCertify(input.actorKind);
  const certification = certifyAdaptiveAlphaDataset({
    pitManifest: input.pitManifest,
    coverageManifest: input.coverageManifest,
    biasAssessment: input.biasAssessment,
    gateInput: input.gateInput,
    policy: input.policy,
    certifiedAt: input.qualifiedAt,
    warningReview: input.warningReview ?? null,
  });
  const failures = adaptiveAlphaCertificationFailures(certification);
  const blockedByActor = actorBlock !== null;
  const qualified = certification.certified && !blockedByActor;
  let bundle = sealAdaptiveAlphaEvidenceBundle({
    certification,
    policy: input.policy,
    sealedAt: input.qualifiedAt,
  });
  if (input.evidenceVault) {
    const ref = appendAdaptiveAlphaEvidenceToVault(input.evidenceVault, bundle);
    bundle = sealAdaptiveAlphaEvidenceBundle({
      certification,
      policy: input.policy,
      sealedAt: input.qualifiedAt,
      evidenceVaultRefs: Object.freeze([ref]),
    });
  }
  const material = `${input.strategyId}|${input.strategyVersion}|${certification.contentHash}|${input.policy.policyHash}`;
  const qualificationId = `aaf-v2-ql:${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
  const allFailures = blockedByActor && actorBlock ? Object.freeze([actorBlock, ...failures]) : failures;
  return Object.freeze({
    schema: ADAPTIVE_ALPHA_V2_SCHEMA,
    qualificationId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    certification,
    evidenceBundle: bundle,
    qualified,
    promotionPermitted: qualified,
    failures: allFailures,
    grantsExecutionAuthority: false,
  });
}

export function adaptiveAlphaQualificationMarker(
  qualification: AdaptiveAlphaQualification,
): AdaptiveAlphaQualificationMarker {
  return qualification.qualified
    ? HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED
    : HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_BLOCKED;
}
