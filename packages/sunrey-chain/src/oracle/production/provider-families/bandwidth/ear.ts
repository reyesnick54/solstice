/**
 * Economic Asset Registry projection for bandwidth source datasets.
 * Raw network traffic records are never stored.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { asUtcInstant } from '../../../../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  controllerRefFor,
  operatorRefFor,
  projectDescriptor,
  scanForbiddenPayload,
  sourceOrganizationRefFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../../../../economic-asset-registry/src/index.ts';
import type { BandwidthEconomicRecord } from './types.ts';
import { economicRecordOmitsPayloads } from './privacy.ts';

export function mapBandwidthRecordToEconomicAsset(
  record: BandwidthEconomicRecord,
): Result<RegisterAssetInput, RegistryFailure> {
  if (!economicRecordOmitsPayloads(record)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'bandwidth projection cannot store traffic payloads' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `bandwidth:${record.identity.networkServiceRef}:${record.schemaId}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(record.identity.controllerRef),
    sourceSchemaVersion: `${record.schemaId}:${record.usageSchemaVersion}`,
    controllerRef: controllerRefFor(record.identity.controllerRef),
    operatorRef: operatorRefFor(record.identity.controllerRef),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'BANDWIDTH_COMMUNICATIONS',
    contentCommitmentMaterial: `bandwidth-meta:${record.identity.trafficAggregateRef}:${record.receipt.receiptId}`.slice(0, 256),
    provenanceMaterial: `bandwidth-prov:${record.sourceClass}:${record.factType}:${record.schemaId}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: 'REGISTERED',
    createdAt: asUtcInstant('2026-08-19T00:00:00.000Z'),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function projectBandwidthMetadata(
  registry: EconomicAssetRegistryPort,
  record: BandwidthEconomicRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapBandwidthRecordToEconomicAsset(record);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
