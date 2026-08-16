/**
 * Chunk 40 — SunRey protocol governance types.
 *
 * Running a newer binary does not change consensus rules. Protocol state
 * changes only when an authorized UpgradePlan activates at a defined height.
 *
 * No governance token. SunRey Coin and MoonRey do not grant voting power.
 */

export const UPGRADE_KINDS = [
  'PARAMETER_CHANGE',
  'CONSENSUS_PARAMETER_CHANGE',
  'MODULE_ADD',
  'MODULE_REPLACE',
  'CRYPTO_POLICY_CHANGE',
  'CODEC_EXTENSION',
  'HARD_PROTOCOL_CUTOVER',
  'VALIDATOR_POLICY_CHANGE',
  'FEE_PARAMETER_CHANGE',
] as const;
export type UpgradeKind = (typeof UPGRADE_KINDS)[number];

export const UPGRADE_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'VALIDATING',
  'AWAITING_AUTHORIZATION',
  'AUTHORIZED',
  'SCHEDULED',
  'READY',
  'ACTIVATED',
  'REJECTED',
  'CANCELLED',
  'FAILED_VALIDATION',
  'SUPERSEDED',
] as const;
export type UpgradeStatus = (typeof UPGRADE_STATUSES)[number];

export const GOVERNANCE_ROLES = [
  'PROTOCOL_OPERATOR',
  'VALIDATOR_GOVERNANCE_SIGNER',
  'SECURITY_GOVERNANCE_SIGNER',
  'RELEASE_AUTHORITY',
  'AI_PREPARER',
] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const GOVERNANCE_KEY_KINDS = [
  'GOVERNANCE_SIGNING',
  'VALIDATOR_CONSENSUS_SIGNING',
  'P2P_IDENTITY',
  'EXECUTION_AUTHORITY_SIGNING',
] as const;
export type GovernanceKeyKind = (typeof GOVERNANCE_KEY_KINDS)[number];

export const THRESHOLD_MODELS = [
  'VALIDATOR_SUPERMAJORITY',
  'VALIDATOR_SUPERMAJORITY_PLUS_RELEASE_AUTHORITY',
  'SECURITY_EMERGENCY_THRESHOLD',
] as const;
export type ThresholdModel = (typeof THRESHOLD_MODELS)[number];

export const VOTE_CHOICES = ['APPROVE', 'REJECT'] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

export const READINESS_STATUSES = [
  'READY',
  'INCOMPATIBLE_BINARY',
  'MISSING_ARTIFACT',
  'HASH_MISMATCH',
  'UNSUPPORTED_CODEC',
  'UNSUPPORTED_CRYPTO_SUITE',
  'STATE_MIGRATION_UNAVAILABLE',
] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export const CRYPTO_SUITE_SCHEDULE_STATES = [
  'AVAILABLE',
  'HYBRID_REQUIRED',
  'CLASSICAL_DEPRECATED',
  'LEGACY_VERIFY_ONLY',
  'LEGACY_RETIRED',
] as const;
export type CryptoSuiteScheduleState = (typeof CRYPTO_SUITE_SCHEDULE_STATES)[number];

export const EMERGENCY_REASONS = [
  'CRITICAL_CRYPTO_BREAK',
  'CRITICAL_CONSENSUS_VULNERABILITY',
  'SUPPLY_CORRUPTION_BUG',
] as const;
export type EmergencyReason = (typeof EMERGENCY_REASONS)[number];

export const ACCOUNTABLE_IDENTITY_KINDS = ['HUMAN_OPERATOR', 'LEGAL_ENTITY'] as const;
export type AccountableIdentityKind = (typeof ACCOUNTABLE_IDENTITY_KINDS)[number];

export type AccountableIdentity = {
  readonly kind: AccountableIdentityKind;
  readonly id: string;
  readonly displayName: string;
};

export type GovernanceActor = {
  readonly actorId: string;
  readonly role: GovernanceRole;
  readonly identity: AccountableIdentity | { readonly kind: 'AI_PREPARER'; readonly id: string };
  readonly keyKind: GovernanceKeyKind;
  readonly publicKeyHex: string;
  readonly votingPower: bigint;
};

export type ConsensusParams = {
  readonly maxBlockBytes: number;
  readonly maxTransactions: number;
  readonly timeoutProposeMs: number;
  readonly timeoutPrevoteMs: number;
  readonly timeoutPrecommitMs: number;
  readonly evidenceMaxAge: number;
};

export type NativeModuleRecord = {
  readonly moduleId: string;
  readonly version: string;
  readonly artifactHash: string;
  readonly schemaHash: string;
  readonly activationHeight: number;
  readonly deactivationHeight: number | null;
};

export type CodecRecord = {
  readonly codecId: string;
  readonly schemaVersion: number;
  readonly schemaHash: string;
  readonly activationHeight: number;
};

export type CryptoPolicySchedule = {
  readonly suiteId: string;
  readonly targetState: CryptoSuiteScheduleState;
  readonly activationHeight: number;
  readonly preserveHistoricalVerify: true;
};

export type StateMigrationSpec = {
  readonly version: number;
  readonly contentHash: string;
  readonly fromProtocolVersion: number;
  readonly toProtocolVersion: number;
  readonly preStateRequirement: string;
  readonly postStateRoot: string;
};

export type ReleaseManifest = {
  readonly sourceCommit: string;
  readonly toolchainVersion: string;
  readonly artifactHash: string;
  readonly moduleHashes: Readonly<Record<string, string>>;
  readonly schemaHashes: Readonly<Record<string, string>>;
  readonly reproducedInCi: false;
};

