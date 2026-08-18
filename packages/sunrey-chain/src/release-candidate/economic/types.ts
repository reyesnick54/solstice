/**
 * Chunk 78 — SunRey economic release-candidate types.
 *
 * TESTNET / PRODUCTION-CANDIDATE economic qualification only.
 * This does not authorize mainnet, invent production parameters, or
 * treat engineering qualification as regulatory approval.
 * ReleaseAuthority signs the economic bundle only. It does not
 * activate economic policy or issue Execution Authority.
 */

export const ECONOMIC_RC_SCHEMA_VERSION = 1 as const;
export const ECONOMIC_RC_ID_PREFIX = 'SUNREY_ECONOMIC_TESTNET_RC_' as const;
export const FIRST_ECONOMIC_RC_ID = 'SUNREY_ECONOMIC_TESTNET_RC_1' as const;
export const ECONOMIC_PUBLIC_API_VERSION = 'v1' as const;
export const ECONOMIC_RC_ENVIRONMENT = 'simulation' as const;
export const ECONOMIC_RC_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const ECONOMIC_RC_MAINNET_READY = false as const;
export const ECONOMIC_RC_PRODUCTION_FINANCIAL_SERVICES = false as const;
export const PRODUCTION_PARAMETER_UNCONFIGURED = 'UNCONFIGURED' as const;

export const ECONOMIC_RC_STATUSES = [
  'BUILDING',
  'QUALIFICATION_IN_PROGRESS',
  'QUALIFIED_FOR_ECONOMIC_TESTNET_RC',
  'QUALIFIED_WITH_PENDING_EXTENDED_TEST',
  'SUPERSEDED',
] as const;
export type EconomicRcStatus = (typeof ECONOMIC_RC_STATUSES)[number];

export const ECONOMIC_QUALIFICATION_CATEGORIES = [
  'MONETARY_POLICY',
  'SUNREY_SUPPLY',
  'MOONREY_SUPPLY',
  'GENESIS_POLICY',
  'VALIDATOR_ECONOMICS',
  'FEE_MARKET',
  'MOONREY_ISSUANCE',
  'ORACLES',
  'PROTOCOL_TREASURY',
  'EXCHANGE_SETTLEMENT',
  'MACHINE_ECONOMY',
  'DUAL_ECONOMY',
  'FORMAL_ASSURANCE',
  'PROPERTY_TESTING',
  'ADVERSARIAL_STRESS',
  'PERFORMANCE',
  'RECOVERY',
  'GOVERNANCE',
  'SUPPLY_CHAIN',
  'SDK',
  'EXPLORER',
] as const;
export type EconomicQualificationCategory = (typeof ECONOMIC_QUALIFICATION_CATEGORIES)[number];

export const ECONOMIC_QUALIFICATION_STATES = [
  'PASS',
  'FAIL',
  'PENDING_EXTENDED_TEST',
  'NOT_APPLICABLE',
] as const;
export type EconomicQualificationState = (typeof ECONOMIC_QUALIFICATION_STATES)[number];

export const ECONOMIC_QUALIFICATION_PROFILES = ['smoke', 'full', 'extended'] as const;
export type EconomicQualificationProfile = (typeof ECONOMIC_QUALIFICATION_PROFILES)[number];

export const ECONOMIC_POLICY_FREEZE_KEYS = [
  'sunreyMonetaryPolicy',
  'moonreyMonetaryPolicy',
  'validatorBondPolicy',
  'validatorRewardPolicy',
  'validatorPenaltyPolicy',
  'feePolicyV2',
  'resourceWeightSchedule',
  'feeDispositionPolicy',
  'moonreyProductivePolicy',
  'normalizationRules',
  'issuanceBudgets',
  'protocolTreasuryPolicy',
  'dualEconomyScenarioSchema',
] as const;
export type EconomicPolicyFreezeKey = (typeof ECONOMIC_POLICY_FREEZE_KEYS)[number];

export const ECONOMIC_SCHEMA_FREEZE_KEYS = [
  'monetaryPolicy',
  'issuanceAuthority',
  'validatorEconomics',
  'feePolicy',
  'moonreyContributionPolicy',
  'treasuryBudget',
  'treasuryDisbursement',
  'economicReports',
] as const;
export type EconomicSchemaFreezeKey = (typeof ECONOMIC_SCHEMA_FREEZE_KEYS)[number];

