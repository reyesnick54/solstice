/**
 * Chunk 158 — Full-platform production-candidate burn-in.
 *
 * Extends the existing Chunk 90 production-handoff owner. This is a
 * binder of evidence references, hashes, version IDs, capability IDs,
 * and test receipts. It does not create a second release authority,
 * activate production, or connect real providers.
 *
 * PRODUCTION_ACTIVE is not an achievable outcome.
 */

export const FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION = 1 as const;
export const FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION = '1' as const;
export const FULL_PLATFORM_CANDIDATE_TOOL_VERSION = 'sunrey-ops/production/full-platform/1' as const;
export const FULL_PLATFORM_CANDIDATE_BUNDLE_ID = 'sunrey.production.full-platform.candidate.v1' as const;
export const FULL_PLATFORM_FIXTURE_VERSION = 'full-platform-fixture.v1' as const;
export const FULL_PLATFORM_DEFAULT_SEED = 'sunrey-full-platform-candidate-seed-v1' as const;

export const PRODUCTION_ACTIVE = false as const;
export const PRODUCTION_ACTIVATED = false as const;
export const AI_CAN_AUTHORIZE = false as const;
export const AI_CAN_CHANGE_BUNDLE_STATUS = false as const;
export const BUNDLE_CAN_OVERRIDE_FIREWALL = false as const;
export const ENGINEERING_IS_NOT_LICENSURE = true as const;

export const BURN_IN_PROFILES = ['SMOKE', 'STANDARD', 'EXTENDED'] as const;
export type BurnInProfile = (typeof BURN_IN_PROFILES)[number];

export const BUNDLE_STATES = [
  'INCOMPLETE',
  'ENGINEERING_FAILED',
  'ENGINEERING_RECONCILED',
  'BURN_IN_FAILED',
  'BURN_IN_PASSED',
  'AWAITING_PRODUCTION_PARAMETERS',
  'AWAITING_EXTERNAL_PROVIDER_EVIDENCE',
  'AWAITING_SECURITY_AUDIT',
  'AWAITING_LEGAL_REGULATORY_EVIDENCE',
  'AWAITING_HUMAN_GOVERNANCE',
  'PRODUCTION_CANDIDATE_REVIEW_READY',
] as const;
export type FullPlatformBundleState = (typeof BUNDLE_STATES)[number];

export const MATRIX_STATUSES = [
  'PASS',
  'FAIL',
  'EXTERNAL_REQUIRED',
  'HUMAN_REQUIRED',
  'UNCONFIGURED',
] as const;
export type ReadinessMatrixStatus = (typeof MATRIX_STATUSES)[number];

export const READINESS_ROWS = [
  'architectureIntegrity',
  'tests',
  'persistence',
  'idempotency',
  'observability',
  'securityAdversarial',
  'chain',
  'economicConstitution',
  'sunrey',
  'moonrey',
  'exchange',
  'custody',
  'payments',
  'identityCompliance',
  'providers',
  'aiBoundary',
  'privacy',
  'externalEvidence',
  'humanGovernance',
] as const;
export type ReadinessRowId = (typeof READINESS_ROWS)[number];

export const CHECKPOINT_IDS = [
  'BOOTSTRAP',
  'IDENTITY_READY',
  'PAYMENTS_ACTIVE_SIMULATION',
  'ECONOMIC_EVIDENCE_FLOWING',
  'EXCHANGE_SETTLING',
  'PERSISTENCE_RESTARTED',
  'PROVIDER_FAILURE_INJECTED',
  'RECOVERY_COMPLETE',
  'FINAL_RECONCILIATION',
] as const;
export type BurnInCheckpointId = (typeof CHECKPOINT_IDS)[number];

export const COMPONENT_EVIDENCE_KEYS = [
  'repositoryIntegrity',
  'architectureManifest',
  'buildProvenance',
  'securityAuditBundle',
  'persistenceRecovery',
  'idempotencyReconciliation',
  'controlRoom',
  'adversarialCampaign',
  'mainnetRc',
  'economicConstitutionCandidate',
  'productionActivationFirewall',
  'providerAcceptance',
  'credentialPlane',
  'oracleProviderCandidates',
  'bankPaymentFxCandidates',
  'regulatedProviderCandidates',
  'custodyProviderCandidates',
  'kernelInvariants',
  'ledgerInvariants',
  'evidenceVault',
  'sunreyChain',
  'assetSupplyBook',
  'sunreyCoinPolicyCandidate',
  'moonreyCoinPolicyCandidate',
  'economicAssetRegistry',
  'hin',
  'humanContributions',
  'productiveEconomicData',
  'exchange',
  'custody',
  'aiRuntimeBoundary',
  'sunreyAgentBoundary',
] as const;
export type ComponentEvidenceKey = (typeof COMPONENT_EVIDENCE_KEYS)[number];

export const EVIDENCE_LANES = ['ENGINEERING', 'EXTERNAL', 'HUMAN', 'REHEARSAL'] as const;
export type EvidenceLane = (typeof EVIDENCE_LANES)[number];

export const REJECTED_IMPLICIT_VERSIONS = ['latest', 'current', 'default'] as const;

