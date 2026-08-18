/**
 * Chunk 88 — SunRey authorized production genesis execution engine
 * and launch control-room types.
 *
 * The complete production path exists in code. Automated tests use
 * isolated rehearsal inputs only. Engineering qualification is never
 * sufficient to execute. Chain genesis does not authorize customer
 * financial capabilities.
 */

import type { GenesisAssetAllocationManifest, ProductionCapabilityActivation } from '../mainnet/types.ts';
import type { GenesisTimePolicy } from '../production-ceremony/types.ts';

export const GENESIS_EXECUTION_SCHEMA_VERSION = 1 as const;
export const GENESIS_EXECUTION_TOOL_VERSION = 'sunrey-launch/production/1' as const;

export const LAUNCH_EXECUTION_STATES = [
  'PLAN_CREATED',
  'PLAN_VERIFIED',
  'AUTHORIZATION_COMPLETE',
  'EXECUTION_PERMIT_ISSUED',
  'GENESIS_EXECUTED',
  'FIRST_BLOCK_FINALIZED',
  'INITIAL_CHAIN_VERIFIED',
  'CANCELLED',
  'INCIDENT',
] as const;
export type LaunchExecutionState = (typeof LAUNCH_EXECUTION_STATES)[number];

export const LAUNCH_EXECUTION_MODES = ['REHEARSAL', 'PRODUCTION'] as const;
export type LaunchExecutionMode = (typeof LAUNCH_EXECUTION_MODES)[number];

export const LAUNCH_AUTHORITY_ROLES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'RELEASE_AUTHORITY',
  'OPERATIONS_AUTHORITY',
] as const;
export type LaunchAuthorityRole = (typeof LAUNCH_AUTHORITY_ROLES)[number];

export const REQUIRED_LAUNCH_HUMAN_ROLES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'RELEASE_AUTHORITY',
] as const;
export type RequiredLaunchHumanRole = (typeof REQUIRED_LAUNCH_HUMAN_ROLES)[number];

export const LAUNCH_ACTOR_KINDS = ['HUMAN', 'AI', 'SERVICE', 'AUTOMATION'] as const;
export type LaunchActorKind = (typeof LAUNCH_ACTOR_KINDS)[number];

export const LAUNCH_EVENT_CLASSES = [
  'PLAN_BOUND',
  'PLAN_VERIFIED',
  'AUTHORIZATION_RECORDED',
  'AUTHORIZATION_REJECTED',
  'PERMIT_ISSUED',
  'PERMIT_CONSUMED',
  'PERMIT_REPLAY_REJECTED',
  'PERMIT_REVOKED',
  'READINESS_CHECKED',
  'CONTROL_ROOM_SNAPSHOT',
  'GENESIS_DISTRIBUTED',
  'GENESIS_AGREED',
  'GENESIS_EXECUTED',
  'SERVICE_BROUGHT_UP',
  'FIRST_PROPOSAL',
  'FIRST_COMMIT',
  'FIRST_BLOCK_VERIFIED',
  'FIRST_BLOCK_FAILED',
  'SUPPLY_AUDITED',
  'INCIDENT_OPENED',
  'HISTORY_REWRITE_REJECTED',
  'CAPABILITY_MATRIX_UNCHANGED',
] as const;
export type LaunchEventClass = (typeof LAUNCH_EVENT_CLASSES)[number];

export const SERVICE_BRING_UP_SEQUENCE = [
  'INFRASTRUCTURE',
  'SECURITY_SERVICES',
  'SIGNERS',
  'SENTRIES',
  'VALIDATORS',
  'CONSENSUS',
  'PUBLIC_RPC',
  'EXPLORER',
  'MONITORING',
] as const;
export type ServiceBringUpStep = (typeof SERVICE_BRING_UP_SEQUENCE)[number];

