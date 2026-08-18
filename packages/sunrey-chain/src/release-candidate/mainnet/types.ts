/**
 * Chunk 84 — SunRey Mainnet Release Candidate types.
 *
 * This is a MAINNET RELEASE CANDIDATE. It does not launch mainnet,
 * enable LIVE_* flags, or convert engineering qualification into
 * production-network authorization. ENGINEERING_QUALIFIED is never
 * AUTHORIZED_CANDIDATE. ReleaseAuthority signs the bundle only.
 */

export const MAINNET_RC_SCHEMA_VERSION = 1 as const;
export const MAINNET_RC_ID_PREFIX = 'SUNREY_MAINNET_RC_' as const;
export const FIRST_MAINNET_RC_ID = 'SUNREY_MAINNET_RC_1' as const;
export const MAINNET_RC_PUBLIC_API_VERSION = 'v1' as const;
export const MAINNET_RC_ENVIRONMENT = 'simulation' as const;
export const MAINNET_RC_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const MAINNET_RC_MAINNET_ENABLED = false as const;
export const MAINNET_RC_PRODUCTION_FINANCIAL_SERVICES = false as const;
export const MAINNET_RC_SIGNING_ACTIVATES_NETWORK = false as const;
export const CANDIDATE_V2_ID = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2' as const;
export const CANDIDATE_V2_DOMAIN = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2' as const;
export const ROOT_OF_TRUST_CHUNK = 'CHUNK-64' as const;
export const CEREMONY_EVIDENCE_CHUNK = 'CHUNK-85' as const;

export const MAINNET_RC_STATUSES = [
  'DRAFT',
  'ENGINEERING_QUALIFICATION',
  'ENGINEERING_QUALIFIED',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_AUTHORIZATION',
  'SUPERSEDED',
] as const;
export type MainnetRcStatus = (typeof MAINNET_RC_STATUSES)[number];

export const MAINNET_QUALIFICATION_CATEGORIES = [
  'BUILD',
  'PROTOCOL',
  'ENCODING',
  'CONSENSUS',
  'VALIDATORS',
  'GOVERNANCE',
  'CRYPTOGRAPHY',
  'PQC',
  'WALLETS',
  'NATIVE_ASSETS',
  'MONETARY_POLICY',
  'VALIDATOR_ECONOMICS',
  'FEE_MARKET',
  'MOONREY_ISSUANCE',
  'TREASURY',
  'ORACLES',
  'MACHINE_ECONOMY',
  'EXCHANGE',
  'CUSTODY',
  'INTEROPERABILITY',
  'PRIVACY',
  'STORAGE',
  'DATABASE',
  'INFRASTRUCTURE',
  'PROVIDER_ACCEPTANCE',
  'FORMAL_ASSURANCE',
  'FUZZING',
  'ADVERSARIAL_SECURITY',
  'ECONOMIC_STRESS',
  'PERFORMANCE',
  'DISASTER_RECOVERY',
  'SUPPLY_CHAIN',
  'SDK',
  'EXPLORER',
  'OBSERVABILITY',
  'EXTERNAL_SECURITY_REVIEW',
  'LEGAL_REGULATORY',
  'HUMAN_AUTHORIZATION',
] as const;
export type MainnetQualificationCategory = (typeof MAINNET_QUALIFICATION_CATEGORIES)[number];

export const MAINNET_QUALIFICATION_STATES = [
  'PASS',
  'FAIL',
  'PENDING',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'HUMAN_AUTHORIZATION_REQUIRED',
  'NOT_APPLICABLE',
] as const;
export type MainnetQualificationState = (typeof MAINNET_QUALIFICATION_STATES)[number];

export const MAINNET_QUALIFICATION_PROFILES = ['smoke', 'full', 'extended'] as const;
export type MainnetQualificationProfile = (typeof MAINNET_QUALIFICATION_PROFILES)[number];

export const MAINNET_PROTOCOL_FREEZE_KEYS = [
  'transactionProtocol',
  'blockProtocol',
  'consensus',
  'validatorRules',
  'executionRuntime',
  'stateSchemas',
  'p2pProtocol',
  'governance',
  'cryptoPolicy',
] as const;
export type MainnetProtocolFreezeKey = (typeof MAINNET_PROTOCOL_FREEZE_KEYS)[number];