export const REQUIRED_DUAL_ECONOMY_SCENARIOS = [
  'baseline',
  'rapid-automation',
  'energy-scarcity',
  'compute-abundance',
  'high-concentration',
] as const;
export type RequiredDualEconomyScenario = (typeof REQUIRED_DUAL_ECONOMY_SCENARIOS)[number];

export const ECONOMIC_FORMAL_MODEL_IDS = [
  'NATIVE_MONETARY_POLICY',
  'GENESIS_ALLOCATION_CONSERVATION',
  'VALIDATOR_ECONOMICS',
  'ADAPTIVE_FEE_MARKET',
  'MOONREY_POLICY_GOVERNANCE',
  'FEE_CONSERVATION',
  'NATIVE_ASSET_CONSERVATION',
] as const;
export type EconomicFormalModelId = (typeof ECONOMIC_FORMAL_MODEL_IDS)[number];

export type UnconfiguredProductionValue = {
  readonly id: string;
  readonly value: typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly notes: string;
};

export type EconomicPolicyFreeze = {
  readonly schemaVersion: typeof ECONOMIC_RC_SCHEMA_VERSION;
  readonly hashes: Readonly<Record<EconomicPolicyFreezeKey, string>>;
  readonly unconfiguredProductionValues: readonly UnconfiguredProductionValue[];
  readonly combinedHash: string;
};

export type EconomicSchemaFreeze = {
  readonly schemaVersion: typeof ECONOMIC_RC_SCHEMA_VERSION;
  readonly hashes: Readonly<Record<EconomicSchemaFreezeKey, string>>;
  readonly breakingChangeRequiresNewRc: true;
  readonly combinedHash: string;
};

export type EconomicSourceBinding = {
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseArtifactDigest: string;
  readonly economicSchemaVersions: Readonly<Record<string, string>>;
  readonly policyHashes: Readonly<Record<string, string>>;
  readonly formalEvidenceDigest: string;
  readonly stressEvidenceDigest: string;
  readonly supplyChainEvidenceDigest: string;
};

export type EconomicQualificationCell = {
  readonly category: EconomicQualificationCategory;
  readonly state: EconomicQualificationState;
  readonly sourceCommit: string;
  readonly detail: string;
  readonly evidenceDigest: string;
};

export type EconomicQualificationMatrix = {
  readonly schemaVersion: typeof ECONOMIC_RC_SCHEMA_VERSION;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: EconomicQualificationProfile;
  readonly cells: readonly EconomicQualificationCell[];
  readonly combinedDigest: string;
  readonly notRegulatoryApproval: true;
};

export type EconomicQualificationEvidence = {
  readonly matrix: EconomicQualificationMatrix;
  readonly formal: {
    readonly models: readonly string[];
    readonly result: string;
    readonly digest: string;
    readonly counterexamples: readonly string[];
    readonly registryEquivalents: readonly string[];
  };
  readonly stress: {
    readonly ok: boolean;
    readonly criticalFailures: readonly string[];
    readonly digest: string;
    readonly hiddenFailures: false;
  };
  readonly simulation: {
    readonly scenarios: readonly string[];
    readonly ok: boolean;
    readonly digest: string;
  };
  readonly property: {
    readonly seed: number;
    readonly corpusReference: string;
    readonly ok: boolean;
    readonly digest: string;
  };
  readonly sevenValidator: {
    readonly ok: boolean;
    readonly exercises: readonly string[];
    readonly digest: string;
  };
  readonly supply: {
    readonly ok: boolean;
    readonly sunrey: string;
    readonly moonrey: string;
    readonly validatorBond: string;
    readonly feeBurn: string;
    readonly treasury: string;
    readonly exchangeLocks: string;
    readonly machineEscrow: string;
    readonly interopEscrow: string;
    readonly digest: string;
  };
  readonly recovery: {
    readonly snapshot: boolean;
    readonly postgres: boolean;
    readonly explorer: boolean;
    readonly invariantsIdentical: boolean;
    readonly digest: string;
  };
  readonly upgrade: {
    readonly oldPolicyBefore: boolean;
    readonly newPolicyAfter: boolean;
    readonly historicalPreserved: boolean;
    readonly laggingNodeCatchUp: boolean;
    readonly digest: string;
  };
  readonly compatibility: {
    readonly typescriptSdk: boolean;
    readonly rustSdk: boolean;
    readonly explorer: boolean;
    readonly digest: string;
  };
  readonly performance: {
    readonly context: string;
    readonly claimedExtendedDuration: false;
    readonly digest: string;
  };
  readonly extended: {
    readonly ran: boolean;
    readonly claimedDurationCompleted: false;
    readonly digest: string | null;
  };
};

