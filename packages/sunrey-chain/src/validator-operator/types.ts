/**
 * Chunk 92 — SunRey validator operator platform types.
 *
 * Operational projection / control plane over the canonical validator
 * registry. This module does not independently change validator-set
 * state, reimplement consensus, create public delegated staking, or
 * issue a governance token.
 */

import type { ProductionValidatorDossier } from '../production-ceremony/types.ts';
import type { BondState } from '../validator-economics/types.ts';
import type { ValidatorStatus } from '../validators/types.ts';

/** Consumed by reference. Chunk 85 remains the dossier authority. */
export type ConsumedProductionValidatorDossier = Pick<
  ProductionValidatorDossier,
  'validatorId' | 'legalOperatorReference' | 'operatorEvidenceState' | 'fixtureClass'
>;

export const VALIDATOR_OPERATOR_SCHEMA_VERSION = 1 as const;
export const VALIDATOR_OPERATOR_TOOL_VERSION = 'sunrey-ops/validator/1' as const;
export const VALIDATOR_OPERATOR_OWNER = 'packages/sunrey-chain' as const;
export const VALIDATOR_OPERATOR_DOMAIN = 'sunrey.validator.operator.v1' as const;
export const VALIDATOR_OPERATOR_NOW_UTC = '2026-08-18T12:00:00.000Z' as const;

export const CANONICAL_VALIDATOR_SET_AUTHORITATIVE = true as const;
export const OPERATOR_PLATFORM_IS_PROJECTION = true as const;
export const AI_CANNOT_CAST_VALIDATOR_VOTE = true as const;
export const SENTRIES_CANNOT_SIGN = true as const;
export const NO_PUBLIC_DELEGATED_STAKING = true as const;
export const NO_GOVERNANCE_TOKEN = true as const;
export const OPERATOR_CANNOT_DEBIT_CUSTOMER_ASSETS = true as const;
export const BINARY_DEPLOY_DOES_NOT_ACTIVATE_PROTOCOL = true as const;
export const MONITORING_SUSPICION_IS_NOT_FINALIZED_MISCONDUCT = true as const;
export const DIFFERENT_VALIDATOR_IDS_DO_NOT_IMPLY_INDEPENDENCE = true as const;

export const OPERATOR_NODE_STATES = [
  'PROVISIONING',
  'SYNCING',
  'READY',
  'ACTIVE',
  'MAINTENANCE',
  'DEGRADED',
  'JAILED',
  'UNBONDING',
  'EXITING',
  'RETIRED',
] as const;
export type OperatorNodeState = (typeof OPERATOR_NODE_STATES)[number];

export const CANONICAL_STATUS_MAP: Readonly<Record<OperatorNodeState, ValidatorStatus | null>> = {
  PROVISIONING: 'CANDIDATE',
  SYNCING: 'BONDED',
  READY: 'PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'ACTIVE',
  DEGRADED: 'ACTIVE',
  JAILED: 'JAILED',
  UNBONDING: 'PENDING_EXIT',
  EXITING: 'PENDING_EXIT',
  RETIRED: 'EXITED',
};

export const OPERATOR_ROLES = [
  'OPERATOR_ADMIN',
  'FLEET_OPERATOR',
  'SIGNER_CUSTODIAN',
  'ENROLLMENT_OFFICER',
  'INCIDENT_RESPONDER',
  'GOVERNANCE_PREPARER',
  'VIEWER',
  'AI_ANALYST',
] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'WORKLOAD', 'SERVICE'] as const;
export type OperatorActorKind = (typeof ACTOR_KINDS)[number];

export const ACCEPTANCE_STATES = [
  'UNSUBMITTED',
  'PENDING_HUMAN_REVIEW',
  'HUMAN_ACCEPTED',
  'REJECTED',
  'FIXTURE_REHEARSAL_ONLY',
] as const;
export type OperatorAcceptanceState = (typeof ACCEPTANCE_STATES)[number];

export const ENROLLMENT_STAGES = [
  'OPERATOR_PROFILE',
  'INFRASTRUCTURE_EVIDENCE',
  'SIGNER_EVIDENCE',
  'CANDIDATE_V2_ASSIGNMENT',
  'DOSSIER',
  'HUMAN_ACCEPTANCE',
  'VALIDATOR_GOVERNANCE_ACTION',
  'ACTIVATION_COORDINATE',
] as const;
export type EnrollmentStage = (typeof ENROLLMENT_STAGES)[number];

