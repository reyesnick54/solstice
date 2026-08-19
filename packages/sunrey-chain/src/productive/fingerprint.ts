import { sha256Hex } from '../../../security/src/hash.ts';
import type { CanonicalProductiveMeasurement } from '../units/measurement.ts';
import {
  HASH_DOMAIN_PRODUCTIVE,
  HASH_DOMAIN_PRODUCTIVE_V2,
  PRODUCTIVE_FINGERPRINT_V1,
  PRODUCTIVE_FINGERPRINT_V2,
  type ClaimType,
  type ProductiveCategory,
} from './types.ts';

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

export type ContributionFingerprintV2Input = ContributionFingerprintInput & {
  readonly measurement: CanonicalProductiveMeasurement;
};

/**
 * Versioned fingerprint for newly normalized contributions. Historical
 * PRODUCTIVE_FINGERPRINT_V1 values remain unchanged.
 */
export function contributionFingerprintV2(input: ContributionFingerprintV2Input): string {
  const facts = [...input.oracleFactIds].sort().join(',');
  const upstream = [...input.upstreamContributionIds].sort().join(',');
  const quantity = input.measurement.canonicalQuantity;
  const canonical = [
    HASH_DOMAIN_PRODUCTIVE_V2,
    PRODUCTIVE_FINGERPRINT_V2,
    input.objectId,
    String(input.measurementPeriodEpoch),
    input.validFromUnixSeconds.toString(),
    input.validUntilUnixSeconds.toString(),
    input.claimType,
    input.category,
    quantity.mantissa.toString(),
    String(quantity.scale),
    quantity.numerator.toString(),
    quantity.denominator.toString(),
    input.measurement.canonicalUnit,
    input.measurement.measurementDimension,
    input.measurement.semanticQualifier,
    input.measurement.normalizationConstitutionVersion,
    input.measurement.normalizationReceiptId,
    facts,
    upstream,
  ].join('|');
  return sha256Hex(canonical);
}

export function fingerprintVersionOf(fingerprintDomain: string): typeof PRODUCTIVE_FINGERPRINT_V1 | typeof PRODUCTIVE_FINGERPRINT_V2 {
  return fingerprintDomain === HASH_DOMAIN_PRODUCTIVE_V2 ? PRODUCTIVE_FINGERPRINT_V2 : PRODUCTIVE_FINGERPRINT_V1;
}
