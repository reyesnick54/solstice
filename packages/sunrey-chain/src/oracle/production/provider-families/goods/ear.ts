/**
 * Economic Asset Registry projection for goods source datasets,
 * observation commitments, and verified goods facts. Raw customer
 * and order content is never stored.
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
import { publicEvidenceOmitsPii } from './privacy.ts';
import type { PublicGoodsEvidence } from './types.ts';

export function mapGoodsEvidenceToEconomicAsset(
  evidence: PublicGoodsEvidence,
): Result<RegisterAssetInput, RegistryFailure> {
  if (!publicEvidenceOmitsPii(evidence)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'goods projection cannot store customer content' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `goods:${evidence.observationId}:${evidence.factType}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(evidence.identity.merchantRef ?? evidence.sourceClass),
    sourceSchemaVersion: `${evidence.factType}:1`,
    controllerRef: controllerRefFor(evidence.sourceClass),
    operatorRef: operatorRefFor(evidence.sourceClass),
    jurisdiction: 'US',
    rightsConcepts: evidence.licenseRef
      ? ['USAGE_RIGHTS', 'COMMERCIALIZATION_RIGHTS']
      : ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant('2026-08-19T00:00:00.000Z'),
    validUntil: asUtcInstant('2026-11-17T00:00:00.000Z'),
    economicCategory: 'GOODS',
    contentCommitmentMaterial: `goods-meta:${evidence.observationId}:${evidence.mantissa}:${evidence.unit}`.slice(0, 256),
    provenanceMaterial: `goods-prov:${evidence.sourceClass}:${evidence.factType}`.slice(0, 256),
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

export function projectGoodsMetadata(
  registry: EconomicAssetRegistryPort,
  evidence: PublicGoodsEvidence,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapGoodsEvidenceToEconomicAsset(evidence);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
