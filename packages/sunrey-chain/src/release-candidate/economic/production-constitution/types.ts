/**
 * Chunk 148 — Production Economic Constitution Candidate Bundle.
 *
 * Extends the existing Chunk 78 economic release-candidate owner.
 * This is a new versioned candidate bundle. Historical Economic RC
 * hashes remain reproducible. This module never activates production.
 * PRODUCTION_ACTIVE is not an achievable state.
 */

import type { ProductionParameterId, ProductionParameterRecord } from '../../../economics/production-activation/types.ts';

export const PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION = '1' as const;
export const PRODUCTION_ECONOMIC_CONSTITUTION_TOOL_VERSION =
  'sunrey-economics/production-constitution-candidate/1' as const;
export const PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID =
  'sunrey.economics.production-constitution.candidate.v1' as const;

export const PRODUCTION_ACTIVATED = false as const;
export const PARAMETERS_SELECTED_FOR_PRODUCTION = false as const;
export const AI_CAN_AUTHORIZE = false as const;
export const PEVE_IS_TOKEN_VALUATION = false as const;
export const GPUV_EQUALS_MOONREY = false as const;
export const LEGACY_V1_MOONREY_PRODUCTION_ELIGIBLE = false as const;
export const CHUNK_71_MONETARY_AUTHORITY = 'Chunk71' as const;
export const ASSET_SUPPLY_BOOK_AUTHORITY = 'AssetSupplyBook' as const;

export const REJECTED_IMPLICIT_VERSIONS = ['latest', 'current', 'default'] as const;

export const BUNDLE_STATES = [
  'BUNDLE_INCOMPLETE',
  'ENGINEERING_RECONCILIATION_FAILED',
  'ENGINEERING_RECONCILED',
  'AWAITING_PARAMETER_SELECTION',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_GOVERNANCE',
  'AWAITING_HUMAN_ACTIVATION_AUTHORIZATION',
  'PRODUCTION_CANDIDATE_PACKAGE_READY',
] as const;
export type ProductionEconomicConstitutionBundleState = (typeof BUNDLE_STATES)[number];

export const QUALIFICATION_RESULTS = [
  'INCOMPLETE',
  'ENGINEERING_RECONCILED',
  'AWAITING_PARAMETER_SELECTION',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_GOVERNANCE',
  'AWAITING_HUMAN_ACTIVATION_AUTHORIZATION',
  'PRODUCTION_CANDIDATE_PACKAGE_READY',
] as const;
export type ProductionEconomicConstitutionQualification = (typeof QUALIFICATION_RESULTS)[number];

export const PARAMETER_COVERAGE_STATUSES = [
  'CONFIGURED_CANDIDATE',
  'UNCONFIGURED',
  'FIXTURE_ONLY',
  'INVALID',
  'MISSING_GOVERNANCE',
  'MISSING_EXTERNAL_EVIDENCE',
  'MISSING_HUMAN_APPROVAL',
] as const;
export type ParameterCoverageStatus = (typeof PARAMETER_COVERAGE_STATUSES)[number];

export const HUMAN_DECISION_KINDS = ['PARAMETER_SELECTION', 'FINAL_ACTIVATION_AUTHORIZATION'] as const;
export type HumanEconomicDecisionKind = (typeof HUMAN_DECISION_KINDS)[number];

export const LEGACY_PATH_CLASSES = [
  'HISTORICAL_REPLAY_ONLY',
  'ENGINEERING_ONLY',
  'REHEARSAL_ONLY',
  'PRODUCTION_CANDIDATE_ELIGIBLE',
] as const;
export type LegacyPathClass = (typeof LEGACY_PATH_CLASSES)[number];

export const CONSTITUTION_COMPONENT_KEYS = [
  'monetaryConstitution',
  'parameterPackage',
  'humanVerification',
  'humanValuation',
  'sunreyConversion',
  'sourceTaxonomy',
  'unitConstitution',
  'attribution',
  'productiveValue',
  'moonreyConversion',
  'oracleCertification',
  'economicDataFabric',
  'fees',
  'burns',
  'genesis',
  'supply',
] as const;
export type ConstitutionComponentKey = (typeof CONSTITUTION_COMPONENT_KEYS)[number];

export const AUTHORITY_DOMAINS = [
  'MONETARY_ISSUANCE',
  'SUPPLY',
  'HUMAN_VALUATION',
  'PRODUCTIVE_VALUE',
  'GPUV_CONVERSION',
  'SUNREY_CONVERSION',
  'SOURCE_TAXONOMY',
  'UNITS',
  'ORACLE_CONSENSUS',
  'ECONOMIC_ASSET_REGISTRY',
] as const;
export type AuthorityDomain = (typeof AUTHORITY_DOMAINS)[number];

