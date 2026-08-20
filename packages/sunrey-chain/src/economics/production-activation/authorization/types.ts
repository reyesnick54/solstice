/**
 * Chunk 163 — governed production economic parameter authorization.
 *
 * Human-governance package only. This module never activates production,
 * never flips LIVE_* flags, never mints, and never mutates AssetSupplyBook.
 * AUTHORIZED_CANDIDATE means the governance package is complete, not that
 * production is running. PRODUCTION_ACTIVE is not a package state.
 */

import type {
  GovernanceApprovalRecord,
  GovernanceApprovalSet,
  GovernanceOpsActorKind,
  HumanApprovalRole,
} from '../../../governance-ops/types.ts';
import type { ProductionParameterId, ProductionParameterStatus } from '../types.ts';
import type { ParameterSourceClass } from '../parameter-package/types.ts';

export const PRODUCTION_ECONOMIC_AUTHORIZATION_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_ECONOMIC_AUTHORIZATION_TOOL_VERSION =
  'sunrey-economics/production-economic-authorization/1' as const;
export const PRODUCTION_ECONOMIC_AUTHORIZATION_DOMAIN =
  'SUNREY_PRODUCTION_ECONOMIC_AUTHORIZATION_PACKAGE_V1' as const;
export const PRODUCTION_ECONOMIC_AUTHORIZATION_CAPABILITY =
  'sunrey-production-economic-authorization' as const;

export const AUTHORIZATION_PRODUCTION_ACTIVATED = false as const;
export const AUTHORIZATION_PRODUCTION_ACTIVATION_REQUESTED = false as const;
export const AI_CAN_APPROVE_PRODUCTION_ECONOMICS = false as const;
export const REHEARSAL_PARAMETERS_MAY_BE_PROMOTED = false as const;
export const PEVE_IS_SUNREY_TOKEN_VALUATION = false as const;
export const REFERENCE_PRICE_CAN_MINT_MOONREY = false as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;
export const ASSET_SUPPLY_BOOK_REMAINS_SUPPLY_AUTHORITY = true as const;
export const FIREWALL_MAY_BE_OVERRIDDEN = false as const;

export const AUTHORIZATION_STATES = [
  'DRAFT',
  'PARAMETERS_INCOMPLETE',
  'PREFLIGHT_REQUIRED',
  'PREFLIGHT_FAILED',
  'PREFLIGHT_PASSED',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'AWAITING_HUMAN_APPROVALS',
  'APPROVALS_SATISFIED',
  'AUTHORIZED_CANDIDATE',
  'EXPIRED',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type ProductionEconomicAuthorizationState = (typeof AUTHORIZATION_STATES)[number];

export const AUTHORIZATION_PARAMETER_CLASSES = [
  'UNCONFIGURED',
  'MISSING',
  'REHEARSAL_REFERENCE',
  'PRODUCTION_CANDIDATE',
  'REJECTED_SOURCE',
] as const;
export type AuthorizationParameterClass = (typeof AUTHORIZATION_PARAMETER_CLASSES)[number];

export const REQUIRED_HUMAN_AUTHORIZATION_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
  'ECONOMIC_POLICY_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
] as const satisfies readonly HumanApprovalRole[];
export type RequiredProductionAuthorizationRole = (typeof REQUIRED_HUMAN_AUTHORIZATION_ROLES)[number];

export const REJECTED_APPROVAL_ACTOR_KINDS = ['AI', 'AGENT', 'AUTOMATION'] as const;
export type RejectedApprovalActorKind = (typeof REJECTED_APPROVAL_ACTOR_KINDS)[number];

export const REQUIRED_EXTERNAL_EVIDENCE_CLASSES = [
  'SECURITY_AUDIT',
  'COUNSEL_OPINION',
  'LICENSE',
  'REGULATORY_APPROVAL',
  'PROVIDER_CONTRACT',
  'HSM_ATTESTATION',
] as const;
export type RequiredExternalEvidenceClass = (typeof REQUIRED_EXTERNAL_EVIDENCE_CLASSES)[number];

export const OPERATING_SCOPE_DOMAINS = [
  'NATIVE_PROTOCOL_ECONOMICS',
  'BANKING',
  'PAYMENTS',
  'EXCHANGE',
  'CUSTODY',
  'HIN',
] as const;
export type OperatingScopeDomain = (typeof OPERATING_SCOPE_DOMAINS)[number];

