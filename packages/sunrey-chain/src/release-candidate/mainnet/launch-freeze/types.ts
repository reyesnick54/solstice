/**
 * Chunk 164 — Immutable production launch candidate freeze.
 *
 * Identifies exactly which software, protocol, economic constitution,
 * genesis candidate, providers, external evidence, operating scope,
 * security artifacts, database schemas, and configuration would
 * constitute one production launch candidate.
 *
 * Freeze is not approval. Freeze is not authorization. Freeze is not
 * activation. This module never mints, never issues Execution
 * Authority, never enables mainnet, and never flips LIVE_* flags.
 *
 * Canonical owner remains Chunk 84 mainnet release candidate.
 * Do not create packages/launch-candidate, packages/release-v2,
 * packages/mainnet-v2, packages/production-release, or
 * packages/production-manifest.
 */

export const LAUNCH_FREEZE_SCHEMA_VERSION = 1 as const;
export const LAUNCH_FREEZE_CONTENT_VERSION = 1 as const;
export const LAUNCH_FREEZE_DOMAIN = 'SUNREY_PRODUCTION_LAUNCH_CANDIDATE_FREEZE_V1' as const;
export const LAUNCH_FREEZE_TOOL_VERSION = 'sunrey-release/production-launch-freeze/1' as const;
export const LAUNCH_FREEZE_CAPABILITY = 'sunrey-production-launch-freeze' as const;
export const CURRENT_LAUNCH_FREEZE_ID = 'sunrey.production.launch-candidate.freeze.v1' as const;
export const GENESIS_CANDIDATE_BIND_ID = 'sunrey.production.genesis.candidate.v1' as const;
export const CHUNK_164_ID = 'CHUNK-164' as const;

export const LAUNCH_FREEZE_PRODUCTION_ACTIVATED = false as const;
export const LAUNCH_FREEZE_MAINNET_ENABLED = false as const;
export const LAUNCH_FREEZE_LIVE_CONNECTIVITY_ENABLED = false as const;
export const FREEZE_EQUALS_APPROVAL = false as const;
export const FREEZE_EQUALS_ACTIVATION = false as const;
export const FREEZE_CAN_MINT = false as const;
export const FREEZE_CAN_ISSUE_EXECUTION_AUTHORITY = false as const;
export const FIXTURE_EVIDENCE_SATISFIES_PRODUCTION = false as const;

