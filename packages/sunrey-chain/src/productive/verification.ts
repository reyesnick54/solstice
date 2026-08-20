import type { RightObject } from '../protocol/rights.ts';
import type { CanonicalProductiveMeasurement } from '../units/measurement.ts';
import { integralCanonicalQuantity } from '../units/measurement.ts';
import type { ProductiveClaim } from './claims.ts';
import { periodIsDefined } from './claims.ts';
import { contributionFingerprint, contributionFingerprintV2 } from './fingerprint.ts';
import { objectIsActive, type ProductiveEconomicObject } from './objects.ts';
import {
  detectConflicts,
  distinctOracleSources,
  factIsConflicted,
  factIsStale,
  type OracleFact,
} from './oracle.ts';
import type { MoonReyIssuancePolicy } from './policy.ts';
import {
  PRODUCTIVE_CONTRIBUTION_SCHEMA_V1,
  PRODUCTIVE_CONTRIBUTION_SCHEMA_V2,
  PRODUCTIVE_FINGERPRINT_V1,
  PRODUCTIVE_FINGERPRINT_V2,
  PRODUCTIVE_SCHEMA_VERSION,
  type ContributionStatus,
  type ProductiveRejectionCode,
} from './types.ts';
import { defaultUnitRegistry, type UnitRegistry } from './units.ts';

export type VerifiedProductiveContribution = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION | typeof PRODUCTIVE_CONTRIBUTION_SCHEMA_V2;
  readonly contributionId: string;
  readonly claimId: string;
  readonly objectId: string;
  readonly claimType: ProductiveClaim['claimType'];
  readonly category: ProductiveClaim['category'];
  readonly quantity: bigint;
  readonly unit: string;
  readonly normalizedQuantity: bigint;
  readonly baseUnitId: string;
  readonly measurementPeriod: ProductiveClaim['measurementPeriod'];
  readonly geography: ProductiveClaim['geography'];
  readonly oracleFactIds: readonly string[];
  readonly rightsReferences: readonly string[];
  readonly controller: string;
  readonly fingerprint: string;
  readonly fingerprintVersion: typeof PRODUCTIVE_FINGERPRINT_V1 | typeof PRODUCTIVE_FINGERPRINT_V2;
  readonly upstreamContributionIds: readonly string[];
  readonly downstreamContributionIds: readonly string[];
  readonly status: ContributionStatus;
  readonly qualityFactor: bigint;
  readonly normalizationConstitutionVersion?: string | undefined;
  readonly normalizationReceiptId?: string | undefined;
  readonly canonicalUnit?: string | undefined;
  readonly canonicalMeasurement?: CanonicalProductiveMeasurement | undefined;
};

export type VerificationContext = {
  readonly height: number;
  readonly blockTimeUnixSeconds: bigint;
  readonly object: ProductiveEconomicObject | undefined;
  readonly rights: readonly RightObject[];
  readonly facts: readonly OracleFact[];
  readonly policy: MoonReyIssuancePolicy;
  readonly knownFingerprints: ReadonlySet<string>;
  readonly unitRegistry?: UnitRegistry | undefined;
  readonly canonicalMeasurement?: CanonicalProductiveMeasurement | undefined;
  readonly contributionSchema?: 1 | 2 | undefined;
  readonly normalizationFamily?: 'LEGACY_NPU_V1' | 'CANONICAL_MEASUREMENT_V2' | undefined;
};

export type VerificationResult =
  | { readonly ok: true; readonly contribution: VerifiedProductiveContribution }
  | { readonly ok: false; readonly code: ProductiveRejectionCode };

