/**
 * Hash and sign the readiness bundle with existing ReleaseAuthority.
 * Any evidence change invalidates the prior signature.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { localTestReleaseAuthority, signArtifact, verifySignature } from '../supply-chain/release.ts';
import type { MainnetReadinessReport, ReadinessBundle, ReadinessEvidenceRecord } from './types.ts';
import { evidenceRecordHash } from './evidence.ts';

export const READINESS_BUNDLE_DOMAIN = 'SUNREY_MAINNET_READINESS_BUNDLE_V1' as const;

export function canonicalEvidenceBytes(records: readonly ReadinessEvidenceRecord[]): Buffer {
  const ordered = [...records].sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  const parts = [encodeString(READINESS_BUNDLE_DOMAIN)];
  for (const row of ordered) {
    parts.push(encodeString(evidenceRecordHash(row)));
  }
  return Buffer.concat(parts);
}

export function signReadinessBundle(
  records: readonly ReadinessEvidenceRecord[],
  report: MainnetReadinessReport,
): ReadinessBundle {
  const bytes = canonicalEvidenceBytes(records);
  const { authority } = localTestReleaseAuthority();
  const signature = signArtifact(bytes, authority);
  return Object.freeze({
    bundleHash: sha256Hex(bytes),
    signature,
    report,
  });
}

export function verifyReadinessBundle(
  records: readonly ReadinessEvidenceRecord[],
  bundle: ReadinessBundle,
): boolean {
  const bytes = canonicalEvidenceBytes(records);
  if (sha256Hex(bytes) !== bundle.bundleHash) {
    return false;
  }
  const { authority } = localTestReleaseAuthority();
  return verifySignature(bytes, bundle.signature, authority);
}

export function tamperedEvidenceRejected(
  original: readonly ReadinessEvidenceRecord[],
  tampered: readonly ReadinessEvidenceRecord[],
  bundle: ReadinessBundle,
): boolean {
  return verifyReadinessBundle(original, bundle) && !verifyReadinessBundle(tampered, bundle);
}
