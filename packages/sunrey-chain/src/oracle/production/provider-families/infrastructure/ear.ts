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
import type { InfrastructureEvidenceRecord } from './types.ts';

export function mapInfrastructureRecordToEconomicAsset(
  record: InfrastructureEvidenceRecord,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `infrastructure:${record.observation.observationId}:${record.observation.sourceClass}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(record.observation.controllerId),
    sourceSchemaVersion: `${record.observation.sourceClass}:2`,
    controllerRef: controllerRefFor(record.observation.controllerId),
    operatorRef: operatorRefFor(record.observation.operatorPartyId),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'INFRASTRUCTURE',
    contentCommitmentMaterial: `infrastructure-meta:${record.observation.observationId}:${record.observation.factType}`.slice(0, 256),
    provenanceMaterial: `infrastructure-prov:${record.observation.sourceClass}:${record.observation.infrastructureClass}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: 'REGISTERED',
    createdAt: asUtcInstant('2026-08-19T00:00:00.000Z'),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  const encoded = JSON.stringify(payload).toLowerCase();
  if (encoded.includes('tenant') || encoded.includes('accesslog') || encoded.includes('lease document')) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'infrastructure projection stores references only' });
  }
  return ok(payload);
}

export function projectInfrastructureMetadata(
  registry: EconomicAssetRegistryPort,
  record: InfrastructureEvidenceRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapInfrastructureRecordToEconomicAsset(record);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
