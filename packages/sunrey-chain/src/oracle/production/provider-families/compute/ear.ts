/**
 * Economic Asset Registry projection for compute source datasets,
 * observation sets, and verified compute facts. Workload payloads
 * are never stored.
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
import type { ComputeEconomicRecord } from './types.ts';
import { economicRecordOmitsPayloads } from './privacy.ts';

export function mapComputeRecordToEconomicAsset(record: ComputeEconomicRecord): Result<RegisterAssetInput, RegistryFailure> {
  if (!economicRecordOmitsPayloads(record)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'compute projection cannot store workload payloads' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `compute:${record.execution.executionRef}:${record.schemaId}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(record.execution.controllerRef),
    sourceSchemaVersion: `${record.schemaId}:1`,
    controllerRef: controllerRefFor(record.execution.controllerRef),
    operatorRef: operatorRefFor(record.execution.controllerRef),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: record.productiveCategory === 'AI_COMPUTE' ? 'AI_COMPUTE' : 'COMPUTE',
    contentCommitmentMaterial: `compute-meta:${record.execution.executionRef}:${record.receipt.receiptId}`.slice(0, 256),
    provenanceMaterial: `compute-prov:${record.sourceClass}:${record.factType}:${record.schemaId}`.slice(0, 256),
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

export function projectComputeMetadata(
  registry: EconomicAssetRegistryPort,
  record: ComputeEconomicRecord,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapComputeRecordToEconomicAsset(record);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
