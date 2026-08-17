/**
 * Chunk 63 — SunRey Testnet release-candidate types.
 *
 * This is TESTNET work. No status implies mainnet readiness.
 * Tickers remain NOT_ASSIGNED. ENVIRONMENT stays simulation.
 * ReleaseAuthority signs RC artifacts only. It is not Execution
 * Authority and does not activate protocol change.
 */

export const RC_SCHEMA_VERSION = 1 as const;
export const RC_ID_PREFIX = 'SUNREY_TESTNET_RC_' as const;
export const FIRST_RC_ID = 'SUNREY_TESTNET_RC_1' as const;
export const PUBLIC_API_VERSION = 'v1' as const;
export const RC_ENVIRONMENT = 'simulation' as const;
export const RC_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const RC_MAINNET_READY = false as const;
export const RC_PRODUCTION_FINANCIAL_SERVICES = false as const;

export const RC_STATUSES = [
  'BUILDING',
  'QUALIFICATION_IN_PROGRESS',
  'QUALIFIED_FOR_TESTNET_RC',
  'QUALIFIED_WITH_PENDING_EXTENDED_TEST',
  'SUPERSEDED',
] as const;
export type RcStatus = (typeof RC_STATUSES)[number];

export const FEATURE_STATES = [
  'FROZEN_IN_RC',
  'EXCLUDED_FROM_RC',
  'EXPERIMENTAL_TESTNET_ONLY',
] as const;
export type FeatureState = (typeof FEATURE_STATES)[number];

export const QUALIFICATION_CATEGORIES = [
  'BUILD',
  'PROTOCOL',
  'CONSENSUS',
  'CRYPTO',
  'WALLET',
  'NATIVE_ASSETS',
  'MOONREY',
  'EXCHANGE',
  'CUSTODY',
  'ORACLE',
  'MACHINE',
  'INTEROP',
  'SDK',
  'EXPLORER',
  'SECURITY',
  'FORMAL',
  'PERFORMANCE',
  'OPERATIONS',
  'DR',
  'SUPPLY_CHAIN',
] as const;
export type QualificationCategory = (typeof QUALIFICATION_CATEGORIES)[number];

export const QUALIFICATION_STATES = [
  'PASS',
  'FAIL',
  'NOT_APPLICABLE',
  'PENDING_EXTENDED_TEST',
] as const;
export type QualificationState = (typeof QUALIFICATION_STATES)[number];

export const QUALIFICATION_PROFILES = ['smoke', 'full', 'endurance'] as const;
export type QualificationProfile = (typeof QUALIFICATION_PROFILES)[number];

export const PROTOCOL_FREEZE_KEYS = [
  'canonicalTransactionSchema',
  'blockSchema',
  'consensusParameters',
  'stateMachineVersion',
  'nativeAssetSchema',
  'feeSchema',
  'governanceSchema',
  'oracleSchema',
  'productiveEconomySchema',
  'interopPacketSchema',
] as const;
export type ProtocolFreezeKey = (typeof PROTOCOL_FREEZE_KEYS)[number];

export type FeatureInventoryEntry = {
  readonly featureId: string;
  readonly title: string;
  readonly state: FeatureState;
  readonly notes: string;
};

export type ProtocolFreeze = {
  readonly protocolVersion: string;
  readonly hashes: Readonly<Record<ProtocolFreezeKey, string>>;
  readonly combinedHash: string;
};

export type ApiFreeze = {
  readonly publicApiVersion: typeof PUBLIC_API_VERSION;
  readonly rustSdkCrate: 'sunrey-sdk';
  readonly compatibility: 'BACKWARD_COMPATIBLE';
  readonly breakingChangeRequiresNewRc: true;
  readonly digest: string;
};

export type CryptoPolicyFreeze = {
  readonly policyId: string;
  readonly classicalAlgorithms: readonly string[];
  readonly pqProvider: string;
  readonly pqProviderVersion: string;
  readonly hybridRequired: boolean;
  readonly selectedRolePolicies: Readonly<Record<string, string>>;
  readonly legacyVerificationPolicy: string;
  readonly productionCryptographicApproval: false;
  readonly quantumProofClaim: false;
  readonly digest: string;
};

