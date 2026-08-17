/**
 * Chunk 55 — provider-neutral operational types.
 *
 * Failure domains are not AWS/Azure/GCP. Cloud adapters may be added later.
 * Engineering SLOs are ENGINEERING_TEST_TARGETS, not production contracts.
 */

import type { ConsensusMessageType, ValidatorStatus } from '../validators/types.ts';

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

export const NODE_ROLES = [
  'VALIDATOR',
  'SENTRY',
  'PUBLIC_RPC',
  'REMOTE_SIGNER',
  'OPERATOR',
] as const;
export type NodeRole = (typeof NODE_ROLES)[number];

export const FORBIDDEN_VALIDATOR_HOSTED_SERVICES = [
  'PUBLIC_WEB_UI',
  'PUBLIC_EXPLORER',
  'PUBLIC_FAUCET',
  'CUSTOMER_API',
  'EXCHANGE_MATCHING',
  'CUSTODY_OPERATIONS',
] as const;
export type ForbiddenValidatorHostedService = (typeof FORBIDDEN_VALIDATOR_HOSTED_SERVICES)[number];

export const SIGNER_TRANSPORTS = ['MTLS', 'UNIX_DOMAIN_SOCKET'] as const;
export type SignerTransportKind = (typeof SIGNER_TRANSPORTS)[number];

export const SIGNER_MODES = ['ACTIVE', 'PASSIVE'] as const;
export type SignerMode = (typeof SIGNER_MODES)[number];

export const PEER_KINDS = ['SENTRY', 'PRIVATE', 'PUBLIC'] as const;
export type PeerKind = (typeof PEER_KINDS)[number];

export const SNAPSHOT_KINDS = ['CHAIN_STATE'] as const;
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number];

export const STATE_SYNC_MODES = ['GENESIS_BLOCK_SYNC', 'TRUSTED_SNAPSHOT'] as const;
export type StateSyncMode = (typeof STATE_SYNC_MODES)[number];

export const INCIDENT_KINDS = [
  'SIGNER_COMPROMISE',
  'DOUBLE_SIGN_SUSPECTED',
  'SENTRY_COMPROMISE',
  'KEY_MATERIAL_EXPOSURE',
  'SNAPSHOT_TAMPER',
  'DISK_EXHAUSTION',
  'LEASE_FENCE_CONFLICT',
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const OPS_REASON_CODES = [
  'OK',
  'UNSAFE_CONFIG',
  'SENTRY_CANNOT_SIGN',
  'PUBLIC_RPC_CANNOT_REACH_SIGNER',
  'WRONG_VALIDATOR',
  'WRONG_NETWORK',
  'WRONG_CHAIN',
  'WRONG_HEIGHT',
  'WRONG_ROUND',
  'WRONG_STEP',
  'CANONICAL_BYTES_MISMATCH',
  'UNSUPPORTED_CRYPTO_SUITE',
  'VALIDATOR_SET_MISMATCH',
  'SIGNER_ROLLBACK',
  'SIGNER_CORRUPT',
  'DUPLICATE_ACTIVE_SIGNER',
  'LEASE_FENCED',
  'SNAPSHOT_TAMPER',
  'WRONG_NETWORK_SNAPSHOT',
  'INCOMPATIBLE_PROTOCOL',
  'INCOMPATIBLE_BINARY',
  'PRIVATE_KEY_EXPORT_FORBIDDEN',
  'FORBIDDEN_HOSTED_SERVICE',
  'INSUFFICIENT_SENTRIES',
  'PEER_CANNOT_CHANGE_VOTING_POWER',
  'PRUNE_FORBIDDEN',
  'DISK_PRESSURE',
  'MAINTENANCE_MODE',
  'EVIDENCE_IMMUTABLE',
  'SIGNER_UNAVAILABLE',
  'UNAUTHENTICATED_CLIENT',
] as const;
export type OpsReasonCode = (typeof OPS_REASON_CODES)[number];

export type OpsFailure = {
  readonly code: OpsReasonCode;
  readonly message: string;
};

export type OpsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: OpsFailure };

export function opsOk<T>(value: T): OpsResult<T> {
  return { ok: true, value };
}

export function opsErr(code: OpsReasonCode, message: string): OpsResult<never> {
  return { ok: false, error: { code, message } };
}

export type ResourceLimits = {
  readonly cpuMillis: number;
  readonly memoryBytes: number;
  readonly openFiles: number;
  readonly diskBytes: number;
  readonly maxNetworkConnections: number;
  readonly diskWarnRatio: number;
};

export type LogPolicy = {
  readonly format: 'JSON';
  readonly includeHeight: boolean;
  readonly includeRound: boolean;
  readonly includeStep: boolean;
  readonly includePeerState: boolean;
  readonly includeConsensusEvents: boolean;
  readonly includeSignerErrors: boolean;
  readonly includeUpgradeState: boolean;
  readonly redactPrivateKeys: true;
};

export type RpcBinding = {
  readonly host: string;
  readonly port: number;
  readonly public: boolean;
};

export type SignerEndpoint = {
  readonly transport: SignerTransportKind;
  readonly endpoint: string;
  readonly clientId: string;
  readonly serverName?: string;
};

export type PeerDescriptor = {
  readonly peerId: string;
  readonly kind: PeerKind;
  readonly address: string;
  readonly persistent: boolean;
};