export const CANONICAL_AUTHORITIES = Object.freeze({
  MONETARY_ISSUANCE: 'Chunk71',
  SUPPLY: 'AssetSupplyBook',
  HUMAN_INFORMATION_RIGHTS: 'HIN',
  HUMAN_CONTRIBUTION: 'HumanContributionRegistry',
  HUMAN_CONTRIBUTION_VALUATION: 'HumanContributionValuation',
  ORACLE_CONSENSUS: 'OracleConsensus',
  PRODUCTIVE_EVENT_IDENTITY: 'ProductiveEventRegistry',
  ATTRIBUTION: 'Attribution',
  PRODUCTIVE_VALUE_FUNCTION: 'ProductiveValueFunction',
  EXCHANGE: 'SunReyExchange',
} as const);

export type ExactVersionBinding = {
  readonly key: string;
  readonly versionId: string;
  readonly contentHash: string;
};

export type ParameterCoverageRecord = {
  readonly id: ProductionParameterId;
  readonly status: ParameterCoverageStatus;
  readonly versionId: string | null;
  readonly valueHash: string | null;
  readonly sourceClass: string;
  readonly notes: string;
};

export type HumanEconomicDecisionRequired = {
  readonly decisionId: string;
  readonly kind: HumanEconomicDecisionKind;
  readonly title: string;
  readonly parameterId: ProductionParameterId | null;
  readonly unresolved: true;
  readonly aiMayDecide: false;
};

export type ExternalEvidenceInventoryItem = {
  readonly evidenceId: string;
  readonly title: string;
  readonly present: false | boolean;
  readonly fabricated: false;
  readonly class: 'EXTERNAL' | 'HUMAN' | 'ENGINEERING';
  readonly notes: string;
};

export type LegacyPathInventoryItem = {
  readonly pathId: string;
  readonly title: string;
  readonly classification: LegacyPathClass;
  readonly productionCandidateEligible: boolean;
};

export type AuthorityOwnerRecord = {
  readonly domain: AuthorityDomain;
  readonly canonicalOwner: string;
  readonly competingOwners: readonly string[];
};

export type EconomicPolicyCompatibilityNode = {
  readonly id: ConstitutionComponentKey;
  readonly versionId: string;
  readonly contentHash: string;
};

export type EconomicPolicyCompatibilityEdge = {
  readonly from: ConstitutionComponentKey;
  readonly to: ConstitutionComponentKey;
  readonly required: true;
  readonly compatible: boolean;
  readonly reason: string;
};

export type EconomicPolicyCompatibilityGraph = {
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION;
  readonly nodes: readonly EconomicPolicyCompatibilityNode[];
  readonly edges: readonly EconomicPolicyCompatibilityEdge[];
  readonly complete: boolean;
};

export type SunReyConstitutionBinding = {
  readonly ontologyVersion: string;
  readonly ontologyHash: string;
  readonly verificationPolicyVersion: string;
  readonly verificationPolicyHash: string;
  readonly valuationPolicyVersion: string;
  readonly valuationPolicyHash: string;
  readonly valuationOutputDenomination: string;
  readonly conversionPolicyVersion: string;
  readonly conversionPolicyHash: string;
  readonly conversionInputDenomination: string;
  readonly conversionOutputAsset: 'SUNREY_COIN';
  readonly settlementAuthorizationStatus: string;
  readonly issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION';
  readonly supplyBook: 'AssetSupplyBook';
  readonly structurallyReady: boolean;
  readonly productionEligible: false | boolean;
  readonly legacyFixturePath: boolean;
  readonly peveUsedAsValuation: false;
};

export type MoonReyConstitutionBinding = {
  readonly sourceTaxonomyVersion: string;
  readonly sourceTaxonomyHash: string;
  readonly unitConstitutionVersion: string;
  readonly unitConstitutionHash: string;
  readonly attributionPolicyVersion: string;
  readonly attributionPolicyHash: string;
  readonly productiveValuePolicyVersion: string;
  readonly productiveValuePolicyHash: string;
  readonly productiveValueOutputUnit: 'GPUV';
  readonly conversionPolicyVersion: string;
  readonly conversionPolicyHash: string;
  readonly conversionInputUnit: 'GPUV';
  readonly conversionOutputAsset: 'MOONREY_COIN';
  readonly issuanceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION';
  readonly supplyBook: 'AssetSupplyBook';
  readonly structurallyReady: boolean;
  readonly productionEligible: false | boolean;
  readonly legacyV1Path: boolean;
  readonly gpuvEqualsMoonRey: false;
  readonly gpuvCanMint: false;
};

