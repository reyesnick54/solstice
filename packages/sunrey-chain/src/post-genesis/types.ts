/**
 * Chunk 89 — SunRey post-genesis stabilization, safe-mode operations,
 * and progressive production capability activation.
 *
 * This is the operational control plane for the first blocks and epochs
 * after a future authorized production genesis. It does not launch
 * mainnet, enable LIVE_* flags, or treat chain health as authorization
 * for regulated or high-risk financial services.
 */

import type { ActivationDomain } from '../mainnet/types.ts';
import type { EmergencyActionClass, RestrictionState } from '../governance-ops/types.ts';

export const POST_GENESIS_SCHEMA_VERSION = 1 as const;
export const POST_GENESIS_TOOL_VERSION = 'sunrey-mainnet/stabilization/1' as const;
export const POST_GENESIS_DOMAIN = 'sunrey.post-genesis.v1' as const;

export const POST_GENESIS_PHASES = [
  'CHAIN_STABILIZATION',
  'NATIVE_ASSET_LIMITED',
  'ORACLE_LIMITED',
  'ECONOMIC_SERVICES_LIMITED',
  'REGULATED_SERVICES_ELIGIBLE',
  'FULL_CONFIGURED_OPERATIONS',
] as const;
export type PostGenesisPhase = (typeof POST_GENESIS_PHASES)[number];

export const INDEPENDENT_CAPABILITIES = [
  'SUNREY_COIN_NATIVE_ASSET',
  'MOONREY_COIN_NATIVE_ASSET',
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'FIAT_BANKING',
  'PAYMENT_RAILS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
  'INTEROPERABILITY',
] as const;
export type IndependentCapability = (typeof INDEPENDENT_CAPABILITIES)[number];

export const REGULATED_CAPABILITIES = [
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'FIAT_BANKING',
  'PAYMENT_RAILS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKET',
] as const;
export type RegulatedCapability = (typeof REGULATED_CAPABILITIES)[number];

export const POST_GENESIS_INCIDENT_CATEGORIES = [
  'CONSENSUS',
  'SIGNER',
  'STORAGE',
  'DATABASE',
  'ORACLE',
  'ECONOMIC_RECONCILIATION',
  'EXCHANGE',
  'CUSTODY',
  'PROVIDER',
  'SECURITY',
  'GOVERNANCE',
] as const;
export type PostGenesisIncidentCategory = (typeof POST_GENESIS_INCIDENT_CATEGORIES)[number];

export const INCIDENT_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_RESOLUTION_STATES = [
  'OPEN',
  'CONTAINED',
  'RECOVERING',
  'RESOLVED',
  'ACCEPTED_RISK',
] as const;
export type IncidentResolutionState = (typeof INCIDENT_RESOLUTION_STATES)[number];

export const ACTIVATION_RESULTS = [
  'ACTIVATED',
  'REJECTED',
  'HELD',
  'RESTRICTED',
] as const;
export type CapabilityActivationOutcome = (typeof ACTIVATION_RESULTS)[number];

export const HEALTH_COMPONENT_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNHEALTHY',
  'DISABLED',
  'NOT_APPLICABLE',
] as const;
export type HealthComponentState = (typeof HEALTH_COMPONENT_STATES)[number];

export const STATUS_PLANES = [
  'ENGINEERING_HEALTH',
  'PRODUCTION_CAPABILITY_STATUS',
  'REGULATED_SERVICE_STATUS',
] as const;
export type StatusPlane = (typeof STATUS_PLANES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'AGENT', 'AUTOMATION'] as const;
export type PostGenesisActorKind = (typeof ACTOR_KINDS)[number];

export const NETWORK_CLASSES = ['DEVELOPMENT', 'TESTNET', 'REHEARSAL', 'PRODUCTION_CANDIDATE'] as const;
export type PostGenesisNetworkClass = (typeof NETWORK_CLASSES)[number];

export const EVIDENCE_STATES = [
  'NOT_PROVIDED',
  'PROVIDED_UNVERIFIED',
  'ENGINEERING_VERIFIED',
  'EXTERNAL_VERIFICATION_REQUIRED',
  'HUMAN_VERIFIED',
  'NOT_APPLICABLE',
] as const;
export type PostGenesisEvidenceState = (typeof EVIDENCE_STATES)[number];

export const ADMISSION_CRITERION_KINDS = ['ENGINEERING', 'EXTERNAL', 'HUMAN'] as const;
export type AdmissionCriterionKind = (typeof ADMISSION_CRITERION_KINDS)[number];

export type ProtocolCoordinate = {
  readonly height: number;
  readonly epoch: number;
  readonly finalizedStateRoot: string;
};

export type ActivationCoordinate = {
  readonly kind: 'HEIGHT' | 'EPOCH' | 'APPROVED_CHECKPOINT';
  readonly height: number;
  readonly epoch: number | null;
  readonly checkpointId: string | null;
};