export const LAUNCH_FREEZE_STATES = [
  'DRAFT',
  'INCOMPLETE',
  'ENGINEERING_VALIDATED',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_PRODUCTION_PARAMETERS',
  'AWAITING_HUMAN_AUTHORIZATION',
  'FROZEN_FOR_REVIEW',
  'STALE',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type LaunchFreezeState = (typeof LAUNCH_FREEZE_STATES)[number];

export const FORBIDDEN_LAUNCH_FREEZE_STATES = ['PRODUCTION_ACTIVE', 'LIVE', 'DEPLOYED'] as const;
export type ForbiddenLaunchFreezeState = (typeof FORBIDDEN_LAUNCH_FREEZE_STATES)[number];

export const LAUNCH_REVIEW_CLASSES = ['INCOMPLETE_REVIEW_CANDIDATE', 'LAUNCH_REVIEW_READY'] as const;
export type LaunchReviewClass = (typeof LAUNCH_REVIEW_CLASSES)[number];

export const REJECTED_IMPLICIT_VERSIONS = ['latest', 'current', 'default', 'main', 'head'] as const;

export const LAUNCH_FREEZE_DIFF_CLASSES = [
  'SOFTWARE',
  'ARCHITECTURE',
  'ECONOMICS',
  'GENESIS',
  'VALIDATORS',
  'CRYPTOGRAPHY',
  'PROVIDER',
  'LEGAL_EXTERNAL_EVIDENCE',
  'OPERATING_SCOPE',
  'DATABASE',
  'SECURITY',
  'TEST_EVIDENCE',
] as const;
export type LaunchFreezeDiffClass = (typeof LAUNCH_FREEZE_DIFF_CLASSES)[number];

export const LAUNCH_FREEZE_STALENESS_REASONS = [
  'SOURCE_COMMIT_CHANGED',
  'ARCHITECTURE_MANIFEST_CHANGED',
  'PARAMETER_PACKAGE_CHANGED',
  'ECONOMIC_AUTHORIZATION_CHANGED',
  'GENESIS_CHANGED',
  'VALIDATOR_SET_CHANGED',
  'CRYPTO_POLICY_CHANGED',
  'EXTERNAL_EVIDENCE_EXPIRED',
  'EXTERNAL_EVIDENCE_REVOKED',
  'OPERATING_SCOPE_CHANGED',
  'PROVIDER_BINDING_CHANGED',
  'DATABASE_MIGRATION_CHANGED',
  'SECURITY_BUNDLE_CHANGED',
  'FULL_PLATFORM_QUALIFICATION_CHANGED',
] as const;
export type LaunchFreezeStalenessReason = (typeof LAUNCH_FREEZE_STALENESS_REASONS)[number];

export const ENVIRONMENTAL_METRIC_KINDS = [
  'CPU_TEMPERATURE',
  'TEMPORARY_LOCAL_TEST_DURATION',
  'WALL_CLOCK_MONITORING',
] as const;
export type EnvironmentalMetricKind = (typeof ENVIRONMENTAL_METRIC_KINDS)[number];

export const LAUNCH_FREEZE_BLOCKER_CODES = [
  'FLOATING_VERSION_REJECTED',
  'SECRET_VALUE_REJECTED',
  'PRIVATE_KEY_REJECTED',
  'PRODUCTION_PARAMETERS_UNCONFIGURED',
  'EXTERNAL_EVIDENCE_INCOMPLETE',
  'EXTERNAL_EVIDENCE_EXPIRED',
  'EXTERNAL_EVIDENCE_REVOKED',
  'FIXTURE_EVIDENCE_CANNOT_SATISFY_PRODUCTION',
  'HUMAN_AUTHORIZATION_INCOMPLETE',
  'ENGINEERING_NOT_VALIDATED',
  'INCOMPLETE_REVIEW_CANDIDATE',
  'FREEZE_FOR_REVIEW_REQUIRES_COMPLETE_INPUTS',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'MAINNET_ENABLE_FORBIDDEN',
  'MINT_FORBIDDEN',
  'EXECUTION_AUTHORITY_FORBIDDEN',
] as const;
export type LaunchFreezeBlockerCode = (typeof LAUNCH_FREEZE_BLOCKER_CODES)[number];

export const CRITICAL_LAUNCH_FREEZE_COMPONENTS = [
  'architecture-manifest',
  'architecture-integrity-baseline',
  'package-lock',
  'mainnet-rc',
  'economic-rc',
  'full-platform-candidate',
  'production-economic-authorization',
  'production-parameter-package',
  'chunk-71-monetary-constitution',
  'chunk-144-parameter-package',
  'chunk-145-sunrey-policy-candidate',
  'chunk-146-moonrey-policy-candidate',
  'chunk-148-economic-constitution-candidate',
  'chunk-163-economic-authorization',
  'external-evidence-snapshot',
  'operating-scope-snapshot',
  'provider-binding-snapshot',
  'validator-candidate-set',
  'cryptographic-policy',
  'genesis-candidate',
  'genesis-allocation-manifest',
  'production-ceremony-plan',
  'database-migration-manifest',
  'configuration-baseline',
  'sbom',
  'provenance',
  'audit-bundle',
  'test-receipt-bundle',
  'adversarial-campaign',
  'burn-in-report',
] as const;
export type CriticalLaunchFreezeComponent = (typeof CRITICAL_LAUNCH_FREEZE_COMPONENTS)[number];

export type ExactVersionBinding = {
  readonly componentId: string;
  readonly schemaVersion: string;
  readonly contentVersion: string;
  readonly contentHash: string;
};

export type ExternalEvidenceSnapshotRecord = {
  readonly recordId: string;
  readonly evidenceClass: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly scopeLabel: string;
  readonly contentDigest: string;
  readonly verificationState: string;
  readonly expiresAtUtc: string | null;
  readonly revoked: boolean;
  readonly fixture: boolean;
};

export type ExternalEvidenceFreezeSnapshot = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly snapshotHash: string;
  readonly records: readonly ExternalEvidenceSnapshotRecord[];
  readonly complete: boolean;
  readonly fixtureOnly: boolean;
  readonly expired: boolean;
  readonly revoked: boolean;
};

