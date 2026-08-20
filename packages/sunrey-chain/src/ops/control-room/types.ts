/**
 * Chunk 156 — unified production-candidate control room types.
 *
 * Read/operations plane only. Control-room state is operational status.
 * It does not activate production economics, issue Execution Authority,
 * post a ledger journal, mint, or enable LIVE_* flags.
 */

import { SLO_LABEL, type AlertSeverity } from '../types.ts';

export const CONTROL_ROOM_SCHEMA_VERSION = 1 as const;
export const CONTROL_ROOM_PLANE = 'READ_OPERATIONS' as const;
export const CONTROL_ROOM_CAPABILITY_ID = 'sunrey-unified-control-room' as const;

export const OPERATIONAL_STATES = [
  'NORMAL',
  'DEGRADED',
  'INCIDENT',
  'RECOVERY',
  'MAINTENANCE',
  'BLOCKED',
] as const;
export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export const PROVIDER_TECHNICAL_HEALTH = [
  'TECHNICALLY_HEALTHY',
  'AUTH_FAILED',
  'DEGRADED',
  'UNAVAILABLE',
  'SCHEMA_INCOMPATIBLE',
  'REVALIDATION_REQUIRED',
  'SUSPENDED',
] as const;
export type ProviderTechnicalHealth = (typeof PROVIDER_TECHNICAL_HEALTH)[number];

export const OPERATIONAL_INCIDENT_STATUSES = [
  'OPEN',
  'MITIGATING',
  'RECOVERING',
  'RESOLVED',
  'POSTMORTEM_REQUIRED',
] as const;
export type OperationalIncidentStatus = (typeof OPERATIONAL_INCIDENT_STATUSES)[number];

export const CONTROL_ROOM_INCIDENT_KINDS = [
  'PROVIDER_OUTAGE',
  'DATABASE_FAILOVER',
  'OUTBOX_BACKLOG',
  'CUSTODY_HSM_FAILURE',
  'PAYMENT_SUBMISSION_UNKNOWN_SURGE',
  'ORACLE_QUORUM_LOSS',
  'SUPPLY_RECONCILIATION_FAILURE',
  'CREDENTIAL_COMPROMISE',
  'CHAIN_FINALITY_DEGRADATION',
  'AI_AUTHORITY_ATTEMPT',
  'LEDGER_IMBALANCE',
  'CROSS_ASSET_CUSTODY_MISMATCH',
] as const;
export type ControlRoomIncidentKind = (typeof CONTROL_ROOM_INCIDENT_KINDS)[number];

export const BURN_RATE_CATEGORIES = ['NORMAL', 'SLOW', 'FAST', 'EXHAUSTED'] as const;
export type BurnRateCategory = (typeof BURN_RATE_CATEGORIES)[number];

export const AUTHORITY_LINEAGE_STEPS = [
  'REQUEST',
  'ACTION_INTENT',
  'KERNEL_DECISION',
  'EXECUTION_AUTHORITY_REF',
  'LEDGER_OR_DOMAIN_MUTATION',
  'EVIDENCE_VAULT_REF',
  'EVENT',
  'EXTERNAL_SUBMISSION',
] as const;
export type AuthorityLineageStep = (typeof AUTHORITY_LINEAGE_STEPS)[number];

export const SAFE_CORRELATION_KEYS = [
  'requestId',
  'traceId',
  'correlationId',
  'intentId',
  'evidenceId',
  'eventId',
  'operationId',
  'providerSubmissionRef',
  'chainTransactionRef',
] as const;
export type SafeCorrelationKey = (typeof SAFE_CORRELATION_KEYS)[number];

export const ALLOWED_METRIC_LABEL_KEYS = [
  'domain',
  'providerClass',
  'jurisdictionClass',
  'asset',
  'environment',
  'status',
  'component',
  'plane',
] as const;
export type AllowedMetricLabelKey = (typeof ALLOWED_METRIC_LABEL_KEYS)[number];

export const CONTROL_ROOM_CAPABILITIES = Object.freeze({
  canPostLedger: false,
  canMint: false,
  canIssueAuthority: false,
  canSignCustodyTransaction: false,
  canModifyProviderCredentials: false,
  canClearSanctionsResult: false,
  canChangeTokenomics: false,
  canEnableLiveFlags: false,
  canObserve: true,
  canAlert: true,
  canReport: true,
  canRecommend: true,
  canOpenIncidentMetadata: true,
  canProduceRehearsalArtifacts: true,
  realAlertProviderConnected: false,
  productionActive: false,
  providerHealthEqualsLegalApproval: false,
  engineeringSlosOnly: true,
  metricsContainPii: false,
  logsContainCredentials: false,
});

export type ControlRoomCapabilities = typeof CONTROL_ROOM_CAPABILITIES;