export type PeerPolicy = {
  readonly persistentSentryPeers: readonly string[];
  readonly allowedPrivatePeers: readonly string[];
  readonly maxConnections: number;
  readonly scoreThreshold: number;
  readonly temporaryBanMs: number;
  readonly diversityWarnBelow: number;
};

export type StateSyncConfig = {
  readonly mode: StateSyncMode;
  readonly trustedHeight: bigint;
  readonly trustedBlockId: string;
  readonly trustedStateRoot: string;
};

export type SnapshotConfig = {
  readonly directory: string;
  readonly retain: number;
};

export type ValidatorNodeConfig = {
  readonly schemaVersion: typeof OPS_SCHEMA_VERSION;
  readonly role: NodeRole;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly dataDirectory: string;
  readonly p2pListen: string;
  readonly sentryPeers: readonly PeerDescriptor[];
  readonly signer: SignerEndpoint;
  readonly rpc: RpcBinding;
  readonly metricsEndpoint: string;
  readonly stateSync: StateSyncConfig;
  readonly snapshot: SnapshotConfig;
  readonly logPolicy: LogPolicy;
  readonly resourceLimits: ResourceLimits;
  readonly peerPolicy: PeerPolicy;
  readonly hostedServices: readonly string[];
  readonly maintenanceMode: boolean;
};

export type SentryNodeConfig = {
  readonly schemaVersion: typeof OPS_SCHEMA_VERSION;
  readonly role: 'SENTRY';
  readonly networkId: string;
  readonly chainId: string;
  readonly p2pListen: string;
  readonly validatorPeerId: string;
  readonly publicPeers: readonly string[];
  readonly hasConsensusVotingKey: false;
};

export type SentryTopology = {
  readonly validatorId: string;
  readonly validatorPeerId: string;
  readonly sentries: readonly {
    readonly sentryId: string;
    readonly peerId: string;
    readonly address: string;
  }[];
};

export type SignerClientIdentity = {
  readonly clientId: string;
  readonly role: NodeRole;
  readonly certificateFingerprint: string;
};

export type SignerLease = {
  readonly consensusKeyId: string;
  readonly holderId: string;
  readonly fencingToken: bigint;
  readonly expiresAtUtc: string;
  readonly mode: SignerMode;
};

export type SafetyCheckpoint = {
  readonly validatorId: string;
  readonly chainId: string;
  readonly lastSignedHeight: bigint;
  readonly lastSignedRound: bigint;
  readonly lastSignedStep: ConsensusMessageType;
  readonly integrityHash: string;
  readonly createdAtUtc: string;
};

export type KeyGenerationReceipt = {
  readonly keyId: string;
  readonly publicKeyHex: string;
  readonly purpose: string;
  readonly role: string;
  readonly suiteId: string;
  readonly providerId: string;
  readonly privateMaterialExported: false;
  readonly createdAtUtc: string;
};

export type WorkflowStep = {
  readonly id: string;
  readonly status: 'PENDING' | 'DONE' | 'BLOCKED';
  readonly detail: string;
};

export type ValidatorWorkflowReceipt = {
  readonly kind: 'JOIN' | 'EXIT' | 'REPLACE' | 'ROTATE' | 'JAIL';
  readonly validatorId: string;
  readonly steps: readonly WorkflowStep[];
  readonly status: ValidatorStatus | 'SCHEDULED';
  readonly epoch: bigint;
  readonly evidenceErased: false;
};

export type SnapshotManifest = {
  readonly kind: SnapshotKind;
  readonly networkId: string;
  readonly chainId: string;
  readonly height: bigint;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly protocolVersion: string;
  readonly validatorSetHash: string;
  readonly validatorSetVersion: bigint;
  readonly payloadHash: string;
  readonly manifestHash: string;
  readonly createdAtUtc: string;
  readonly includesPrivateKey: false;
};

export type ReadinessCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type OperatorReadinessReport = {
  readonly ready: boolean;
  readonly role: NodeRole;
  readonly networkId: string;
  readonly chainId: string;
  readonly checks: readonly ReadinessCheck[];
  readonly atUtc: string;
};

export type StructuredLogRecord = {
  readonly ts: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly event: string;
  readonly height?: string;
  readonly round?: string;
  readonly step?: ConsensusMessageType;
  readonly peerState?: string;
  readonly consensusEvent?: string;
  readonly signerError?: string;
  readonly upgradeState?: string;
};

export type IncidentProcedure = {
  readonly kind: IncidentKind;
  readonly isolateSigner: boolean;
  readonly isolateSentries: boolean;
  readonly rotateKeys: boolean;
  readonly preserveEvidence: true;
  readonly notifyGovernance: boolean;
  readonly steps: readonly string[];
};

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = Object.freeze({
  cpuMillis: 2_000,
  memoryBytes: 4 * 1024 * 1024 * 1024,
  openFiles: 65_536,
  diskBytes: 200 * 1024 * 1024 * 1024,
  maxNetworkConnections: 256,
  diskWarnRatio: 0.85,
});

export const DEFAULT_LOG_POLICY: LogPolicy = Object.freeze({
  format: 'JSON',
  includeHeight: true,
  includeRound: true,
  includeStep: true,
  includePeerState: true,
  includeConsensusEvents: true,
  includeSignerErrors: true,
  includeUpgradeState: true,
  redactPrivateKeys: true,
});
