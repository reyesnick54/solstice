import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import {
  ADAPTIVE_ALPHA_V2_SCHEMA,
  type AdaptiveAlphaDatasetCertification,
  type AdaptiveAlphaEvidenceBundle,
  type AdaptiveAlphaQualificationPolicy,
} from './types.ts';

export function sealAdaptiveAlphaEvidenceBundle(input: {
  readonly certification: AdaptiveAlphaDatasetCertification;
  readonly policy: AdaptiveAlphaQualificationPolicy;
  readonly sealedAt: UtcInstant;
  readonly evidenceVaultRefs?: readonly string[];
}): AdaptiveAlphaEvidenceBundle {
  const material = JSON.stringify({
    certification: input.certification.contentHash,
    policy: input.policy.policyHash,
    sealedAt: input.sealedAt,
  });
  const bundleId = `aaf-v2-ev:${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
  return Object.freeze({
    schema: ADAPTIVE_ALPHA_V2_SCHEMA,
    bundleId,
    certification: input.certification,
    policyId: input.policy.policyId,
    policyVersion: input.policy.version,
    policyHash: input.policy.policyHash,
    evidenceVaultRefs: Object.freeze([...(input.evidenceVaultRefs ?? [])]),
    sealedAt: input.sealedAt,
    grantsExecutionAuthority: false,
  });
}

export function appendAdaptiveAlphaEvidenceToVault(
  vault: EvidenceVault,
  bundle: AdaptiveAlphaEvidenceBundle,
): string {
  const sealed = vault.seal('HELIOS_ADAPTIVE_ALPHA_V2_EVIDENCE', bundle);
  return sealed.evidenceId;
}