export type PostGenesisPolicy = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseId: string;
  readonly activeProtocol: string;
  readonly initialPhase: PostGenesisPhase;
  readonly checkpointHeights: readonly number[];
  readonly checkpointEpochs: readonly number[];
  readonly rpcMayOperate: boolean;
  readonly explorerMayOperate: boolean;
  readonly monitoringOperates: boolean;
  readonly backupsOperate: boolean;
  readonly highRiskFinancialDefault: 'INDEPENDENTLY_DISABLED';
  readonly moonreyProductiveIssuanceDefault: 'EXPLICITLY_DISABLED';
  readonly treasurySpendingAuthorizedByGenesis: false;
  readonly privacyDefault: 'DENY';
  readonly rawPdvUnavailable: true;
  readonly interopTrustedBridgeRoot: false;
  readonly realProductionCapabilitiesActivated: false;
};

export type PhaseAdmissionCriterion = {
  readonly criterionId: string;
  readonly phase: PostGenesisPhase;
  readonly kind: AdmissionCriterionKind;
  readonly description: string;
  readonly satisfied: boolean;
  readonly evidenceState: PostGenesisEvidenceState;
  readonly missingEvidenceVisible: boolean;
};

export type ValidatorStabilitySample = {
  readonly validatorId: string;
  readonly missedVotes: number;
  readonly proposedBlocks: number;
  readonly peerConnected: boolean;
  readonly restarts: number;
  readonly catchingUp: boolean;
  readonly signerWarning: boolean;
  readonly jailed: boolean;
  readonly bonded: boolean;
};

export type StorageGrowthSample = {
  readonly redbBytes: bigint;
  readonly walBytes: bigint;
  readonly stateBytes: bigint;
  readonly snapshotBytes: bigint;
  readonly diskHeadroomBytes: bigint;
};

export type DatabaseHealthSample = {
  readonly primary: HealthComponentState;
  readonly replica: HealthComponentState;
  readonly replicationLagMs: number;
  readonly backup: HealthComponentState;
  readonly connectionSaturationBps: number;
  readonly transactionFailures: number;
};

export type FeeMarketSample = {
  readonly baseResourcePriceMinor: bigint;
  readonly blockUtilizationBps: number;
  readonly resourceSaturationBps: number;
  readonly feeDistributedMinor: bigint;
  readonly unexpectedOscillation: boolean;
};

export type OracleHealthSample = {
  readonly state: HealthComponentState;
  readonly acceptedProvider: boolean;
  readonly technicalHealthy: boolean;
  readonly commercialEvidence: PostGenesisEvidenceState;
  readonly governancePolicy: PostGenesisEvidenceState;
  readonly humanApproval: PostGenesisEvidenceState;
};

export type PostGenesisEconomicAudit = {
  readonly checkpointId: string;
  readonly coordinate: ProtocolCoordinate;
  readonly sunreySupplyMinor: bigint;
  readonly moonreySupplyMinor: bigint;
  readonly burnedMinor: bigint;
  readonly lockedMinor: bigint;
  readonly escrowedMinor: bigint;
  readonly feeReservedMinor: bigint;
  readonly conserved: boolean;
  readonly findings: readonly string[];
};

export type PostGenesisValidatorAudit = {
  readonly checkpointId: string;
  readonly coordinate: ProtocolCoordinate;
  readonly bondedMinor: bigint;
  readonly rewardsMinor: bigint;
  readonly penaltiesMinor: bigint;
  readonly feeRewardAllocatedMinor: bigint;
  readonly conserved: boolean;
  readonly findings: readonly string[];
};

export type BackupCheckpoint = {
  readonly checkpointId: string;
  readonly verified: boolean;
  readonly restoreValidatedOnClone: boolean;
  readonly activeNetworkTouched: false;
  readonly notes: string;
};

export type PostGenesisCheckpoint = {
  readonly checkpointId: string;
  readonly coordinate: ProtocolCoordinate;
  readonly phase: PostGenesisPhase;
  readonly capturedAtUtc: string;
};

export type PostGenesisHealthReport = {
  readonly checkpoint: PostGenesisCheckpoint;
  readonly validatorParticipationBps: number;
  readonly finality: HealthComponentState;
  readonly conflictingFinality: boolean;
  readonly stateRootAgreement: boolean;
  readonly peerHealth: HealthComponentState;
  readonly signerHealth: HealthComponentState;
  readonly storage: StorageGrowthSample;
  readonly database: DatabaseHealthSample;
  readonly rpc: HealthComponentState;
  readonly explorer: HealthComponentState;
  readonly backup: HealthComponentState;
  readonly oracle: OracleHealthSample;
  readonly economicConserved: boolean;
  readonly openIncidentCount: number;
  readonly validators: readonly ValidatorStabilitySample[];
  readonly feeMarket: FeeMarketSample;
  readonly engineeringHealthy: boolean;
};