export function verifyProductiveClaim(
  claim: ProductiveClaim,
  context: VerificationContext,
): VerificationResult {
  const units = context.unitRegistry ?? defaultUnitRegistry;
  const measurement = context.canonicalMeasurement ?? claim.canonicalMeasurement;
  const newContribution =
    context.contributionSchema === 2 ||
    claim.contributionSchema === 2 ||
    context.normalizationFamily === 'CANONICAL_MEASUREMENT_V2' ||
    measurement !== undefined;
  if (!context.object) {
    return { ok: false, code: 'UNREGISTERED_OBJECT' };
  }
  if (!objectIsActive(context.object, context.height, context.blockTimeUnixSeconds)) {
    return { ok: false, code: 'OBJECT_NOT_ACTIVE' };
  }
  if (context.policy.activationHeight > context.height) {
    return { ok: false, code: 'POLICY_NOT_ACTIVE' };
  }
  if (!context.policy.eligibleCategories.includes(claim.category)) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CATEGORY' };
  }
  if (!periodIsDefined(claim.measurementPeriod)) {
    return { ok: false, code: 'MEASUREMENT_PERIOD_UNDEFINED' };
  }
  if (newContribution && context.normalizationFamily === 'LEGACY_NPU_V1') {
    return { ok: false, code: 'LEGACY_NORMALIZATION_NOT_ALLOWED_FOR_NEW_CONTRIBUTION' };
  }
  if (newContribution && !measurement) {
    return { ok: false, code: 'CANONICAL_UNIT_REQUIRED' };
  }
  if (measurement) {
    if (measurement.normalizationConstitutionVersion !== measurement.receipt.conversionVersion) {
      return { ok: false, code: 'NORMALIZATION_VERSION_MISMATCH' };
    }
    if (!measurement.normalizationReceiptId) {
      return { ok: false, code: 'NORMALIZATION_RECEIPT_REQUIRED' };
    }
    if (measurement.factType === 'REFERENCE_PRICE') {
      return { ok: false, code: 'FACT_UNIT_MISMATCH' };
    }
    if (measurement.productiveCategory !== claim.category) {
      return { ok: false, code: 'CLAIM_UNIT_MISMATCH' };
    }
    if (measurement.sourceUnit !== claim.unit) {
      return { ok: false, code: 'CLAIM_UNIT_MISMATCH' };
    }
    if (measurement.lossy || measurement.roundingApplied || !measurement.exact) {
      return { ok: false, code: 'LOSSY_NORMALIZATION_FORBIDDEN' };
    }
  }
  const normalized = measurement
    ? canonicalizeForContribution(measurement)
    : units.normalize(claim.category, claim.unit, claim.quantity);
  if (!normalized || (!measurement && !units.isAllowed(context.object.category, claim.unit))) {
    return { ok: false, code: measurement ? 'LOSSY_NORMALIZATION_FORBIDDEN' : 'UNIT_MISMATCH' };
  }
  if (claim.category !== context.object.category) {
    return { ok: false, code: 'UNIT_MISMATCH' };
  }
  if (claim.rightsReferences.length === 0) {
    return { ok: false, code: 'MISSING_RIGHTS' };
  }
  const rightsOk = evaluateRights(claim, context);
  if (rightsOk !== true) {
    return { ok: false, code: rightsOk };
  }
  const facts = context.facts.filter((fact) => claim.oracleFactIds.includes(fact.factId));
  if (facts.some((fact) => factIsStale(fact, context.blockTimeUnixSeconds))) {
    return { ok: false, code: 'STALE_ORACLE_FACT' };
  }
  if (facts.some((fact) => factIsConflicted(fact)) || detectConflicts(facts).length > 0) {
    return { ok: false, code: 'CONFLICTED_ORACLE_FACT' };
  }
  if (distinctOracleSources(facts).length < context.policy.minimumOracleQuorum) {
    return { ok: false, code: 'INSUFFICIENT_ORACLE_QUORUM' };
  }
  if (facts.some((fact) => fact.quality < context.policy.requiredFactQuality)) {
    return { ok: false, code: 'QUALITY_BELOW_MINIMUM' };
  }
  const qualityFactor = medianQuality(facts);
  const fingerprintInput = {
    objectId: claim.objectId,
    measurementPeriodEpoch: claim.measurementPeriod.epoch,
    validFromUnixSeconds: claim.measurementPeriod.validFromUnixSeconds,
    validUntilUnixSeconds: claim.measurementPeriod.validUntilUnixSeconds,
    claimType: claim.claimType,
    category: claim.category,
    normalizedQuantity: normalized.normalizedQuantity,
    baseUnitId: normalized.baseUnitId,
    oracleFactIds: claim.oracleFactIds,
    upstreamContributionIds: claim.upstreamContributionIds,
  };
  const fingerprint = measurement
    ? contributionFingerprintV2({ ...fingerprintInput, measurement })
    : contributionFingerprint(fingerprintInput);
  if (context.knownFingerprints.has(fingerprint)) {
    return { ok: false, code: 'DUPLICATE_CONTRIBUTION' };
  }
  return {
    ok: true,
    contribution: Object.freeze({
      schemaVersion: measurement ? PRODUCTIVE_CONTRIBUTION_SCHEMA_V2 : PRODUCTIVE_CONTRIBUTION_SCHEMA_V1,
      contributionId: `vpc.${fingerprint.slice(0, 32)}`,
      claimId: claim.claimId,
      objectId: claim.objectId,
      claimType: claim.claimType,
      category: claim.category,
      quantity: claim.quantity,
      unit: claim.unit,
      normalizedQuantity: normalized.normalizedQuantity,
      baseUnitId: normalized.baseUnitId,
      measurementPeriod: claim.measurementPeriod,
      geography: claim.geography,
      oracleFactIds: [...claim.oracleFactIds].sort(),
      rightsReferences: [...claim.rightsReferences],
      controller: claim.controller,
      fingerprint,
      fingerprintVersion: measurement ? PRODUCTIVE_FINGERPRINT_V2 : PRODUCTIVE_FINGERPRINT_V1,
      upstreamContributionIds: [...claim.upstreamContributionIds],
      downstreamContributionIds: [],
      status: 'ELIGIBLE',
      qualityFactor,
      ...(measurement
        ? {
            normalizationConstitutionVersion: measurement.normalizationConstitutionVersion,
            normalizationReceiptId: measurement.normalizationReceiptId,
            canonicalUnit: measurement.canonicalUnit,
            canonicalMeasurement: measurement,
          }
        : {}),
    }),
  };
}

