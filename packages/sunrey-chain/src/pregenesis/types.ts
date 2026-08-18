/**
 * Chunk 87 — SunRey pre-genesis production shadow network types.
 *
 * Engineering qualification of production-like infrastructure before any
 * production genesis. This does not launch mainnet, enable LIVE_* flags,
 * or treat engineering qualification as authorization.
 */

export const PREGENESIS_SCHEMA_VERSION = 1 as const;
export const PREGENESIS_TOOL_VERSION = 'sunrey-ops/pregenesis/1' as const;

export const PREGENESIS_QUALIFICATION_STATES = [
  'PREGENESIS_QUALIFICATION_INCOMPLETE',
  'PREGENESIS_QUALIFIED_WITH_FINDINGS',
  'PREGENESIS_ENGINEERING_QUALIFIED',
] as const;
export type PregenesisQualificationState = (typeof PREGENESIS_QUALIFICATION_STATES)[number];

export const CONFIG_VARIANCE_CLASSES = [
  'EXPECTED_REHEARSAL_VARIANCE',
  'APPROVED_ENVIRONMENT_VARIANCE',
  'UNEXPECTED_VARIANCE',
] as const;
export type ConfigVarianceClass = (typeof CONFIG_VARIANCE_CLASSES)[number];

export const PROVIDER_COVERAGE_LANES = [
  'LOCAL_SIMULATED',
  'SANDBOX_TESTED',
  'EXTERNAL_PROVIDER_TESTED',
] as const;
export type ProviderCoverageLane = (typeof PROVIDER_COVERAGE_LANES)[number];

export const OPERATIONAL_INVARIANTS = [
  'NO_CONFLICTING_FINALITY',
  'SIGNER_SAFETY',
  'STATE_ROOT_CONVERGENCE',
  'SUPPLY_RECONCILIATION',
  'NO_DUPLICATE_SETTLEMENT',
  'NO_DUPLICATE_WITHDRAWAL',
  'BACKUP_VERIFIABLE',
  'RESTORE_CONVERGES',
  'NO_SECRET_EXPOSURE',
  'CONFIGURATION_PARITY_ACCOUNTED',
] as const;
export type PregenesisOperationalInvariant = (typeof OPERATIONAL_INVARIANTS)[number];

export const FAILURE_SCENARIOS = [
  'ONE_VALIDATOR_LOSS',
  'TWO_VALIDATOR_LOSS',
  'ONE_FAILURE_DOMAIN_LOSS',
  'SENTRY_LOSS',
  'RPC_LOSS',
  'MONITORING_NODE_LOSS',
  'NO_QUORUM_PARTITION',
  'SIGNER_UNAVAILABLE',
  'STORAGE_FAILURE',
  'DATABASE_FAILURE',
  'ORACLE_PROVIDER_OUTAGE',
] as const;
export type PregenesisFailureScenario = (typeof FAILURE_SCENARIOS)[number];

export const RUNBOOK_PROCEDURES = [
  'VALIDATOR_RESTART',
  'SENTRY_REPLACEMENT',
  'RPC_FAILOVER',
  'SIGNER_INCIDENT',
  'DATABASE_RECOVERY',
  'CHAIN_RECOVERY',
  'ORACLE_INCIDENT',
  'PROVIDER_OUTAGE',
] as const;
export type PregenesisRunbookProcedure = (typeof RUNBOOK_PROCEDURES)[number];

export const FINDING_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type PregenesisFindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const HEALTH_WINDOW_KINDS = ['BLOCK_EPOCH_COUNT', 'ELAPSED_DURATION'] as const;
export type PregenesisHealthWindowKind = (typeof HEALTH_WINDOW_KINDS)[number];

export type PregenesisFinding = {
  readonly findingId: string;
  readonly scenario: string;
  readonly severity: PregenesisFindingSeverity;
  readonly component: string;
  readonly evidence: string;
  readonly reproduction: string;
  readonly remediation: string;
  readonly verification: string;
};

export type ConfigVariance = {
  readonly path: string;
  readonly productionValue: string;
  readonly shadowValue: string;
  readonly classification: ConfigVarianceClass;
  readonly rationale: string;
};

export type ArtifactDifference = {
  readonly artifact: string;
  readonly productionDigest: string;
  readonly shadowDigest: string;
  readonly environmentSpecific: true;
  readonly notes: string;
};

export type ProductionEnvironmentPlan = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly source: 'CHUNK_66_INFRA_AND_CHUNK_81_CANDIDATE_V2';
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly validatorCount: 7;
  readonly serviceRoles: readonly string[];
  readonly storageEngine: 'redb';
  readonly postgresProfile: string;
  readonly environment: 'simulation';
  readonly mainnetEnabled: false;
  readonly productionAuthorized: false;
  readonly configurationDigest: string;
};