export type DependencyFreeze = {
  readonly npmLockDigest: string;
  readonly cargoLockRustDigest: string;
  readonly cargoLockNodeDigest: string;
  readonly containerBaseDigests: Readonly<Record<string, string>>;
  readonly toolchain: {
    readonly rust: string;
    readonly node: string;
  };
  readonly pqcDependency: string;
  readonly formalTools: string;
  readonly combinedDigest: string;
};

export type ArtifactFreeze = {
  readonly digests: Readonly<Record<string, string>>;
  readonly combinedDigest: string;
};

export type QualificationCell = {
  readonly category: QualificationCategory;
  readonly state: QualificationState;
  readonly sourceCommit: string;
  readonly detail: string;
  readonly evidenceDigest: string;
};

export type RCQualificationMatrix = {
  readonly schemaVersion: typeof RC_SCHEMA_VERSION;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: QualificationProfile;
  readonly cells: readonly QualificationCell[];
  readonly combinedDigest: string;
};

export type KnownSecurityLimitation = {
  readonly id: string;
  readonly title: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly source: string;
  readonly hiddenFromReleaseNotes: false;
};

export type RcReleaseNotes = {
  readonly rcId: string;
  readonly banner: 'SUNREY TESTNET';
  readonly mainnetReady: false;
  readonly features: readonly string[];
  readonly protocolChanges: readonly string[];
  readonly securityChanges: readonly string[];
  readonly pqcChanges: readonly string[];
  readonly knownLimitations: readonly KnownSecurityLimitation[];
  readonly breakingChanges: readonly string[];
  readonly migrationInstructions: readonly string[];
  readonly operatorInstructions: readonly string[];
  readonly sdkChanges: readonly string[];
};

export type TestnetReleaseCandidateManifest = {
  readonly schemaVersion: typeof RC_SCHEMA_VERSION;
  readonly rc_id: string;
  readonly source_commit: string;
  readonly protocol_version: string;
  readonly api_version: typeof PUBLIC_API_VERSION;
  readonly testnet_network_id: string;
  readonly chain_id: string;
  readonly genesis_hash: string;
  readonly validator_set_fixture_hash: string;
  readonly protocol_schema_hash: string;
  readonly module_hashes: Readonly<Record<string, string>>;
  readonly crypto_suite_policy: CryptoPolicyFreeze;
  readonly native_asset_registry_hash: string;
  readonly governance_policy_hash: string;
  readonly dependency_lock_digests: DependencyFreeze;
  readonly sbom_digest: string;
  readonly provenance_digest: string;
  readonly formal_report_digest: string;
  readonly audit_bundle_digest: string;
  readonly fuzz_report_reference: string;
  readonly adversarial_report_reference: string;
  readonly performance_baseline_reference: string;
  readonly build_artifact_digests: Readonly<Record<string, string>>;
  readonly qualification_state: RcStatus;
  readonly environment: typeof RC_ENVIRONMENT;
  readonly ticker_status: typeof RC_TICKER_STATUS;
  readonly mainnet_ready: false;
  readonly production_financial_services: false;
  readonly created_at_utc: string;
};

export type SignedRcBundle = {
  readonly manifest: TestnetReleaseCandidateManifest;
  readonly featureInventory: readonly FeatureInventoryEntry[];
  readonly protocolFreeze: ProtocolFreeze;
  readonly apiFreeze: ApiFreeze;
  readonly qualification: RCQualificationMatrix;
  readonly notes: RcReleaseNotes;
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

export type RcCompareReport = {
  readonly left: string;
  readonly right: string;
  readonly materialChange: boolean;
  readonly differences: readonly { readonly field: string; readonly left: string; readonly right: string }[];
};

export type RcVerifyReport = {
  readonly ok: boolean;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export type EnduranceConfig = {
  readonly ticks: number;
  readonly claimedDurationCompleted: false;
};
