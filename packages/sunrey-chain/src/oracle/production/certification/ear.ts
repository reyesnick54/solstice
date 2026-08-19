import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { asUtcInstant } from '../../../../../domain/src/time.ts';
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
} from '../../../../../economic-asset-registry/src/index.ts';
import type { EconomicDataSourceCertificationRecord } from './types.ts';

const CATEGORY_MAP = Object.freeze({
  energy: 'ENERGY',
  food_agriculture: 'FOOD_AGRICULTURE',
  water: 'WATER',
  compute: 'COMPUTE',
  ai_usage: 'AI_COMPUTE',
  manufacturing: 'MANUFACTURING',
  real_estate_use: 'REAL_ESTATE_USE',
  storage: 'STORAGE',
  logistics: 'LOGISTICS_TRANSPORTATION',
  bandwidth: 'BANDWIDTH_COMMUNICATIONS',
  resources: 'MINERALS_RAW_MATERIALS',
  service_delivery: 'SERVICES',
  reference_price: 'SHARED_ECONOMIC_REFERENCE',
  minerals_resources: 'MINERALS_RAW_MATERIALS',
  ai_compute: 'AI_COMPUTE',
  infrastructure: 'INFRASTRUCTURE',
  goods: 'GOODS',
  services: 'SERVICES',
  automated_machine_output: 'AUTOMATED_MACHINE_OUTPUT',
} as const);

/**
 * Projects certification metadata and provenance references into the
 * Economic Asset Registry. Raw provider responses are never stored.
 */
export function mapCertificationToEconomicAsset(
  record: EconomicDataSourceCertificationRecord,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `cert:${record.certificationId}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(record.providerId),
    sourceSchemaVersion: `${record.schemaId}:${record.schemaVersionRecord}`,
    controllerRef: controllerRefFor(record.providerId),
    operatorRef: operatorRefFor(record.providerId),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: record.status === 'PRODUCTION_CANDIDATE' ? 'AUTHORITATIVE' : 'ATTESTED',
    freshness: record.status === 'SUSPENDED' || record.status === 'REVOKED' ? 'STALE' : 'CURRENT',
    validFrom: asUtcInstant(record.createdAt),
    validUntil: asUtcInstant(record.expiresAt),
    economicCategory: CATEGORY_MAP[record.sourceCategory],
    contentCommitmentMaterial: `cert-meta:${record.certificationId}:${record.evidenceDigest}`.slice(0, 256),
    provenanceMaterial: `cert-prov:${record.providerId}:${record.sourceId}:${record.feedId}:${record.status}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: record.status === 'SUSPENDED' ? 'SUSPENDED' : record.status === 'REVOKED' ? 'RESTRICTED' : 'REGISTERED',
    createdAt: asUtcInstant(record.createdAt),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  if (JSON.stringify(payload).includes('numericValue') || JSON.stringify(payload).toLowerCase().includes('apikey')) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'certification projection cannot store raw provider responses' });
  }
  return ok(payload);
}

export function projectCertificationMetadata(
  registry: EconomicAssetRegistryPort,
  record: EconomicDataSourceCertificationRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapCertificationToEconomicAsset(record);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
