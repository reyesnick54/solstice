/**
 * Chunk 90 — SunRey production handoff and day-2 operations types.
 *
 * This is the long-lived production-ownership control plane. It does
 * not launch mainnet, convert rehearsal into observed production, or
 * let AI satisfy required human accountability roles.
 */

export const PRODUCTION_HANDOFF_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_HANDOFF_TOOL_VERSION = 'sunrey-ops/production/1' as const;
export const SLO_CONTRACT_LABEL = 'ENGINEERING_TEST_TARGETS' as const;
export const APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK = true as const;
export const AI_CANNOT_SATISFY_HUMAN_ROLES = true as const;
export const TREASURY_CANNOT_MINT = true as const;

export const HANDOFF_NOW_UTC = '2026-08-18T00:00:00.000Z' as const;

export const EVIDENCE_CLASSES = [
  'REHEARSAL',
  'ENGINEERING',
  'EXTERNAL',
  'HUMAN',
  'PRODUCTION_OBSERVED',
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const HANDOFF_STATES = [
  'HANDOFF_INCOMPLETE',
  'ENGINEERING_HANDOFF_READY',
  'AWAITING_EXTERNAL_ACCEPTANCE',
  'AWAITING_OPERATOR_ACCEPTANCE',
  'PRODUCTION_HANDOFF_PACKAGE_COMPLETE',
] as const;
export type ProductionHandoffState = (typeof HANDOFF_STATES)[number];

export const CAPABILITY_STATES = [
  'INACTIVE',
  'ELIGIBLE',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED_BY_POLICY',
] as const;
export type ProductionCapabilityState = (typeof CAPABILITY_STATES)[number];

export const OPERATIONAL_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'VALIDATOR_OPERATIONS',
  'INFRASTRUCTURE',
  'DATABASE',
  'RELEASE_AUTHORITY',
  'TREASURY',
  'ORACLE',
  'EXCHANGE',
  'CUSTODY',
  'COMPLIANCE_OPERATIONS',
  'INCIDENT_COMMAND',
  'OPERATIONS_AUTHORITY',
  'OBSERVER',
  'AI_ANALYST',
] as const;
export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];

export const HUMAN_ACCOUNTABILITY_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'VALIDATOR_OPERATIONS',
  'INFRASTRUCTURE',
  'DATABASE',
  'RELEASE_AUTHORITY',
  'TREASURY',
  'ORACLE',
  'EXCHANGE',
  'CUSTODY',
  'COMPLIANCE_OPERATIONS',
  'INCIDENT_COMMAND',
  'OPERATIONS_AUTHORITY',
] as const;
export type HumanAccountabilityRole = (typeof HUMAN_ACCOUNTABILITY_ROLES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'AGENT', 'AUTOMATION', 'SERVICE'] as const;
export type HandoffActorKind = (typeof ACTOR_KINDS)[number];

export const INVENTORY_SYSTEM_KINDS = [
  'VALIDATOR',
  'SENTRY',
  'SIGNER',
  'RPC',
  'EXPLORER',
  'DATABASE',
  'STORAGE',
  'BACKUP',
  'ORACLE_COLLECTOR',
  'EXCHANGE',
  'CUSTODY',
  'MONITORING',
  'RELEASE_SERVICE',
  'INTEROP',
  'PROVIDER_DEPENDENCY',
] as const;
export type InventorySystemKind = (typeof INVENTORY_SYSTEM_KINDS)[number];

export const PRODUCTION_SLO_DOMAINS = [
  'CONSENSUS_AVAILABILITY',
  'FINALITY_LATENCY',
  'RPC_AVAILABILITY',
  'STATE_SYNC_SUCCESS',
  'DATABASE_AVAILABILITY',
  'BACKUP_SUCCESS',
  'ORACLE_FRESHNESS',
  'EXPLORER_LAG',
] as const;
export type ProductionSloDomain = (typeof PRODUCTION_SLO_DOMAINS)[number];

export const ECONOMIC_INTEGRITY_SLIS = [
  'SUPPLY_RECONCILIATION',
  'DVP_RECONCILIATION',
  'CUSTODY_RECONCILIATION',
  'FEE_RECONCILIATION',
  'TREASURY_RECONCILIATION',
  'MOONREY_ISSUANCE_RECONCILIATION',
] as const;
export type EconomicIntegritySli = (typeof ECONOMIC_INTEGRITY_SLIS)[number];

export const CHANGE_KINDS = ['PROTOCOL', 'APPLICATION', 'CONFIGURATION', 'PROVIDER', 'POLICY'] as const;
export type ProductionChangeKind = (typeof CHANGE_KINDS)[number];

