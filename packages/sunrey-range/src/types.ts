/**
 * Chunk 57 — versioned adversarial range types.
 *
 * Isolated development/testnet security range only. Red actors are
 * deterministic in-process test doubles. No external targets.
 */

export const RANGE_SCHEMA_VERSION = 1 as const;
export const RANGE_PROTOCOL_VERSION = 'sunrey.range.v1' as const;
export const RANGE_NETWORK_ID = 'net_sunrey_range_dev' as const;
export const RANGE_CHAIN_ID = 'chn_sunrey_range_dev' as const;
export const RANGE_GENESIS_LABEL = 'sunrey.range.genesis.v1' as const;

export const ATTACK_CATEGORIES = [
  'BFT_ADVERSARY',
  'VALIDATOR_FAULT',
  'NETWORK_PARTITION',
  'PEER_ABUSE',
  'SIGNER_COMPROMISE',
  'WALLET_COMPROMISE',
  'ORACLE_MANIPULATION',
  'PRODUCTIVE_FRAUD',
  'MOONREY_ISSUANCE_ABUSE',
  'EXCHANGE_MANIPULATION',
  'CUSTODY_ABUSE',
  'MACHINE_COMMERCE_ABUSE',
  'INTEROPERABILITY_ABUSE',
  'GOVERNANCE_ABUSE',
  'SERVICE_DEGRADATION',
  'INVARIANT_VALIDATION',
  'PRIVACY_ABUSE',
  'API_ABUSE',
  'UPGRADE_ABUSE',
  'COMPOUND_FAILURE',
  'ECONOMIC_STRESS',
] as const;
export type AttackCategory = (typeof ATTACK_CATEGORIES)[number];

export const SECURITY_INVARIANT_IDS = [
  'NO_CONFLICTING_FINALITY',
  'NO_UNAUTHORIZED_ISSUANCE',
  'NO_ASSET_CREATION_FROM_SETTLEMENT',
  'NO_DOUBLE_SETTLEMENT',
  'NO_DOUBLE_MOONREY_ATTRIBUTION',
  'NO_UNAUTHORIZED_GOVERNANCE',
  'NO_VALIDATOR_KEY_REUSE',
  'NO_RAW_PERSONAL_DATA_EGRESS',
  'NO_INTEROP_PROOF_BYPASS',
  'NO_BLIND_WITHDRAWAL_RESUBMISSION',
  'NO_MACHINE_MANDATE_BYPASS',
  'NO_DUPLICATE_VALIDATOR_REWARD',
  'NO_DUPLICATE_VALIDATOR_PENALTY',
  'NO_CUSTOMER_ASSET_VALIDATOR_PENALTY',
  'UNBOND_DELAY_RESPECTED',
] as const;
export type SecurityInvariantId = (typeof SECURITY_INVARIANT_IDS)[number];

export const DETECTION_CHANNELS = [
  'metrics',
  'alert',
  'surveillance',
  'evidence',
  'accountability',
  'reconciliation',
  'security_log',
] as const;
export type DetectionChannel = (typeof DETECTION_CHANNELS)[number];

export const RECOVERY_KINDS = [
  'VALIDATOR_ROTATION',
  'WALLET_RECOVERY',
  'SNAPSHOT_RESTORE',
  'ORACLE_SUSPENSION',
  'INTEROP_CLIENT_FREEZE',
  'CUSTODY_SECURITY_HOLD',
  'EXCHANGE_RECONCILIATION',
  'SIGNER_FENCING',
  'KEY_ROTATION',
  'NONE_PREVENTIVE',
] as const;
export type RecoveryKind = (typeof RECOVERY_KINDS)[number];

export const SCORECARD_STATUSES = ['TESTED', 'PARTIAL', 'NOT_TESTED', 'OUT_OF_SCOPE'] as const;
export type ScorecardStatus = (typeof SCORECARD_STATUSES)[number];

export const RANGE_ROLES = [
  'VALIDATOR',
  'SENTRY',
  'RPC',
  'EXPLORER',
  'FAUCET',
  'EXCHANGE',
  'CUSTODY',
  'ORACLE_PROVIDER',
  'MACHINE_ACTOR',
  'RELAYER',
  'OBSERVABILITY',
  'MALICIOUS_PEER',
  'HUMAN_OPERATOR',
] as const;
export type RangeRole = (typeof RANGE_ROLES)[number];

export type RangeActor = {
  readonly actorId: string;
  readonly role: RangeRole;
  readonly adversarial: boolean;
  readonly votingPower?: bigint;
  readonly controllerId?: string;
};

export type RangeFault = {
  readonly faultId: string;
  readonly kind: string;
  readonly targetId: string;
  readonly detail: string;
};

export type RangeTimelineStep = {
  readonly atTick: number;
  readonly actorId: string;
  readonly action: string;
};

export type RangeInitialState = {
  readonly networkId: typeof RANGE_NETWORK_ID;
  readonly chainId: typeof RANGE_CHAIN_ID;
  readonly validatorCount: 7;
  readonly testCredentialsOnly: true;
};

export type ExpectedDetection = {
  readonly channel: DetectionChannel;
  readonly code: string;
  readonly required: boolean;
};

export type AttackScenario = {
  readonly scenarioId: string;
  readonly category: AttackCategory;
  readonly version: number;
  readonly seed: number;
  readonly subsystem: string;
  readonly attack: string;
  readonly initialState: RangeInitialState;
  readonly actors: readonly RangeActor[];
  readonly faults: readonly RangeFault[];
  readonly timeline: readonly RangeTimelineStep[];
  readonly expectedSecurityProperties: readonly SecurityInvariantId[];
  readonly expectedDetections: readonly ExpectedDetection[];
  readonly expectedRecovery: readonly RecoveryKind[];
  readonly preventiveControl: string;
  readonly detectiveControl: string;
  readonly recovery: string;
  readonly preventiveOnly: boolean;
};

export type SecurityInvariantResult = {
  readonly invariantId: SecurityInvariantId;
  readonly held: boolean;
  readonly detail: string;
};

export type DetectionResult = {
  readonly channel: DetectionChannel;
  readonly code: string;
  readonly observed: boolean;
  readonly detail: string;
};

export type RecoveryResult = {
  readonly kind: RecoveryKind;
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly historicalEvidencePreserved: boolean;
  readonly detail: string;
};

export type AttackResult = {
  readonly scenarioId: string;
  readonly version: number;
  readonly seed: number;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly attackBlocked: boolean;
  readonly safetyHeld: boolean;
  readonly livenessDegraded: boolean;
  readonly invariants: readonly SecurityInvariantResult[];
  readonly detections: readonly DetectionResult[];
  readonly recovery: RecoveryResult;
  readonly notes: string;
  readonly passed: boolean;
};

export type CampaignReport = {
  readonly schemaVersion: typeof RANGE_SCHEMA_VERSION;
  readonly protocolVersion: typeof RANGE_PROTOCOL_VERSION;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly scenarioCount: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly AttackResult[];
  readonly scorecard: SecurityScorecard;
};

export type SecurityScorecard = {
  readonly label: 'ENGINEERING_TEST_SCORECARD';
  readonly notAMarketingRating: true;
  readonly categories: Readonly<Record<string, ScorecardStatus>>;
  readonly notes: readonly string[];
};

export type RangeEvidenceRecord = {
  readonly scenarioId: string;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly result: AttackResult;
  readonly invariants: readonly SecurityInvariantResult[];
  readonly alerts: readonly string[];
  readonly recovery: RecoveryResult;
  readonly secretsPresent: false;
};