export type OperatingScopeSnapshotRow = {
  readonly rowId: string;
  readonly jurisdiction: string;
  readonly legalEntityRef: string;
  readonly activationDomain: string;
  readonly corridorId: string | null;
  readonly asset: string | null;
  readonly eligibility: boolean;
  readonly status: string;
  readonly providerRequirements: readonly string[];
};

export type OperatingScopeFreezeSnapshot = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly snapshotHash: string;
  readonly rows: readonly OperatingScopeSnapshotRow[];
  readonly corridorIds: readonly string[];
  readonly requirementIds: readonly string[];
};

export type ProviderBindingSnapshotRow = {
  readonly providerId: string;
  readonly domain: string;
  readonly profileVersion: string;
  readonly endpointProfileHash: string;
  readonly credentialDescriptorRef: string;
  readonly evidenceRefs: readonly string[];
  readonly operatingScopeRefs: readonly string[];
  readonly failoverBindingId: string | null;
};

export type ProviderBindingFreezeSnapshot = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly snapshotHash: string;
  readonly rows: readonly ProviderBindingSnapshotRow[];
};

export type MigrationRecord = {
  readonly migrationId: string;
  readonly contentDigest: string;
};

export type DatabaseMigrationEntry = {
  readonly databaseName: string;
  readonly latestSchemaVersion: string;
  readonly migrations: readonly MigrationRecord[];
};

export type DatabaseMigrationManifest = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly manifestHash: string;
  readonly databases: readonly DatabaseMigrationEntry[];
};

export type ConfigurationBaseline = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly baselineHash: string;
  readonly environment: 'simulation';
  readonly liveFlags: Readonly<Record<string, false>>;
  readonly credentialDescriptorHashes: readonly string[];
  readonly rustBuildIdentityHash: string;
};

export type ReleaseBillOfMaterials = {
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly bomHash: string;
  readonly components: readonly ExactVersionBinding[];
  readonly implicitVersionsPresent: boolean;
};

export type ProductionLaunchCandidateFreezeInput = {
  readonly freezeId: string;
  readonly freezeVersion?: number;
  readonly sourceCommit: string;
  readonly sourceTreeHash: string | null;
  readonly architectureManifestHash: string;
  readonly architectureIntegrityBaselineHash: string;
  readonly packageLockHash: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly productionEconomicAuthorizationHash: string;
  readonly productionParameterPackageHash: string;
  readonly externalEvidenceSnapshotHash: string;
  readonly operatingScopeSnapshotHash: string;
  readonly providerBindingSnapshotHash: string;
  readonly validatorCandidateSetHash: string;
  readonly cryptographicPolicyHash: string;
  readonly genesisCandidateId: string;
  readonly genesisCandidateHash: string;
  readonly genesisAllocationManifestHash: string;
  readonly productionCeremonyPlanHash: string;
  readonly databaseMigrationManifestHash: string;
  readonly configurationBaselineHash: string;
  readonly sbomHash: string;
  readonly provenanceHash: string;
  readonly auditBundleHash: string;
  readonly testReceiptBundleHash: string;
  readonly adversarialCampaignHash: string;
  readonly burnInReportHash: string;
  readonly bindings: readonly ExactVersionBinding[];
  readonly productionParametersComplete: boolean;
  readonly externalEvidenceComplete: boolean;
  readonly humanAuthorizationComplete: boolean;
  readonly engineeringValidated?: boolean;
  readonly supersededBy?: string | null;
  readonly fixtureEvidenceUsed?: boolean;
  readonly requestFrozenForReview?: boolean;
  readonly rejected?: boolean;
};

