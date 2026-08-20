/**
 * Chunk 143 — Production Economic Activation Firewall types.
 *
 * Evaluator only. This module never activates production, never flips
 * LIVE_* flags, and never invokes monetary issuance authority.
 * PRODUCTION_ACTIVE is not an achievable state here.
 */

import type { ActivationDomain } from '../../mainnet/types.ts';
import type { EvidenceClass } from '../../production-handoff/types.ts';

export const PRODUCTION_ECONOMIC_ACTIVATION_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_ECONOMIC_ACTIVATION_TOOL_VERSION =
  'sunrey-economics/production-activation/1' as const;
export const PRODUCTION_ECONOMIC_ACTIVATION_FIREWALL_ID =
  'sunrey.economics.production-activation.firewall.v1' as const;

export const ECONOMIC_ACTIVATION_PRODUCTION_ACTIVATED = false as const;
export const ECONOMIC_ACTIVATION_LIVE_FLAGS_CHANGED = false as const;
export const ECONOMIC_ACTIVATION_MONETARY_AUTHORITY_INVOKED = false as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;
export const AI_CAN_AUTHORIZE_PRODUCTION = false as const;
export const ENGINEERING_EVIDENCE_IS_EXTERNAL_APPROVAL = false as const;

export const ECONOMIC_ACTIVATION_DOMAINS = [
  'SUNREY_COIN_ISSUANCE',
  'MOONREY_COIN_ISSUANCE',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_ECONOMIC_DATA',
  'SUNREY_EXCHANGE_SETTLEMENT',
] as const;
export type EconomicActivationDomain = (typeof ECONOMIC_ACTIVATION_DOMAINS)[number];

export const ECONOMIC_ACTIVATION_STATES = [
  'ECONOMIC_ACTIVATION_BLOCKED',
  'ENGINEERING_READY',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_AUTHORIZATION',
  'PRODUCTION_CANDIDATE_READY',
] as const;
export type EconomicActivationState = (typeof ECONOMIC_ACTIVATION_STATES)[number];

export const ECONOMIC_ACTIVATION_BLOCKER_CODES = [
  'PRODUCTION_PARAMETER_UNCONFIGURED',
  'MAXIMUM_SUPPLY_UNCONFIGURED',
  'GENESIS_SUPPLY_UNCONFIGURED',
  'ISSUANCE_POLICY_UNCONFIGURED',
  'CONVERSION_POLICY_NOT_PRODUCTION',
  'VALUE_POLICY_NOT_PRODUCTION',
  'ORACLE_PROVIDER_EVIDENCE_MISSING',
  'ORACLE_LICENSE_EVIDENCE_MISSING',
  'SOURCE_DIVERSITY_INSUFFICIENT',
  'ECONOMIC_DATA_COVERAGE_GAP',
  'HIN_PRIVACY_REVIEW_MISSING',
  'HIN_LEGAL_REVIEW_MISSING',
  'HIN_HUMAN_AUTHORIZATION_MISSING',
  'HIN_CHAIN_ANCHOR_NOT_READY',
  'EXTERNAL_SECURITY_REVIEW_MISSING',
  'LEGAL_EVIDENCE_MISSING',
  'REGULATORY_EVIDENCE_MISSING',
  'PARTNER_EVIDENCE_MISSING',
  'HUMAN_AUTHORIZATION_MISSING',
  'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY',
  'POLICY_BINDING_MISMATCH',
  'SUPPLY_RECONCILIATION_FAILED',
  'GENESIS_ALLOCATION_NOT_AUTHORIZED',
  'LIVE_FLAGS_MUST_REMAIN_DISABLED',
  'AI_CANNOT_AUTHORIZE_PRODUCTION',
] as const;
export type EconomicActivationBlockerCode = (typeof ECONOMIC_ACTIVATION_BLOCKER_CODES)[number];

export const REQUIREMENT_EVIDENCE_CLASSES = [
  'ENGINEERING',
  'EXTERNAL',
  'HUMAN',
  'PRODUCTION_OBSERVED',
  'REHEARSAL',
] as const;
export type RequirementEvidenceClass = (typeof REQUIREMENT_EVIDENCE_CLASSES)[number];

export const ECONOMIC_ACTOR_KINDS = [
  'HUMAN',
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
] as const;
export type EconomicActorKind = (typeof ECONOMIC_ACTOR_KINDS)[number];

