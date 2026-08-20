/**
 * Chunk 144 — typed production economic parameter values and packages.
 *
 * This module can represent future production parameters. It does not
 * choose tokenomics, mint, activate production, or mutate Chunk 71
 * monetary state. PRODUCTION_ACTIVE is not an achievable package state.
 */

import type { NativeMonetaryAssetId } from '../../types.ts';
import type { ProductionParameterId, VersionBinding } from '../types.ts';

export const PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_PARAMETER_PACKAGE_TOOL_VERSION =
  'sunrey-economics/production-parameter-package/1' as const;
export const NATIVE_PROTOCOL_PRECISION = 6 as const;
export const PRECISION_REFERENCE = 'NATIVE_PROTOCOL_PRECISION' as const;

export const PARAMETER_PACKAGE_PRODUCTION_ACTIVATED = false as const;
export const PARAMETER_PACKAGE_USABLE_AS_AUTOMATIC_ACTIVATION = false as const;
export const PARAMETER_PACKAGE_MINTS = false as const;
export const PARAMETER_PACKAGE_MUTATES_SUPPLY = false as const;
export const AI_CAN_AUTHORIZE_PARAMETER = false as const;
export const ARBITRARY_SOURCE_CLASS_ALLOWED = false as const;

export const PARAMETER_VALUE_KINDS = [
  'QUANTITY',
  'RATIONAL_CONVERSION',
  'CAP_SCHEDULE',
  'ISSUANCE_POLICY_REFERENCE',
  'SUPPLY_GUARD_POLICY',
  'FEE_POLICY_REFERENCE',
  'BURN_POLICY_REFERENCE',
  'GENESIS_ALLOCATION_REFERENCE',
] as const;
export type ParameterValueKind = (typeof PARAMETER_VALUE_KINDS)[number];

export const PARAMETER_SOURCE_CLASSES = [
  'UNCONFIGURED',
  'ENGINEERING_SIMULATION',
  'REHEARSAL_FIXTURE',
  'HUMAN_GOVERNANCE_CANDIDATE',
  'PROTOCOL_GOVERNANCE_CANDIDATE',
  'EXTERNAL_REVIEWED_CANDIDATE',
] as const;
export type ParameterSourceClass = (typeof PARAMETER_SOURCE_CLASSES)[number];

export const FORBIDDEN_PARAMETER_SOURCE_CLASSES = [
  'PRODUCTION',
  'PRODUCTION_ACTIVE',
  'PRODUCTION_APPROVED',
  'LIVE',
  'MAINNET',
] as const;