export const PROVIDER_BINDING_DOMAINS = [
  'NATIVE_PROTOCOL',
  'BANKING',
  'PAYMENTS',
  'EXCHANGE',
  'CUSTODY',
  'HIN',
  'ORACLE',
] as const;
export type ProviderBindingDomain = (typeof PROVIDER_BINDING_DOMAINS)[number];

export const AUTHORIZATION_PREFLIGHT_CHECKS = [
  'SCHEMA_VALIDATION',
  'FORMAL_SMOKE',
  'PROPERTY_TESTS',
  'ECONOMIC_STRESS',
  'DUAL_ECONOMY_SIMULATION',
  'SUPPLY_INVARIANTS',
  'ECONOMIC_RC',
  'MAINNET_RC',
  'FULL_PLATFORM_BURN_IN',
  'ADVERSARIAL_CAMPAIGN',
  'PARAMETER_HASH_VERIFICATION',
  'PROVIDER_READINESS',
  'OPERATING_SCOPE',
  'EXTERNAL_EVIDENCE',
] as const;
export type AuthorizationPreflightCheckId = (typeof AUTHORIZATION_PREFLIGHT_CHECKS)[number];

export const SUPPLY_MODEL_SCENARIOS = [
  'LONG_HORIZON',
  'MAXIMUM_ISSUANCE',
  'CAPS',
  'BURNS',
  'EPOCH_BOUNDARIES',
  'CATEGORY_CONCENTRATION',
  'DUPLICATE_EVENTS',
  'ORACLE_MANIPULATION',
  'ECONOMIC_SHOCK',
] as const;
export type SupplyModelScenarioId = (typeof SUPPLY_MODEL_SCENARIOS)[number];

export const AUTHORIZATION_BLOCKER_CODES = [
  'PARAMETERS_INCOMPLETE',
  'REHEARSAL_PARAMETERS_CANNOT_BE_PROMOTED',
  'PRODUCTION_PARAMETERS_UNCONFIGURED',
  'PREFLIGHT_REQUIRED',
  'PREFLIGHT_FAILED',
  'EXTERNAL_EVIDENCE_MISSING',
  'EXTERNAL_EVIDENCE_EXPIRED',
  'EXTERNAL_EVIDENCE_REVOKED',
  'AWAITING_HUMAN_APPROVALS',
  'AI_CANNOT_APPROVE',
  'AGENT_CANNOT_APPROVE',
  'AUTOMATION_CANNOT_APPROVE',
  'DISTINCT_HUMAN_ROLES_REQUIRED',
  'STALE_SIGNATURE',
  'PARAMETER_HASH_CHANGED',
  'RELEASE_HASH_CHANGED',
  'EVIDENCE_HASH_CHANGED',
  'OPERATING_SCOPE_CHANGED',
  'PROVIDER_MATRIX_CHANGED',
  'HIDDEN_PREMINT_FORBIDDEN',
  'TESTNET_FAUCET_MIGRATION_FORBIDDEN',
  'APPLICATION_LEDGER_MIGRATION_FORBIDDEN',
  'WRAPPED_FIAT_FORBIDDEN',
  'PEVE_CANNOT_VALUE_SUNREY',
  'REFERENCE_PRICE_CANNOT_MINT_MOONREY',
  'GENESIS_ALLOCATION_UNAUTHORIZED',
  'FIREWALL_OVERRIDE_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
] as const;
export type AuthorizationBlockerCode = (typeof AUTHORIZATION_BLOCKER_CODES)[number];

export type ApprovalWindow = {
  readonly validFromUtc: string;
  readonly validUntilUtc: string;
};

export type AuthorizationParameterStatusRow = {
  readonly parameterId: ProductionParameterId;
  readonly firewallStatus: ProductionParameterStatus;
  readonly authorizationClass: AuthorizationParameterClass;
  readonly sourceClass: ParameterSourceClass | 'UNKNOWN';
  readonly rehearsalReference: boolean;
  readonly productionEligible: boolean;
};