export const FORBIDDEN_PACKAGES = [
  'packages/full-platform',
  'packages/mainnet-v2',
  'packages/production-ready',
  'packages/launch-v2',
  'packages/system-rc',
  'packages/sunrey-production',
] as const;

export type ExactVersionBinding = {
  readonly key: string;
  readonly versionId: string;
  readonly contentHash: string;
  readonly capabilityId: string;
};

export type EvidenceReference = {
  readonly key: ComponentEvidenceKey;
  readonly capabilityId: string;
  readonly versionId: string;
  readonly contentHash: string;
  readonly testReceiptId: string;
  readonly lane: EvidenceLane;
  readonly fabricated: false;
};

export type ExternalEvidenceItem = {
  readonly evidenceId: string;
  readonly title: string;
  readonly present: false;
  readonly fabricated: false;
  readonly lane: 'EXTERNAL' | 'HUMAN';
  readonly notes: string;
};

export type BurnInCheckpoint = {
  readonly id: BurnInCheckpointId;
  readonly sequence: number;
  readonly atUtc: string;
  readonly stateHash: string;
  readonly evidenceHash: string;
  readonly environmentalMetricsHash: string;
};

export type ReadinessMatrixRow = {
  readonly id: ReadinessRowId;
  readonly status: ReadinessMatrixStatus;
  readonly notes: string;
};

export type FullPlatformCandidateBundle = {
  readonly bundleId: typeof FULL_PLATFORM_CANDIDATE_BUNDLE_ID;
  readonly schemaVersion: typeof FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION;
  readonly bundleVersion: typeof FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION;
  readonly sourceCommit: string;
  readonly fixtureVersion: typeof FULL_PLATFORM_FIXTURE_VERSION;
  readonly seed: string;
  readonly profile: BurnInProfile;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly economicConstitutionHash: string;
  readonly firewallDecisionHash: string;
  readonly productionHandoffPackageHash: string;
  readonly componentHashes: Readonly<Record<ComponentEvidenceKey, string>>;
  readonly architectureIntegrityHash: string;
  readonly burnInCanonicalHash: string;
  readonly bundleHash: string;
  readonly productionActivated: false;
};

export type FullPlatformBurnInCounters = {
  readonly duplicatePaymentEffects: 0 | number;
  readonly duplicateWithdrawalEffects: 0 | number;
  readonly referencePriceDirectMints: 0 | number;
  readonly aiAuthorityViolations: 0 | number;
  readonly rawCredentialLeaks: 0 | number;
  readonly publicChainPiiLeaks: 0 | number;
  readonly adversarialInvariantBreaches: 0 | number;
};

export type FullPlatformPosture = {
  readonly architectureIntegrity: true | boolean;
  readonly fullPlatformBurnInPassed: boolean;
  readonly ledgerBalanced: boolean;
  readonly sunreySupplyReconciled: boolean;
  readonly moonreySupplyReconciled: boolean;
  readonly crossAssetCustodyIsolated: boolean;
  readonly realBankConnected: false;
  readonly realKycProviderConnected: false;
  readonly realCustodyProviderConnected: false;
  readonly realOracleProviderConnected: false;
  readonly liveFlagsEnabled: false;
  readonly productionEconomicParametersConfigured: false;
  readonly productionActive: false;
};

export type FullPlatformQualificationDecision = {
  readonly bundleState: FullPlatformBundleState;
  readonly bundleHash: string;
  readonly firewallDecisionHash: string;
  readonly engineeringPassed: boolean;
  readonly burnInPassed: boolean;
  readonly architectureIntegrity: boolean;
  readonly matrix: readonly ReadinessMatrixRow[];
  readonly externalEvidence: readonly ExternalEvidenceItem[];
  readonly openBlockers: readonly string[];
  readonly counters: FullPlatformBurnInCounters;
  readonly posture: FullPlatformPosture;
  readonly productionActivated: false;
  readonly aiCanChangeStatus: false;
  readonly bundleOverridesFirewall: false;
};

export type FullPlatformCandidateReport = {
  readonly schemaVersion: typeof FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION;
  readonly toolVersion: typeof FULL_PLATFORM_CANDIDATE_TOOL_VERSION;
  readonly identity: {
    readonly bundleId: typeof FULL_PLATFORM_CANDIDATE_BUNDLE_ID;
    readonly sourceCommit: string;
    readonly fixtureVersion: typeof FULL_PLATFORM_FIXTURE_VERSION;
    readonly seed: string;
    readonly profile: BurnInProfile;
    readonly bundleHash: string;
    readonly burnInCanonicalHash: string;
  };
  readonly checkpoints: readonly BurnInCheckpoint[];
  readonly matrix: readonly ReadinessMatrixRow[];
  readonly counters: FullPlatformBurnInCounters;
  readonly posture: FullPlatformPosture;
  readonly firewall: {
    readonly decisionHash: string;
    readonly overallState: string;
    readonly productionActivated: false;
    readonly overriddenByBundle: false;
  };
  readonly qualification: FullPlatformBundleState;
  readonly openBlockers: readonly string[];
  readonly productionActive: false;
};