export const NODE_KINDS = ['VALIDATOR', 'SENTRY'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const KEY_PURPOSES = [
  'CONSENSUS_VOTING',
  'P2P_IDENTITY',
  'GOVERNANCE',
  'OPERATOR_TLS',
] as const;
export type OperatorKeyPurpose = (typeof KEY_PURPOSES)[number];

export const HSM_KMS_STATES = [
  'SIMULATION',
  'REHEARSAL',
  'PROVIDER_CLAIMED',
  'UNAVAILABLE',
] as const;
export type HsmKmsState = (typeof HSM_KMS_STATES)[number];

export const ROTATION_STATES = [
  'CURRENT',
  'PREPARED',
  'ACTIVATING',
  'RETIRED',
  'REJECTED',
] as const;
export type RotationState = (typeof ROTATION_STATES)[number];

export const FENCING_STATES = ['ACTIVE', 'PASSIVE', 'FENCED', 'UNASSIGNED'] as const;
export type FencingState = (typeof FENCING_STATES)[number];

export const ANTI_DOUBLE_SIGN_STATES = ['READY', 'WATERMARK_HELD', 'CONFLICT', 'UNKNOWN'] as const;
export type AntiDoubleSignState = (typeof ANTI_DOUBLE_SIGN_STATES)[number];

export const INCIDENT_TYPES = [
  'NODE_FAILURE',
  'SIGNER_FAILURE',
  'KEY_COMPROMISE_SUSPECTED',
  'NETWORK_PARTITION',
  'STORAGE_CORRUPTION',
  'VERSION_MISMATCH',
  'DOUBLE_SIGN_EVIDENCE',
  'PROVIDER_OUTAGE',
] as const;
export type ValidatorIncidentType = (typeof INCIDENT_TYPES)[number];

export const BACKUP_CLASSES = [
  'SNAPSHOT',
  'SIGNER_SAFETY',
  'CONFIGURATION',
  'EVIDENCE',
] as const;
export type OperatorBackupClass = (typeof BACKUP_CLASSES)[number];

export const RECOVERY_KINDS = [
  'NODE_LOSS',
  'DISK_LOSS',
  'SENTRY_LOSS',
  'SIGNER_LOSS',
  'FAILURE_DOMAIN_LOSS',
] as const;
export type RecoveryKind = (typeof RECOVERY_KINDS)[number];

export const HIGH_IMPACT_ACTIONS = [
  'ENROLL',
  'ACCEPT',
  'MAINTENANCE_PLAN',
  'MAINTENANCE_EXECUTE',
  'UPGRADE_PLAN',
  'UPGRADE_BATCH',
  'PROTOCOL_ACTIVATE',
  'ROTATE_PREPARE',
  'ROTATE_ACTIVATE',
  'RECOVERY',
  'INCIDENT_OPEN',
  'INCIDENT_PRESERVE',
  'GOVERNANCE_PREPARE',
  'GOVERNANCE_CAST',
  'BACKUP_CREATE',
  'BACKUP_RESTORE',
  'SENTRY_REPLACE',
  'SIGNER_FENCE',
] as const;
export type HighImpactAction = (typeof HIGH_IMPACT_ACTIONS)[number];

export const OPERATOR_REASON_CODES = [
  'OK',
  'UNAUTHORIZED_OPERATOR',
  'UNAUTHORIZED_ROLE',
  'AI_CANNOT_PERFORM',
  'AI_CANNOT_CAST_VOTE',
  'CROSS_OPERATOR_DENIED',
  'SENTRY_CANNOT_SIGN',
  'UNSAFE_MAINTENANCE',
  'UNSAFE_UPGRADE_BATCH',
  'WRONG_RELEASE',
  'PROTOCOL_NOT_ACTIVATED_BY_BINARY',
  'ROTATION_REPLAY',
  'OLD_KEY_REJECTED',
  'DUAL_ACTIVE_SIGNER',
  'FIXTURE_ACCEPTANCE_REJECTED',
  'CANONICAL_SET_AUTHORITATIVE',
  'CUSTOMER_ASSET_ISOLATION',
  'MONITORING_NOT_FINALIZED',
  'PRIVATE_KEY_FORBIDDEN',
  'DOSSIER_AUTHORITY_EXTERNAL',
  'MACHINE_AUTHORITY_UNDEFINED',
  'MISSING_EVIDENCE',
  'ENROLLMENT_INCOMPLETE',
] as const;
export type OperatorReasonCode = (typeof OPERATOR_REASON_CODES)[number];

export type OperatorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: OperatorReasonCode; readonly message: string };