export type PregenesisNetworkDefinition = {
  readonly schemaVersion: 1;
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly displayName: string;
  readonly environment: 'simulation';
  readonly mainnetEnabled: false;
  readonly productionAuthorized: false;
  readonly usableAsProductionAuthorization: false;
};

export type PregenesisServiceHealth = {
  readonly role: string;
  readonly nodeId: string;
  readonly healthy: boolean;
  readonly notes: string;
};

export type PregenesisValidatorHealth = {
  readonly validatorId: string;
  readonly peerConnectivity: boolean;
  readonly sentryRouting: boolean;
  readonly remoteSigner: boolean;
  readonly voteParticipation: boolean;
  readonly proposalDuty: boolean;
  readonly catchUp: boolean;
  readonly restart: boolean;
  readonly stateSync: boolean;
  readonly signerFencing: boolean;
  readonly antiDoubleSignPersistence: boolean;
};

export type PregenesisSignerHealth = {
  readonly validatorId: string;
  readonly signChallenge: boolean;
  readonly restart: boolean;
  readonly activePassiveFencing: boolean;
  readonly keyRotationRehearsal: boolean;
  readonly unavailabilityHandled: boolean;
  readonly stateRecovery: boolean;
  readonly shadowKeysOnly: true;
};

export type PregenesisRecoveryEvidence = {
  readonly scenario: PregenesisFailureScenario | PregenesisRunbookProcedure;
  readonly injected: boolean;
  readonly recovered: boolean;
  readonly canonicalStateReconciled: boolean;
  readonly conflictingFinality: false;
  readonly notes: string;
};

export type PregenesisHealthWindow = {
  readonly kind: PregenesisHealthWindowKind;
  readonly blockCount: string | null;
  readonly epochCount: string | null;
  readonly startedAtUtc: string | null;
  readonly endedAtUtc: string | null;
  readonly elapsedMs: string | null;
  readonly claimedWithoutClock: false;
};

export type PregenesisBurnInReport = {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly profile: 'bounded' | 'extended';
  readonly window: PregenesisHealthWindow;
  readonly completed: boolean;
  readonly durationClaimedWithoutExecution: false;
  readonly notes: string;
};

export type PregenesisQualificationPlan = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly healthWindowPolicy: PregenesisHealthWindowKind;
  readonly requiredInvariants: readonly PregenesisOperationalInvariant[];
  readonly failureScenarios: readonly PregenesisFailureScenario[];
  readonly runbooks: readonly PregenesisRunbookProcedure[];
  readonly mainnetEnabled: false;
};

export type PregenesisQualificationRun = {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly planId: string;
  readonly network: PregenesisNetworkDefinition;
  readonly startedAtUtc: string;
  readonly endedAtUtc: string | null;
  readonly profile: 'bounded' | 'extended';
  readonly mainnetEnabled: false;
};

