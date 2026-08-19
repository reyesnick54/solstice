import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  controllerRefFor,
  projectDescriptor,
  rightsHolderRefFor,
  scanForbiddenPayload,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistry,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../../../economic-asset-registry/src/index.ts';
import { eventIdentityCannotAuthorizeIssuance } from './event.ts';
import type { ProductiveEconomicEvent } from './types.ts';

const OWNER = CANONICAL_SYSTEM_OWNERS.productive;

/**
 * Optional Economic Asset Registry projection for event identity.
 * Metadata and lineage only. The registry remains an index.
 */
export function mapEconomicEventAsset(
  event: ProductiveEconomicEvent,
  at: UtcInstant,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ECONOMIC_ATTESTATION',
    domain: 'PRODUCTIVE_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: event.eventId,
    sourceClass: 'DERIVED_PROJECTION',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(event.schemaVersion),
    controllerRef: controllerRefFor(event.controllerRefs[0] ?? event.eventId),
    rightsHolderRefs: [rightsHolderRefFor(event.eventId)],
    jurisdiction: codedJurisdiction(event.jurisdiction),
    geography: event.geography,
    rightsConcepts: ['CONTROLLER_RIGHTS'],
    sensitivityClass: 'CONFIDENTIAL',
    qualityClass: event.status === 'VERIFIED' ? 'VERIFIED' : 'ATTESTED',
    freshness: event.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT',
    validFrom: unixToUtc(event.measurementPeriod.validFromUnixSeconds),
    validUntil: unixToUtc(event.measurementPeriod.validUntilUnixSeconds),
    economicCategory: 'MANUFACTURING',
    contentCommitmentMaterial: `econ-event:${event.eventId}:${event.eventFingerprint}`.slice(0, 256),
    provenanceMaterial: `econ-event-prov:${event.evidenceDigest}:${event.lineageRoot}`.slice(0, 256),
    storageClass: 'DERIVED_REBUILDABLE',
    status: event.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function projectEconomicEvent(
  registry: EconomicAssetRegistryPort,
  event: ProductiveEconomicEvent,
  at: UtcInstant,
  related?: {
    readonly claimAssetId?: EconomicAssetDescriptor['assetId'];
    readonly contributionAssetId?: EconomicAssetDescriptor['assetId'];
    readonly objectAssetId?: EconomicAssetDescriptor['assetId'];
  },
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapEconomicEventAsset(event, at);
  if (!mapped.ok) {
    return mapped;
  }
  const projected = projectDescriptor(registry, mapped.value);
  if (!projected.ok) {
    return projected;
  }
  let current = projected.value;
  const links: Array<{ readonly id: EconomicAssetDescriptor['assetId'] | undefined; readonly kind: 'DERIVED_FROM' | 'CONTRIBUTED_TO' | 'TRANSFORMED_FROM' }> = [
    { id: related?.objectAssetId, kind: 'DERIVED_FROM' },
    { id: related?.claimAssetId, kind: 'DERIVED_FROM' },
    { id: related?.contributionAssetId, kind: 'CONTRIBUTED_TO' },
  ];
  for (const link of links) {
    if (!link.id) {
      continue;
    }
    const next = registry.addLineage({
      fromAssetId: current.assetId,
      toAssetId: link.id,
      kind: link.kind,
      at,
    });
    if (!next.ok) {
      return next;
    }
    current = next.value;
  }
  return ok(current);
}

export function eventProjectionCannotMint(
  registry: EconomicAssetRegistry,
  descriptor: EconomicAssetDescriptor,
): false {
  return registry.authorizeMint(descriptor).authorized;
}

export function eventProjectionAuthorizesIssuance(event: ProductiveEconomicEvent): false {
  return eventIdentityCannotAuthorizeIssuance(event);
}

export function defaultProjectionInstant(): UtcInstant {
  return asUtcInstant('2026-08-19T12:00:00.000Z');
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

export function refuseMissingRegistry(): Result<never, RegistryFailure> {
  return err({
    code: 'ASSET_NOT_FOUND',
    message: 'Economic Asset Registry projection is optional and never a minting dependency',
  });
}