export const INDEPENDENTLY_GATED_SERVICES = [
  'EXCHANGE',
  'CUSTODY_WITHDRAWALS',
  'FIAT_RAILS',
  'PAYMENTS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKETS',
  'PRODUCTION_INTEROP',
] as const;
export type IndependentlyGatedService = (typeof INDEPENDENTLY_GATED_SERVICES)[number];

export const SAFE_MODE_DISABLED_CAPABILITIES = INDEPENDENTLY_GATED_SERVICES;

export const LAUNCH_FAILURE_CODES = [
  'VALIDATOR_NOT_READY',
  'SIGNER_NOT_READY',
  'WRONG_GENESIS',
  'WRONG_PLAN',
  'WRONG_CANDIDATE_V2',
  'WRONG_MAINNET_RC',
  'WRONG_NETWORK',
  'WRONG_CHAIN',
  'MODIFIED_VALIDATOR_SET',
  'PROVIDER_ISSUE',
  'CONFIGURATION_DRIFT',
  'AUTHORIZATION_MISMATCH',
  'INSUFFICIENT_HUMAN_AUTHORITY',
  'AI_CANNOT_AUTHORIZE',
  'FIXTURE_REJECTED_FROM_PRODUCTION',
  'PERMIT_REPLAYED',
  'PERMIT_REVOKED',
  'PERMIT_EXPIRED',
  'CRITICAL_AUDIT_BLOCKER',
  'FIRST_BLOCK_VERIFICATION_FAILURE',
  'HISTORY_REWRITE_FORBIDDEN',
  'DUPLICATE_INITIALIZATION',
  'TICKER_INVENTION_FORBIDDEN',
] as const;
export type LaunchFailureCode = (typeof LAUNCH_FAILURE_CODES)[number];

export type LaunchHumanAuthorization = {
  readonly role: LaunchAuthorityRole;
  readonly actorKind: LaunchActorKind;
  readonly actorId: string;
  readonly planHash: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly signedAtUtc: string;
};

export type ProductionEnvironmentPlan = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly source: 'CHUNK_86' | 'REHEARSAL_ISOLATED';
  readonly networkId: string;
  readonly chainId: string;
  readonly topologyDigest: string;
  readonly providerBindingHash: string;
  readonly observedDeploymentHash: string;
  readonly allowedVarianceCodes: readonly string[];
  readonly fixtureClass: boolean;
  readonly usableForProduction: boolean;
  readonly planHash: string;
};

export type PreGenesisQualificationReport = {
  readonly schemaVersion: 1;
  readonly reportId: string;
  readonly source: 'CHUNK_87' | 'REHEARSAL_ISOLATED';
  readonly qualificationState: 'QUALIFIED_REHEARSAL' | 'QUALIFIED_PRODUCTION' | 'NOT_QUALIFIED';
  readonly genesisHashBound: string;
  readonly candidateV2HashBound: string;
  readonly mainnetRcHashBound: string;
  readonly ceremonyTranscriptHashBound: string;
  readonly fixtureClass: boolean;
  readonly usableForProduction: boolean;
  readonly reportHash: string;
};

export type ProductionLaunchPlan = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly planVersion: number;
  readonly mode: LaunchExecutionMode;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2Hash: string;
  readonly environmentPlan: ProductionEnvironmentPlan;
  readonly genesisManifestHash: string;
  readonly genesisHash: string;
  readonly genesisAuthorizationPackageHash: string;
  readonly ceremonyTranscriptHash: string;
  readonly providerReadinessHash: string;
  readonly auditSecurityStateHash: string;
  readonly preGenesisQualification: PreGenesisQualificationReport;
  readonly allocationManifestHash: string;
  readonly allocation: GenesisAssetAllocationManifest;
  readonly requiredHumanRoles: readonly RequiredLaunchHumanRole[];
  readonly requiredApprovals: number;
  readonly genesisTimePolicy: GenesisTimePolicy;
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly validatorSetHash: string;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly usableForProduction: boolean;
  readonly realProductionExecutionPerformed: false;
  readonly mainnetEnabled: false;
  readonly planHash: string;
};

