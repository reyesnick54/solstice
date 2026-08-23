/**
 * Phase I Prompt 3 — operational reliability types.
 *
 * Extends Chunk 55 / Chunk 156 owners. Not a second observability,
 * control-room, SRE, incident, or disaster-recovery package.
 * Engineering targets only. Production remains disabled.
 */

import { SLO_LABEL, type AlertSeverity } from '../types.ts';

export const SRE_SCHEMA_VERSION = 1 as const;
export const SRE_PLANE = 'READ_OPERATIONS' as const;
export const SRE_OWNER = 'packages/sunrey-chain/src/ops' as const;

export const ENGINEERING_TARGET_LABEL = 'ENGINEERING_TARGET' as const;
export type EngineeringTargetLabel = typeof ENGINEERING_TARGET_LABEL;

export const TELEMETRY_SYSTEMS = [
  'API',
  'AUTHENTICATION',
  'LEDGER',
  'ACCOUNTS',
  'PAYMENTS',
  'FX',
  'CARDS',
  'TREASURY',
  'RECONCILIATION',
  'PROVIDERS',
  'GROW',
  'AGENT',
  'EXCHANGE',
  'CHAIN',
  'WALLETS',
  'CUSTODY',
  'VAULT',
  'HIN',
  'DATABASE',
  'QUEUES_JOBS',
] as const;
export type TelemetrySystem = (typeof TELEMETRY_SYSTEMS)[number];

export const TELEMETRY_COVERAGE = ['COVERED', 'PARTIAL', 'BLIND'] as const;
export type TelemetryCoverage = (typeof TELEMETRY_COVERAGE)[number];

export const LOG_ARE_NOT_FINANCIAL_EVIDENCE = true;

export const INCIDENT_STATUSES = [
  'DETECTED',
  'INVESTIGATING',
  'MITIGATING',
  'MONITORING',
  'RESOLVED',
  'POSTMORTEM_REQUIRED',
  'CLOSED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITY_LEVELS = ['SEV1', 'SEV2', 'SEV3', 'SEV4'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const CUSTOMER_IMPACT_LEVELS = [
  'NONE',
  'DEGRADED',
  'PARTIAL_OUTAGE',
  'FULL_OUTAGE',
  'DATA_EXPOSURE',
  'FINANCIAL_INTEGRITY',
] as const;
export type CustomerImpactLevel = (typeof CUSTOMER_IMPACT_LEVELS)[number];

export const SLI_IDS = [
  'API_AVAILABILITY',
  'API_LATENCY',
  'AUTHENTICATION_SUCCESS',
  'LEDGER_POSTING',
  'PAYMENT_ORCHESTRATION',
  'PROVIDER_SUCCESS',
  'FX_QUOTE',
  'AGENT_RESPONSE',
  'EXCHANGE_ORDER_PROCESSING',
  'CHAIN_FINALITY',
  'WALLET_PROCESSING',
  'RECONCILIATION',
] as const;
export type SliId = (typeof SLI_IDS)[number];

export const PRODUCTIZATION_ALERT_CODES = [
  'API_OUTAGE',
  'DATABASE_FAILURE',
  'HIGH_ERRORS',
  'QUEUE_BACKLOG',
  'LEDGER_POSTING_FAILURE',
  'PROVIDER_OUTAGE',
  'RECONCILIATION_BREAK_SPIKE',
  'TREASURY_LIQUIDITY_WARNING',
  'EXCHANGE_HALT_FAILURE',
  'CHAIN_STALL',
  'VALIDATOR_LOSS',
  'WALLET_BACKLOG',
  'AGENT_MODEL_FAILURE',
  'SECURITY_ANOMALY',
  'VAULT_ACCESS_ANOMALY',
] as const;
export type ProductizationAlertCode = (typeof PRODUCTIZATION_ALERT_CODES)[number];

export const KILL_SWITCH_DOMAINS = [
  'PROVIDER',
  'PAYMENTS',
  'FX',
  'CARDS',
  'AGENT',
  'EXCHANGE_MARKET',
  'WITHDRAWALS',
  'DATA_MARKETPLACE',
] as const;
export type KillSwitchDomain = (typeof KILL_SWITCH_DOMAINS)[number];

export const CHAOS_SCENARIOS = [
  'API_RESTART',
  'WORKER_RESTART',
  'DATABASE_CONNECTION_INTERRUPTION',
  'QUEUE_INTERRUPTION',
  'PROVIDER_TIMEOUT',
  'MODEL_OUTAGE',
  'EXCHANGE_RESTART',
  'VALIDATOR_OUTAGE',
  'RPC_OUTAGE',
] as const;
export type ChaosScenario = (typeof CHAOS_SCENARIOS)[number];

export const DEGRADED_MODE_IDS = [
  'AGENT_UNAVAILABLE',
  'EXCHANGE_UNAVAILABLE',
  'FX_PROVIDER_UNAVAILABLE',
  'CUSTODY_UNAVAILABLE',
  'MODEL_OUTAGE',
  'CHAIN_STALL',
  'PROVIDER_UNAVAILABLE',
  'KYC_PROVIDER_UNAVAILABLE',
] as const;
export type DegradedModeId = (typeof DEGRADED_MODE_IDS)[number];

export const ON_CALL_ROLES = [
  'INCIDENT_COMMANDER',
  'OPERATIONS_AUTHORITY',
  'SECURITY_AUTHORITY',
  'COMPLIANCE_OPERATIONS',
  'DATABASE',
  'INFRASTRUCTURE',
  'TREASURY',
  'EXCHANGE',
  'CUSTODY',
  'VALIDATOR_OPERATIONS',
  'PROTOCOL_AUTHORITY',
] as const;
export type OnCallRole = (typeof ON_CALL_ROLES)[number];