export type ProductionLaunchCandidateFreeze = {
  readonly freezeId: string;
  readonly schemaVersion: typeof LAUNCH_FREEZE_SCHEMA_VERSION;
  readonly freezeVersion: number;
  readonly status: LaunchFreezeState;
  readonly reviewClass: LaunchReviewClass;
  readonly sourceCommit: string;
  readonly sourceTreeHash: string | null;
  readonly architectureManifestHash: string;
  readonly architectureIntegrityBaselineHash: string;
  readonly packageLockHash: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly productionEconomicAuthorizationHash: string;
  readonly productionParameterPackageHash: string;
  readonly externalEvidenceSnapshotHash: string;
  readonly operatingScopeSnapshotHash: string;
  readonly providerBindingSnapshotHash: string;
  readonly validatorCandidateSetHash: string;
  readonly cryptographicPolicyHash: string;
  readonly genesisCandidateId: string;
  readonly genesisCandidateHash: string;
  readonly genesisAllocationManifestHash: string;
  readonly productionCeremonyPlanHash: string;
  readonly databaseMigrationManifestHash: string;
  readonly configurationBaselineHash: string;
  readonly sbomHash: string;
  readonly provenanceHash: string;
  readonly auditBundleHash: string;
  readonly testReceiptBundleHash: string;
  readonly adversarialCampaignHash: string;
  readonly burnInReportHash: string;
  readonly freezeHash: string;
  readonly bindings: readonly ExactVersionBinding[];
  readonly blockers: readonly LaunchFreezeBlockerCode[];
  readonly productionActivated: false;
  readonly mainnetEnabled: false;
  readonly liveConnectivityEnabled: false;
  readonly freezeEqualsApproval: false;
  readonly freezeEqualsActivation: false;
  readonly supersededBy: string | null;
};

export type LaunchFreezeObservation = {
  readonly sourceCommit: string;
  readonly architectureManifestHash: string;
  readonly productionParameterPackageHash: string;
  readonly productionEconomicAuthorizationHash: string;
  readonly genesisCandidateHash: string;
  readonly validatorCandidateSetHash: string;
  readonly cryptographicPolicyHash: string;
  readonly externalEvidenceSnapshotHash: string;
  readonly externalEvidenceExpired: boolean;
  readonly externalEvidenceRevoked: boolean;
  readonly operatingScopeSnapshotHash: string;
  readonly providerBindingSnapshotHash: string;
  readonly databaseMigrationManifestHash: string;
  readonly securityBundleHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly environmental?: {
    readonly cpuTemperature?: number;
    readonly temporaryLocalTestDurationMs?: number;
    readonly wallClockMonitoringMetric?: string;
  };
};

export type LaunchFreezeStaleness = {
  readonly freezeHash: string;
  readonly stale: boolean;
  readonly status: 'STALE' | 'CURRENT';
  readonly reasons: readonly LaunchFreezeStalenessReason[];
  readonly environmentalMetricsIgnored: true;
};

export type LaunchFreezeDiffChange = {
  readonly classification: LaunchFreezeDiffClass;
  readonly field: string;
  readonly left: string;
  readonly right: string;
};

export type LaunchFreezeDiff = {
  readonly leftFreezeId: string;
  readonly rightFreezeId: string;
  readonly leftHash: string;
  readonly rightHash: string;
  readonly changes: readonly LaunchFreezeDiffChange[];
  readonly autoApproved: false;
};

export type LaunchFreezeOfflinePackage = {
  readonly kind: 'SUNREY_PRODUCTION_LAUNCH_FREEZE_OFFLINE_PACKAGE';
  readonly freezeHash: string;
  readonly componentHashes: Readonly<Record<string, string>>;
  readonly versions: Readonly<Record<string, string>>;
  readonly diffSummary: string;
  readonly blockerSummary: string;
  readonly rawSecretsPresent: false;
  readonly asymmetricKeyMaterialPresent: false;
  readonly confidentialLegalDocumentsPresent: false;
};

export type LaunchFreezeSupersession = {
  readonly previousFreezeId: string;
  readonly previousFreezeHash: string;
  readonly previousStatus: 'SUPERSEDED';
  readonly nextFreezeId: string;
  readonly nextFreezeHash: string;
  readonly history: readonly string[];
  readonly historyPreserved: true;
};

export type LaunchFreezeEvaluation = {
  readonly freeze: ProductionLaunchCandidateFreeze;
  readonly evidence: ExternalEvidenceFreezeSnapshot;
  readonly operatingScope: OperatingScopeFreezeSnapshot;
  readonly providers: ProviderBindingFreezeSnapshot;
  readonly migrations: DatabaseMigrationManifest;
  readonly configuration: ConfigurationBaseline;
  readonly bom: ReleaseBillOfMaterials;
  readonly productionParametersComplete: boolean;
  readonly externalEvidenceComplete: boolean;
  readonly humanAuthorizationComplete: boolean;
  readonly unconfiguredTokenomics: readonly string[];
  readonly productionActive: false;
};
