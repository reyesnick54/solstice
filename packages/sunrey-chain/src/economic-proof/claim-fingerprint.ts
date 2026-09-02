import { economicProofDigest } from './hash.ts';
import type {
  CanonicalEntityId,
  CanonicalEventId,
  ClaimFingerprint,
  EconomyKind,
} from './types.ts';

export type ClaimFingerprintMaterial = {
  readonly economy: EconomyKind;
  readonly canonicalEntityId: CanonicalEntityId;
  readonly canonicalEventId: CanonicalEventId;
  readonly economicAction: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string | null;
  readonly jurisdictionCommitment?: string;
  readonly categoryCommitment?: string;
};

export function asClaimFingerprint(value: string): ClaimFingerprint {
  return value as ClaimFingerprint;
}

/**
 * Consensus-safe claim identity commitment. Uses pseudonymous / committed
 * identifiers only — never raw personal data.
 */
export function deriveClaimFingerprint(material: ClaimFingerprintMaterial): ClaimFingerprint {
  return asClaimFingerprint(
    economicProofDigest([
      'claim',
      material.economy,
      material.canonicalEntityId,
      material.canonicalEventId,
      material.economicAction,
      material.quantity.toString(),
      material.unit,
      material.validFromUtc,
      material.validUntilUtc ?? '',
      material.jurisdictionCommitment ?? '',
      material.categoryCommitment ?? '',
    ]),
  );
}
