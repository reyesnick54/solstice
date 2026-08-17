/**
 * Chunk 70 — SunRey Mainnet Rehearsal types.
 *
 * This is a production-like dry run. It does not launch mainnet,
 * activate LIVE_* services, or authorize production funds.
 */

export const LAUNCH_REHEARSAL_SCHEMA_VERSION = 1 as const;
export const LAUNCH_REHEARSAL_TOOL_VERSION = 'sunrey-launch/1' as const;

export const REHEARSAL_NETWORK_CLASSES = ['RESERVED_TEST', 'REHEARSAL'] as const;
export type RehearsalNetworkClass = (typeof REHEARSAL_NETWORK_CLASSES)[number];

export const LAUNCH_PHASES = [
  'T_MINUS_24H',
  'T_MINUS_4H',
  'T_MINUS_1H',
  'GENESIS',
  'POST_GENESIS_15M',
  'POST_GENESIS_1H',
  'STABILITY_WINDOW',
] as const;
export type LaunchPhase = (typeof LAUNCH_PHASES)[number];

export const LAUNCH_ROLES = [
  'LAUNCH_COORDINATOR',
  'PROTOCOL_OPERATOR',
  'SECURITY_OPERATOR',
  'VALIDATOR_OPERATOR',
  'INFRASTRUCTURE_OPERATOR',
  'DATABASE_OPERATOR',
  'ORACLE_OPERATOR',
  'EXCHANGE_OPERATOR',
  'CUSTODY_OPERATOR',
  'INCIDENT_COMMANDER',
  'OBSERVER',
] as const;
export type LaunchRole = (typeof LAUNCH_ROLES)[number];

export const REHEARSAL_SUCCESS_CLASSES = [
  'REHEARSAL_INCOMPLETE',
  'REHEARSAL_COMPLETED_WITH_FINDINGS',
  'ENGINEERING_REHEARSAL_QUALIFIED',
] as const;
export type RehearsalSuccessClass = (typeof REHEARSAL_SUCCESS_CLASSES)[number];