export const REJECTED_PARAMETER_SOURCES = [
  'SIMULATION',
  'DEVELOPMENT',
  'ENGINEERING_SIMULATION_PARAMETERS',
  'FIXTURE',
  'REHEARSAL',
] as const;
export type RejectedParameterSource = (typeof REJECTED_PARAMETER_SOURCES)[number];

export const PRODUCTION_PARAMETER_IDS = [
  'SUNREY_MAXIMUM_SUPPLY',
  'MOONREY_MAXIMUM_SUPPLY',
  'SUNREY_GENESIS_SUPPLY',
  'MOONREY_GENESIS_SUPPLY',
  'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
  'MOONREY_POST_GENESIS_ISSUANCE_POLICY',
  'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION',
  'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION',
  'SUNREY_PER_PERIOD_CAPS',
  'MOONREY_PER_PERIOD_CAPS',
  'GLOBAL_SUPPLY_GUARDS',
  'PER_CLASS_CAPS',
  'FEE_POLICY',
  'BURN_POLICY',
  'GENESIS_ALLOCATION_MANIFEST',
] as const;
export type ProductionParameterId = (typeof PRODUCTION_PARAMETER_IDS)[number];

export const PARAMETER_STATUSES = ['UNCONFIGURED', 'REJECTED_SOURCE', 'CONFIGURED'] as const;
export type ProductionParameterStatus = (typeof PARAMETER_STATUSES)[number];

export const BINDING_KEYS = [
  'sourceCommit',
  'mainnetRc',
  'economicRc',
  'pregenesisQualification',
  'productionHandoff',
  'genesisPlan',
  'monetaryConstitution',
  'sunreyContributionVerificationPolicy',
  'sunreyContributionValuationPolicy',
  'sunreySettlementConversionPolicy',
  'moonreySourceTaxonomy',
  'canonicalUnitConstitution',
  'moonreyAttributionPolicy',
  'moonreyProductiveValuePolicy',
  'moonreyGpuvConversionPolicy',
  'moonreyProductionIssuancePackage',
  'oracleCertificationPolicy',
  'economicDataFabricVersion',
  'hinPolicy',
  'hinChainAnchorCapability',
  'economicAssetVerificationPolicy',
] as const;
export type BindingKey = (typeof BINDING_KEYS)[number];

export type VersionBinding = {
  readonly key: BindingKey;
  readonly versionId: string;
  readonly contentHash: string;
};

export type ProductionEconomicActivationManifest = {
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_ACTIVATION_SCHEMA_VERSION;
  readonly firewallId: typeof PRODUCTION_ECONOMIC_ACTIVATION_FIREWALL_ID;
  readonly bindings: readonly VersionBinding[];
  readonly unboundLatestRejected: true;
};

export type ProductionParameterRecord = {
  readonly id: ProductionParameterId;
  readonly status: ProductionParameterStatus;
  readonly sourceClass: string;
  readonly versionId: string | null;
  readonly valueHash: string | null;
  readonly governed: boolean;
  readonly infrastructureMetadataOnly: boolean;
  /** Chunk 144 validation receipt. Absent on historical UNCONFIGURED rows. */
  readonly validationReceiptHash?: string | null;
};

export type ActivationEvidenceRecord = {
  readonly evidenceId: string;
  readonly requirementId: string;
  readonly evidenceClass: RequirementEvidenceClass | EvidenceClass;
  readonly description: string;
  readonly fixture: boolean;
  readonly fixtureKind: string | null;
  readonly actorKind: EconomicActorKind | null;
  readonly actorId: string | null;
  readonly reference: string | null;
  readonly contentHash: string | null;
};

export type HinProductionGates = {
  readonly privacyReview: boolean;
  readonly legalAnalysis: boolean;
  readonly jurisdictionPolicy: boolean;
  readonly termsAgreements: boolean;
  readonly requesterControls: boolean;
  readonly humanAuthorization: boolean;
};

export type HinChainAnchorReadiness = {
  readonly consentAnchorPath: boolean;
  readonly usageAnchorPath: boolean;
  readonly revocationAnchorPath: boolean;
  readonly finality: boolean;
  readonly reconciliation: boolean;
  readonly reorgHandling: boolean;
  readonly privacyClassification: boolean;
};

