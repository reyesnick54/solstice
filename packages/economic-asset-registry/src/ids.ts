import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type AssetId = Brand<string, 'EconomicAssetId'>;
export type SchemaId = Brand<string, 'EconomicAssetSchemaId'>;
export type CanonicalOwnerRef = Brand<string, 'EconomicAssetCanonicalOwnerRef'>;
export type CanonicalSourceRef = Brand<string, 'EconomicAssetCanonicalSourceRef'>;
export type ControllerRef = Brand<string, 'EconomicAssetControllerRef'>;
export type RightsHolderRef = Brand<string, 'EconomicAssetRightsHolderRef'>;
export type CustodianRef = Brand<string, 'EconomicAssetCustodianRef'>;
export type OperatorRef = Brand<string, 'EconomicAssetOperatorRef'>;
export type SubjectRef = Brand<string, 'EconomicAssetSubjectRef'>;
export type SourceOrganizationRef = Brand<string, 'EconomicAssetSourceOrganizationRef'>;
export type RightsPolicyRef = Brand<string, 'EconomicAssetRightsPolicyRef'>;
export type ConsentRef = Brand<string, 'EconomicAssetConsentRef'>;
export type PurposeRef = Brand<string, 'EconomicAssetPurposeRef'>;
export type LicenseRef = Brand<string, 'EconomicAssetLicenseRef'>;
export type UsageRestrictionRef = Brand<string, 'EconomicAssetUsageRestrictionRef'>;
export type RetentionPolicyRef = Brand<string, 'EconomicAssetRetentionPolicyRef'>;
export type DeletionPolicyRef = Brand<string, 'EconomicAssetDeletionPolicyRef'>;
export type ValuationMethodRef = Brand<string, 'EconomicAssetValuationMethodRef'>;
export type LegalOwnershipRightsRef = Brand<string, 'EconomicAssetLegalOwnershipRightsRef'>;
export type ContentCommitment = Brand<string, 'EconomicAssetContentCommitment'>;
export type ProvenanceDigest = Brand<string, 'EconomicAssetProvenanceDigest'>;
export type LineageRoot = Brand<string, 'EconomicAssetLineageRoot'>;
export type NetworkId = Brand<string, 'EconomicAssetNetworkId'>;
export type ChainId = Brand<string, 'EconomicAssetChainId'>;
export type TransactionId = Brand<string, 'EconomicAssetTransactionId'>;
export type BlockId = Brand<string, 'EconomicAssetBlockId'>;
export type StateRootRef = Brand<string, 'EconomicAssetStateRootRef'>;
export type VerificationDecisionId = Brand<string, 'EconomicAssetVerificationDecisionId'>;
export type VerificationPolicyId = Brand<string, 'EconomicAssetVerificationPolicyId'>;
export type VerificationPolicyVersion = Brand<string, 'EconomicAssetVerificationPolicyVersion'>;