export type ProductionEconomicParameterDiff = {
  readonly fromParameterPackageHash: string;
  readonly toParameterPackageHash: string;
  readonly addedParameters: readonly ProductionParameterId[];
  readonly removedParameters: readonly ProductionParameterId[];
  readonly changedCaps: readonly ProductionParameterId[];
  readonly changedFormulas: readonly ProductionParameterId[];
  readonly changedConversionPolicies: readonly ProductionParameterId[];
  readonly changedEligibility: readonly ProductionParameterId[];
  readonly changedGenesisAssumptions: readonly ProductionParameterId[];
  readonly changedAuthority: readonly string[];
  readonly changedSupplyLimits: readonly ProductionParameterId[];
  readonly changedParameters: readonly ProductionParameterId[];
  readonly rehearsalPromoted: false;
  readonly autoApproved: false;
  readonly diffHash: string;
};

export type ExternalEvidenceSlot = {
  readonly evidenceClass: RequiredExternalEvidenceClass;
  readonly present: boolean;
  readonly revoked: boolean;
  readonly expiresAtUtc: string | null;
  readonly contentHash: string | null;
  readonly fixture: boolean;
};

export type ExternalEvidenceBinding = {
  readonly bundleHash: string;
  readonly slots: readonly ExternalEvidenceSlot[];
  readonly allRequiredPresent: boolean;
  readonly stale: boolean;
  readonly expired: boolean;
  readonly revoked: boolean;
};

export type OperatingScopeRow = {
  readonly domain: OperatingScopeDomain;
  readonly kind: 'NATIVE_PROTOCOL' | 'REGULATED_SERVICE';
  readonly bound: boolean;
  readonly activatedByGlobalEconomicPackage: false;
};

export type OperatingScopeBinding = {
  readonly matrixHash: string;
  readonly rows: readonly OperatingScopeRow[];
  readonly nativeProtocolSeparatedFromRegulatedServices: true;
  readonly globalPackageActivatesRegulatedProducts: false;
};

export type ProviderBindingRow = {
  readonly domain: ProviderBindingDomain;
  readonly bound: boolean;
  readonly relatedToNativeProtocol: boolean;
  readonly missingBlocksNativeProtocol: boolean;
  readonly missingBlocksDomain: boolean;
};

export type ProviderBindingMatrix = {
  readonly matrixHash: string;
  readonly rows: readonly ProviderBindingRow[];
  readonly unrelatedProviderMissingBlocksProtocol: false;
};

export type GenesisAuthorizationBinding = {
  readonly manifestHash: string;
  readonly productionAllocationAuthorized: boolean;
  readonly hiddenPremint: false;
  readonly inheritedTestnetFaucet: false;
  readonly migratedApplicationLedgerBalances: false;
  readonly wrappedFiat: false;
  readonly separatelyApproved: boolean;
};

export type SunReyIssuanceProposalBinding = {
  readonly policyHash: string;
  readonly verifiedHumanEconomicContributionBound: boolean;
  readonly humanValuationPolicyBound: boolean;
  readonly conversionPolicyBound: boolean;
  readonly rightsConsentEvidenceBound: boolean;
  readonly chunk71Bound: true;
  readonly peveUsedAsTokenValuation: false;
};

export type MoonReyIssuanceProposalBinding = {
  readonly policyHash: string;
  readonly sourceTaxonomyBound: boolean;
  readonly canonicalUnitsBound: boolean;
  readonly oracleProviderEligibilityBound: boolean;
  readonly economicEventIdentityBound: boolean;
  readonly attributionBound: boolean;
  readonly productiveValueBound: boolean;
  readonly gpuvConversionPolicyBound: boolean;
  readonly chunk71Bound: true;
  readonly referencePriceMintsDirectly: false;
};

export type SupplyModelScenarioResult = {
  readonly scenario: SupplyModelScenarioId;
  readonly ran: boolean;
  readonly invariantHeld: boolean | null;
  readonly notes: string;
};

export type SupplyModelReport = {
  readonly modeled: boolean;
  readonly parametersComplete: boolean;
  readonly scenarios: readonly SupplyModelScenarioResult[];
  readonly singleSimulationClaimsStability: false;
  readonly supplyBookAuthority: 'CHUNK_71_ASSET_SUPPLY_BOOK';
  readonly reportHash: string;
};

export type AuthorizationPreflightCheck = {
  readonly id: AuthorizationPreflightCheckId;
  readonly passed: boolean;
  readonly detail: string;
};

