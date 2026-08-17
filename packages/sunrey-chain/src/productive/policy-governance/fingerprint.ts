import { sha256Hex } from '../../../../security/src/hash.ts';
import { contributionFingerprint, type ContributionFingerprintInput } from '../fingerprint.ts';
import type { ClaimType, ProductiveCategory } from '../types.ts';
import {
  CAPACITY_OUTPUT_DOMAIN,
  CROSS_CATEGORY_DOMAIN,
  POLICY_GOVERNANCE_DOMAIN,
} from './types.ts';

export type GovernedFingerprintInput = ContributionFingerprintInput & {
  readonly actorId: string;
  readonly deliveryFromUnixSeconds: bigint;
  readonly deliveryUntilUnixSeconds: bigint;
  readonly claimLineage: readonly string[];
};

/**
 * Strengthened contribution fingerprint. Existing v1 fingerprints remain
 * authoritative for the Chunk 44 issuance engine. This v2 print adds actor,
 * delivery window, and explicit claim lineage.
 */
export function governedContributionFingerprint(input: GovernedFingerprintInput): string {
  const v1 = contributionFingerprint(input);
  const lineage = [...input.claimLineage].sort().join(',');
  const canonical = [
    POLICY_GOVERNANCE_DOMAIN,
    v1,
    input.actorId,
    input.deliveryFromUnixSeconds.toString(),
    input.deliveryUntilUnixSeconds.toString(),
    lineage,
  ].join('|');
  return sha256Hex(canonical);
}

/**
 * Same productive event across categories. Category is excluded so a single
 * event cannot receive full independent credit unless a governed allocation
 * rule is present.
 */
export function crossCategoryEventFingerprint(input: {
  readonly objectId: string;
  readonly measurementPeriodEpoch: number;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly deliveryFromUnixSeconds: bigint;
  readonly deliveryUntilUnixSeconds: bigint;
  readonly actorId: string;
  readonly oracleFactIds: readonly string[];
  readonly claimLineage: readonly string[];
}): string {
  const facts = [...input.oracleFactIds].sort().join(',');
  const lineage = [...input.claimLineage].sort().join(',');
  return sha256Hex(
    [
      CROSS_CATEGORY_DOMAIN,
      input.objectId,
      String(input.measurementPeriodEpoch),
      input.validFromUnixSeconds.toString(),
      input.validUntilUnixSeconds.toString(),
      input.deliveryFromUnixSeconds.toString(),
      input.deliveryUntilUnixSeconds.toString(),
      input.actorId,
      facts,
      lineage,
    ].join('|'),
  );
}

/**
 * Same asset's capacity, output, and delivery for one economic event.
 */
export function capacityOutputEventFingerprint(input: {
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly measurementPeriodEpoch: number;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
}): string {
  return sha256Hex(
    [
      CAPACITY_OUTPUT_DOMAIN,
      input.objectId,
      input.category,
      String(input.measurementPeriodEpoch),
      input.validFromUnixSeconds.toString(),
      input.validUntilUnixSeconds.toString(),
    ].join('|'),
  );
}

export function claimTypeOfEvent(claimType: ClaimType): 'CAPACITY' | 'OUTPUT' | 'DELIVERY' | 'OTHER' {
  if (claimType === 'CAPACITY' || claimType === 'OUTPUT' || claimType === 'DELIVERY') {
    return claimType;
  }
  return 'OTHER';
}