export type ControlRoomRefusal = {
  readonly ok: false;
  readonly code:
    | 'CONTROL_ROOM_CANNOT_POST_LEDGER'
    | 'CONTROL_ROOM_CANNOT_MINT'
    | 'CONTROL_ROOM_CANNOT_ISSUE_AUTHORITY'
    | 'CONTROL_ROOM_CANNOT_SIGN_CUSTODY'
    | 'CONTROL_ROOM_CANNOT_MODIFY_CREDENTIALS'
    | 'CONTROL_ROOM_CANNOT_CLEAR_SANCTIONS'
    | 'CONTROL_ROOM_CANNOT_CHANGE_TOKENOMICS'
    | 'CONTROL_ROOM_CANNOT_ENABLE_LIVE_FLAGS';
  readonly message: string;
};

export type SafeCorrelationRefs = {
  readonly requestId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly intentId?: string;
  readonly evidenceId?: string;
  readonly eventId?: string;
  readonly operationId?: string;
  readonly providerSubmissionRef?: string;
  readonly chainTransactionRef?: string;
};

export type AuthorityLineage = {
  readonly readOnly: true;
  readonly canIssueOrRenewAuthority: false;
  readonly requestId: string;
  readonly intentId: string;
  readonly kernelDecision: string;
  readonly executionAuthorityRef: string;
  readonly mutationRef: string;
  readonly evidenceId: string;
  readonly eventId: string;
  readonly providerSubmissionRef?: string;
  readonly steps: readonly AuthorityLineageStep[];
};

export type SafeMetricLabels = Partial<Record<AllowedMetricLabelKey, string>>;

export type CredentialSnapshot = {
  readonly domain: string;
  readonly providerClass: string;
  readonly environment: 'simulation';
  readonly expiryHorizonHours: bigint;
  readonly rotationRequired: boolean;
  readonly scopeRejections: bigint;
  readonly resolutionFailures: bigint;
};

export type ProviderRuntimeSnapshot = {
  readonly domain: string;
  readonly providerClass: string;
  readonly environment: 'simulation';
  readonly technicalHealth: ProviderTechnicalHealth;
  readonly sessions: bigint;
  readonly authFailures: bigint;
  readonly circuitOpen: boolean;
  readonly schemaDrift: boolean;
  readonly revalidationRequired: boolean;
  readonly legalApproval: false;
  readonly commercialApproval: false;
  readonly productionAuthorization: false;
};

export type PaymentSnapshot = {
  readonly domain: 'payments';
  readonly providerClass: string;
  readonly environment: 'simulation';
  readonly submissionUnknown: bigint;
  readonly reconciliationRequired: bigint;
  readonly callbackReplays: bigint;
  readonly settlementLagMs: bigint;
  readonly fxQuoteStaleRejections: bigint;
};

export type ComplianceSnapshot = {
  readonly domain: 'compliance';
  readonly providerClass: string;
  readonly environment: 'simulation';
  readonly kycUnavailable: boolean;
  readonly sanctionsUnavailable: boolean;
  readonly amlUnavailable: boolean;
  readonly manualReviewQueue: bigint;
};

export type CustodySnapshot = {
  readonly domain: 'custody';
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN' | 'CROSS_ASSET';
  readonly environment: 'simulation';
  readonly reconciliationMismatches: bigint;
  readonly submissionUnknown: bigint;
  readonly crossAssetRejections: bigint;
  readonly hsmHealthy: boolean;
};

export type PersistenceSnapshot = {
  readonly domain: 'persistence';
  readonly environment: 'simulation';
  readonly primaryHealthy: boolean;
  readonly replicaLagMs: bigint;
  readonly outboxBacklog: bigint;
  readonly inboxFailed: bigint;
  readonly deadLetterCount: bigint;
  readonly recoveryReconciliationQueue: bigint;
  readonly backupAgeMs: bigint;
};

export type EconomicSnapshot = {
  readonly domain: 'economic';
  readonly environment: 'simulation';
  readonly oracleQuorumDegraded: boolean;
  readonly productiveValueReviewQueue: bigint;
  readonly humanContributionReviewQueue: bigint;
  readonly supplyReconciliationMismatches: bigint;
  readonly productionActive: false;
};

export type EventFabricSnapshot = {
  readonly domain: 'events';
  readonly environment: 'simulation';
  readonly outboxBacklog: bigint;
  readonly inboxFailed: bigint;
  readonly deadLetterCount: bigint;
};

export type ExchangeSnapshot = {
  readonly domain: 'exchange';
  readonly environment: 'simulation';
  readonly pendingSettlements: bigint;
  readonly reconciliationMismatches: bigint;
};

export type AiSafetySnapshot = {
  readonly domain: 'ai';
  readonly environment: 'simulation';
  readonly actorClass: 'S3M' | 'GROK' | 'AGENT';
  readonly attempt:
    | 'ISSUE_AUTHORITY'
    | 'APPROVE_COMPLIANCE'
    | 'ACTIVATE_PRODUCTION'
    | 'SIGN_CUSTODY_WITHDRAWAL'
    | 'MODIFY_TOKENOMICS'
    | 'BYPASS_MANDATE';
  readonly humanScoreChanged: false;
};

