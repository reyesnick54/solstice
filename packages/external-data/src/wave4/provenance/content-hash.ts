/**
 * Deterministic content hashing for provenance commitments.
 * Privacy-sensitive values use salted commitments — never public low-entropy hashes.
 */

import { hashRawPayload, canonicalJsonStringify } from '../../../../provider-sdk/src/hash.ts';
import { sha256Hex } from '../../../../security/src/hash.ts';

export type ContentCommitment = {
  readonly algorithm: 'sha256';
  readonly digest: string;
  readonly kind: 'public' | 'salted';
};

const LOW_ENTROPY_PATTERN = /^(?:\d{4,6}|\d{3}-\d{2}-\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

/**
 * Hash canonical JSON for public commitments (non-sensitive structured data).
 */
export function commitPublicContent(value: unknown): ContentCommitment {
  return Object.freeze({
    algorithm: 'sha256',
    digest: hashRawPayload(canonicalJsonStringify(value)).digest,
    kind: 'public',
  });
}

/**
 * Salted commitment for privacy-sensitive or potentially low-entropy values.
 * The salt never appears in event payloads — only the commitment digest is stored.
 */
export function commitSensitiveValue(value: string, salt: string): ContentCommitment {
  if (value.length === 0) {
    throw new TypeError('cannot commit empty sensitive value');
  }
  const kind = LOW_ENTROPY_PATTERN.test(value) ? 'salted' : 'salted';
  return Object.freeze({
    algorithm: 'sha256',
    digest: sha256Hex(`${salt}|${value}`),
    kind,
  });
}

/**
 * Transformation commitment: hashes the transformation descriptor and input
 * commitments — not raw secrets.
 */
export function commitTransformation(input: {
  readonly transformationKind: string;
  readonly inputCommitments: readonly string[];
  readonly outputCommitment: string;
  readonly normalizationVersion: string;
}): ContentCommitment {
  const material = [
    input.transformationKind,
    input.normalizationVersion,
    ...[...input.inputCommitments].sort(),
    input.outputCommitment,
  ].join('|');
  return Object.freeze({
    algorithm: 'sha256',
    digest: sha256Hex(material),
    kind: 'public',
  });
}
