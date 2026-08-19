/**
 * Privacy-safe Economic Asset Registry projection for water source
 * datasets and observation metadata. Raw meter datasets are never stored.
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
import type { NormalizedWaterObservation, WaterProductionEvidenceRecord } from './types.ts';

export function mapWaterObservationToEconomicAsset(
  observation: NormalizedWaterObservation,
): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `water:${observation.observationId}:${observation.sourceClass}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(observation.upstreamOrganizationId),
    sourceSchemaVersion: `water:${observation.sourceClass}:1`,
    controllerRef: controllerRefFor(observation.controllerId),
    operatorRef: operatorRefFor(observation.operatorPartyId),
    jurisdiction: observation.geography.jurisdiction,
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'WATER',
    contentCommitmentMaterial: `water-meta:${observation.observationId}:${observation.normalizationReceipt.receiptId}`.slice(
      0,
      256,
    ),
    provenanceMaterial: `water-prov:${observation.sourceClass}:${observation.factType}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: 'REGISTERED',
    createdAt: asUtcInstant('2026-08-19T00:00:00.000Z'),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  if (JSON.stringify(payload).toLowerCase().includes('apikey')) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'water projection cannot store credentials' });
  }
  return ok(payload);
}

export function projectWaterMetadata(
  registry: EconomicAssetRegistryPort,
  evidence: WaterProductionEvidenceRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapWaterObservationToEconomicAsset(evidence.observation);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
