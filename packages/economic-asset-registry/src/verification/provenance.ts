import { CANONICAL_SYSTEM_OWNERS } from '../ids.ts';
import {
  INDUSTRIAL_RESTRICTED_SENSITIVITY,
  PRODUCTIVE_ECONOMIC_CATEGORIES,
  PROTECTED_CONTENT_SENSITIVITY,
  type EconomicAssetClass,
  type SensitivityClass,
  type SourceClass,
  type StorageClass,
} from '../taxonomy.ts';
import type { EconomicAssetChainAnchor, EconomicAssetDescriptor, LineageEdge } from '../types.ts';
import { wouldCreateCycle } from '../lineage.ts';
import type { AssetClassVerificationRule, EconomicAssetVerificationPolicy } from './types.ts';
import type { EconomicAssetVerificationCode } from './rejections.ts';

const VERIFIER_CLASSES = new Set<EconomicAssetClass>([
  'ECONOMIC_ATTESTATION',
  'HUMAN_CONTRIBUTION_EVIDENCE',
  'VERIFIED_ECONOMIC_FACT',
  'ORACLE_OBSERVATION_SET',
  'HUMAN_CONTRIBUTION_RECORD',
]);

const SENSITIVE = new Set<SensitivityClass>(PROTECTED_CONTENT_SENSITIVITY);
const INDUSTRIAL = new Set<SensitivityClass>(INDUSTRIAL_RESTRICTED_SENSITIVITY);
const PRODUCTIVE_CATEGORIES = new Set<string>(PRODUCTIVE_ECONOMIC_CATEGORIES);
const PUBLIC_STORAGE = new Set<StorageClass>(['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA']);

function sourceMatchesOwner(sourceClass: SourceClass, ownerSystem: string): boolean {
  switch (sourceClass) {
    case 'HUMAN_INFORMATION_NETWORK':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.hin;
    case 'PERSONAL_DATA_VAULT':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.pdv;
    case 'PERSONAL_ECONOMIC_GRAPH':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.peg;
    case 'HUMAN_CONTRIBUTION_REGISTRY':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.humanContribution;
    case 'CONSENT_LEDGER':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.consent;
    case 'ORACLE_NETWORK':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.oracle;
    case 'PRODUCTIVE_OBJECT_REGISTRY':
    case 'PRODUCTIVE_CLAIM_REGISTRY':
      return ownerSystem === CANONICAL_SYSTEM_OWNERS.productive;
    default:
      return true;
  }
}

