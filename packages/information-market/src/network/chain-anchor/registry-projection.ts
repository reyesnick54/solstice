import type { UtcInstant } from '../../../../domain/src/time.ts';
import { ok, type Result } from '../../../../domain/src/result.ts';
import {
  chainIdFor,
  contentCommitmentFor,
  networkIdFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../../economic-asset-registry/src/index.ts';
import { blockIdFor, transactionIdFor } from '../../../../economic-asset-registry/src/ids.ts';
import { parseChainHeight } from './projections.ts';
import type { HumanInformationAnchor } from './types.ts';

/**
 * Projects finalized chain-anchor metadata onto an existing Economic
 * Asset Registry descriptor. Does not duplicate the HIN source record
 * and does not mark the asset VERIFIED.
 */
export function projectFinalizedChainAnchor(
  registry: EconomicAssetRegistryPort,
  anchor: HumanInformationAnchor,
  at: UtcInstant,
): Result<EconomicAssetDescriptor | null, RegistryFailure> {
  if (!anchor.finalized || anchor.chainState !== 'FINALIZED') {
    return ok(null);
  }
  const existing = registry.findBySourceRecord('HUMAN_INFORMATION_NETWORK', sourceRecordFor(anchor));
  if (!existing) {
    return ok(null);
  }
  if (existing.status === 'VERIFIED' && existing.chainAnchor?.finalityState === 'FINALIZED_ON_SIMULATION') {
    return ok(existing);
  }
  const next = registry.correct(existing.assetId, inputFromDescriptor(existing, anchor, at));
  if (!next.ok) {
    return next;
  }
  if (next.value.status === 'VERIFIED' && existing.status !== 'VERIFIED') {
    return ok(next.value);
  }
  return ok(next.value);
}

function sourceRecordFor(anchor: HumanInformationAnchor): string {
  if (anchor.kind === 'CONSENT_REVOCATION') {
    return anchor.sourceRecordId;
  }
  return anchor.sourceRecordId;
}

function inputFromDescriptor(
  existing: EconomicAssetDescriptor,
  anchor: HumanInformationAnchor,
  at: UtcInstant,
): RegisterAssetInput {
  return {
    assetClass: existing.assetClass,
    domain: existing.domain,
    canonicalOwnerSystem: existing.canonicalOwnerSystem,
    sourceRecordId: existing.sourceRecordId,
    sourceClass: existing.sourceClass,
    sourceSystem: existing.sourceSystem,
    sourceSchemaVersion: existing.sourceSchemaVersion,
    controllerRef: existing.controllerRef,
    rightsHolderRefs: existing.rightsHolderRefs,
    subjectRef: existing.subjectRef,
    jurisdiction: existing.jurisdiction,
    consentRefs: existing.consentRefs,
    purposeRefs: existing.purposeRefs,
    usageRestrictionRefs: existing.usageRestrictionRefs,
    sensitivityClass: existing.sensitivityClass,
    qualityClass: existing.qualityClass,
    freshness: existing.freshness,
    validFrom: existing.validFrom,
    validUntil: existing.validUntil,
    economicCategory: existing.economicCategory,
    contentCommitmentMaterial: `${existing.contentCommitment}:chain-finality:${anchor.anchorId}`,
    provenanceMaterial: `${existing.provenanceDigest}:anchored`,
    storageClass: existing.storageClass,
    status: existing.status === 'VERIFIED' ? 'REGISTERED' : existing.status,
    chainAnchor: {
      networkId: networkIdFor(anchor.blockReference ? 'sunrey-simulation' : 'sunrey-simulation'),
      chainId: chainIdFor('net_sunrey_simulation'),
      transactionId: anchor.transactionId ? transactionIdFor(anchor.transactionId) : null,
      blockHeight: parseChainHeight(anchor.blockReference),
      blockId: anchor.blockReference ? blockIdFor(anchor.blockReference) : null,
      stateRootRef: null,
      contentCommitment: contentCommitmentFor(anchor.payloadCommitment ?? existing.contentCommitment),
      anchorType: existing.chainAnchor?.anchorType ?? 'RIGHTS_COMMITMENT',
      finalityState: 'FINALIZED_ON_SIMULATION',
    },
    createdAt: at,
  };
}