export function operatorOk<T>(value: T): OperatorResult<T> {
  return { ok: true, value };
}

export function operatorErr(code: OperatorReasonCode, message: string): OperatorResult<never> {
  return { ok: false, code, message };
}

export type OperatorPrincipal = {
  readonly actorId: string;
  readonly operatorId: string;
  readonly role: OperatorRole;
  readonly kind: OperatorActorKind;
  readonly tokenId: string;
  readonly workloadId: string | null;
};

export type AuthorizedContact = {
  readonly contactId: string;
  readonly role: string;
  readonly channel: 'EMAIL_REF' | 'PAGER_REF' | 'VOICE_REF';
  readonly reference: string;
};

export type ValidatorOperatorOrganization = {
  readonly organizationId: string;
  readonly legalName: string;
  readonly controllerReference: string;
  readonly independenceClaimed: false;
};

export type ValidatorOperatorProfile = {
  readonly profileId: string;
  readonly operatorId: string;
  readonly publicDescriptor: string;
  readonly infrastructureEvidenceRef: string | null;
  readonly signerEvidenceRef: string | null;
  readonly securityEvidenceRef: string | null;
  readonly privatePersonalDetailsExposed: false;
};

export type ValidatorOperator = {
  readonly operatorId: string;
  readonly organizationId: string;
  readonly authorizedContacts: readonly AuthorizedContact[];
  readonly operationalRegion: string;
  readonly providerReferences: readonly string[];
  readonly securityEvidenceReferences: readonly string[];
  readonly incidentContacts: readonly AuthorizedContact[];
  readonly acceptanceStatus: OperatorAcceptanceState;
  readonly profileId: string;
  readonly fixture: boolean;
};

export type ValidatorSignerRecord = {
  readonly signerId: string;
  readonly validatorId: string;
  readonly operatorId: string;
  readonly keyPurpose: OperatorKeyPurpose;
  readonly publicKeyFingerprint: string;
  readonly provider: string;
  readonly hsmKmsState: HsmKmsState;
  readonly algorithm: string;
  readonly rotationState: RotationState;
  readonly fencingState: FencingState;
  readonly antiDoubleSignState: AntiDoubleSignState;
  readonly watermarkHeight: bigint;
  readonly privateKeyPresent: false;
};

export type ValidatorNodeRecord = {
  readonly nodeId: string;
  readonly validatorId: string | null;
  readonly operatorId: string;
  readonly kind: NodeKind;
  readonly operationalState: OperatorNodeState;
  readonly canonicalStatus: ValidatorStatus | null;
  readonly region: string;
  readonly failureDomain: string;
  readonly cloudProvider: string;
  readonly softwareRelease: string;
  readonly protocolVersion: string;
  readonly artifactDigest: string;
  readonly canSign: boolean;
};

export type NodeHealthSample = {
  readonly nodeId: string;
  readonly height: bigint;
  readonly peerCount: number;
  readonly consensusParticipation: boolean;
  readonly missedVotes: number;
  readonly proposalDuties: number;
  readonly stateRoot: string;
  readonly diskFreeBytes: bigint;
  readonly cpuPermille: number;
  readonly memoryUsedBytes: bigint;
  readonly networkRxBytes: bigint;
  readonly networkTxBytes: bigint;
  readonly signerLatencyMs: number | null;
  readonly signerHealthy: boolean | null;
  readonly snapshotStatus: 'CURRENT' | 'STALE' | 'ABSENT' | 'NOT_APPLICABLE';
  readonly collectedAtUtc: string;
};