export type UpgradePlan = {
  readonly upgradeId: string;
  readonly upgradeKind: UpgradeKind;
  readonly currentProtocolVersion: number;
  readonly targetProtocolVersion: number;
  readonly proposalHeight: number;
  readonly activationHeight: number;
  readonly affectedModules: readonly string[];
  readonly newModuleHashes: Readonly<Record<string, string>>;
  readonly codecRegistryHash: string;
  readonly consensusParamsHash: string;
  readonly cryptoPolicyHash: string;
  readonly stateMigrationHash: string | null;
  readonly releaseArtifactHash: string;
  readonly minimumNodeVersion: string;
  readonly governancePolicyVersion: number;
  readonly authorizationState: string;
  readonly status: UpgradeStatus;
  readonly evidenceReferences: readonly string[];
  readonly consensusParams: ConsensusParams | null;
  readonly modules: readonly NativeModuleRecord[];
  readonly codecs: readonly CodecRecord[];
  readonly cryptoSchedule: CryptoPolicySchedule | null;
  readonly stateMigration: StateMigrationSpec | null;
  readonly releaseManifest: ReleaseManifest;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type GovernancePolicy = {
  readonly version: number;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: number;
  readonly thresholdModel: ThresholdModel;
  readonly requiredPower: bigint;
  readonly totalPower: bigint;
  readonly signers: readonly GovernanceActor[];
  readonly releaseAuthorityId: string | null;
  readonly minActivationLead: number;
};

export type GovernanceVote = {
  readonly upgradeId: string;
  readonly proposalContentHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: number;
  readonly voterId: string;
  readonly governancePolicyVersion: number;
  readonly activationHeight: number;
  readonly choice: VoteChoice;
  readonly publicKeyHex: string;
  readonly signatureHex: string;
};

export type UpgradeReadiness = {
  readonly upgradeId: string;
  readonly status: ReadinessStatus;
  readonly detail: string;
};

export type EmergencyHaltIntent = {
  readonly intentId: string;
  readonly reason: EmergencyReason;
  readonly status: 'PROPOSED' | 'AUTHORIZED' | 'ACTIVE' | 'CANCELLED';
  readonly authorizedPower: bigint;
  readonly evidenceReferences: readonly string[];
};

export type GovernanceAuditRecord = {
  readonly kind:
    | 'PROPOSAL'
    | 'VOTE'
    | 'AUTHORIZATION'
    | 'SCHEDULE'
    | 'CANCELLATION'
    | 'ACTIVATION'
    | 'MIGRATION'
    | 'EMERGENCY';
  readonly upgradeId: string;
  readonly contentHash: string;
  readonly height: number;
  readonly protocolVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type ProtocolCommitments = {
  readonly protocolVersion: number;
  readonly consensusParamsHash: string;
  readonly moduleRegistryHash: string;
  readonly codecRegistryHash: string;
  readonly cryptoPolicyHash: string;
};

export const CONSENSUS_PARAM_BOUNDS = Object.freeze({
  maxBlockBytes: Object.freeze({ min: 1_024, max: 4_194_304 }),
  maxTransactions: Object.freeze({ min: 1, max: 4_096 }),
  timeoutProposeMs: Object.freeze({ min: 100, max: 30_000 }),
  timeoutPrevoteMs: Object.freeze({ min: 100, max: 30_000 }),
  timeoutPrecommitMs: Object.freeze({ min: 100, max: 30_000 }),
  evidenceMaxAge: Object.freeze({ min: 1, max: 1_000_000 }),
});

export const LEGAL_TRANSITIONS: Readonly<Record<UpgradeStatus, readonly UpgradeStatus[]>> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['VALIDATING', 'CANCELLED', 'SUPERSEDED'],
  VALIDATING: ['AWAITING_AUTHORIZATION', 'FAILED_VALIDATION', 'CANCELLED'],
  AWAITING_AUTHORIZATION: ['AUTHORIZED', 'REJECTED', 'CANCELLED', 'SUPERSEDED'],
  AUTHORIZED: ['SCHEDULED', 'CANCELLED', 'SUPERSEDED'],
  SCHEDULED: ['READY', 'CANCELLED', 'SUPERSEDED'],
  READY: ['ACTIVATED', 'CANCELLED'],
  ACTIVATED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED_VALIDATION: ['DRAFT', 'CANCELLED'],
  SUPERSEDED: [],
};

export const FORBIDDEN_PAYLOAD_KEYS = [
  'production_network_enabled',
  'PRODUCTION_NETWORK_ENABLED',
  'ENVIRONMENT',
  'CONFIRMED_BY_COUNSEL',
  'customer_ledger_authority',
  'CUSTOMER_LEDGER_AUTHORITY',
  'ai_governance',
  'AI_GOVERNANCE',
  'evidence_vault_replacement',
  'EVIDENCE_VAULT_REPLACEMENT',
  'disable_signature_verification',
  'DISABLE_SIGNATURE_VERIFICATION',
  'unknown_crypto_suite',
  'UNKNOWN_CRYPTO_SUITE',
  'remove_validator_accountability',
  'REMOVE_VALIDATOR_ACCOUNTABILITY',
  'sunrey_coin_supply',
  'SUNREY_COIN_SUPPLY',
  'moonrey_issuance',
  'MOONREY_ISSUANCE',
  'finalized_history_rewrite',
  'FINALIZED_HISTORY_REWRITE',
] as const;