export type PregenesisQualificationReport = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof PREGENESIS_TOOL_VERSION;
  readonly run: PregenesisQualificationRun;
  readonly network: PregenesisNetworkDefinition;
  readonly topology: {
    readonly validators: 7;
    readonly sentries: number;
    readonly remoteSigners: number;
    readonly rpc: number;
    readonly explorer: number;
    readonly monitoring: number;
    readonly backup: number;
    readonly oracleCollectors: number;
    readonly database: number;
    readonly exchangeSandbox: number;
    readonly custodySandbox: number;
  };
  readonly bindings: {
    readonly mainnetRcId: string;
    readonly mainnetRcHash: string;
    readonly candidateV2Id: string;
    readonly candidateV2RootHash: string;
  };
  readonly artifactDifferences: readonly ArtifactDifference[];
  readonly configurationVariances: readonly ConfigVariance[];
  readonly validators: readonly PregenesisValidatorHealth[];
  readonly consensus: {
    readonly heights: string;
    readonly converged: boolean;
    readonly height: string;
    readonly blockId: string;
    readonly stateRoot: string;
    readonly validatorSetHash: string;
    readonly noConflictingFinality: true;
  };
  readonly signers: readonly PregenesisSignerHealth[];
  readonly hsm: {
    readonly contractShapeExercised: boolean;
    readonly productionHardwareEvidence: 'CHUNK_82';
    readonly simulationOnly: true;
  };
  readonly storage: {
    readonly engine: 'redb';
    readonly restart: boolean;
    readonly snapshot: boolean;
    readonly restore: boolean;
    readonly stateSync: boolean;
    readonly archiveMode: boolean;
    readonly configuredPruning: boolean;
  };
  readonly database: {
    readonly tls: true;
    readonly pooling: boolean;
    readonly replicaRouting: boolean;
    readonly backup: boolean;
    readonly recovery: boolean;
    readonly pitrRehearsal: boolean;
    readonly blockchainAuthority: false;
  };
  readonly failures: readonly PregenesisRecoveryEvidence[];
  readonly oracle: {
    readonly authentication: boolean;
    readonly normalization: boolean;
    readonly quorum: boolean;
    readonly conflict: boolean;
    readonly staleness: boolean;
    readonly providerOutage: boolean;
    readonly sandboxOnly: true;
  };
  readonly economics: {
    readonly sunreyTransfers: boolean;
    readonly moonreyIssuance: boolean;
    readonly fees: boolean;
    readonly validatorEconomics: boolean;
    readonly treasury: boolean;
    readonly machineCommerce: boolean;
    readonly exchange: boolean;
    readonly realEconomicValue: false;
    readonly units: 'REHEARSAL_ONLY';
  };
  readonly exchangeCustody: {
    readonly sandboxMode: true;
    readonly depositSimulation: boolean;
    readonly dvp: boolean;
    readonly withdrawalWorkflow: boolean;
    readonly travelRuleSimulation: boolean;
    readonly signing: boolean;
    readonly reconciliation: boolean;
    readonly productionActivated: false;
  };
  readonly observability: {
    readonly consensusMetrics: boolean;
    readonly validatorMetrics: boolean;
    readonly signerMetrics: boolean;
    readonly diskMetrics: boolean;
    readonly rpcMetrics: boolean;
    readonly databaseMetrics: boolean;
    readonly oracleMetrics: boolean;
    readonly exchangeCustodyMetrics: boolean;
    readonly backupMetrics: boolean;
  };
  readonly alerts: {
    readonly consensusDegradation: boolean;
    readonly signerFailure: boolean;
    readonly diskPressure: boolean;
    readonly databaseFailure: boolean;
    readonly oracleDegradation: boolean;
    readonly custodySignerIssue: boolean;
    readonly exchangeReconciliationMismatch: boolean;
    readonly backupFailure: boolean;
  };
  readonly logSecurity: {
    readonly privateKeyAbsent: true;
    readonly secretValueAbsent: boolean;
    readonly kycPayloadAbsent: boolean;
    readonly rawPdvAbsent: boolean;
  };
  readonly backups: {
    readonly chainSnapshot: boolean;
    readonly databaseBackup: boolean;
    readonly signerSafetyBackup: boolean;
    readonly configurationBackup: boolean;
    readonly releaseEvidenceBackup: boolean;
  };
  readonly restore: {
    readonly isolatedRecovery: boolean;
    readonly canonicalStateReconciled: boolean;
  };
  readonly performance: {
    readonly class: 'ENGINEERING_MEASUREMENT';
    readonly latency: string;
    readonly throughput: string;
    readonly resourceConsumption: string;
    readonly storageGrowth: string;
    readonly peerBehavior: string;
    readonly databaseBehavior: string;
    readonly guarantee: false;
  };
  readonly capacity: {
    readonly cpuHeadroom: string;
    readonly memoryHeadroom: string;
    readonly diskHeadroom: string;
    readonly networkHeadroom: string;
    readonly databaseHeadroom: string;
    readonly rpcHeadroom: string;
    readonly backupStorageHeadroom: string;
  };
  readonly burnIn: PregenesisBurnInReport;
  readonly invariants: Readonly<Record<PregenesisOperationalInvariant, boolean>>;
  readonly runbooks: readonly {
    readonly procedure: PregenesisRunbookProcedure;
    readonly exercised: boolean;
    readonly notes: string;
  }[];
  readonly operatorEvidence: {
    readonly rehearsalTasksObserved: readonly string[];
    readonly legalCertification: false;
    readonly operatorCertification: false;
  };
  readonly providerCoverage: readonly {
    readonly providerId: string;
    readonly lane: ProviderCoverageLane;
    readonly notes: string;
  }[];
  readonly securityReview: {
    readonly chunk: 'CHUNK-83';
    readonly openBlockers: readonly string[];
    readonly openBlockersRemainVisible: true;
    readonly claimsExternalAuditPassed: false;
  };
  readonly services: readonly PregenesisServiceHealth[];
  readonly findings: readonly PregenesisFinding[];
  readonly classification: PregenesisQualificationState;
  readonly readiness: {
    readonly engineeringRequirementId: 'REQ-PREGENESIS-001';
    readonly engineeringStatus: 'ENGINEERING_VERIFIED' | 'NOT_PROVIDED';
    readonly humanRequirementId: 'REQ-PREGENESIS-002';
    readonly humanStatus: 'NOT_PROVIDED';
    readonly authorizesMainnet: false;
  };
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly liveFlagsRemainDisabled: true;
};