export type ProductionLaunchAuthorization = {
  readonly schemaVersion: 1;
  readonly planHash: string;
  readonly authorizations: readonly LaunchHumanAuthorization[];
  readonly authorizationSetHash: string;
  readonly complete: boolean;
  readonly occupiedByAi: false;
  readonly usableForProduction: boolean;
};

export type LaunchExecutionPermit = {
  readonly schemaVersion: 1;
  readonly permitId: string;
  readonly launchPlanHash: string;
  readonly genesisHash: string;
  readonly rcHash: string;
  readonly candidateV2Hash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly authorizationSetHash: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string;
  readonly executionNonce: string;
  readonly singleUse: true;
  readonly consumed: boolean;
  readonly revoked: boolean;
  readonly permitHash: string;
};

export type LaunchValidatorReadiness = {
  readonly validatorId: string;
  readonly candidateMatch: boolean;
  readonly genesisHashMatch: boolean;
  readonly consensusPublicKeyMatch: boolean;
  readonly networkMatch: boolean;
  readonly chainMatch: boolean;
  readonly artifactMatch: boolean;
  readonly remoteSignerHealthy: boolean;
  readonly antiDoubleSignInitialized: boolean;
  readonly peerSentryConfigured: boolean;
  readonly timeSyncHealthy: boolean;
  readonly storageHealthy: boolean;
  readonly operatorAcknowledged: boolean;
  readonly genesisHashAcknowledged: string | null;
  readonly ready: boolean;
  readonly failureCode: LaunchFailureCode | null;
};

export type LaunchServiceReadiness = {
  readonly step: ServiceBringUpStep | IndependentlyGatedService;
  readonly sequenced: boolean;
  readonly independentlyGated: boolean;
  readonly broughtUp: boolean;
  readonly healthy: boolean;
};

export type LaunchObservabilityReadiness = {
  readonly metrics: boolean;
  readonly logs: boolean;
  readonly alerts: boolean;
  readonly validatorHealth: boolean;
  readonly signerHealth: boolean;
  readonly disk: boolean;
  readonly database: boolean;
  readonly backupMonitoring: boolean;
  readonly ready: boolean;
};

export type LaunchBackupReadiness = {
  readonly backupTargetsConfigured: boolean;
  readonly evidencePathsConfigured: boolean;
  readonly ready: boolean;
};

export type ProductionLaunchControlRoomState = {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly mode: LaunchExecutionMode;
  readonly executionState: LaunchExecutionState;
  readonly authorizationComplete: boolean;
  readonly releaseVerified: boolean;
  readonly candidateV2Verified: boolean;
  readonly providerHealthy: boolean;
  readonly validatorsReady: boolean;
  readonly signersReady: boolean;
  readonly networkReady: boolean;
  readonly storageReady: boolean;
  readonly databaseReady: boolean;
  readonly observabilityReady: boolean;
  readonly backupReady: boolean;
  readonly securityFindingsClear: boolean;
  readonly externalReady: boolean;
  readonly genesisStatus: 'NOT_EXECUTED' | 'DISTRIBUTED' | 'AGREED' | 'EXECUTED';
  readonly firstBlockStatus: 'NOT_OBSERVED' | 'PROPOSED' | 'COMMITTED' | 'FINALIZED' | 'FAILED';
  readonly capabilityActivationUnchanged: true;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
};

export type LaunchEvent = {
  readonly sequence: number;
  readonly actor: string;
  readonly actorKind: LaunchActorKind | 'SYSTEM';
  readonly eventClass: LaunchEventClass;
  readonly inputHash: string;
  readonly result: 'OK' | 'REJECTED' | 'INCIDENT';
  readonly evidenceHash: string;
  readonly previousEventHash: string;
  readonly eventHash: string;
  readonly occurredAtUtc: string;
};