export type PostGenesisIncident = {
  readonly incidentId: string;
  readonly category: PostGenesisIncidentCategory;
  readonly severity: IncidentSeverity;
  readonly checkpointId: string | null;
  readonly component: string;
  readonly evidence: string;
  readonly operatorAction: string;
  readonly governanceAction: string;
  readonly currentRestrictions: readonly string[];
  readonly resolution: IncidentResolutionState;
  readonly conflictingFinality: boolean;
  readonly rewritesFinalizedState: false;
};

export type CapabilityEvidenceSlot = {
  readonly slotId: string;
  readonly description: string;
  readonly state: PostGenesisEvidenceState;
  readonly required: boolean;
  readonly external: boolean;
};

export type CapabilityActivationEvidence = {
  readonly packageId: string;
  readonly capability: IndependentCapability;
  readonly legal: readonly CapabilityEvidenceSlot[];
  readonly regulatory: readonly CapabilityEvidenceSlot[];
  readonly security: readonly CapabilityEvidenceSlot[];
  readonly operations: readonly CapabilityEvidenceSlot[];
  readonly providers: readonly CapabilityEvidenceSlot[];
  readonly human: readonly CapabilityEvidenceSlot[];
  readonly privacy: readonly CapabilityEvidenceSlot[];
};

export type HumanAuthorityRecord = {
  readonly actorKind: PostGenesisActorKind;
  readonly actorId: string;
  readonly role: string;
  readonly statement: string;
  readonly signedAtUtc: string;
  readonly accepted: boolean;
};

export type CapabilityActivationPackage = {
  readonly packageId: string;
  readonly capability: IndependentCapability;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseId: string;
  readonly activeProtocol: string;
  readonly policyVersion: string;
  readonly requiredProviders: readonly string[];
  readonly evidence: CapabilityActivationEvidence;
  readonly humanAuthority: readonly HumanAuthorityRecord[];
  readonly activationCoordinate: ActivationCoordinate;
  readonly restrictions: readonly EmergencyActionClass[];
  readonly packageHash: string;
};

export type CapabilityActivationResult = {
  readonly packageId: string;
  readonly capability: IndependentCapability;
  readonly outcome: CapabilityActivationOutcome;
  readonly reasons: readonly string[];
  readonly runtimeEnabled: boolean;
  readonly restrictionState: RestrictionState;
  readonly realProductionCapabilitiesActivated: false;
};

export type CapabilityHistoryEntry = {
  readonly packageId: string;
  readonly capability: IndependentCapability;
  readonly packageHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly releaseId: string;
  readonly policyVersion: string;
  readonly authority: string;
  readonly coordinate: ActivationCoordinate;
  readonly result: CapabilityActivationOutcome;
  readonly restrictions: readonly string[];
  readonly reasons: readonly string[];
};

export type PublicCapabilityStatus = {
  readonly capability: IndependentCapability | 'SUNREY_CHAIN';
  readonly engineeringHealth: HealthComponentState;
  readonly productionCapabilityStatus: 'UNAVAILABLE' | 'ELIGIBLE' | 'RESTRICTED' | 'ENABLED';
  readonly regulatedServiceStatus: 'UNAVAILABLE' | 'ELIGIBLE' | 'RESTRICTED' | 'NOT_APPLICABLE';
};

export type PublicNetworkStatus = {
  readonly environment: 'simulation';
  readonly networkClass: PostGenesisNetworkClass;
  readonly phase: PostGenesisPhase;
  readonly protocolVersion: string;
  readonly planes: {
    readonly ENGINEERING_HEALTH: HealthComponentState;
    readonly PRODUCTION_CAPABILITY_STATUS: 'UNAVAILABLE' | 'PARTIAL' | 'CONFIGURED';
    readonly REGULATED_SERVICE_STATUS: 'UNAVAILABLE';
  };
  readonly capabilities: readonly PublicCapabilityStatus[];
  readonly realProductionCapabilitiesActivated: false;
  readonly securityInternalsExposed: false;
};

export type ProductionStabilizationReport = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof POST_GENESIS_TOOL_VERSION;
  readonly networkId: string;
  readonly chainId: string;
  readonly phase: PostGenesisPhase;
  readonly policy: PostGenesisPolicy;
  readonly latestCheckpoint: PostGenesisCheckpoint | null;
  readonly latestHealth: PostGenesisHealthReport | null;
  readonly economicAudit: PostGenesisEconomicAudit | null;
  readonly validatorAudit: PostGenesisValidatorAudit | null;
  readonly incidents: readonly PostGenesisIncident[];
  readonly capabilities: readonly PublicCapabilityStatus[];
  readonly history: readonly CapabilityHistoryEntry[];
  readonly backups: readonly BackupCheckpoint[];
  readonly admission: readonly PhaseAdmissionCriterion[];
  readonly realProductionCapabilitiesActivated: false;
  readonly genesisDoesNotEnableCapabilities: true;
};

export type ActivationDomainRef = ActivationDomain;