export type CoverageGapSnapshot = {
  readonly unitExtensionRequired: readonly string[];
  readonly semanticReviewRequired: readonly string[];
  readonly missingProviderCoverage: readonly string[];
};

export type PolicyBindingPair = {
  readonly leftKey: BindingKey;
  readonly leftVersionId: string;
  readonly rightKey: BindingKey;
  readonly rightVersionId: string;
  readonly compatible: boolean;
};

export type SupplySafetySnapshot = {
  readonly canonicalSupplyBook: boolean;
  readonly sunreyReconciles: boolean;
  readonly moonreyReconciles: boolean;
  readonly hiddenPremint: boolean;
  readonly faucetMigration: boolean;
  readonly rehearsalBalanceMigration: boolean;
  readonly automaticApplicationLedgerMigration: boolean;
  readonly genesisAllocationAuthorized: boolean;
};

export type OracleProductionEvidenceSnapshot = {
  readonly realProviderOnboarding: boolean;
  readonly dataLicense: boolean;
  readonly usageRight: boolean;
  readonly securityReview: boolean;
  readonly jurisdiction: boolean;
  readonly sourceDiversity: boolean;
  readonly quality: boolean;
  readonly keyManagement: boolean;
  readonly operationalMonitoring: boolean;
  readonly sandboxProvider: boolean;
};

export type ExternalSecurityEvidenceSnapshot = {
  readonly assessmentProvided: boolean;
  readonly openCriticalFindings: number;
  readonly openHighFindings: number;
  readonly retestEvidence: boolean;
  readonly cryptographicReview: boolean;
  readonly providerSecurity: boolean;
  readonly hsmProvider: boolean;
};

export type LegalRegulatoryEvidenceSnapshot = {
  readonly counselOpinion: boolean;
  readonly licenseOrRegistration: boolean;
  readonly regulatoryApproval: boolean;
  readonly partnerAgreement: boolean;
  readonly jurisdictionOperatingApproval: boolean;
};

export type HumanAuthorizationSlot = {
  readonly role: string;
  readonly actorKind: EconomicActorKind;
  readonly actorId: string;
  readonly accepted: boolean;
  readonly fixtureSignature: boolean;
};

export type LiveFlagSnapshot = {
  readonly ENVIRONMENT: string;
  readonly SIMULATION_MODE: boolean;
  readonly LIVE_MONEY_ENABLED: boolean;
  readonly LIVE_PAYMENTS_ENABLED: boolean;
  readonly LIVE_BANKING_RAILS: boolean;
  readonly LIVE_EXTERNAL_KYC: boolean;
  readonly LIVE_EXTERNAL_BANK_CONNECTION: boolean;
  readonly REAL_MONEY_ENABLED: boolean;
  readonly LIVE_TRADING_ENABLED: boolean;
  readonly LIVE_CRYPTO_ENABLED: boolean;
  readonly LIVE_EXCHANGE_ENABLED: boolean;
  readonly LIVE_DATA_MARKET_ENABLED: boolean;
  readonly LIVE_INVESTMENT_EXECUTION: boolean;
};

export type ActivationRequirement = {
  readonly requirementId: string;
  readonly domain: EconomicActivationDomain | 'SHARED';
  readonly title: string;
  readonly evidenceClass: RequirementEvidenceClass;
  readonly blockerCode: EconomicActivationBlockerCode;
  readonly mainnetDomain: ActivationDomain | null;
};

export type RequirementEvaluation = {
  readonly requirementId: string;
  readonly domain: EconomicActivationDomain | 'SHARED';
  readonly evidenceClass: RequirementEvidenceClass;
  readonly satisfied: boolean;
  readonly blocking: boolean;
  readonly blockerCode: EconomicActivationBlockerCode | null;
  readonly notes: string;
};

export type DomainActivationDecision = {
  readonly domain: EconomicActivationDomain;
  readonly mainnetDomain: ActivationDomain;
  readonly state: EconomicActivationState;
  readonly engineeringReady: boolean;
  readonly externalEvidenceReady: boolean;
  readonly humanAuthorizationReady: boolean;
  readonly parametersConfigured: boolean;
  readonly runtimeEnabled: false;
  readonly blockers: readonly EconomicActivationBlockerCode[];
};

