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
import { economicRecordOmitsPersonLevel } from './privacy.ts';
import type { RealEstateEvidenceRecord } from './types.ts';

export function mapRealEstateRecordToEconomicAsset(
  record: RealEstateEvidenceRecord,
): Result<RegisterAssetInput, RegistryFailure> {
  if (!economicRecordOmitsPersonLevel(record)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'real-estate projection cannot store tenant or access histories' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `real-estate:${record.observation.observationId}:${record.observation.sourceClass}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(record.observation.controllerId),
    sourceSchemaVersion: `${record.observation.sourceClass}:1`,
    controllerRef: controllerRefFor(record.observation.controllerId),
    operatorRef: operatorRefFor(record.observation.operatorPartyId),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'REAL_ESTATE_USE',
    contentCommitmentMaterial: `real-estate-meta:${record.observation.observationId}:${record.observation.factType}`.slice(0, 256),
    provenanceMaterial: `real-estate-prov:${record.observation.sourceClass}:${record.observation.factType}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: 'REGISTERED',
    createdAt: asUtcInstant('2026-08-19T00:00:00.000Z'),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  const encoded = JSON.stringify(payload).toLowerCase();
  if (encoded.includes('tenant') || encoded.includes('lease document') || encoded.includes('accesslog')) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'public registry metadata cannot hold tenant or lease documents' });
  }
  return ok(payload);
}

export function projectRealEstateMetadata(
  registry: EconomicAssetRegistryPort,
  record: RealEstateEvidenceRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapRealEstateRecordToEconomicAsset(record);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