export type SupplyReconciliationBinding = {
  readonly canonicalSupplyBook: true | boolean;
  readonly sunreyReconciles: boolean;
  readonly moonreyReconciles: boolean;
  readonly hiddenPremint: boolean;
  readonly faucetMigration: boolean;
  readonly rehearsalBalanceMigration: boolean;
  readonly automaticApplicationLedgerMigration: boolean;
  readonly genesisAllocationAuthorized: boolean;
  readonly usedExistingChunk71Auditor: true;
};

export type GenesisReconciliationBinding = {
  readonly sunreyAllocationEqualsGenesis: boolean | null;
  readonly moonreyAllocationEqualsGenesis: boolean | null;
  readonly hiddenAllocation: false | boolean;
  readonly inheritedFaucet: false | boolean;
  readonly migratedRehearsalBalance: false | boolean;
  readonly automaticAppLedgerMigration: false | boolean;
};

export type MaxSupplyBinding = {
  readonly sunreyConsistent: boolean | null;
  readonly moonreyConsistent: boolean | null;
  readonly duplicateMaxSupplyField: false | boolean;
};

export type RehearsalBinding = {
  readonly reportHash: string;
  readonly schemaVersion: string;
  readonly policyStructureMatches: boolean;
  readonly parameterPackageSchemaMatches: boolean;
  readonly fixtureValuesMayDiffer: true;
  readonly validatedUnselectedProductionValues: false;
  readonly label: 'REHEARSAL_ONLY';
};

export type StressBinding = {
  readonly reportHash: string;
  readonly criticalInvariantsPassed: boolean;
  readonly openHighOrCriticalFindings: boolean;
  readonly supplyIntegrityHeld: boolean;
  readonly replaySafetyHeld: boolean;
  readonly capSafetyHeld: boolean;
  readonly isExternalApproval: false;
};

export type FirewallBinding = {
  readonly decisionHash: string;
  readonly overallState: string;
  readonly productionActivated: false;
  readonly overriddenByBundle: false;
};

export type ProductionEconomicConstitutionCandidateBundle = {
  readonly bundleId: typeof PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID;
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION;
  readonly bundleVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION;
  readonly sourceCommit: string;
  readonly economicRcId: string;
  readonly mainnetRcId: string;
  readonly monetaryConstitutionHash: string;
  readonly parameterPackageHash: string;
  readonly sunreyPolicyCandidateHash: string;
  readonly sunreyValuationPolicyHash: string;
  readonly sunreyConversionPolicyHash: string;
  readonly moonreyPolicyCandidateHash: string;
  readonly moonreyProductiveValuePolicyHash: string;
  readonly moonreyConversionPolicyHash: string;
  readonly sourceTaxonomyHash: string;
  readonly unitConstitutionHash: string;
  readonly attributionPolicyHash: string;
  readonly oracleCertificationPolicyHash: string;
  readonly economicDataFabricHash: string;
  readonly HINPolicyHash: string;
  readonly HINChainAnchorCapabilityHash: string;
  readonly economicAssetVerificationHash: string;
  readonly feePolicyHash: string;
  readonly burnPolicyHash: string;
  readonly supplyGuardHash: string;
  readonly genesisAllocationManifestHash: string;
  readonly rehearsalReportHash: string;
  readonly stressReportHash: string;
  readonly firewallDecisionHash: string;
  readonly bundleHash: string;
  readonly economicConstitutionHash: string;
  readonly productionActivated: false;
};

export type FrozenProductionEconomicConstitutionCandidateBundle = {
  readonly bundle: ProductionEconomicConstitutionCandidateBundle;
  readonly frozen: true;
  readonly frozenAtUtc: string;
  readonly approved: false;
  readonly activated: false;
  readonly authorized: false;
};

export type LayerSeparationProof = {
  readonly humanCannotMasqueradeAsProductive: true | boolean;
  readonly productiveCannotMasqueradeAsHuman: true | boolean;
  readonly commonArbitraryEconomicScore: false;
  readonly peveIsContributionValuation: false;
  readonly peveIsSunReyQuantity: false;
  readonly peveIsMoonReyQuantity: false;
  readonly peveIsHumanWorth: false;
  readonly peveIsCreditScore: false;
  readonly gpuvIsPhysicalQuantity: false;
  readonly gpuvIsFiat: false;
  readonly gpuvIsMoonRey: false;
  readonly gpuvIsExchangePrice: false;
  readonly gpuvCanMint: false;
};

