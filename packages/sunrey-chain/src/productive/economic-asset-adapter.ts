import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  controllerRefFor,
  operatorRefFor,
  projectDescriptor,
  reflectSourceLifecycle,
  rightsHolderRefFor,
  scanForbiddenPayload,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type EconomicCategory,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../economic-asset-registry/src/index.ts';
import type { ProductiveClaim } from './claims.ts';
import type { ProductiveEconomicObject } from './objects.ts';
import type { ProductiveCategory } from './types.ts';
import type { VerifiedProductiveContribution } from './verification.ts';

const OWNER = CANONICAL_SYSTEM_OWNERS.productive;

/**
 * Maps productive objects, claims, and verified contributions into
 * master registry descriptors. The productive engine remains
 * authoritative for contribution eligibility.
 */
export class ProductiveEconomicAssetAdapter {
  readonly registry: EconomicAssetRegistryPort;

  constructor(registry: EconomicAssetRegistryPort) {
    this.registry = registry;
  }

  projectObject(object: ProductiveEconomicObject, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapProductiveObject(object, at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok) {
      return projected;
    }
    if (object.status === 'SUSPENDED') {
      return this.registry.suspend(projected.value.assetId, at);
    }
    if (object.status === 'SUPERSEDED' || object.status === 'EXPIRED') {
      return this.registry.restrict(projected.value.assetId, at);
    }
    return projected;
  }

  projectClaim(input: {
    readonly claim: ProductiveClaim;
    readonly objectAssetId?: EconomicAssetDescriptor['assetId'] | undefined;
    readonly factAssetId?: EconomicAssetDescriptor['assetId'] | undefined;
    readonly at: UtcInstant;
  }): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapProductiveClaim(input.claim, input.at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok) {
      return projected;
    }
    let current = projected.value;
    if (input.objectAssetId) {
      const linked = this.registry.addLineage({
        fromAssetId: current.assetId,
        toAssetId: input.objectAssetId,
        kind: 'DERIVED_FROM',
        at: input.at,
      });
      if (!linked.ok) {
        return linked;
      }
      current = linked.value;
    }
    if (input.factAssetId) {
      const verified = this.registry.addLineage({
        fromAssetId: current.assetId,
        toAssetId: input.factAssetId,
        kind: 'VERIFIED_BY',
        at: input.at,
      });
      if (!verified.ok) {
        return verified;
      }
      current = verified.value;
    }
    if (input.claim.status === 'SUPERSEDED') {
      return this.registry.restrict(current.assetId, input.at);
    }
    return ok(current);
  }

  projectContribution(input: {
    readonly contribution: VerifiedProductiveContribution;
    readonly claimAssetId?: EconomicAssetDescriptor['assetId'];
    readonly at: UtcInstant;
  }): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapProductiveContribution(input.contribution, input.at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !input.claimAssetId) {
      return projected;
    }
    return this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: input.claimAssetId,
      kind: 'CONTRIBUTED_TO',
      at: input.at,
    });
  }

  reflectClaimSupersession(claimId: string, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    return reflectSourceLifecycle(this.registry, OWNER, claimId, 'RESTRICTED', at);
  }
}

export function createProductiveEconomicAssetAdapter(
  registry: EconomicAssetRegistryPort,
): ProductiveEconomicAssetAdapter {
  return new ProductiveEconomicAssetAdapter(registry);
}