export type FinancialSafetySnapshot = {
  readonly domain: 'financial_safety';
  readonly environment: 'simulation';
  readonly ledgerImbalance: boolean;
  readonly supplyMismatch: boolean;
  readonly duplicateIssuanceAttempt: boolean;
  readonly crossAssetCustodyMismatch: boolean;
  readonly doubleSubmitAttempt: boolean;
  readonly unexpectedProviderFinality: boolean;
  readonly staleFxUseAttempt: boolean;
  readonly balancesAltered: false;
};

export type SecuritySignalSnapshot = {
  readonly domain: 'security';
  readonly environment: 'simulation';
  readonly credentialMisuse: boolean;
  readonly secretLeakGuardRejection: boolean;
  readonly hsmUnavailable: boolean;
  readonly webhookReplay: boolean;
  readonly signatureFailure: boolean;
  readonly ssrfRejection: boolean;
  readonly unexpectedEndpointAttempt: boolean;
  readonly providerScopeMismatch: boolean;
  readonly secretValuesPresent: false;
};

export type DomainSnapshots = {
  readonly credentials?: readonly CredentialSnapshot[];
  readonly providers?: readonly ProviderRuntimeSnapshot[];
  readonly payments?: readonly PaymentSnapshot[];
  readonly compliance?: readonly ComplianceSnapshot[];
  readonly custody?: readonly CustodySnapshot[];
  readonly persistence?: PersistenceSnapshot;
  readonly economic?: EconomicSnapshot;
  readonly events?: EventFabricSnapshot;
  readonly exchange?: ExchangeSnapshot;
  readonly aiSafety?: readonly AiSafetySnapshot[];
  readonly financialSafety?: FinancialSafetySnapshot;
  readonly security?: SecuritySignalSnapshot;
};

export type HealthNodeId =
  | 'payments'
  | 'kernel'
  | 'ledger'
  | 'provider_candidate'
  | 'credential_health'
  | 'fx'
  | 'event_fabric'
  | 'persistence'
  | 'moonrey_evidence'
  | 'economic_data_provider'
  | 'connector'
  | 'certification'
  | 'oracle_quorum'
  | 'productive_contribution'
  | 'attribution'
  | 'productive_value'
  | 'monetary_authority'
  | 'custody'
  | 'exchange'
  | 'compliance'
  | 'chain';

export type HealthNode = {
  readonly id: HealthNodeId;
  readonly healthy: boolean;
  readonly status: OperationalState;
  readonly detail: string;
};

export type HealthEdge = {
  readonly from: HealthNodeId;
  readonly to: HealthNodeId;
};

export type RootCauseCandidate = {
  readonly nodeId: HealthNodeId;
  readonly reason: string;
  readonly correlationIsNotCausation: true;
};

export type ErrorBudget = {
  readonly sloId: string;
  readonly label: typeof SLO_LABEL;
  readonly windowMs: bigint;
  readonly elapsedMs: bigint;
  readonly allowedFailures: bigint;
  readonly observedFailures: bigint;
  readonly remainingFailures: bigint;
  readonly remainingBudgetBps: bigint;
  readonly consumedBudgetBps: bigint;
  readonly burnRateBps: bigint;
  readonly burnCategory: BurnRateCategory;
};

export type RecoveryCondition = {
  readonly id: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

export type TimelineActor = 'SYSTEM' | 'HUMAN' | 'CONTROL_ROOM';

export type TimelineEventKind = 'OBSERVED' | 'DECIDED' | 'HUMAN_ACTION' | 'RECOVERED';

export type IncidentTimelineEvent = {
  readonly sequence: bigint;
  readonly atUtc: string;
  readonly kind: TimelineEventKind;
  readonly actor: TimelineActor;
  readonly summary: string;
  readonly correlationRefs: SafeCorrelationRefs;
};

export type OperationalIncident = {
  readonly incidentId: string;
  readonly kind: ControlRoomIncidentKind;
  readonly severity: AlertSeverity;
  readonly startedAt: string;
  readonly detectedAt: string;
  readonly affectedComponents: readonly string[];
  readonly safeSummary: string;
  readonly correlationRefs: readonly SafeCorrelationRefs[];
  readonly invariantFailures: readonly string[];
  readonly providerStates: readonly ProviderTechnicalHealth[];
  readonly reconciliationRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly status: OperationalIncidentStatus;
  readonly recoveryConditions: readonly RecoveryCondition[];
  readonly runbookRef: string;
  readonly autoExecuteRunbook: false;
};

export type ControlRoomRecommendation = {
  readonly summary: string;
  readonly runbookRef: string;
  readonly executable: false;
};

export type ControlRoomReport = {
  readonly schemaVersion: typeof CONTROL_ROOM_SCHEMA_VERSION;
  readonly plane: typeof CONTROL_ROOM_PLANE;
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly engineeringSlosOnly: true;
  readonly operationalState: OperationalState;
  readonly capabilities: ControlRoomCapabilities;
  readonly incidents: readonly OperationalIncident[];
  readonly recommendations: readonly ControlRoomRecommendation[];
  readonly realAlertProviderConnected: false;
};