export type FirstProposal = {
  readonly proposer: string;
  readonly height: bigint;
  readonly round: bigint;
  readonly blockId: string;
  readonly validatorSetHash: string;
  readonly stateRoot: string;
};

export type FirstCommit = {
  readonly height: bigint;
  readonly blockId: string;
  readonly commitPower: bigint;
  readonly totalPower: bigint;
  readonly signatures: readonly string[];
  readonly canonicalRulesOk: boolean;
};

export type FirstBlockVerification = {
  readonly proposal: FirstProposal;
  readonly commit: FirstCommit;
  readonly stateRoot: string;
  readonly validatorsConverged: boolean;
  readonly healthyValidatorAgreement: boolean;
  readonly verified: boolean;
};

export type GenesisSupplyAudit = {
  readonly sunreyGenesisQuantity: bigint;
  readonly moonreyGenesisQuantity: bigint;
  readonly allocationManifestHash: string;
  readonly nativeSupplyEquationHolds: boolean;
  readonly hiddenAllocation: false;
  readonly zeroSupplyCompatible: boolean;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly ok: boolean;
};

export type GenesisExecutionResult = {
  readonly executed: boolean;
  readonly mode: LaunchExecutionMode;
  readonly genesisHash: string;
  readonly canonicalBytesHex: string;
  readonly genesisTimeUtc: string;
  readonly distributedTo: readonly string[];
  readonly independentlyVerified: readonly string[];
  readonly failureCode: LaunchFailureCode | null;
  readonly realProductionExecutionPerformed: false;
};

export type LaunchIncident = {
  readonly severity: 'HIGH';
  readonly class: 'FIRST_BLOCK_VERIFICATION_FAILURE' | 'PRE_GENESIS_FAILURE' | 'BRING_UP_FAILURE';
  readonly evidencePreserved: true;
  readonly synthesizedSuccess: false;
  readonly detail: string;
};

export type LaunchExecutionSession = {
  readonly sessionId: string;
  readonly mode: LaunchExecutionMode;
  readonly state: LaunchExecutionState;
  readonly plan: ProductionLaunchPlan;
  readonly authorization: ProductionLaunchAuthorization | null;
  readonly permit: LaunchExecutionPermit | null;
  readonly validators: readonly LaunchValidatorReadiness[];
  readonly services: readonly LaunchServiceReadiness[];
  readonly observability: LaunchObservabilityReadiness;
  readonly backup: LaunchBackupReadiness;
  readonly controlRoom: ProductionLaunchControlRoomState;
  readonly events: readonly LaunchEvent[];
  readonly genesis: GenesisExecutionResult | null;
  readonly firstBlock: FirstBlockVerification | null;
  readonly supplyAudit: GenesisSupplyAudit | null;
  readonly incident: LaunchIncident | null;
  readonly capabilityMatrix: readonly ProductionCapabilityActivation[];
  readonly capabilityMatrixUnchanged: true;
  readonly realProductionExecutionPerformed: false;
  readonly mainnetEnabled: false;
};

export type LaunchExecutionReport = {
  readonly schemaVersion: 1;
  readonly title: 'SunRey Launch Execution Report';
  readonly sessionId: string;
  readonly mode: LaunchExecutionMode;
  readonly planHash: string;
  readonly authorizationSetHash: string | null;
  readonly permitHash: string | null;
  readonly genesisHash: string | null;
  readonly firstBlockVerified: boolean;
  readonly supplyAuditOk: boolean;
  readonly controlRoom: ProductionLaunchControlRoomState;
  readonly eventsHash: string;
  readonly previousReportHash: string;
  readonly reportHash: string;
  readonly executionState: LaunchExecutionState;
  readonly capabilityActivationUnchanged: true;
  readonly realProductionExecutionPerformed: false;
  readonly mainnetEnabled: false;
  readonly liveFlagsRemainDisabled: true;
};