export const PROVIDER_LIFECYCLE_STATES = [
  'UNCONFIGURED',
  'ENGINEERING_TESTED',
  'EXTERNALLY_EVIDENCED',
  'HUMAN_ACCEPTED',
  'PRODUCTION_ELIGIBLE',
] as const;
export type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

export const HSM_QUALIFICATION_STATES = [
  'SIMULATION_HSM',
  'SOFTWARE_SECURE_PROVIDER',
  'EXTERNAL_HSM_CONFIGURED_UNVERIFIED',
  'EXTERNAL_HSM_VERIFIED',
] as const;
export type HsmQualificationState = (typeof HSM_QUALIFICATION_STATES)[number];

export const EXTERNAL_REVIEW_STATES = [
  'NOT_PERFORMED',
  'ENGINEERING_PREPARATION_ONLY',
  'IN_PROGRESS',
  'RETEST_PENDING',
  'COMPLETED_WITH_EVIDENCE',
] as const;
export type ExternalReviewState = (typeof EXTERNAL_REVIEW_STATES)[number];

export type MainnetSourceFreeze = {
  readonly sourceCommit: string;
  readonly rustToolchain: string;
  readonly nodeToolchain: string;
  readonly npmLockDigest: string;
  readonly cargoLockRustDigest: string;
  readonly cargoLockNodeDigest: string;
  readonly generatedProtocolSourcesDigest: string;
  readonly containerImages: Readonly<Record<string, string>>;
  readonly sbomDigest: string;
  readonly provenanceDigest: string;
  readonly releaseSignature: string;
  readonly combinedDigest: string;
};

export type MainnetProtocolFreeze = {
  readonly protocolVersion: string;
  readonly hashes: Readonly<Record<MainnetProtocolFreezeKey, string>>;
  readonly combinedHash: string;
};

export type MainnetEconomicFreeze = {
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly sunreyMonetaryPolicyHash: string;
  readonly moonreyMonetaryPolicyHash: string;
  readonly feePolicyV2Hash: string;
  readonly validatorEconomicsHash: string;
  readonly moonreyIssuanceHash: string;
  readonly protocolTreasuryHash: string;
  readonly combinedHash: string;
};

export type MainnetCandidateV2Freeze = {
  readonly candidateId: typeof CANDIDATE_V2_ID;
  readonly domain: typeof CANDIDATE_V2_DOMAIN;
  readonly genesisCandidateHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly rootHash: string;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
};

export type MainnetCryptoFreeze = {
  readonly policyId: string;
  readonly consensusSuiteId: string;
  readonly pqRequiredForConsensus: false;
  readonly hsmRequiredForConsensus: false;
  readonly productionPqProvider: null;
  readonly productionHsmProvider: null;
  readonly testnetPqSoftwareSupported: boolean;
  readonly cryptoAgile: true;
  readonly digest: string;
};

export type MainnetRootOfTrustFreeze = {
  readonly architectureChunk: typeof ROOT_OF_TRUST_CHUNK;
  readonly ceremonyEvidenceChunk: typeof CEREMONY_EVIDENCE_CHUNK;
  readonly kind: 'SIMULATION_REHEARSAL';
  readonly productionCeremonyEvidence: null;
  readonly digest: string;
};

export type MainnetHsmReport = {
  readonly state: HsmQualificationState;
  readonly simulationSatisfiesExternalHardware: false;
  readonly fixtureSatisfiesExternalHardware: false;
  readonly notes: string;
};

export type ProviderAcceptanceRow = {
  readonly providerId: string;
  readonly domain: string;
  readonly state: ProviderLifecycleState;
  readonly productionEligible: false | true;
  readonly notes: string;
};

export type ProviderAcceptanceMatrix = {
  readonly rows: readonly ProviderAcceptanceRow[];
  readonly unconfigured: readonly string[];
  readonly engineeringTested: readonly string[];
  readonly externallyEvidenced: readonly string[];
  readonly humanAccepted: readonly string[];
  readonly productionEligible: readonly string[];
  readonly digest: string;
};

export type AuditRemediationSnapshot = {
  readonly externalReviewStatus: ExternalReviewState;
  readonly openFindings: readonly string[];
  readonly criticalBlockers: readonly string[];
  readonly highFindings: readonly string[];
  readonly riskAcceptances: readonly string[];
  readonly retestState: 'NOT_APPLICABLE' | 'PENDING' | 'RETESTED';
  readonly claimsExternalAuditPassed: false;
  readonly digest: string;
};

