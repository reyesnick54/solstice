/**
 * Chunk 54 — SunRey validator operator infrastructure types.
 *
 * Operator tooling around the existing validator registry, BFT engine,
 * signer safety, P2P, governance, and CryptoSuite. This is not a second
 * consensus engine or validator registry.
 */

import type { ConsensusMessageType, ValidatorStatus } from '../validators/types.ts';

export const OPS_SCHEMA_VERSION = 1 as const;

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