export function mapProductiveObject(
  object: ProductiveEconomicObject,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  if (hasIndustrialPayload(object.capacityMetadata)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'productive projection cannot include industrial raw payloads' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'PRODUCTIVE_ECONOMIC_OBJECT',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: object.objectId,
    sourceClass: 'PRODUCTIVE_OBJECT_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(object.schemaVersion),
    controllerRef: controllerRefFor(object.controller),
    operatorRef: operatorRefFor(object.operator),
    rightsHolderRefs: [rightsHolderRefFor(object.owner)],
    jurisdiction: codedJurisdiction(object.geography.jurisdiction),
    geography: object.geography.geographyId,
    rightsConcepts: ['CONTROLLER_RIGHTS', 'USAGE_RIGHTS'],
    sensitivityClass: 'CONFIDENTIAL',
    qualityClass: 'ATTESTED',
    freshness: object.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    validFrom: unixToUtc(object.validFromUnixSeconds),
    validUntil: object.validUntilUnixSeconds === null ? null : unixToUtc(object.validUntilUnixSeconds),
    economicCategory: asEconomicCategory(object.category),
    contentCommitmentMaterial: `prod-obj:${object.objectId}:${object.provenance}`.slice(0, 256),
    provenanceMaterial: `prod-obj-prov:${object.rightsReference}:${object.unitSchema}`.slice(0, 256),
    storageClass: 'ON_CHAIN_PUBLIC_METADATA',
    status: object.status === 'SUSPENDED' ? 'SUSPENDED' : object.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapProductiveClaim(claim: ProductiveClaim, at: UtcInstant): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'PRODUCTIVE_CLAIM',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: claim.claimId,
    sourceClass: 'PRODUCTIVE_CLAIM_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(claim.schemaVersion),
    controllerRef: controllerRefFor(claim.controller),
    jurisdiction: codedJurisdiction(claim.geography.jurisdiction),
    geography: claim.geography.geographyId,
    rightsConcepts: ['CONTROLLER_RIGHTS', 'USAGE_RIGHTS'],
    sensitivityClass: 'CONFIDENTIAL',
    qualityClass: claim.status === 'VERIFIED' ? 'VERIFIED' : 'ATTESTED',
    freshness: claim.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    validFrom: unixToUtc(claim.measurementPeriod.validFromUnixSeconds),
    validUntil: unixToUtc(claim.measurementPeriod.validUntilUnixSeconds),
    economicCategory: asEconomicCategory(claim.category),
    contentCommitmentMaterial: `prod-claim:${claim.claimId}:${claim.objectId}:${claim.unit}`.slice(0, 256),
    provenanceMaterial: `prod-claim-prov:${claim.oracleFactIds.join(',')}:${claim.rightsReferences.join(',')}`.slice(0, 256),
    storageClass: 'ON_CHAIN_COMMITMENT_ONLY',
    status: claim.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapProductiveContribution(
  contribution: VerifiedProductiveContribution,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: contribution.contributionId,
    sourceClass: 'PRODUCTIVE_CLAIM_REGISTRY',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(contribution.schemaVersion),
    controllerRef: controllerRefFor(contribution.controller),
    jurisdiction: codedJurisdiction(contribution.geography.jurisdiction),
    geography: contribution.geography.geographyId,
    rightsConcepts: ['CONTROLLER_RIGHTS'],
    sensitivityClass: 'CONFIDENTIAL',
    qualityClass: 'VERIFIED',
    freshness: contribution.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    validFrom: unixToUtc(contribution.measurementPeriod.validFromUnixSeconds),
    validUntil: unixToUtc(contribution.measurementPeriod.validUntilUnixSeconds),
    economicCategory: asEconomicCategory(contribution.category),
    contentCommitmentMaterial: `prod-contrib:${contribution.contributionId}:${contribution.fingerprint}`.slice(0, 256),
    provenanceMaterial: `prod-contrib-prov:${contribution.claimId}:${contribution.objectId}`.slice(0, 256),
    storageClass: 'ON_CHAIN_COMMITMENT_ONLY',
    status: contribution.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

function asEconomicCategory(category: ProductiveCategory): EconomicCategory {
  return category;
}

function codedJurisdiction(value: string): string {
  if (/^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(value)) {
    return value;
  }
  return 'US-SIM';
}

function unixToUtc(seconds: bigint): UtcInstant {
  return asUtcInstant(new Date(Number(seconds) * 1000).toISOString());
}

function hasIndustrialPayload(metadata: Readonly<Record<string, string>>): boolean {
  const text = Object.values(metadata).join(' ');
  return /scada|mes raw|telemetry payload|factory credential/i.test(text);
}