export const ASSET_ID_PREFIXES = Object.freeze({
  asset: 'ear_',
  schema: 'eas_',
  owner: 'eao_',
  source: 'easrc_',
  controller: 'eactl_',
  rightsHolder: 'earh_',
  custodian: 'eacus_',
  operator: 'eaop_',
  subject: 'easub_',
  organization: 'eaorg_',
  rightsPolicy: 'earp_',
  consent: 'eacn_',
  purpose: 'eapu_',
  license: 'ealic_',
  usage: 'eausg_',
  retention: 'earet_',
  deletion: 'eadel_',
  valuation: 'eavm_',
  legalOwnership: 'ealor_',
  content: 'eacc_',
  provenance: 'eaprv_',
  lineage: 'ealn_',
  network: 'eanet_',
  chain: 'eachn_',
  transaction: 'eatx_',
  block: 'eablk_',
  stateRoot: 'easr_',
  verificationDecision: 'eavd_',
  verificationPolicy: 'eavp_',
  verificationPolicyVersion: 'eavpv_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

function refFor<T extends string>(prefix: string, material: string): Brand<string, T> {
  return brandAs<string, T>(`${prefix}${digest(material).slice(0, 32)}`);
}

export function sha256Canonical(material: string): string {
  return digest(material);
}

export function asAssetId(value: string): AssetId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.asset, 'AssetId');
}
export function asSchemaId(value: string): SchemaId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.schema, 'SchemaId');
}
export function asCanonicalOwnerRef(value: string): CanonicalOwnerRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.owner, 'CanonicalOwnerRef');
}
export function asCanonicalSourceRef(value: string): CanonicalSourceRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.source, 'CanonicalSourceRef');
}
export function asControllerRef(value: string): ControllerRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.controller, 'ControllerRef');
}
export function asRightsHolderRef(value: string): RightsHolderRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.rightsHolder, 'RightsHolderRef');
}
export function asCustodianRef(value: string): CustodianRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.custodian, 'CustodianRef');
}
export function asOperatorRef(value: string): OperatorRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.operator, 'OperatorRef');
}
export function asSubjectRef(value: string): SubjectRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.subject, 'SubjectRef');
}
export function asSourceOrganizationRef(value: string): SourceOrganizationRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.organization, 'SourceOrganizationRef');
}
export function asRightsPolicyRef(value: string): RightsPolicyRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.rightsPolicy, 'RightsPolicyRef');
}
export function asConsentRef(value: string): ConsentRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.consent, 'ConsentRef');
}
export function asPurposeRef(value: string): PurposeRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.purpose, 'PurposeRef');
}
export function asLicenseRef(value: string): LicenseRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.license, 'LicenseRef');
}
export function asUsageRestrictionRef(value: string): UsageRestrictionRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.usage, 'UsageRestrictionRef');
}
export function asRetentionPolicyRef(value: string): RetentionPolicyRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.retention, 'RetentionPolicyRef');
}
export function asDeletionPolicyRef(value: string): DeletionPolicyRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.deletion, 'DeletionPolicyRef');
}
export function asValuationMethodRef(value: string): ValuationMethodRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.valuation, 'ValuationMethodRef');
}
export function asLegalOwnershipRightsRef(value: string): LegalOwnershipRightsRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.legalOwnership, 'LegalOwnershipRightsRef');
}
export function asContentCommitment(value: string): ContentCommitment {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.content, 'ContentCommitment');
}
export function asProvenanceDigest(value: string): ProvenanceDigest {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.provenance, 'ProvenanceDigest');
}
export function asLineageRoot(value: string): LineageRoot {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.lineage, 'LineageRoot');
}
export function asNetworkId(value: string): NetworkId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.network, 'NetworkId');
}
export function asChainId(value: string): ChainId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.chain, 'ChainId');
}
export function asTransactionId(value: string): TransactionId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.transaction, 'TransactionId');
}
export function asBlockId(value: string): BlockId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.block, 'BlockId');
}
export function asStateRootRef(value: string): StateRootRef {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.stateRoot, 'StateRootRef');
}
export function asVerificationDecisionId(value: string): VerificationDecisionId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.verificationDecision, 'VerificationDecisionId');
}
export function asVerificationPolicyId(value: string): VerificationPolicyId {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.verificationPolicy, 'VerificationPolicyId');
}
export function asVerificationPolicyVersion(value: string): VerificationPolicyVersion {
  return asPrefixedHex(value, ASSET_ID_PREFIXES.verificationPolicyVersion, 'VerificationPolicyVersion');
}