export const CHANGE_STATES = [
  'DRAFT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'DEPLOYED',
  'VERIFIED',
  'REJECTED',
  'UNAPPROVED',
] as const;
export type ProductionChangeState = (typeof CHANGE_STATES)[number];

export const MAINTENANCE_TARGETS = [
  'RPC',
  'EXPLORER',
  'DATABASE_REPLICA',
  'ORACLE_COLLECTOR',
  'OFF_CHAIN_SERVICE',
  'VALIDATOR',
] as const;
export type MaintenanceTarget = (typeof MAINTENANCE_TARGETS)[number];

export const KEY_ROTATION_PURPOSES = [
  'SERVICE_CREDENTIAL',
  'TLS',
  'VALIDATOR_KEY',
  'GOVERNANCE_KEY',
  'ORACLE_SIGNING_KEY',
  'RELEASE_KEY',
  'BACKUP_ENCRYPTION',
] as const;
export type KeyRotationPurpose = (typeof KEY_ROTATION_PURPOSES)[number];

export const PROVIDER_RENEWAL_KINDS = [
  'CONTRACT',
  'SECURITY_EVIDENCE',
  'HSM_ATTESTATION',
  'DATA_LICENSE_EVIDENCE',
  'PROVIDER_REVIEW',
  'CERTIFICATE_VALIDITY',
] as const;
export type ProviderRenewalKind = (typeof PROVIDER_RENEWAL_KINDS)[number];

export const PROVIDER_RENEWAL_STATES = [
  'CURRENT',
  'REMINDER_DUE',
  'EXPIRED',
  'REPLACEMENT_REQUIRED',
] as const;
export type ProviderRenewalState = (typeof PROVIDER_RENEWAL_STATES)[number];

export const INCIDENT_DOMAINS = [
  'PROTOCOL',
  'SIGNER',
  'INFRASTRUCTURE',
  'DATABASE',
  'ORACLE',
  'ECONOMIC',
  'EXCHANGE',
  'CUSTODY',
  'PROVIDER',
  'SECURITY',
] as const;
export type ProductionIncidentDomain = (typeof INCIDENT_DOMAINS)[number];

export const BACKUP_WORKFLOW_CLASSES = [
  'CHAIN_SNAPSHOT',
  'DATABASE_BACKUP',
  'CONFIGURATION_BACKUP',
  'SIGNER_SAFETY_DATA',
  'RELEASE_EVIDENCE_ARCHIVE',
] as const;
export type BackupWorkflowClass = (typeof BACKUP_WORKFLOW_CLASSES)[number];

export const LIFECYCLE_REHEARSAL_PHASES = [
  'CHUNK_86_PRODUCTION_PLAN_AND_PRE_GENESIS',
  'CHUNK_87_CEREMONY_AND_AUTHORIZED_GENESIS',
  'CHUNK_88_FIRST_BLOCK_AND_POST_GENESIS',
  'CHUNK_89_STABILIZATION_AND_CAPABILITY_EVIDENCE',
  'CHUNK_90_OPERATOR_HANDOFF_AND_EVIDENCE_SEAL',
] as const;
export type LifecycleRehearsalPhase = (typeof LIFECYCLE_REHEARSAL_PHASES)[number];

export const FORBIDDEN_INVENTORY_SECRET_KEYS = [
  'privateKey',
  'private_key',
  'secret',
  'password',
  'credential',
  'apiKey',
  'api_key',
  'token',
  'mnemonic',
  'seed',
] as const;

export const PUBLIC_TICKER_POLICY = 'NOT_ASSIGNED_UNLESS_GOVERNED' as const;

export type ClassifiedEvidence = {
  readonly id: string;
  readonly evidenceClass: EvidenceClass;
  readonly source: string;
  readonly hash: string;
  readonly rehearsal: boolean;
  readonly fixture: boolean;
  readonly notes: string;
};

export type InventoryComponent = {
  readonly componentId: string;
  readonly kind: InventorySystemKind;
  readonly role: string;
  readonly ownerRole: OperationalRole;
  readonly environmentClass: 'SIMULATION' | 'REHEARSAL' | 'PRODUCTION_CANDIDATE';
  readonly providerDependency: string | null;
  readonly notes: string;
};

export type ProductionSystemInventory = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly inventoryId: string;
  readonly components: readonly InventoryComponent[];
  readonly secretsPresent: false;
  readonly hash: string;
};

export type ResponsibilityRow = {
  readonly role: OperationalRole;
  readonly humanRequired: boolean;
  readonly aiMayAssist: boolean;
  readonly aiSatisfiesAccountability: false;
  readonly systems: readonly InventorySystemKind[];
  readonly canonicalAuthority: string;
};

export type ProductionResponsibilityMatrix = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly rows: readonly ResponsibilityRow[];
  readonly hash: string;
};