export type EconomicKnownLimitation = {
  readonly id: string;
  readonly title: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly source: string;
  readonly hiddenFromReleaseNotes: false;
};

export type EconomicReleaseManifest = {
  readonly schemaVersion: typeof ECONOMIC_RC_SCHEMA_VERSION;
  readonly economic_rc_id: string;
  readonly source_commit: string;
  readonly protocol_version: string;
  readonly api_version: typeof ECONOMIC_PUBLIC_API_VERSION;
  readonly network_id: string;
  readonly chain_id: string;
  readonly monetary_policy_hashes: Readonly<Record<string, string>>;
  readonly fee_policy_hash: string;
  readonly validator_economics_hash: string;
  readonly moonrey_policy_hash: string;
  readonly treasury_policy_hash: string;
  readonly formal_report_hash: string;
  readonly stress_report_hash: string;
  readonly simulation_report_hash: string;
  readonly sbom_digest: string;
  readonly release_provenance_digest: string;
  readonly qualification_result: EconomicRcStatus;
  readonly environment: typeof ECONOMIC_RC_ENVIRONMENT;
  readonly ticker_status: typeof ECONOMIC_RC_TICKER_STATUS;
  readonly mainnet_ready: false;
  readonly production_financial_services: false;
  readonly signing_activates_policy: false;
  readonly created_at_utc: string;
};

export type SignedEconomicRcBundle = {
  readonly manifest: EconomicReleaseManifest;
  readonly sourceBinding: EconomicSourceBinding;
  readonly policyFreeze: EconomicPolicyFreeze;
  readonly schemaFreeze: EconomicSchemaFreeze;
  readonly qualification: EconomicQualificationMatrix;
  readonly evidence: EconomicQualificationEvidence;
  readonly limitations: readonly EconomicKnownLimitation[];
  readonly signatures: {
    readonly manifest: string;
    readonly policyBundle: string;
    readonly qualification: string;
    readonly formal: string;
    readonly stress: string;
    readonly sbom: string;
    readonly provenance: string;
  };
  readonly authorityId: string;
  readonly supersededBy: string | null;
};

export type EconomicCompatibilityReport = {
  readonly typescriptSdkReadsFrozenPolicies: boolean;
  readonly rustSdkReadsFrozenPolicies: boolean;
  readonly typescriptSdkReadsReceipts: boolean;
  readonly rustSdkReadsReceipts: boolean;
  readonly explorerMonetary: boolean;
  readonly explorerSupply: boolean;
  readonly explorerValidatorEconomics: boolean;
  readonly explorerFees: boolean;
  readonly explorerMoonreyProvenance: boolean;
  readonly explorerTreasury: boolean;
  readonly digest: string;
};

export type EconomicReleaseComparison = {
  readonly left: string;
  readonly right: string;
  readonly materialChange: boolean;
  readonly policyChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly schemaChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly parameterChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly formalChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly stressChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly supplyBehaviorChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly compatibilityStatus: 'COMPATIBLE' | 'BREAKING' | 'IDENTICAL';
};

export type EconomicReleaseReadinessReport = {
  readonly rcId: string;
  readonly engineeringStatus: 'ENGINEERING_VERIFIED' | 'QUALIFICATION_IN_PROGRESS';
  readonly mainnetAuthorized: false;
  readonly externalApprovalsRemain: true;
  readonly digest: string;
};

export type EconomicQualificationReport = {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly policyHashes: Readonly<Record<string, string>>;
  readonly matrix: readonly { readonly category: EconomicQualificationCategory; readonly state: EconomicQualificationState }[];
  readonly formalResult: string;
  readonly stressResult: string;
  readonly simulationResult: string;
  readonly sevenValidatorResult: string;
  readonly supplyReconciliation: EconomicQualificationEvidence['supply'];
  readonly recoveryResult: string;
  readonly performanceContext: string;
  readonly knownLimitations: readonly string[];
  readonly unconfiguredProductionValues: readonly UnconfiguredProductionValue[];
  readonly mainnetReady: false;
  readonly regulatoryApproval: false;
};

export type EconomicRcVerifyReport = {
  readonly ok: boolean;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};