export const BACKUP_CLAIM_STATES = [
  'CONFIGURED_UNTESTED',
  'RESTORE_TESTED',
  'RESTORE_FAILED',
] as const;
export type BackupClaimState = (typeof BACKUP_CLAIM_STATES)[number];

export type TelemetryInventoryRow = {
  readonly system: TelemetrySystem;
  readonly owner: string;
  readonly metrics: TelemetryCoverage;
  readonly logs: TelemetryCoverage;
  readonly traces: TelemetryCoverage;
  readonly notes: string;
  readonly blindSpot: string | null;
};

export type MetricConvention = {
  readonly name: string;
  readonly system: TelemetrySystem;
  readonly unit: 'count' | 'ms' | 'bps' | 'height' | 'gauge';
  readonly description: string;
};

export type StructuredOperationalLog = {
  readonly timestamp: string;
  readonly service: string;
  readonly environment: 'simulation';
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  readonly eventCode: string;
  readonly message: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly canonicalFinancialEvidence: false;
};

export type SliDefinition = {
  readonly id: SliId;
  readonly system: TelemetrySystem;
  readonly description: string;
  readonly measurement: string;
  readonly goodEvent: string;
  readonly validEvent: string;
};

export type ProductizationSlo = {
  readonly sliId: SliId;
  readonly label: EngineeringTargetLabel;
  readonly existingOpsLabel: typeof SLO_LABEL;
  readonly proposedTarget: string;
  readonly contractualSla: false;
  readonly humanApproved: false;
};

export type SeverityDefinition = {
  readonly level: SeverityLevel;
  readonly mapsTo: AlertSeverity;
  readonly criteria: string;
  readonly responseExpectation: string;
  readonly pageOnCall: boolean;
};

export type ProductizationAlert = {
  readonly code: ProductizationAlertCode;
  readonly severity: SeverityLevel;
  readonly description: string;
  readonly runbookRef: string;
  readonly autoExecute: false;
};

export type IncidentMitigation = {
  readonly atUtc: string;
  readonly summary: string;
  readonly actorRole: OnCallRole | 'SYSTEM';
};

export type IncidentTimelineEntry = {
  readonly sequence: bigint;
  readonly atUtc: string;
  readonly status: IncidentStatus;
  readonly actorRole: OnCallRole | 'SYSTEM' | 'HUMAN';
  readonly summary: string;
};

export type PersistentIncident = {
  readonly incidentId: string;
  readonly severity: SeverityLevel;
  readonly status: IncidentStatus;
  readonly commander: OnCallRole | null;
  readonly services: readonly TelemetrySystem[];
  readonly startedAt: string;
  readonly detectedAt: string;
  readonly resolvedAt: string | null;
  readonly customerImpact: CustomerImpactLevel;
  readonly timeline: readonly IncidentTimelineEntry[];
  readonly mitigations: readonly IncidentMitigation[];
  readonly evidence: readonly string[];
  readonly postmortemReference: string | null;
  readonly alertCode: ProductizationAlertCode | null;
  readonly runbookRef: string;
  readonly autoExecuteRunbook: false;
};

export type KillSwitchReference = {
  readonly domain: KillSwitchDomain;
  readonly owner: string;
  readonly scopes: readonly string[];
  readonly globalDestructiveOff: false;
  readonly controlRoomCanEngage: false;
};

export type ControlRoomReadModel = {
  readonly schemaVersion: typeof SRE_SCHEMA_VERSION;
  readonly plane: typeof SRE_PLANE;
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly overall: 'HEALTHY' | 'DEGRADED' | 'INCIDENT';
  readonly payments: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly providers: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly treasury: 'HEALTHY' | 'DEGRADED' | 'WARNING';
  readonly reconciliation: 'MATCHED' | 'BREAK';
  readonly agent: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly exchange: 'HEALTHY' | 'HALTED' | 'UNAVAILABLE';
  readonly chain: 'HEALTHY' | 'STALLED' | 'DEGRADED';
  readonly custody: 'HEALTHY' | 'WITHDRAWALS_PAUSED' | 'UNAVAILABLE';
  readonly database: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly queues: 'HEALTHY' | 'BACKLOG';
  readonly security: 'QUIET' | 'ANOMALY';
  readonly activeIncidents: readonly PersistentIncident[];
  readonly killSwitches: readonly KillSwitchReference[];
  readonly secretsPresent: false;
};

export type RestoreTestRecord = {
  readonly drillId: string;
  readonly startedAtUtc: string;
  readonly finishedAtUtc: string;
  readonly backupCreated: boolean;
  readonly isolatedBlankTarget: boolean;
  readonly restored: boolean;
  readonly integrityValidated: boolean;
  readonly applicationSmokePassed: boolean;
  readonly ledgerInvariantsPassed: boolean;
  readonly inventedJournals: false;
  readonly claimBackupWorks: boolean;
  readonly result: 'PASS' | 'FAIL';
  readonly notes: string;
};

export const SRE_CAPABILITIES = Object.freeze({
  canPostLedger: false,
  canMint: false,
  canIssueAuthority: false,
  canEnableLiveFlags: false,
  canEngageGlobalKillSwitch: false,
  canAutoExecuteRunbooks: false,
  logsAreCanonicalFinancialEvidence: false,
  contractualSla: false,
  multiRegionFailoverImplemented: false,
  productionActive: false,
  realAlertProviderConnected: false,
});