export type AccessGrant = {
  readonly principalId: string;
  readonly principalKind: 'HUMAN' | 'SERVICE';
  readonly role: OperationalRole;
  readonly systems: readonly string[];
  readonly keyPurpose: KeyRotationPurpose | null;
  readonly providerPermissions: readonly string[];
  readonly universalAuthority: false;
  readonly leastPrivilege: true;
};

export type ProductionAccessInventory = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly grants: readonly AccessGrant[];
  readonly secretsPresent: false;
  readonly hash: string;
};

export type OperatorAcceptanceRecord = {
  readonly acceptanceId: string;
  readonly operatorId: string;
  readonly role: OperationalRole;
  readonly actorKind: HandoffActorKind;
  readonly systemsAccepted: readonly string[];
  readonly runbooksReviewed: readonly string[];
  readonly accessGranted: boolean;
  readonly accessVerified: boolean;
  readonly onCallResponsibility: boolean;
  readonly evidenceHash: string;
  readonly humanSignature: string | null;
  readonly evidenceClass: EvidenceClass;
  readonly fixture: boolean;
  readonly realHumanAcceptance: boolean;
};

export type ProductionSloDefinition = {
  readonly domain: ProductionSloDomain;
  readonly sli: string;
  readonly target: string;
  readonly label: typeof SLO_CONTRACT_LABEL;
  readonly contractual: false;
};

export type EconomicIntegrityDefinition = {
  readonly sli: EconomicIntegritySli;
  readonly description: string;
  readonly integrityFailureIsNotLatency: true;
  readonly label: typeof SLO_CONTRACT_LABEL;
};

export type ProductionSLOPolicy = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly label: typeof SLO_CONTRACT_LABEL;
  readonly contractualPromises: false;
  readonly operational: readonly ProductionSloDefinition[];
  readonly economicIntegrity: readonly EconomicIntegrityDefinition[];
  readonly hash: string;
};

export type ProductionConfigurationBaseline = {
  readonly baselineId: string;
  readonly approvedConfigurationHash: string;
  readonly retainedAtUtc: string;
  readonly notes: string;
};

export type ProductionOperationalBaseline = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly softwareVersion: string;
  readonly protocolVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly configuration: ProductionConfigurationBaseline;
  readonly topologyHash: string;
  readonly providerVersions: Readonly<Record<string, string>>;
  readonly schemaVersions: Readonly<Record<string, string>>;
  readonly resourceExpectations: Readonly<Record<string, string>>;
  readonly activeCapabilities: readonly string[];
  readonly hash: string;
};

export type ProductionChangeRecord = {
  readonly changeId: string;
  readonly kind: ProductionChangeKind;
  readonly reason: string;
  readonly affectedServices: readonly string[];
  readonly risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'PROTOCOL';
  readonly releaseRef: string | null;
  readonly policyOrGovernanceRef: string | null;
  readonly approval: string | null;
  readonly approved: boolean;
  readonly deploymentResult: string | null;
  readonly verification: string | null;
  readonly rollbackStrategy: string | null;
  readonly applicationRollbackIsChainHistoryRollback: false;
  readonly state: ProductionChangeState;
};

export type ProductionMaintenanceWindow = {
  readonly windowId: string;
  readonly target: MaintenanceTarget;
  readonly startsAtUtc: string;
  readonly endsAtUtc: string;
  readonly preservesConsensusSafety: boolean;
  readonly usesValidatorOpsWorkflows: boolean;
  readonly notes: string;
};

export type KeyRotationSchedule = {
  readonly purpose: KeyRotationPurpose;
  readonly cadence: string;
  readonly lastRotatedAtUtc: string | null;
  readonly evidenceHash: string | null;
  readonly usesActualProviderCapability: true;
};

export type ProductionProviderRenewalRecord = {
  readonly recordId: string;
  readonly providerId: string;
  readonly kind: ProviderRenewalKind;
  readonly expiresAtUtc: string | null;
  readonly state: ProviderRenewalState;
  readonly automaticRenewalClaim: false;
  readonly notes: string;
};

export type ProductionIncidentRecord = {
  readonly incidentId: string;
  readonly domain: ProductionIncidentDomain;
  readonly summary: string;
  readonly commandRole: 'INCIDENT_COMMAND';
  readonly emergencyUsesChunk79BoundedAuthority: true;
  readonly hiddenEmergencyPower: false;
  readonly preserved: {
    readonly logs: boolean;
    readonly metrics: boolean;
    readonly configHashes: boolean;
    readonly releaseHashes: boolean;
    readonly chainReferences: boolean;
    readonly auditEvents: boolean;
    readonly operatorActions: boolean;
  };
  readonly evidenceClass: EvidenceClass;
};

