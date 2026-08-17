/**
 * Chunk 55 — provider-neutral operational types.
 *
 * Failure domains are not AWS/Azure/GCP. Cloud adapters may be added later.
 * Engineering SLOs are ENGINEERING_TEST_TARGETS, not production contracts.
 */

export const OPS_SCHEMA_VERSION = 1 as const;
export const OPS_PROTOCOL_VERSION = 'sunrey.ops.v1' as const;
export const DEVELOPMENT_CHAIN_ID = 'chn_sunrey_local_dev' as const;
export const DEVELOPMENT_NETWORK_ID = 'net_sunrey_local_dev' as const;

export const FAILURE_DOMAIN_KINDS = [
  'REGION',
  'AVAILABILITY_ZONE',
  'DATA_CENTER',
  'OPERATOR_NETWORK',
] as const;
export type FailureDomainKind = (typeof FAILURE_DOMAIN_KINDS)[number];

export const DEPLOYMENT_CELL_ROLES = [
  'RPC',
  'INDEXER',
  'EXPLORER',
  'RELAY',
  'MONITORING_AGENT',
  'SERVICE_DATABASE',
  'FAUCET',
] as const;
export type DeploymentCellRole = (typeof DEPLOYMENT_CELL_ROLES)[number];

export const BACKUP_CLASSES = [
  'BLOCKCHAIN_STATE',
  'CONSENSUS_WAL',
  'SIGNER_SAFETY',
  'VALIDATOR_CONFIGURATION',
  'EXPLORER_INDEX',
  'POSTGRES_APPLICATION_DATA',
  'CUSTODY_METADATA',
  'ENCRYPTED_CONFIGURATION',
] as const;
export type BackupClass = (typeof BACKUP_CLASSES)[number];

export const BACKUP_STORAGE_KINDS = ['LOCAL_FILESYSTEM', 'S3_COMPATIBLE_TEST_PROVIDER'] as const;
export type BackupStorageKind = (typeof BACKUP_STORAGE_KINDS)[number];

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_CODES = [
  'CONSENSUS_FINALITY_DELAY',
  'VALIDATOR_MISSED_VOTES',
  'VALIDATOR_SIGNER_UNAVAILABLE',
  'VALIDATOR_PEER_ISOLATION',
  'RPC_HIGH_ERROR_RATE',
  'DISK_LOW',
  'EXPLORER_LAG',
  'ORACLE_QUORUM_UNAVAILABLE',
  'CUSTODY_RECONCILIATION_MISMATCH',
  'EXCHANGE_SETTLEMENT_BACKLOG',
  'INTEROP_CLIENT_EXPIRING',
] as const;
export type AlertCode = (typeof ALERT_CODES)[number];

export const SECURITY_EVENT_CODES = [
  'SIGNER_REJECTION',
  'WRONG_NETWORK_ACCESS',
  'INVALID_CRYPTO_SUITE',
  'SUSPICIOUS_RPC_BEHAVIOR',
  'VALIDATOR_EVIDENCE',
  'CUSTODY_SECURITY_HALT',
  'ORACLE_PROVIDER_SUSPENSION',
  'INTEROP_CLIENT_FREEZE',
] as const;
export type SecurityEventCode = (typeof SECURITY_EVENT_CODES)[number];

export const LOG_SEVERITIES = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

export const SLO_LABEL = 'ENGINEERING_TEST_TARGETS' as const;

export const SLO_IDS = [
  'RPC_AVAILABILITY',
  'EXPLORER_INDEXING_LAG',
  'BLOCK_FINALITY_PERFORMANCE',
  'ORACLE_FRESHNESS',
  'SETTLEMENT_PROCESSING',
  'BACKUP_SUCCESS',
] as const;
export type SloId = (typeof SLO_IDS)[number];

export const DASHBOARD_IDS = [
  'NETWORK_OVERVIEW',
  'CONSENSUS',
  'VALIDATOR',
  'RPC',
  'EXPLORER',
  'NATIVE_ASSETS',
  'MOONREY_PRODUCTIVE_ECONOMY',
  'ORACLE',
  'EXCHANGE',
  'CUSTODY',
  'INTEROP',
] as const;
export type DashboardId = (typeof DASHBOARD_IDS)[number];

export const SIGNER_ROLES = ['ACTIVE', 'PASSIVE', 'DISABLED'] as const;
export type SignerRole = (typeof SIGNER_ROLES)[number];

