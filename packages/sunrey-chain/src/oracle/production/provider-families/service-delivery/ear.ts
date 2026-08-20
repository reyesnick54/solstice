/**
 * Economic Asset Registry projection for service source metadata,
 * observation commitments, and verified service facts. Raw customer
 * content and payloads are never stored.
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
import { publicEvidenceHidesPayload } from './privacy.ts';
import type { PublicServiceEvidence } from './types.ts';

export function mapServiceEvidenceToEconomicAsset(
  evidence: PublicServiceEvidence,
): Result<RegisterAssetInput, RegistryFailure> {
  if (!publicEvidenceHidesPayload(evidence) || evidence.containsCustomerPii) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'service projection cannot store payloads or PII' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `service:${evidence.observationId}:${evidence.serviceKind}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(evidence.sourceClass),
    sourceSchemaVersion: `SERVICE_DELIVERY:1`,
    controllerRef: controllerRefFor(evidence.sourceClass),
    operatorRef: operatorRefFor(evidence.sourceClass),
    jurisdiction: 'US',
    rightsConcepts: evidence.identity.licenseRef
      ? ['USAGE_RIGHTS', 'COMMERCIALIZATION_RIGHTS']
      : ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'SERVICES',
    contentCommitmentMaterial: `service-meta:${evidence.observationId}:${evidence.mantissa}:${evidence.unit}`.slice(0, 256),
    provenanceMaterial: `service-prov:${evidence.sourceClass}:${evidence.serviceKind}`.slice(0, 256),
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

export function projectServiceMetadata(
  registry: EconomicAssetRegistryPort,
  evidence: PublicServiceEvidence,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapServiceEvidenceToEconomicAsset(evidence);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