export type ProductionEconomicConstitutionSnapshot = {
  readonly bindings: readonly ExactVersionBinding[];
  readonly parameters: readonly ProductionParameterRecord[];
  readonly sunrey: SunReyConstitutionBinding;
  readonly moonrey: MoonReyConstitutionBinding;
  readonly supply: SupplyReconciliationBinding;
  readonly genesis: GenesisReconciliationBinding;
  readonly maxSupply: MaxSupplyBinding;
  readonly rehearsal: RehearsalBinding;
  readonly stress: StressBinding;
  readonly layerSeparation: LayerSeparationProof;
  readonly authorities: readonly AuthorityOwnerRecord[];
  readonly frozen: boolean;
  readonly parameterSelectionComplete: boolean;
  readonly humanGovernanceComplete: boolean;
  readonly finalActivationAuthorization: boolean;
  readonly actorKind: 'HUMAN' | 'AI' | 'S3M' | 'GROK' | 'AGENT' | 'AUTOMATION' | 'SERVICE';
};

export type ProductionEconomicConstitutionReconciliation = {
  readonly ok: boolean;
  readonly sunreyOk: boolean;
  readonly moonreyOk: boolean;
  readonly supplyOk: boolean;
  readonly genesisOk: boolean;
  readonly conversionOk: boolean;
  readonly compatibilityOk: boolean;
  readonly authorityOk: boolean;
  readonly layerSeparationOk: boolean;
  readonly implicitVersionRejected: boolean;
  readonly failures: readonly string[];
};

export type ProductionEconomicConstitutionChangeImpact = {
  readonly supplyChanged: boolean;
  readonly genesisChanged: boolean;
  readonly sunreyValuationChanged: boolean;
  readonly sunreyConversionChanged: boolean;
  readonly moonreyProductiveValueChanged: boolean;
  readonly moonreyConversionChanged: boolean;
  readonly capsChanged: boolean;
  readonly feesChanged: boolean;
  readonly burnsChanged: boolean;
  readonly oracleDependenciesChanged: boolean;
  readonly hinDependenciesChanged: boolean;
  readonly economicConstitutionHashChanged: boolean;
  readonly silentlyActivates: false;
};

export type ProductionEconomicConstitutionQualificationDecision = {
  readonly result: ProductionEconomicConstitutionQualification;
  readonly bundleState: ProductionEconomicConstitutionBundleState;
  readonly bundleHash: string;
  readonly economicConstitutionHash: string;
  readonly firewallDecisionHash: string;
  readonly parameterCoverage: readonly ParameterCoverageRecord[];
  readonly missingParameters: readonly ProductionParameterId[];
  readonly humanDecisionsRequired: readonly HumanEconomicDecisionRequired[];
  readonly humanAuthorizationRequired: readonly HumanEconomicDecisionRequired[];
  readonly externalEvidence: readonly ExternalEvidenceInventoryItem[];
  readonly legacyPaths: readonly LegacyPathInventoryItem[];
  readonly compatibility: EconomicPolicyCompatibilityGraph;
  readonly reconciliation: ProductionEconomicConstitutionReconciliation;
  readonly openBlockers: readonly string[];
  readonly productionActivated: false;
  readonly parameterSelectionIsFinalAuthorization: false;
  readonly aiCanAuthorize: false;
};

export type ProductionEconomicConstitutionCandidateReport = {
  readonly schemaVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION;
  readonly toolVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_TOOL_VERSION;
  readonly identity: {
    readonly bundleId: typeof PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID;
    readonly bundleVersion: typeof PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION;
    readonly sourceCommit: string;
    readonly economicRcId: string;
    readonly mainnetRcId: string;
    readonly bundleHash: string;
    readonly economicConstitutionHash: string;
  };
  readonly versionBindings: readonly ExactVersionBinding[];
  readonly parameterCoverage: readonly ParameterCoverageRecord[];
  readonly sunreyConstitution: SunReyConstitutionBinding;
  readonly moonreyConstitution: MoonReyConstitutionBinding;
  readonly supply: SupplyReconciliationBinding;
  readonly genesis: GenesisReconciliationBinding;
  readonly fees: { readonly policyHash: string; readonly productionConfigured: false | boolean };
  readonly burns: { readonly policyHash: string; readonly productionConfigured: false | boolean };
  readonly hin: { readonly policyHash: string; readonly chainAnchorHash: string };
  readonly oracleProductiveData: {
    readonly certificationHash: string;
    readonly fabricHash: string;
    readonly sourceTaxonomyHash: string;
  };
  readonly exchange: { readonly owner: typeof CANONICAL_AUTHORITIES.EXCHANGE };
  readonly economicRehearsal: RehearsalBinding;
  readonly stress: StressBinding;
  readonly externalEvidence: readonly ExternalEvidenceInventoryItem[];
  readonly humanDecisionsRequired: readonly HumanEconomicDecisionRequired[];
  readonly humanAuthorizationRequired: readonly HumanEconomicDecisionRequired[];
  readonly firewall: FirewallBinding;
  readonly openBlockers: readonly string[];
  readonly qualification: ProductionEconomicConstitutionQualification;
  readonly productionActive: false;
};