function canonicalizeForContribution(
  measurement: CanonicalProductiveMeasurement,
): { readonly normalizedQuantity: bigint; readonly baseUnitId: string } | null {
  const integer = integralCanonicalQuantity(measurement);
  if (!integer.ok) {
    return null;
  }
  return Object.freeze({
    normalizedQuantity: integer.value,
    baseUnitId: measurement.canonicalUnit,
  });
}

function evaluateRights(
  claim: ProductiveClaim,
  context: VerificationContext,
): true | ProductiveRejectionCode {
  const matching = context.rights.filter((right) => claim.rightsReferences.includes(right.rightId));
  if (matching.length === 0) {
    return 'MISSING_RIGHTS';
  }
  for (const right of matching) {
    if (right.revocationState === 'REVOKED') {
      return 'RIGHTS_REVOKED';
    }
    if (
      right.expirationUnixSeconds !== 0n &&
      right.expirationUnixSeconds < context.blockTimeUnixSeconds
    ) {
      return 'RIGHTS_EXPIRED';
    }
    if (right.objectId !== claim.objectId) {
      return 'MISSING_RIGHTS';
    }
    if (right.holderId !== claim.controller && right.holderId !== context.object?.controller) {
      return 'MISSING_RIGHTS';
    }
  }
  return true;
}

function medianQuality(facts: readonly OracleFact[]): bigint {
  const qualities = facts.map((fact) => fact.quality).sort((left, right) => (left < right ? -1 : 1));
  if (qualities.length === 0) {
    return 0n;
  }
  const mid = Math.floor(qualities.length / 2);
  const upper = qualities[mid] ?? 0n;
  if (qualities.length % 2 === 1) {
    return upper;
  }
  const lower = qualities[mid - 1] ?? upper;
  return (lower + upper) / 2n;
}