export type ProductionEconomicActivationDecision = {
  readonly decisionId: string;
  readonly manifestHash: string;
  readonly parameterManifestHash: string;
  readonly overallState: EconomicActivationState;
  readonly domainDecisions: readonly DomainActivationDecision[];
  readonly requirements: readonly RequirementEvaluation[];
  readonly satisfiedRequirements: readonly string[];
  readonly missingRequirements: readonly string[];
  readonly blockingRequirements: readonly string[];
  readonly engineeringEvidence: readonly ActivationEvidenceRecord[];
  readonly externalEvidence: readonly ActivationEvidenceRecord[];
  readonly humanEvidence: readonly ActivationEvidenceRecord[];
  readonly parameterStatus: 'UNCONFIGURED' | 'REJECTED_SOURCE' | 'CONFIGURED';
  readonly policyBindingStatus: 'BOUND' | 'UNBOUND' | 'MISMATCH';
  readonly supplyStatus: 'RECONCILED' | 'FAILED' | 'NOT_CANONICAL';
  readonly mainnetReadinessReference: string;
  readonly economicRcReference: string;
  readonly mainnetRcReference: string;
  readonly pregenesisReference: string;
  readonly handoffReference: string;
  readonly productionActivated: false;
  readonly liveFlagsChanged: false;
  readonly monetaryAuthorityInvoked: false;
};

export type ProductionEconomicActivationReadinessReport = {
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_ACTIVATION_SCHEMA_VERSION;
  readonly toolVersion: typeof PRODUCTION_ECONOMIC_ACTIVATION_TOOL_VERSION;
  readonly decision: ProductionEconomicActivationDecision;
  readonly domains: readonly {
    readonly label: string;
    readonly domain: EconomicActivationDomain;
    readonly engineering: boolean;
    readonly external: boolean;
    readonly human: boolean;
    readonly parameters: boolean;
    readonly finalState: EconomicActivationState;
    readonly blockers: readonly EconomicActivationBlockerCode[];
  }[];
  readonly productionParametersConfigured: false | boolean;
  readonly engineeringEvidenceIsExternalApproval: false;
  readonly aiCanAuthorizeProduction: false;
  readonly chunk71RemainsMonetaryAuthority: true;
  readonly liveFlagsChanged: false;
  readonly productionActive: false;
};

export type ProductionEconomicActivationSnapshot = {
  readonly bindings: readonly VersionBinding[];
  readonly parameters: readonly ProductionParameterRecord[];
  readonly sunreyIssuancePackage?: import('./sunrey-package/types.ts').SunReyProductionIssuanceParameterPackage | null;
  readonly evidence: readonly ActivationEvidenceRecord[];
  readonly hinGates: HinProductionGates;
  readonly hinChainAnchor: HinChainAnchorReadiness;
  readonly coverageGaps: CoverageGapSnapshot;
  readonly policyBindings: readonly PolicyBindingPair[];
  readonly supply: SupplySafetySnapshot;
  readonly oracleEvidence: OracleProductionEvidenceSnapshot;
  readonly externalSecurity: ExternalSecurityEvidenceSnapshot;
  readonly legalRegulatory: LegalRegulatoryEvidenceSnapshot;
  readonly humanAuthorizations: readonly HumanAuthorizationSlot[];
  readonly liveFlags: LiveFlagSnapshot;
  readonly moonreyLegacyV1Only: boolean;
  readonly moonreyV2EngineeringReady: boolean;
  readonly moonreyValuePolicyClass: string;
  readonly sunreyEngineeringReady: boolean;
  readonly exchangeEngineeringReady: boolean;
  readonly intendedProductionCategories: readonly string[];
  readonly moonreyProductionCandidate: MoonReyProductionCandidateSnapshot;
};

export type MoonReyProductionCandidateSnapshot = {
  readonly packageId: string;
  readonly packageHash: string;
  readonly sourceClass: string;
  readonly fixture: boolean;
  readonly productionActivated: false;
  readonly gpuvValuesSelected: false;
  readonly conversionSelected: false;
  readonly gpuvEqualsMoonRey: false;
  readonly legacyV1ProductionEligible: false;
  readonly fixtureAuthorizesProduction: false;
  readonly governedValueV2Required: true;
  readonly chunk71RemainsMonetaryAuthority: true;
};
