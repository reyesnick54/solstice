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
  'CREDENTIAL_ABUSE',
  'ENDPOINT_SSRF',
  'PROVIDER_BOUNDARY_ABUSE',
  'PAYMENT_ABUSE',
  'COMPLIANCE_ABUSE',
  'TRAVEL_RULE_ABUSE',
  'ORACLE_ADVERSARIAL',
  'PRODUCTIVE_ECONOMY_ABUSE',
  'HUMAN_ECONOMY_ABUSE',
  'PERSISTENCE_ABUSE',
  'EVENT_FABRIC_ABUSE',
  'DISTRIBUTED_IDEMPOTENCY_ABUSE',
  'ECONOMIC_CONSTITUTION_ABUSE',
  'AI_AUTHORITY_ABUSE',
  'OBSERVABILITY_ABUSE',
  'CONTROL_ROOM_ABUSE',
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
  'NO_TREASURY_MINT',
  'NO_TREASURY_DOUBLE_SPEND',
  'NO_UNAUTHORIZED_TREASURY_SPEND',
  'NO_CUSTOMER_ASSET_TREASURY_CLAIM',
  'LEDGER_APPEND_ONLY',
  'EXECUTION_AUTHORITY_REQUIRED',
  'KERNEL_CANNOT_BE_BYPASSED',
  'ASSET_SUPPLYBOOK_CANONICAL',
  'CHUNK_71_MONETARY_AUTHORITY',
  'AI_CANNOT_EXECUTE',
  'RAW_SECRET_NOT_EXPOSED',
  'PII_NOT_PUBLIC_CHAIN',
  'ORACLE_CONSENSUS_NO_HTTP',
  'REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT',
  'CROSS_ASSET_CUSTODY_ISOLATED',
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'COMPLIANCE_UNAVAILABLE_NOT_CLEAR',
  'CONTROL_ROOM_READ_ONLY',
  'PRODUCTION_NOT_ACTIVE',
  'NO_RAW_SECRET_EXPOSURE',
  'NO_CROSS_WORKLOAD_CREDENTIAL_USE',
  'CONNECTOR_FAILS_CLOSED',
  'TRAVEL_RULE_ACK_IS_NOT_WITHDRAWAL_AUTHORITY',
  'PRIVATE_KEY_EXPORT_FORBIDDEN',
  'NO_FALSE_INDEPENDENT_QUORUM',
  'NO_DIRECT_PROVIDER_MINT',
  'NO_REFERENCE_PRICE_MINT',
  'NO_DUPLICATE_FINANCIAL_CONSEQUENCE',
  'NO_HUMAN_WORTH_SCORING',
  'NO_REGULATORY_BYPASS',
] as const;
export type SecurityInvariantId = (typeof SECURITY_INVARIANT_IDS)[number];

export const CAMPAIGN_SEVERITIES = ['PROTECTED', 'DEGRADED_BUT_SAFE', 'INVARIANT_BREACH'] as const;
export type CampaignSeverity = (typeof CAMPAIGN_SEVERITIES)[number];

export const PRODUCTION_SAFETY_FIXTURE_VERSION = 'sunrey.range.fixture.v157' as const;
export const RANGE_FIXTURE_VERSION = 'sunrey.range.fixture.v1' as const;

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
  'CREDENTIAL_ROTATION',
  'PROVIDER_QUERY',
  'COMPLIANCE_HOLD',
  'IDEMPOTENT_RECONCILE',
  'SNAPSHOT_REJECT',
  'DEAD_LETTER',
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
  'PROVIDER_CREDENTIAL',
  'COMPLIANCE_PROVIDER',
  'AI_MODEL',
  'CONTROL_ROOM',
  'TELEMETRY',
  'PAYMENT_PROVIDER',
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
  readonly fixtureVersion: string;
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
  readonly fixtureVersion: string;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly attackBlocked: boolean;
  readonly safetyHeld: boolean;
  readonly livenessDegraded: boolean;
  readonly severity: CampaignSeverity;
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
  readonly invariantBreaches: number;
  readonly severities: Readonly<Record<CampaignSeverity, number>>;
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