export function assetIdFor(material: string): AssetId {
  return refFor(ASSET_ID_PREFIXES.asset, `asset:${material}`);
}
export function schemaIdFor(material: string): SchemaId {
  return refFor(ASSET_ID_PREFIXES.schema, `schema:${material}`);
}
export function canonicalOwnerRefFor(material: string): CanonicalOwnerRef {
  return refFor(ASSET_ID_PREFIXES.owner, `owner:${material}`);
}
export function canonicalSourceRefFor(material: string): CanonicalSourceRef {
  return refFor(ASSET_ID_PREFIXES.source, `source:${material}`);
}
export function controllerRefFor(material: string): ControllerRef {
  return refFor(ASSET_ID_PREFIXES.controller, `controller:${material}`);
}
export function rightsHolderRefFor(material: string): RightsHolderRef {
  return refFor(ASSET_ID_PREFIXES.rightsHolder, `rights:${material}`);
}
export function custodianRefFor(material: string): CustodianRef {
  return refFor(ASSET_ID_PREFIXES.custodian, `custodian:${material}`);
}
export function operatorRefFor(material: string): OperatorRef {
  return refFor(ASSET_ID_PREFIXES.operator, `operator:${material}`);
}
export function subjectRefFor(material: string): SubjectRef {
  return refFor(ASSET_ID_PREFIXES.subject, `subject:${material}`);
}
export function sourceOrganizationRefFor(material: string): SourceOrganizationRef {
  return refFor(ASSET_ID_PREFIXES.organization, `org:${material}`);
}
export function rightsPolicyRefFor(material: string): RightsPolicyRef {
  return refFor(ASSET_ID_PREFIXES.rightsPolicy, `rights-policy:${material}`);
}
export function consentRefFor(material: string): ConsentRef {
  return refFor(ASSET_ID_PREFIXES.consent, `consent:${material}`);
}
export function purposeRefFor(material: string): PurposeRef {
  return refFor(ASSET_ID_PREFIXES.purpose, `purpose:${material}`);
}
export function licenseRefFor(material: string): LicenseRef {
  return refFor(ASSET_ID_PREFIXES.license, `license:${material}`);
}
export function usageRestrictionRefFor(material: string): UsageRestrictionRef {
  return refFor(ASSET_ID_PREFIXES.usage, `usage:${material}`);
}
export function retentionPolicyRefFor(material: string): RetentionPolicyRef {
  return refFor(ASSET_ID_PREFIXES.retention, `retention:${material}`);
}
export function deletionPolicyRefFor(material: string): DeletionPolicyRef {
  return refFor(ASSET_ID_PREFIXES.deletion, `deletion:${material}`);
}
export function valuationMethodRefFor(material: string): ValuationMethodRef {
  return refFor(ASSET_ID_PREFIXES.valuation, `valuation:${material}`);
}
export function legalOwnershipRightsRefFor(material: string): LegalOwnershipRightsRef {
  return refFor(ASSET_ID_PREFIXES.legalOwnership, `legal-ownership:${material}`);
}
export function contentCommitmentFor(material: string): ContentCommitment {
  return refFor(ASSET_ID_PREFIXES.content, `content:${material}`);
}
export function provenanceDigestFor(material: string): ProvenanceDigest {
  return refFor(ASSET_ID_PREFIXES.provenance, `provenance:${material}`);
}
export function lineageRootFor(material: string): LineageRoot {
  return refFor(ASSET_ID_PREFIXES.lineage, `lineage:${material}`);
}
export function networkIdFor(material: string): NetworkId {
  return refFor(ASSET_ID_PREFIXES.network, `network:${material}`);
}
export function chainIdFor(material: string): ChainId {
  return refFor(ASSET_ID_PREFIXES.chain, `chain:${material}`);
}
export function transactionIdFor(material: string): TransactionId {
  return refFor(ASSET_ID_PREFIXES.transaction, `tx:${material}`);
}
export function blockIdFor(material: string): BlockId {
  return refFor(ASSET_ID_PREFIXES.block, `block:${material}`);
}
export function stateRootRefFor(material: string): StateRootRef {
  return refFor(ASSET_ID_PREFIXES.stateRoot, `state:${material}`);
}
export function verificationDecisionIdFor(material: string): VerificationDecisionId {
  return refFor(ASSET_ID_PREFIXES.verificationDecision, `verification-decision:${material}`);
}
export function verificationPolicyIdFor(material: string): VerificationPolicyId {
  return refFor(ASSET_ID_PREFIXES.verificationPolicy, `verification-policy:${material}`);
}
export function verificationPolicyVersionFor(material: string): VerificationPolicyVersion {
  return refFor(ASSET_ID_PREFIXES.verificationPolicyVersion, `verification-policy-version:${material}`);
}

export const CANONICAL_SYSTEM_OWNERS = Object.freeze({
  hin: 'packages/information-market',
  pdv: 'packages/personal-data-vault',
  peg: 'packages/personal-economic-graph',
  humanContribution: 'packages/human-economic-contribution',
  consent: 'packages/consent',
  oracle: 'packages/sunrey-chain/src/oracle',
  productive: 'packages/sunrey-chain/src/productive',
  monetary: 'packages/sunrey-chain/src/economics',
  thisRegistry: 'packages/economic-asset-registry',
});