export type MainnetQualificationCell = {
  readonly category: MainnetQualificationCategory;
  readonly state: MainnetQualificationState;
  readonly sourceCommit: string;
  readonly detail: string;
  readonly evidenceDigest: string;
};

export type MainnetQualificationMatrix = {
  readonly schemaVersion: typeof MAINNET_RC_SCHEMA_VERSION;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: MainnetQualificationProfile;
  readonly cells: readonly MainnetQualificationCell[];
  readonly combinedDigest: string;
  readonly notLaunchAuthorization: true;
};

export type MainnetQualificationEvidence = {
  readonly matrix: MainnetQualificationMatrix;
  readonly formal: {
    readonly models: readonly string[];
    readonly bounds: string;
    readonly result: string;
    readonly digest: string;
    readonly counterexamples: readonly string[];
    readonly extendedRan: boolean;
  };
  readonly fuzz: {
    readonly profile: string;
    readonly corpusHash: string;
    readonly campaign: string;
    readonly ok: boolean;
    readonly digest: string;
    readonly extendedRan: boolean;
  };
  readonly adversarial: {
    readonly ok: boolean;
    readonly scenarios: readonly string[];
    readonly digest: string;
    readonly fullRangeRan: boolean;
  };
  readonly economicStress: {
    readonly ok: boolean;
    readonly campaigns: readonly string[];
    readonly criticalFailures: readonly string[];
    readonly digest: string;
    readonly longHorizonRan: boolean;
    readonly hiddenFailures: false;
  };
  readonly performance: {
    readonly environment: string;
    readonly hardware: string;
    readonly commit: string;
    readonly workload: string;
    readonly regressions: readonly string[];
    readonly productionTpsGuarantee: false;
    readonly digest: string;
  };
  readonly sevenValidator: {
    readonly ok: boolean;
    readonly bftFinality: boolean;
    readonly stateRootAgreement: boolean;
    readonly signerSafety: boolean;
    readonly validatorCatchUp: boolean;
    readonly governedUpgrades: boolean;
    readonly snapshotRecovery: boolean;
    readonly digest: string;
  };
  readonly economicE2e: {
    readonly sunreyTransfer: boolean;
    readonly moonreyIssuance: boolean;
    readonly feePolicyV2: boolean;
    readonly validatorRewards: boolean;
    readonly validatorPenalty: boolean;
    readonly treasuryTransaction: boolean;
    readonly dvp: boolean;
    readonly machineCommerce: boolean;
    readonly digest: string;
  };
  readonly storage: {
    readonly redbAtomicity: boolean;
    readonly snapshotRestore: boolean;
    readonly corruptionDetection: boolean;
    readonly schemaCompatibility: boolean;
    readonly postgresRecovery: boolean;
    readonly explorerRebuild: boolean;
    readonly digest: string;
  };
  readonly disasterRecovery: {
    readonly validatorLoss: boolean;
    readonly signerLoss: boolean;
    readonly failureDomainLoss: boolean;
    readonly databaseRecovery: boolean;
    readonly storageRestore: boolean;
    readonly rpcFailover: boolean;
    readonly explorerRebuild: boolean;
    readonly oracleDegradation: boolean;
    readonly digest: string;
  };
  readonly supplyChain: {
    readonly sbomOk: boolean;
    readonly provenanceOk: boolean;
    readonly dependencyPolicyOk: boolean;
    readonly twoBuilderComparison: 'MATCHED' | 'DIVERGED' | 'NOT_ATTEMPTED';
    readonly signedManifest: boolean;
    readonly immutableImageDigests: boolean;
    readonly unavoidableNondeterminism: readonly string[];
    readonly digest: string;
  };
  readonly regulated: {
    readonly sandboxOnly: true;
    readonly liveFlowsActivated: false;
    readonly digest: string;
  };
  readonly extended: {
    readonly ran: boolean;
    readonly claimedDurationCompleted: false;
    readonly workflows: readonly string[];
    readonly digest: string | null;
  };
};

export type MainnetReleaseKnownLimitation = {
  readonly id: string;
  readonly title: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly source: string;
  readonly hiddenFromReleaseNotes: false;
};

