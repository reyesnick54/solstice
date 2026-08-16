import type { RightObject } from '../protocol/rights.ts';
import type { ProductiveClaim } from './claims.ts';
import { periodIsDefined } from './claims.ts';
import { contributionFingerprint } from './fingerprint.ts';
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
  PRODUCTIVE_SCHEMA_VERSION,
  type ContributionStatus,
  type ProductiveRejectionCode,
} from './types.ts';
import { defaultUnitRegistry, type UnitRegistry } from './units.ts';

export type VerifiedProductiveContribution = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
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
  readonly upstreamContributionIds: readonly string[];
  readonly downstreamContributionIds: readonly string[];
  readonly status: ContributionStatus;
  readonly qualityFactor: bigint;
};

export type VerificationContext = {
  readonly height: number;
  readonly blockTimeUnixSeconds: bigint;
  readonly object: ProductiveEconomicObject | undefined;
  readonly rights: readonly RightObject[];
  readonly facts: readonly OracleFact[];
  readonly policy: MoonReyIssuancePolicy;
  readonly knownFingerprints: ReadonlySet<string>;
  readonly unitRegistry?: UnitRegistry;
};

export type VerificationResult =
  | { readonly ok: true; readonly contribution: VerifiedProductiveContribution }
  | { readonly ok: false; readonly code: ProductiveRejectionCode };

export function verifyProductiveClaim(
  claim: ProductiveClaim,
  context: VerificationContext,
): VerificationResult {
  const units = context.unitRegistry ?? defaultUnitRegistry;
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
  const normalized = units.normalize(claim.category, claim.unit, claim.quantity);
  if (!normalized || !units.isAllowed(context.object.category, claim.unit)) {
    return { ok: false, code: 'UNIT_MISMATCH' };
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
  const fingerprint = contributionFingerprint({
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
  });
  if (context.knownFingerprints.has(fingerprint)) {
    return { ok: false, code: 'DUPLICATE_CONTRIBUTION' };
  }
  return {
    ok: true,
    contribution: Object.freeze({
      schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
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
      upstreamContributionIds: [...claim.upstreamContributionIds],
      downstreamContributionIds: [],
      status: 'ELIGIBLE',
      qualityFactor,
    }),
  };
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