export type ValidatorFleet = {
  readonly fleetId: string;
  readonly operatorId: string;
  readonly validators: readonly string[];
  readonly sentries: readonly string[];
  readonly signers: readonly string[];
  readonly regions: readonly string[];
  readonly failureDomains: readonly string[];
  readonly cloudProviders: readonly string[];
  readonly softwareRelease: string;
  readonly protocolVersion: string;
  readonly health: ValidatorFleetHealth;
};

export type ValidatorFleetHealth = {
  readonly fleetId: string;
  readonly healthyNodes: number;
  readonly degradedNodes: number;
  readonly offlineNodes: number;
  readonly signerConflicts: number;
  readonly quorumSafe: boolean;
  readonly remainingVotingPower: bigint;
  readonly totalVotingPower: bigint;
  readonly samples: readonly NodeHealthSample[];
};

export type ValidatorOperatorEnrollment = {
  readonly enrollmentId: string;
  readonly operatorId: string;
  readonly validatorId: string;
  readonly stage: EnrollmentStage;
  readonly profileId: string;
  readonly infrastructureEvidenceRef: string | null;
  readonly signerEvidenceRef: string | null;
  readonly candidateV2Id: string;
  readonly dossierValidatorId: string;
  readonly dossierAuthority: 'CHUNK_85_PRODUCTION_VALIDATOR_DOSSIER';
  readonly humanAcceptanceId: string | null;
  readonly governanceActionId: string | null;
  readonly activationCoordinate: string | null;
  readonly fixture: boolean;
};

export type ValidatorOperatorAcceptance = {
  readonly acceptanceId: string;
  readonly operatorId: string;
  readonly enrollmentId: string;
  readonly state: OperatorAcceptanceState;
  readonly acceptedBy: string | null;
  readonly actorKind: OperatorActorKind;
  readonly fixture: boolean;
  readonly realHumanAcceptance: boolean;
  readonly reason: string | null;
};

export type ValidatorMaintenancePlan = {
  readonly planId: string;
  readonly operatorId: string;
  readonly validatorIds: readonly string[];
  readonly reason: string;
  readonly projectedRemainingVotingPower: bigint;
  readonly totalVotingPower: bigint;
  readonly quorumSafe: boolean;
  readonly decision: 'ALLOW' | 'WARN' | 'REFUSE';
  readonly policy: OperationalQuorumPolicy;
};

export type OperationalQuorumPolicy = {
  readonly name: string;
  readonly requireTwoThirdsPlusRemaining: boolean;
  readonly maxConcurrentMaintenancePowerBps: number;
};

export type ValidatorUpgradePlan = {
  readonly planId: string;
  readonly operatorId: string;
  readonly release: string;
  readonly artifactDigest: string;
  readonly protocolVersion: string;
  readonly upgradePolicy: string;
  readonly validatorBatch: readonly string[];
  readonly readiness: 'NOT_READY' | 'READY' | 'VERIFIED';
  readonly postUpgradeVerification: string | null;
  readonly binaryDeployed: boolean;
  readonly protocolActivated: boolean;
};

export type RotationPackage = {
  readonly packageId: string;
  readonly validatorId: string;
  readonly operatorId: string;
  readonly currentFingerprint: string;
  readonly nextFingerprint: string;
  readonly requestHash: string;
  readonly preservesKeyIdentity: boolean;
  readonly watermark: bigint;
  readonly fencingState: FencingState;
  readonly activated: boolean;
};

export type OperatorBackupRecord = {
  readonly backupId: string;
  readonly operatorId: string;
  readonly validatorId: string;
  readonly class: OperatorBackupClass;
  readonly digest: string;
  readonly createdAtUtc: string;
  readonly verified: boolean;
};

export type RecoveryWorkflow = {
  readonly recoveryId: string;
  readonly kind: RecoveryKind;
  readonly operatorId: string;
  readonly validatorId: string;
  readonly evidencePreserved: boolean;
  readonly steps: readonly string[];
  readonly completed: boolean;
};

export type ValidatorIncident = {
  readonly incidentId: string;
  readonly type: ValidatorIncidentType;
  readonly operatorId: string;
  readonly validatorId: string;
  readonly summary: string;
  readonly evidenceRef: string | null;
  readonly finalizedMisconduct: boolean;
  readonly monitoringSuspicionOnly: boolean;
  readonly evidencePreserved: boolean;
  readonly openedAtUtc: string;
};