export type MainnetReleaseManifest = {
  readonly schemaVersion: typeof MAINNET_RC_SCHEMA_VERSION;
  readonly mainnet_rc_id: string;
  readonly source_commit: string;
  readonly protocol_version: string;
  readonly api_version: typeof MAINNET_RC_PUBLIC_API_VERSION;
  readonly candidate_v2_id: typeof CANDIDATE_V2_ID;
  readonly candidate_v2_hash: string;
  readonly economic_rc_id: string;
  readonly economic_rc_hash: string;
  readonly protocol_freeze_hash: string;
  readonly source_freeze_hash: string;
  readonly crypto_policy_hash: string;
  readonly provider_matrix_hash: string;
  readonly audit_snapshot_hash: string;
  readonly root_of_trust_hash: string;
  readonly hsm_state: HsmQualificationState;
  readonly sbom_digest: string;
  readonly provenance_digest: string;
  readonly qualification_result: MainnetRcStatus;
  readonly environment: typeof MAINNET_RC_ENVIRONMENT;
  readonly ticker_status: typeof MAINNET_RC_TICKER_STATUS;
  readonly mainnet_enabled: false;
  readonly mainnet_ready: false;
  readonly production_financial_services: false;
  readonly signing_activates_network: false;
  readonly engineering_qualified_is_not_authorized_candidate: true;
  readonly created_at_utc: string;
};

export type SignedMainnetRcBundle = {
  readonly manifest: MainnetReleaseManifest;
  readonly sourceFreeze: MainnetSourceFreeze;
  readonly protocolFreeze: MainnetProtocolFreeze;
  readonly economicFreeze: MainnetEconomicFreeze;
  readonly candidateV2: MainnetCandidateV2Freeze;
  readonly cryptoFreeze: MainnetCryptoFreeze;
  readonly rootOfTrust: MainnetRootOfTrustFreeze;
  readonly hsm: MainnetHsmReport;
  readonly providers: ProviderAcceptanceMatrix;
  readonly audit: AuditRemediationSnapshot;
  readonly qualification: MainnetQualificationMatrix;
  readonly evidence: MainnetQualificationEvidence;
  readonly limitations: readonly MainnetReleaseKnownLimitation[];
  readonly signatures: {
    readonly manifest: string;
    readonly artifacts: string;
    readonly sbom: string;
    readonly provenance: string;
    readonly qualification: string;
  };
  readonly authorityId: string;
  readonly supersededBy: string | null;
};

export type MainnetReleaseCandidate = SignedMainnetRcBundle;

export type MainnetCompatibilityReport = {
  readonly typescriptSdk: boolean;
  readonly rustSdk: boolean;
  readonly explorer: boolean;
  readonly wallets: boolean;
  readonly digest: string;
};

export type MainnetReleaseVerificationReport = {
  readonly ok: boolean;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export type MainnetReleaseComparison = {
  readonly left: string;
  readonly right: string;
  readonly materialChange: boolean;
  readonly sourceChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly protocolChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly economicChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly providerChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly securityChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly auditChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
  readonly qualificationChanges: readonly { readonly field: string; readonly left: string; readonly right: string }[];
};

export type MainnetQualificationReport = {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly candidateV2Hash: string;
  readonly economicRcHash: string;
  readonly releaseManifestHash: string;
  readonly qualificationResult: MainnetRcStatus;
  readonly matrix: readonly { readonly category: MainnetQualificationCategory; readonly state: MainnetQualificationState }[];
  readonly formal: string;
  readonly fuzz: string;
  readonly adversarial: string;
  readonly economicStress: string;
  readonly performance: MainnetQualificationEvidence['performance'];
  readonly providerState: {
    readonly unconfigured: readonly string[];
    readonly engineeringTested: readonly string[];
    readonly externallyEvidenced: readonly string[];
    readonly humanAccepted: readonly string[];
    readonly productionEligible: readonly string[];
  };
  readonly auditState: AuditRemediationSnapshot;
  readonly hsmState: HsmQualificationState;
  readonly pqcState: MainnetCryptoFreeze;
  readonly knownLimitations: readonly string[];
  readonly externalHumanGaps: readonly string[];
  readonly mainnetEnabled: false;
  readonly authorizedCandidate: false;
};