export type BackupVerificationRecord = {
  readonly class: BackupWorkflowClass;
  readonly lastVerifiedAtUtc: string | null;
  readonly verified: boolean;
  readonly isolatedEnvironment: boolean;
};

export type RestoreDrillRecord = {
  readonly drillId: string;
  readonly class: BackupWorkflowClass;
  readonly isolatedEnvironment: true;
  readonly executed: boolean;
  readonly executedAtUtc: string | null;
  readonly evidenceClass: EvidenceClass;
};

export type PublicSurfaceDescriptor = {
  readonly surface: 'RPC' | 'EXPLORER' | 'SDK_METADATA';
  readonly capabilityActive: boolean;
  readonly published: boolean;
  readonly networkId: string | null;
  readonly chainId: string | null;
  readonly protocolVersion: string | null;
  readonly activeRelease: string | null;
  readonly assetIds: readonly string[];
  readonly publicTicker: typeof PUBLIC_TICKER_POLICY | string;
};

export type CapabilityInventoryRow = {
  readonly capability: string;
  readonly state: ProductionCapabilityState;
  readonly regulated: boolean;
  readonly eligibilityEvidenceCurrent: boolean;
  readonly notes: string;
};

export type EconomicMonitor = {
  readonly name: string;
  readonly value: string;
  readonly investmentPrediction: false;
};

export type ProductionEvidenceSeal = {
  readonly sealId: string;
  readonly included: {
    readonly releaseHash: string;
    readonly candidateHash: string;
    readonly genesisHash: string;
    readonly launchReportHash: string | null;
    readonly stabilizationReportHash: string | null;
    readonly providerMatrixHash: string;
    readonly auditStateHash: string;
    readonly configurationBaselineHash: string;
    readonly operatorAcceptanceHash: string;
    readonly activeCapabilityMatrixHash: string;
  };
  readonly sealHash: string;
  readonly provesIntegrityOfIncludedRecords: true;
  readonly provesLegalCompliance: false;
  readonly provesSecurityPerfection: false;
  readonly provesFinancialSafety: false;
};

export type ProductionHandoffPackage = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly packageId: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string | null;
  readonly candidateV2Id: string;
  readonly candidateV2Hash: string | null;
  readonly productionEnvironment: 'simulation';
  readonly genesisAuthorizationPackageHash: string | null;
  readonly launchExecutionReportHash: string | null;
  readonly launchExecutionExists: boolean;
  readonly postGenesisPhase: string;
  readonly postGenesisStatus: string;
  readonly activeCapabilities: readonly CapabilityInventoryRow[];
  readonly providerMatrixHash: string;
  readonly securityReviewState: string;
  readonly governanceState: string;
  readonly runbooks: readonly string[];
  readonly serviceInventoryHash: string;
  readonly operatorOwnershipHash: string;
  readonly evidenceArchiveHash: string;
  readonly evidenceClass: EvidenceClass;
  readonly state: ProductionHandoffState;
  readonly observedProduction: false | true;
  readonly hash: string;
};

export type ProductionOperationalReadinessReport = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly engineeringReadiness: string;
  readonly externalProviderReadiness: string;
  readonly auditStatus: string;
  readonly legalRegulatoryStatus: string;
  readonly securityBlockers: readonly string[];
  readonly operatorAcceptance: string;
  readonly configurationBaselineHash: string;
  readonly launchEvidence: string;
  readonly activeCapabilities: readonly CapabilityInventoryRow[];
  readonly knownLimitations: readonly string[];
  readonly externalGaps: readonly string[];
  readonly humanGaps: readonly string[];
  readonly observedProduction: boolean;
  readonly handoffState: ProductionHandoffState;
  readonly hash: string;
};

export type ProductionHandoffReport = {
  readonly schemaVersion: typeof PRODUCTION_HANDOFF_SCHEMA_VERSION;
  readonly package: ProductionHandoffPackage;
  readonly inventory: ProductionSystemInventory;
  readonly responsibility: ProductionResponsibilityMatrix;
  readonly access: ProductionAccessInventory;
  readonly slo: ProductionSLOPolicy;
  readonly baseline: ProductionOperationalBaseline;
  readonly seal: ProductionEvidenceSeal;
  readonly readiness: ProductionOperationalReadinessReport;
  readonly acceptances: readonly OperatorAcceptanceRecord[];
  readonly observedProduction: boolean;
  readonly hash: string;
};

export type OperatorDashboardProjection = {
  readonly networkHealth: string;
  readonly validatorHealth: string;
  readonly release: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly providerState: string;
  readonly backupState: string;
  readonly economicReconciliation: string;
  readonly incidents: readonly string[];
  readonly capabilityStatus: readonly CapabilityInventoryRow[];
  readonly secretsPresent: false;
};