export type AuthorizationPreflightReport = {
  readonly authorizationHash: string;
  readonly checks: readonly AuthorizationPreflightCheck[];
  readonly passed: boolean;
  readonly governancePreflightPassed: boolean;
  readonly binaryInstallActivatesPolicy: false;
  readonly productionActivated: false;
};

export type ProductionEconomicApprovalBinding = {
  readonly record: GovernanceApprovalRecord;
  readonly authorizationHash: string;
  readonly parameterDiffHash: string;
  readonly evidenceBundleHash: string;
  readonly operatingScopeHash: string;
  readonly providerBindingHash: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly policyVersion: number;
  readonly approvalValidUntilUtc: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type ProductionEconomicAuthorizationInput = {
  readonly packageId: string;
  readonly parameterPackageHash: string;
  readonly sunreyPolicyHash: string;
  readonly moonreyPolicyHash: string;
  readonly economicConstitutionCandidateHash: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly externalEvidenceBundleHash: string;
  readonly operatingScopeMatrixHash: string;
  readonly providerBindingMatrixHash: string;
  readonly architectureManifestHash: string;
  readonly sourceCommit: string;
  readonly parameterStatuses: readonly AuthorizationParameterStatusRow[];
  readonly approvalWindow: ApprovalWindow;
  readonly networkId: string;
  readonly chainId: string;
  readonly parameterDiffHash: string;
  readonly genesisManifestHash: string;
  readonly supersededBy?: string | null;
};

export type ProductionEconomicAuthorizationPackage = ProductionEconomicAuthorizationInput & {
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_AUTHORIZATION_SCHEMA_VERSION;
  readonly requiredHumanRoles: readonly RequiredProductionAuthorizationRole[];
  readonly status: ProductionEconomicAuthorizationState;
  readonly authorizationHash: string;
  readonly productionActivationRequested: false;
  readonly productionActivated: false;
  readonly aiMayApprove: false;
  readonly rehearsalParametersPromoted: false;
  readonly chunk71RemainsMonetaryAuthority: true;
  readonly assetSupplyBookRemainsSupplyAuthority: true;
  readonly peveIsSunReyTokenValuation: false;
  readonly referencePriceCanMintMoonRey: false;
  readonly firewallMayBeOverridden: false;
};

export type ProductionEconomicAuthorizationEvaluation = {
  readonly pkg: ProductionEconomicAuthorizationPackage;
  readonly diff: ProductionEconomicParameterDiff;
  readonly evidence: ExternalEvidenceBinding;
  readonly operatingScope: OperatingScopeBinding;
  readonly providers: ProviderBindingMatrix;
  readonly genesis: GenesisAuthorizationBinding;
  readonly sunrey: SunReyIssuanceProposalBinding;
  readonly moonrey: MoonReyIssuanceProposalBinding;
  readonly supplyModel: SupplyModelReport;
  readonly preflight: AuthorizationPreflightReport;
  readonly approvals: GovernanceApprovalSet;
  readonly approvalBindings: readonly ProductionEconomicApprovalBinding[];
  readonly blockers: readonly AuthorizationBlockerCode[];
  readonly s3mMaySummarize: true;
  readonly s3mMayApprove: false;
  readonly realProductionParametersConfigured: false | boolean;
  readonly rehearsalParametersPromoted: false;
  readonly productionActive: false;
};

export type ProductionEconomicAuthorizationOfflinePayload = {
  readonly hashes: {
    readonly authorizationHash: string;
    readonly parameterPackageHash: string;
    readonly parameterDiffHash: string;
    readonly evidenceBundleHash: string;
    readonly operatingScopeHash: string;
    readonly providerBindingHash: string;
    readonly economicRcHash: string;
    readonly fullPlatformCandidateHash: string;
    readonly architectureManifestHash: string;
  };
  readonly versions: {
    readonly schemaVersion: typeof PRODUCTION_ECONOMIC_AUTHORIZATION_SCHEMA_VERSION;
    readonly policyVersion: number;
    readonly toolVersion: typeof PRODUCTION_ECONOMIC_AUTHORIZATION_TOOL_VERSION;
  };
  readonly networkId: string;
  readonly chainId: string;
  readonly parameterDiffSummary: string;
  readonly activationCandidateReference: string;
  readonly approvalExpiryUtc: string;
};

export type { GovernanceApprovalRecord, GovernanceApprovalSet, GovernanceOpsActorKind, HumanApprovalRole };
