import { sha256Hex } from '../../../security/src/hash.ts';
import { HASH_DOMAIN_PRODUCTIVE, type ClaimType, type ProductiveCategory } from './types.ts';

export type ContributionFingerprintInput = {
  readonly objectId: string;
  readonly measurementPeriodEpoch: number;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly claimType: ClaimType;
  readonly category: ProductiveCategory;
  readonly normalizedQuantity: bigint;
  readonly baseUnitId: string;
  readonly oracleFactIds: readonly string[];
  readonly upstreamContributionIds: readonly string[];
};

/**
 * Deterministic economic lineage fingerprint. Duplicate submissions of
 * the same productive event — including through a different claim id —
 * hash to the same value.
 */
export function contributionFingerprint(input: ContributionFingerprintInput): string {
  const facts = [...input.oracleFactIds].sort().join(',');
  const upstream = [...input.upstreamContributionIds].sort().join(',');
  const canonical = [
    HASH_DOMAIN_PRODUCTIVE,
    input.objectId,
    String(input.measurementPeriodEpoch),
    input.validFromUnixSeconds.toString(),
    input.validUntilUnixSeconds.toString(),
    input.claimType,
    input.category,
    input.normalizedQuantity.toString(),
    input.baseUnitId,
    facts,
    upstream,
  ].join('|');
  return sha256Hex(canonical);
}