export const FINDING_CATEGORIES = [
  'PROTOCOL',
  'CONSENSUS',
  'INFRASTRUCTURE',
  'STORAGE',
  'SIGNER',
  'ORACLE',
  'EXCHANGE',
  'CUSTODY',
  'OBSERVABILITY',
  'SECURITY',
  'READINESS',
  'DOCUMENTATION',
  'MAINNET_ENGINEERING_BLOCKER',
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_VERIFICATION_STATES = [
  'OPEN',
  'REMEDIATED_UNVERIFIED',
  'VERIFIED',
  'ACCEPTED_LIMITATION',
] as const;
export type FindingVerificationState = (typeof FINDING_VERIFICATION_STATES)[number];

export const FAILURE_SCENARIOS = [
  'VALIDATOR_UNAVAILABLE',
  'TWO_VALIDATORS_UNAVAILABLE',
  'FAILURE_DOMAIN_EVENT',
  'SIGNER_FAILURE',
  'STORAGE_FAILURE',
  'DATABASE_FAILURE',
  'RPC_FAILURE',
  'EXPLORER_FAILURE',
  'ORACLE_FAILURE',
  'REGULATED_PROVIDER_FAILURE',
  'SECURITY_INCIDENT',
  'NO_QUORUM',
  'NETWORK_REJOIN',
] as const;
export type FailureScenario = (typeof FAILURE_SCENARIOS)[number];

export const CONTROL_ROOM_GATES = [
  'releaseVerified',
  'genesisVerified',
  'validatorsReady',
  'signersReady',
  'networkPathsReady',
  'storageReady',
  'rpcReady',
  'explorerReady',
  'oracleReady',
  'backupReady',
  'monitoringReady',
] as const;
export type ControlRoomGate = (typeof CONTROL_ROOM_GATES)[number];

export type RehearsalFinding = {
  readonly findingId: string;
  readonly category: FindingCategory;
  readonly severity: FindingSeverity;
  readonly description: string;
  readonly evidence: string;
  readonly owner: LaunchRole;
  readonly remediation: string;
  readonly verificationState: FindingVerificationState;
};

export type FirstBlockRecord = {
  readonly genesisTimeUtc: string;
  readonly firstProposal: string;
  readonly firstPrevote: string;
  readonly firstPrecommit: string;
  readonly firstCommit: string;
  readonly firstStateRoot: string;
  readonly firstValidatorSetHash: string;
  readonly healthyValidatorAgreement: boolean;
};

export type LaunchControlRoomState = {
  readonly schemaVersion: 1;
  readonly rehearsalId: string;
  readonly phase: LaunchPhase;
  readonly releaseVerified: boolean;
  readonly genesisVerified: boolean;
  readonly validatorsReady: boolean;
  readonly signersReady: boolean;
  readonly networkPathsReady: boolean;
  readonly storageReady: boolean;
  readonly rpcReady: boolean;
  readonly explorerReady: boolean;
  readonly oracleReady: boolean;
  readonly backupReady: boolean;
  readonly monitoringReady: boolean;
  readonly incidents: readonly string[];
  readonly finalizedHeight: string;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
};

export type FailureScenarioResult = {
  readonly scenario: FailureScenario;
  readonly injected: boolean;
  readonly recovered: boolean;
  readonly finalityRetained: boolean;
  readonly safetyHolds: boolean;
  readonly notes: string;
};

export type NativeAssetRehearsalResult = {
  readonly sunreyTransfer: boolean;
  readonly moonreyIssuance: boolean;
  readonly fees: boolean;
  readonly locks: boolean;
  readonly supplyReconciled: boolean;
  readonly productionValueClaim: false;
  readonly units: 'REHEARSAL_ONLY';
};

export type OracleRehearsalResult = {
  readonly verifiedEconomicFact: boolean;
  readonly moonreyContribution: boolean;
  readonly fabricatedFact: false;
  readonly quorumHeld: boolean;
  readonly staleProviderHandled: boolean;
};

export type RegulatedSandboxResult = {
  readonly deposit: boolean;
  readonly order: boolean;
  readonly match: boolean;
  readonly atomicDvp: boolean;
  readonly withdrawal: boolean;
  readonly screening: boolean;
  readonly travelRule: boolean;
  readonly dualApproval: boolean;
  readonly signing: boolean;
  readonly finality: boolean;
  readonly reconciliation: boolean;
  readonly productionExchangeActivated: false;
  readonly productionCustodyWithdrawals: false;
};

export type InteropRehearsalResult = {
  readonly developmentAssetOnly: true;
  readonly simulatedExternalChain: true;
  readonly productionBridgeActivated: false;
  readonly packetOnce: boolean;
};

export type SdkRehearsalResult = {
  readonly typescript: boolean;
  readonly rust: boolean;
  readonly failoverPolicyHonored: boolean;
};

export type ExplorerRehearsalResult = {
  readonly banner: 'MAINNET REHEARSAL';
  readonly productionLabel: false;
  readonly rebuiltToZeroLag: boolean;
};

export type SecurityIncidentResult = {
  readonly detected: boolean;
  readonly signingRestricted: boolean;
  readonly evidenceSealed: boolean;
  readonly replacementKeyProcedure: boolean;
  readonly operatorCommunications: boolean;
  readonly recovered: boolean;
  readonly productionKeysUsed: false;
};

export type BackupValidationResult = {
  readonly chainSnapshot: boolean;
  readonly postgresBackup: boolean;
  readonly signerSafetyBackup: boolean;
  readonly configurationBackup: boolean;
};

export type MainnetLaunchRehearsalReport = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof LAUNCH_REHEARSAL_TOOL_VERSION;
  readonly rehearsalId: string;
  readonly displayName: 'SunRey Mainnet Rehearsal 1';
  readonly sourceCommit: string;
  readonly release: {
    readonly artifactDigest: string;
    readonly sbomDigest: string;
    readonly provenanceDigest: string;
    readonly protocolCompatible: boolean;
    readonly schemaCompatible: boolean;
  };
  readonly rehearsalGenesis: {
    readonly networkId: string;
    readonly chainId: string;
    readonly genesisHash: string;
    readonly addressHrp: string;
    readonly networkClass: RehearsalNetworkClass;
  };
  readonly validatorCount: 7;
  readonly sentryCount: 14;
  readonly failureDomains: readonly string[];
  readonly finalizedHeight: string;
  readonly stateRoot: string;
  readonly firstBlock: FirstBlockRecord;
  readonly failureScenarios: readonly FailureScenarioResult[];
  readonly recoveryResults: readonly FailureScenarioResult[];
  readonly securityEvents: readonly SecurityIncidentResult[];
  readonly performanceSummary: {
    readonly finalizedBlocks: number;
    readonly consensusRounds: number;
    readonly engineeringOnly: true;
  };
  readonly storageStatus: string;
  readonly oracleStatus: OracleRehearsalResult;
  readonly exchangeCustodySandbox: RegulatedSandboxResult;
  readonly nativeAssets: NativeAssetRehearsalResult;
  readonly interop: InteropRehearsalResult;
  readonly sdk: SdkRehearsalResult;
  readonly explorer: ExplorerRehearsalResult;
  readonly backups: BackupValidationResult;
  readonly readinessChanges: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly findings: readonly RehearsalFinding[];
  readonly engineeringBlockers: readonly RehearsalFinding[];
  readonly classification: RehearsalSuccessClass;
  readonly productionAuthorized: false;
  readonly liveFlagsRemainDisabled: true;
};
