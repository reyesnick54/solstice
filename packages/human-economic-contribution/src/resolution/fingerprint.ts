import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import { actorCommitmentFromAnchors, contributionResolutionFingerprintFor } from './ids.ts';
import type { AuthoritativeIdCommitment, ContributorRole, HumanEconomicIdentityId } from './types.ts';

export type ResolutionFingerprintMaterial = {
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly contributionClass: ContributionClass;
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly issuerCommitment?: string;
  readonly projectWorkIdentifier?: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly contentCommitment: string;
  readonly contributorRole?: ContributorRole;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: string;
};

/**
 * Privacy-preserving contribution fingerprint.
 *
 * Uses keyed HMAC domain separation — never naïvely hashes predictable identity
 * values. Wallet bindings and raw subject refs are excluded; only
 * humanEconomicIdentityId (derived from pre-committed actor anchors) enters
 * the fingerprint material.
 */
export function deriveContributionResolutionFingerprint(material: ResolutionFingerprintMaterial): string {
  const sortedAuthoritative = [...material.authoritativeIdCommitments].sort().join(',');
  const digestMaterial = [
    material.humanEconomicIdentityId,
    material.contributionClass,
    sortedAuthoritative,
    material.issuerCommitment ?? '',
    material.projectWorkIdentifier ?? '',
    material.validFromUtc,
    material.validUntilUtc ?? '',
    material.contentCommitment,
    material.contributorRole ?? '',
    material.measurementQuantity.toString(),
    material.measurementUnit,
  ].join('\n');
  return contributionResolutionFingerprintFor(digestMaterial);
}

/**
 * Derive a human actor commitment from pseudonymous anchors.
 * Callers must pre-hash any sensitive identifiers before passing anchors.
 */
export function deriveActorCommitment(anchors: readonly string[]): string {
  return actorCommitmentFromAnchors(anchors);
}

export function fingerprintMaterialFromObservation(input: {
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly contributionClass: ContributionClass;
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly issuerCommitment?: string;
  readonly projectWorkIdentifier?: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly contentCommitment: string;
  readonly contributorRole?: ContributorRole;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: string;
}): ResolutionFingerprintMaterial {
  return Object.freeze({ ...input });
}