export const CHAOS_FAULTS = [
  'KILL_VALIDATOR',
  'KILL_RPC_NODE',
  'KILL_EXPLORER',
  'KILL_DATABASE_CONNECTION',
  'KILL_RELAYER',
  'KILL_ORACLE_ADAPTER',
  'NETWORK_LATENCY',
  'PACKET_LOSS',
  'FAILURE_DOMAIN_ISOLATION',
  'SIGNER_UNAVAILABLE',
  'DISK_FULL',
] as const;
export type ChaosFault = (typeof CHAOS_FAULTS)[number];

export const DRILL_SCENARIOS = [
  'FAILURE_DOMAIN_LOSS',
  'NO_QUORUM_PARTITION',
  'DATABASE_LOSS',
  'CHAIN_STATE_LOSS',
  'EXPLORER_LOSS',
  'SIGNER_FAILURE',
  'END_TO_END_RESILIENCE',
] as const;
export type DrillScenario = (typeof DRILL_SCENARIOS)[number];

export const INCIDENT_EVIDENCE_KINDS = [
  'OPS_UPGRADE_INCIDENT',
  'OPS_SIGNER_INCIDENT',
  'OPS_VALIDATOR_COMPROMISE',
  'OPS_BACKUP_FAILURE',
  'OPS_CUSTODY_RECONCILIATION_INCIDENT',
] as const;
export type IncidentEvidenceKind = (typeof INCIDENT_EVIDENCE_KINDS)[number];

export const FORBIDDEN_TELEMETRY_KEYS = [
  'privateKey',
  'private_key',
  'mnemonic',
  'seedPhrase',
  'rawKyc',
  'kycRaw',
  'pdvRaw',
  'pdvPayload',
  'cleanRoomRaw',
  'consentContent',
  'hsmSecret',
  'hsmSecretReference',
  'validatorConsensusKey',
] as const;

export type FailureDomain = {
  readonly domainId: string;
  readonly kind: FailureDomainKind;
  readonly displayName: string;
};

export type SovereignDeploymentCell = {
  readonly cellId: string;
  readonly domainId: string;
  readonly roles: readonly DeploymentCellRole[];
  readonly rpcInstances: readonly string[];
  readonly indexerInstances: readonly string[];
  readonly explorerInstances: readonly string[];
  readonly relayInstances: readonly string[];
  readonly monitoringAgents: readonly string[];
  readonly serviceDatabases: readonly string[];
};

export type ValidatorPlacement = {
  readonly validatorId: string;
  readonly domainId: string;
  readonly votingPower: bigint;
  readonly signerTrustZone: string;
};

export type RecoveryStrategy = {
  readonly backupClass: BackupClass;
  readonly strategy: string;
  readonly rebuildable: boolean;
  readonly requiresEncryption: boolean;
  readonly restoreVerification: string;
};

export type EngineeringRecoveryObjective = {
  readonly component: string;
  readonly targetRpoMs: bigint;
  readonly targetRtoMs: bigint;
  readonly label: typeof SLO_LABEL;
};

export type MeasuredRecovery = {
  readonly component: string;
  readonly measuredRpoMs: bigint;
  readonly measuredRtoMs: bigint;
  readonly result: 'PASS' | 'FAIL';
  readonly timestampUtc: string;
};

export type StructuredLogFields = {
  readonly service: string;
  readonly version: string;
  readonly network: string;
  readonly chain: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly blockHeight?: string;
  readonly transactionId?: string;
  readonly severity: LogSeverity;
  readonly eventCode: string;
};

export type AlertDefinition = {
  readonly code: AlertCode;
  readonly severity: AlertSeverity;
  readonly description: string;
  readonly operatorActionRef: string;
};

export type FiredAlert = AlertDefinition & {
  readonly firedAtUtc: string;
  readonly componentId: string;
  readonly details: string;
};

export type SloDefinition = {
  readonly id: SloId;
  readonly label: typeof SLO_LABEL;
  readonly description: string;
  readonly target: string;
};

export type DashboardDefinition = {
  readonly id: DashboardId;
  readonly title: string;
  readonly panels: readonly string[];
};

export type DisasterRecoveryReport = {
  readonly drillId: string;
  readonly scenario: DrillScenario;
  readonly componentsAffected: readonly string[];
  readonly startUtc: string;
  readonly recoveryUtc: string;
  readonly measuredRpoMs: bigint;
  readonly measuredRtoMs: bigint;
  readonly integrityChecks: readonly string[];
  readonly finalState: string;
  readonly failures: readonly string[];
  readonly operatorNotes: string;
  readonly alertsFired: readonly AlertCode[];
};