export function collectProvenanceCodes(
  descriptor: EconomicAssetDescriptor,
  policy: EconomicAssetVerificationPolicy,
  rule: AssetClassVerificationRule | undefined,
  remember: (code: EconomicAssetVerificationCode) => void,
): void {
  if (rule?.requireCanonicalSource && !descriptor.canonicalSourceRef) {
    remember('CANONICAL_SOURCE_REQUIRED');
  }
  if (rule?.requireSchema && (!descriptor.schemaId || !descriptor.sourceSchemaVersion)) {
    remember('SCHEMA_REFERENCE_REQUIRED');
  }
  if (rule?.requireContentCommitment && !descriptor.contentCommitment) {
    remember('CONTENT_COMMITMENT_REQUIRED');
  }
  if (rule?.requireProvenance && (!descriptor.provenanceDigest || !descriptor.sourceSystem || !descriptor.sourceClass)) {
    remember('PROVENANCE_REQUIRED');
  }
  if (rule?.requireObservedAt && !descriptor.observedAt) {
    remember('PROVENANCE_REQUIRED');
  }
  if (rule?.requireSourceOrganization && !descriptor.sourceOrganizationRef) {
    remember('PROVENANCE_REQUIRED');
  }
  if (rule?.requireContributionFingerprint && !descriptor.provenanceDigest) {
    remember('CONTRIBUTION_FINGERPRINT_REQUIRED');
  }
  if (rule?.requireAttestingSource && !descriptor.sourceOrganizationRef && !descriptor.sourceSystem) {
    remember('ATTESTING_SOURCE_REQUIRED');
  }
  if (rule?.requireValidityPeriod && (!descriptor.validFrom || !descriptor.validUntil)) {
    remember('VALIDITY_PERIOD_REQUIRED');
  }
  if (rule?.requireMeasurementPeriod && (!descriptor.validFrom || !descriptor.validUntil)) {
    remember('MEASUREMENT_PERIOD_REQUIRED');
  }

  if (descriptor.validUntil && descriptor.validUntil < descriptor.validFrom) {
    remember('PROVENANCE_MISMATCH');
  }
  if (descriptor.observedAt && descriptor.validUntil && descriptor.observedAt > descriptor.validUntil) {
    remember('PROVENANCE_MISMATCH');
  }

  if (rule && rule.requiredSourceClasses.length > 0 && !rule.requiredSourceClasses.includes(descriptor.sourceClass)) {
    remember('SOURCE_CLASS_MISMATCH');
  }
  if (rule?.forbiddenSourceClasses.includes(descriptor.sourceClass)) {
    remember('SOURCE_CLASS_MISMATCH');
  }
  if (rule && rule.requiredDomains.length > 0 && !rule.requiredDomains.includes(descriptor.domain)) {
    remember('DOMAIN_MISMATCH');
  }
  if (!sourceMatchesOwner(descriptor.sourceClass, descriptor.canonicalOwnerSystem)) {
    remember('SOURCE_CLASS_MISMATCH');
  }

  if (descriptor.sourceClass === 'PERSONAL_DATA_VAULT' && PUBLIC_STORAGE.has(descriptor.storageClass) && SENSITIVE.has(descriptor.sensitivityClass)) {
    remember('PROVENANCE_MISMATCH');
  }
  if (descriptor.assetClass === 'ORACLE_SOURCE_DATASET' && descriptor.sourceClass === 'PERSONAL_DATA_VAULT') {
    remember('SOURCE_CLASS_MISMATCH');
  }
  if (descriptor.assetClass === 'VERIFIED_PRODUCTIVE_CONTRIBUTION' && descriptor.domain !== 'PRODUCTIVE_ECONOMY') {
    remember('DOMAIN_MISMATCH');
  }
  if (rule?.requireProductiveCategory && !PRODUCTIVE_CATEGORIES.has(descriptor.economicCategory)) {
    remember('DOMAIN_MISMATCH');
  }

  const sourceRule = policy.sourceClassRules[descriptor.sourceClass];
  if (sourceRule && !sourceRule.permittedAssetClasses.includes(descriptor.assetClass)) {
    remember('SOURCE_CLASS_MISMATCH');
  }
  if (
    sourceRule &&
    SENSITIVE.has(descriptor.sensitivityClass) &&
    (sourceRule.forbiddenStorageForSensitive as readonly string[]).includes(descriptor.storageClass)
  ) {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
}

export function collectStorageSensitivityCodes(
  descriptor: EconomicAssetDescriptor,
  policy: EconomicAssetVerificationPolicy,
  rule: AssetClassVerificationRule | undefined,
  remember: (code: EconomicAssetVerificationCode) => void,
): void {
  const storageRule = policy.storageRequirements.find((row) => row.sensitivity === descriptor.sensitivityClass);
  if (storageRule && !storageRule.allowedStorage.includes(descriptor.storageClass)) {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
  if (rule?.allowedStorage && !rule.allowedStorage.includes(descriptor.storageClass)) {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
  if (SENSITIVE.has(descriptor.sensitivityClass) && descriptor.storageClass === 'ON_CHAIN_PUBLIC_METADATA') {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
  if (descriptor.sensitivityClass === 'SECRET_REFERENCE_ONLY' && PUBLIC_STORAGE.has(descriptor.storageClass)) {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
  if (INDUSTRIAL.has(descriptor.sensitivityClass) && descriptor.storageClass === 'OFF_CHAIN_PUBLIC_REFERENCE') {
    remember('STORAGE_SENSITIVITY_MISMATCH');
  }
  if (rule?.requireRetention && !descriptor.retentionPolicyRef) {
    remember('RETENTION_POLICY_REQUIRED');
  }
  if (
    policy.retentionRequirements.personalSourceDataRequiresRetention &&
    SENSITIVE.has(descriptor.sensitivityClass) &&
    descriptor.storageClass === 'OFF_CHAIN_PROTECTED' &&
    !descriptor.retentionPolicyRef
  ) {
    remember('RETENTION_POLICY_REQUIRED');
  }
}

export function collectChainAnchorCodes(
  descriptor: EconomicAssetDescriptor,
  policy: EconomicAssetVerificationPolicy,
  remember: (code: EconomicAssetVerificationCode) => void,
): void {
  const anchor = descriptor.chainAnchor;
  if (!anchor) {
    return;
  }
  if (anchor.finalityState === 'FINALIZED_ON_SIMULATION') {
    if (!anchor.transactionId || anchor.blockHeight == null || !anchor.blockId || !anchor.stateRootRef || !anchor.networkId || !anchor.chainId) {
      remember('CHAIN_ANCHOR_INVALID');
    }
  }
  if (anchor.finalityState === 'UNANCHORED') {
    if (anchor.transactionId != null || anchor.blockHeight != null || anchor.blockId != null) {
      remember('FINALITY_CLAIM_INVALID');
    }
  }
  if (SENSITIVE.has(descriptor.sensitivityClass) && descriptor.storageClass === 'ON_CHAIN_PUBLIC_METADATA') {
    remember('CHAIN_ANCHOR_INVALID');
  }
  void policy;
}

export function collectLineageCodes(
  descriptor: EconomicAssetDescriptor,
  knownAssets: readonly EconomicAssetDescriptor[],
  policy: EconomicAssetVerificationPolicy,
  rule: AssetClassVerificationRule | undefined,
  remember: (code: EconomicAssetVerificationCode) => void,
): void {
  const known = new Map(knownAssets.map((item) => [item.assetId, item]));
  known.set(descriptor.assetId, descriptor);

  if (rule?.requireLineage && descriptor.lineage.length === 0) {
    remember('LINEAGE_REQUIRED');
  }

  const existingEdges = knownAssets.flatMap((item) => [...item.lineage]);
  if (wouldCreateCycle(existingEdges, descriptor.lineage)) {
    remember('LINEAGE_CYCLE');
  }

  for (const edge of descriptor.lineage) {
    if (edge.fromAssetId === edge.toAssetId) {
      remember('LINEAGE_CYCLE');
    }
    const parent = known.get(edge.toAssetId);
    if (edge.kind === 'VERIFIED_BY') {
      if (!parent || !VERIFIER_CLASSES.has(parent.assetClass)) {
        remember('LINEAGE_INVALID');
      }
    }
    if (edge.kind === 'SETTLED_FROM') {
      const settlement =
        descriptor.chainAnchor?.anchorType === 'SETTLEMENT_COMMITMENT' || parent?.chainAnchor?.anchorType === 'SETTLEMENT_COMMITMENT';
      if (!settlement) {
        remember('LINEAGE_INVALID');
      }
    }
    if ((edge.kind === 'SUPERSEDES' || edge.kind === 'CORRECTS') && descriptor.supersedes !== edge.toAssetId && descriptor.corrects !== edge.toAssetId) {
      remember('LINEAGE_INVALID');
    }
    if (rule?.requireLineage && !parent && edge.toAssetId !== descriptor.assetId) {
      remember('PARENT_ASSET_REQUIRED');
    }
    if (rule?.requireOracleFactLineage && edge.kind === 'DERIVED_FROM' && parent && parent.assetClass !== 'VERIFIED_ECONOMIC_FACT' && parent.assetClass !== 'ORACLE_OBSERVATION_SET' && parent.assetClass !== 'ORACLE_SOURCE_DATASET' && parent.assetClass !== 'PRODUCTIVE_ECONOMIC_OBJECT') {
      remember('ORACLE_FACT_REFERENCE_REQUIRED');
    }
  }

  if (rule?.requireOracleFactLineage) {
    const hasFact = descriptor.lineage.some((edge) => {
      const parent = known.get(edge.toAssetId);
      return parent?.assetClass === 'VERIFIED_ECONOMIC_FACT' || parent?.assetClass === 'ORACLE_OBSERVATION_SET';
    });
    if (!hasFact) {
      remember('ORACLE_FACT_REFERENCE_REQUIRED');
    }
  }

  if (descriptor.assetClass === 'PRODUCTIVE_CLAIM') {
    const hasObject = descriptor.lineage.some((edge) => known.get(edge.toAssetId)?.assetClass === 'PRODUCTIVE_ECONOMIC_OBJECT');
    if (!hasObject) {
      remember('OBJECT_REFERENCE_REQUIRED');
    }
  }

  void policy;
}

export function chainAnchorIsConsistent(anchor: EconomicAssetChainAnchor | null): boolean {
  if (!anchor) {
    return true;
  }
  if (anchor.finalityState === 'UNANCHORED') {
    return anchor.transactionId == null && anchor.blockHeight == null && anchor.blockId == null;
  }
  if (anchor.finalityState === 'FINALIZED_ON_SIMULATION') {
    return Boolean(anchor.transactionId && anchor.blockId && anchor.stateRootRef && anchor.blockHeight != null);
  }
  return Boolean(anchor.contentCommitment);
}

export type { LineageEdge };