export type ConcentrationBreakdown = {
  readonly dimension: 'OPERATOR' | 'CLOUD' | 'REGION' | 'HSM_PROVIDER' | 'NETWORK';
  readonly buckets: readonly { readonly key: string; readonly validatorCount: number; readonly votingPower: bigint }[];
};

export type ValidatorConcentrationReport = {
  readonly generatedAtUtc: string;
  readonly breakdowns: readonly ConcentrationBreakdown[];
};

export type PublicValidatorView = {
  readonly validatorId: string;
  readonly publicKeyFingerprint: string;
  readonly votingPower: bigint;
  readonly publicStatus: ValidatorStatus | OperatorNodeState;
  readonly bondState: BondState;
  readonly publicAccountabilityEvidence: readonly string[];
  readonly infrastructureHealthExposed: false;
};

export type PrivateOperatorView = {
  readonly validatorId: string;
  readonly public: PublicValidatorView;
  readonly infrastructureHealth: NodeHealthSample | null;
  readonly signerLatencyMs: number | null;
  readonly diskFreeBytes: bigint | null;
};

export type AuditRecord = {
  readonly auditId: string;
  readonly action: HighImpactAction;
  readonly operatorId: string;
  readonly role: OperatorRole;
  readonly actorId: string;
  readonly actorKind: OperatorActorKind;
  readonly validatorId: string | null;
  readonly releaseOrPolicy: string | null;
  readonly requestHash: string;
  readonly approval: string | null;
  readonly result: 'ALLOW' | 'REFUSE';
  readonly reasonCode: OperatorReasonCode;
  readonly atUtc: string;
};

export type GovernanceVotePreparation = {
  readonly preparationId: string;
  readonly operatorId: string;
  readonly validatorId: string;
  readonly proposalId: string;
  readonly summary: string;
  readonly preparedBy: string;
  readonly preparedByKind: OperatorActorKind;
  readonly cast: false;
  readonly machineAuthorityDefined: false;
};

export type OperatorEconomicsProjection = {
  readonly validatorId: string;
  readonly bondState: BondState;
  readonly rewardSummary: string;
  readonly penaltyRecords: readonly string[];
  readonly unbondState: string;
  readonly source: 'CHUNK_72_VALIDATOR_ECONOMICS';
  readonly canDebitCustomerAssets: false;
};

export type AccountabilityProjection = {
  readonly validatorId: string;
  readonly protocolEvidence: readonly string[];
  readonly monitoringAlerts: readonly string[];
  readonly finalizedMisconduct: boolean;
  readonly suspicionPresentedAsFinal: false;
};

export type ValidatorOperatorReport = {
  readonly reportId: string;
  readonly generatedAtUtc: string;
  readonly operators: readonly ValidatorOperator[];
  readonly fleets: readonly ValidatorFleet[];
  readonly enrollments: readonly ValidatorOperatorEnrollment[];
  readonly incidents: readonly ValidatorIncident[];
  readonly concentration: ValidatorConcentrationReport;
  readonly canonicalSetAuthoritative: true;
  readonly publicDelegatedStaking: false;
  readonly governanceToken: false;
};

export type OperatorDashboardProjection = {
  readonly fleet: readonly ValidatorFleet[];
  readonly alerts: readonly ValidatorIncident[];
  readonly maintenance: readonly ValidatorMaintenancePlan[];
  readonly upgrades: readonly ValidatorUpgradePlan[];
  readonly bonds: readonly OperatorEconomicsProjection[];
  readonly signers: readonly ValidatorSignerRecord[];
  readonly backups: readonly OperatorBackupRecord[];
  readonly incidents: readonly ValidatorIncident[];
  readonly secretsPresent: false;
};

export type OperatorApiResponse = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export const DEFAULT_QUORUM_POLICY: OperationalQuorumPolicy = Object.freeze({
  name: 'BFT_TWO_THIRDS_PLUS_REMAINING',
  requireTwoThirdsPlusRemaining: true,
  maxConcurrentMaintenancePowerBps: 3_333,
});