export const PARAMETER_PACKAGE_STATES = [
  'UNCONFIGURED',
  'DRAFT_CANDIDATE',
  'ENGINEERING_VALIDATED',
  'EXTERNAL_REVIEW_REQUIRED',
  'HUMAN_GOVERNANCE_REQUIRED',
  'GOVERNANCE_CANDIDATE',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type ParameterPackageState = (typeof PARAMETER_PACKAGE_STATES)[number];

export const PARAMETER_ASSET_SCOPES = ['SUNREY_COIN', 'MOONREY_COIN', 'SHARED'] as const;
export type ParameterAssetScope = (typeof PARAMETER_ASSET_SCOPES)[number];

export const CAP_SCOPES = [
  'PER_CONTRIBUTION',
  'PER_EVENT',
  'PER_ACCOUNT',
  'PER_RECIPIENT',
  'PER_OBJECT',
  'PER_CONTROLLER',
  'PER_CONTRIBUTION_CLASS',
  'PER_PRODUCTIVE_CATEGORY',
  'PER_EPOCH',
  'PER_ROLLING_POLICY_PERIOD',
  'GLOBAL_ISSUANCE_CEILING',
] as const;
export type CapScope = (typeof CAP_SCOPES)[number];

export const PARAMETER_COVERAGE_STATUSES = [
  'PRESENT',
  'MISSING',
  'INVALID',
  'DUPLICATE',
  'REJECTED_SOURCE',
  'DEPENDENCY_MISSING',
  'AWAITING_GOVERNANCE',
] as const;
export type ParameterCoverageStatus = (typeof PARAMETER_COVERAGE_STATUSES)[number];

export const REJECTED_PARAMETER_AUTHORIZERS = [
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'MODEL',
  'MODEL_OUTPUT',
] as const;
export type RejectedParameterAuthorizer = (typeof REJECTED_PARAMETER_AUTHORIZERS)[number];

export const PARAMETER_BLOCKING_CODES = [
  'PARAMETER_UNCONFIGURED',
  'UNKNOWN_PARAMETER_ID',
  'VALUE_KIND_MISMATCH',
  'FLOAT_QUANTITY_REJECTED',
  'NON_BIGINT_QUANTITY',
  'NEGATIVE_QUANTITY',
  'NEGATIVE_CAP',
  'RATIONAL_DENOMINATOR_ZERO',
  'RATIONAL_DENOMINATOR_NEGATIVE',
  'ARBITRARY_SOURCE_CLASS',
  'PRODUCTION_SOURCE_CLASS_REJECTED',
  'DUPLICATE_PARAMETER',
  'DUPLICATE_CONFLICTING_VERSION',
  'DUPLICATE_ALIAS',
  'GENESIS_EXCEEDS_MAXIMUM',
  'ISSUANCE_CAP_EXCEEDS_MAXIMUM',
  'ISSUED_EXCEEDS_MAXIMUM',
  'ALLOCATION_SUM_MISMATCH',
  'DEPENDENCY_MISSING',
  'AI_CANNOT_AUTHORIZE_PARAMETER',
  'GOVERNANCE_EVIDENCE_MISSING',
  'HUMAN_EVIDENCE_MISSING',
  'EXTERNAL_EVIDENCE_MISSING',
  'BOOLEAN_GOVERNED_INSUFFICIENT',
  'MISSING_VALIDATION_RECEIPT',
  'FIXTURE_NOT_PRODUCTION_GOVERNANCE',
  'PACKAGE_CANNOT_ACTIVATE_PRODUCTION',
] as const;
export type ParameterBlockingCode = (typeof PARAMETER_BLOCKING_CODES)[number];

export type QuantityParameterValue = {
  readonly kind: 'QUANTITY';
  readonly minorUnits: bigint;
  readonly precisionReference: typeof PRECISION_REFERENCE;
  readonly protocolPrecision: typeof NATIVE_PROTOCOL_PRECISION;
  readonly assetId: NativeMonetaryAssetId;
};

export type RationalConversionValue = {
  readonly kind: 'RATIONAL_CONVERSION';
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export type CapScheduleEntry = {
  readonly scope: CapScope;
  readonly classOrCategory: string | null;
  readonly quantityMinorUnits: bigint;
};

export type CapScheduleValue = {
  readonly kind: 'CAP_SCHEDULE';
  readonly assetId: NativeMonetaryAssetId | 'SHARED';
  readonly caps: readonly CapScheduleEntry[];
};

export type IssuancePolicyReferenceValue = {
  readonly kind: 'ISSUANCE_POLICY_REFERENCE';
  readonly assetId: NativeMonetaryAssetId;
  readonly policyVersion: string;
};

export type GlobalSupplyGuardPolicyCandidate = {
  readonly kind: 'SUPPLY_GUARD_POLICY';
  readonly assetId: NativeMonetaryAssetId | 'SHARED';
  readonly maximumSupplyRef: ProductionParameterId | null;
  readonly genesisSupplyRef: ProductionParameterId | null;
  readonly postGenesisIssuanceEnabled: boolean | 'UNCONFIGURED';
  readonly supplyBookAuthority: 'CHUNK_71_ASSET_SUPPLY_BOOK';
  readonly preventIssuanceAboveMaximum: boolean;
  readonly preventNegativeSupply: boolean;
  readonly preventHiddenPremint: boolean;
  readonly preventFaucetMigration: boolean;
  readonly preventRehearsalBalanceMigration: boolean;
  readonly preventAutomaticApplicationLedgerMigration: boolean;
  readonly reconciliationRequiredBeforeIssuance: boolean;
  readonly issuedSupplyObserved: bigint | 'UNCONFIGURED';
};

export type FeePolicyReferenceValue = {
  readonly kind: 'FEE_POLICY_REFERENCE';
  readonly policyVersion: string;
};

export type BurnPolicyReferenceValue = {
  readonly kind: 'BURN_POLICY_REFERENCE';
  readonly policyVersion: string;
};

export type GenesisAllocationLineCandidate = {
  readonly assetId: NativeMonetaryAssetId;
  readonly category: string;
  readonly quantityMinorUnits: bigint;
  readonly recipientRef: string | null;
};

export type GenesisAllocationReferenceValue = {
  readonly kind: 'GENESIS_ALLOCATION_REFERENCE';
  readonly manifestRef: string;
  readonly lines: readonly GenesisAllocationLineCandidate[];
  readonly totalByAsset: {
    readonly SUNREY_COIN: bigint;
    readonly MOONREY_COIN: bigint;
  };
};

export type ProductionParameterValue =
  | QuantityParameterValue
  | RationalConversionValue
  | CapScheduleValue
  | IssuancePolicyReferenceValue
  | GlobalSupplyGuardPolicyCandidate
  | FeePolicyReferenceValue
  | BurnPolicyReferenceValue
  | GenesisAllocationReferenceValue;

export type ProductionParameterDefinition = {
  readonly parameterId: ProductionParameterId;
  readonly valueKind: ParameterValueKind;
  readonly assetScope: ParameterAssetScope;
  readonly required: boolean;
  readonly dependencies: readonly ProductionParameterId[];
  readonly allowsZero: boolean;
  readonly requiresGovernance: boolean;
  readonly requiresHumanReview: boolean;
  readonly requiresExternalEvidence: boolean;
  readonly productionCritical: boolean;
  readonly description: string;
};

export type ParameterGovernanceEvidenceRef = {
  readonly evidenceId: string;
  readonly evidenceClass: 'HUMAN' | 'PROTOCOL' | 'EXTERNAL';
  readonly actorKind: string;
  readonly role: string;
  readonly reference: string;
  readonly contentHash: string;
  readonly fixture: boolean;
};

export type ProductionParameterCandidateInput = {
  readonly parameterId: ProductionParameterId;
  readonly value: ProductionParameterValue | null;
  readonly valueKind: ParameterValueKind;
  readonly versionId: string;
  readonly sourceClass: string;
  readonly createdAt: string;
  readonly effectiveHeightCandidate: bigint | null;
  readonly supersedesVersion: string | null;
  readonly governanceReference: string | null;
  readonly externalEvidenceReferences: readonly string[];
  readonly humanApprovalReferences: readonly string[];
  readonly fixture: boolean;
  readonly rehearsalOnly: boolean;
  readonly alias?: string | null;
};

export type ProductionParameterCandidate = ProductionParameterCandidateInput & {
  readonly parameterHash: string;
  readonly productionActivated: false;
};

export type ProductionEconomicParameterPackageInput = {
  readonly packageId: string;
  readonly schemaVersion: typeof PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION;
  readonly packageVersion: string;
  readonly sourceCommit: string;
  readonly parameters: readonly ProductionParameterCandidateInput[];
  readonly bindings: readonly VersionBinding[];
  readonly governanceEvidence: readonly ParameterGovernanceEvidenceRef[];
  readonly externalEvidence: readonly ParameterGovernanceEvidenceRef[];
  readonly humanEvidence: readonly ParameterGovernanceEvidenceRef[];
  readonly supersedes: string | null;
  readonly supersededBy: string | null;
};

export type ProductionEconomicParameterPackage = Omit<
  ProductionEconomicParameterPackageInput,
  'parameters'
> & {
  readonly parameters: readonly ProductionParameterCandidate[];
  readonly packageHash: string;
  readonly state: ParameterPackageState;
  readonly productionActivated: false;
  readonly usableAsAutomaticActivation: false;
};

export type ParameterCoverageRow = {
  readonly parameterId: ProductionParameterId;
  readonly status: ParameterCoverageStatus;
  readonly blockingCodes: readonly ParameterBlockingCode[];
};

export type ParameterCoverageReport = {
  readonly rows: readonly ParameterCoverageRow[];
  readonly presentCount: number;
  readonly missingCount: number;
  readonly productionValuesSelected: false | boolean;
};

export type ProductionParameterValidationReceipt = {
  readonly packageHash: string;
  readonly parameterId: ProductionParameterId;
  readonly parameterHash: string;
  readonly schemaValid: boolean;
  readonly typeValid: boolean;
  readonly dependenciesValid: boolean;
  readonly crossParameterValid: boolean;
  readonly governanceEvidencePresent: boolean;
  readonly externalEvidencePresent: boolean;
  readonly humanEvidencePresent: boolean;
  readonly fixture: boolean;
  readonly rehearsalOnly: boolean;
  readonly candidateConfigured: boolean;
  readonly productionGovernanceComplete: boolean;
  readonly blockingCodes: readonly ParameterBlockingCode[];
  readonly receiptHash: string;
  readonly productionActivated: false;
};

export type ParameterPackageDiff = {
  readonly changedParameters: readonly {
    readonly parameterId: ProductionParameterId;
    readonly oldHash: string | null;
    readonly newHash: string | null;
    readonly economicCritical: boolean;
  }[];
  readonly addedEvidence: readonly string[];
  readonly removedEvidence: readonly string[];
  readonly governanceChanges: readonly string[];
  readonly autoApproved: false;
};

export type PackageValidationResult = {
  readonly package: ProductionEconomicParameterPackage;
  readonly coverage: ParameterCoverageReport;
  readonly receipts: readonly ProductionParameterValidationReceipt[];
  readonly blockingCodes: readonly ParameterBlockingCode[];
  readonly structurallyValid: boolean;
  readonly productionGovernanceComplete: boolean;
  readonly productionActivated: false;
};
