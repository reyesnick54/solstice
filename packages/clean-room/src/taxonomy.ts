/**
 * Privacy Clean Room vocabularies.
 *
 * Thresholds and decisions are ENGINEERING_POLICY controls.
 * They are not GDPR, CCPA, PDPL, HIPAA, differential-privacy,
 * TEE, or confidential-computing guarantees.
 */

export const CLEAN_ROOM_SESSION_STATES = [
  'CREATED',
  'AUTHORIZATION_PENDING',
  'AUTHORIZED',
  'RUNNING',
  'COMPLETED',
  'DENIED',
  'FAILED',
  'EXPIRED',
  'REVOKED',
] as const;
export type CleanRoomSessionState = (typeof CLEAN_ROOM_SESSION_STATES)[number];

export const CLEAN_ROOM_JOB_STATES = [
  'QUEUED',
  'AUTHORIZING',
  'RUNNING',
  'EGRESS_PENDING',
  'COMPLETED',
  'DENIED',
  'FAILED',
  'EXPIRED',
] as const;
export type CleanRoomJobState = (typeof CLEAN_ROOM_JOB_STATES)[number];

export const SESSION_TRANSITIONS: Readonly<Record<CleanRoomSessionState, readonly CleanRoomSessionState[]>> = {
  CREATED: ['AUTHORIZATION_PENDING', 'DENIED', 'EXPIRED', 'REVOKED'],
  AUTHORIZATION_PENDING: ['AUTHORIZED', 'DENIED', 'EXPIRED', 'REVOKED'],
  AUTHORIZED: ['RUNNING', 'DENIED', 'EXPIRED', 'REVOKED', 'COMPLETED'],
  RUNNING: ['AUTHORIZED', 'COMPLETED', 'FAILED', 'DENIED', 'REVOKED'],
  COMPLETED: [],
  DENIED: [],
  FAILED: [],
  EXPIRED: [],
  REVOKED: [],
};

export const JOB_TRANSITIONS: Readonly<Record<CleanRoomJobState, readonly CleanRoomJobState[]>> = {
  QUEUED: ['AUTHORIZING', 'DENIED', 'FAILED', 'EXPIRED'],
  AUTHORIZING: ['RUNNING', 'DENIED', 'FAILED'],
  RUNNING: ['EGRESS_PENDING', 'DENIED', 'FAILED'],
  EGRESS_PENDING: ['COMPLETED', 'DENIED', 'FAILED'],
  COMPLETED: [],
  DENIED: [],
  FAILED: [],
  EXPIRED: [],
};

export const QUERY_OPERATIONS = [
  'COUNT',
  'SUM',
  'AVERAGE',
  'MIN_MAX_BOUNDED',
  'HISTOGRAM',
  'DISTRIBUTION_BUCKETS',
  'CATEGORY_AGGREGATION',
  'COHORT_METRIC',
] as const;
export type QueryOperation = (typeof QUERY_OPERATIONS)[number];

export const EGRESS_DECISIONS = ['RELEASE', 'REDACT', 'SUPPRESS', 'REVIEW_REQUIRED', 'DENY'] as const;
export type EgressDecision = (typeof EGRESS_DECISIONS)[number];

export const THRESHOLD_LABELS = ['ENGINEERING_POLICY', 'RESEARCH_REQUIRED'] as const;
export type ThresholdLabel = (typeof THRESHOLD_LABELS)[number];

export const CLEAN_ROOM_REASON_CODES = [
  'ALLOWED',
  'DEFAULT_DENY',
  'ACTOR_CONTEXT_REQUIRED',
  'CAPABILITY_DENIED',
  'ASSURANCE_INSUFFICIENT',
  'REQUESTER_UNKNOWN',
  'REQUESTER_MISMATCH',
  'INTERNAL_SERVICE_INSUFFICIENT',
  'NO_ACTIVE_CONSENT',
  'CONSENT_REVOKED',
  'CONSENT_EXPIRED',
  'PURPOSE_MISMATCH',
  'RECIPIENT_OUT_OF_SCOPE',
  'RESOURCE_OUT_OF_SCOPE',
  'FIELD_OUT_OF_SCOPE',
  'OPERATION_OUT_OF_SCOPE',
  'UNSUPPORTED_OPERATION',
  'ARBITRARY_SQL_FORBIDDEN',
  'ARBITRARY_CODE_FORBIDDEN',
  'RAW_ROW_EXPORT_DENIED',
  'COHORT_BELOW_THRESHOLD',
  'CELL_BELOW_THRESHOLD',
  'EXCESSIVE_DIMENSIONS',
  'OUTPUT_CARDINALITY_EXCEEDED',
  'QUERY_BUDGET_EXHAUSTED',
  'REPEATED_QUERY',
  'REPLAYED_REQUEST',
  'SESSION_NOT_AUTHORIZED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'ILLEGAL_TRANSITION',
  'TEMPLATE_UNKNOWN',
  'TEMPLATE_NOT_ALLOWED',
  'CROSS_SUBJECT_DENIED',
  'ASSET_ID_NOT_AUTHORIZATION',
  'DUPLICATE_CONTRIBUTION',
  'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED',
  'NO_SUNREY_COIN_ISSUANCE',
] as const;
export type CleanRoomReasonCode = (typeof CLEAN_ROOM_REASON_CODES)[number];

export const COMPUTATION_IMPLEMENTATION = Object.freeze({
  id: 'packages/clean-room/src/compute.ts',
  version: '1',
  deterministicApprovedOnly: true,
  arbitraryCode: false,
  arbitrarySql: false,
  confidentialCompute: false,
  tee: false,
  hsm: false,
  differentialPrivacy: false,
});

export const EPHEMERAL_PLAINTEXT_GUARANTEE =
  'Decrypted working material exists only in the in-process ephemeral workspace for the duration of a job. On completion or failure the workspace releases object references and does not write temporary files. Plaintext is never logged. This is not HSM, TEE, or confidential-computing protection.';

export const CLEAN_ROOM_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const,
  counselConfirmed: false,
  gdprComplianceClaim: false,
  ccpaComplianceClaim: false,
  saudiPdplComplianceClaim: false,
  uaePdplComplianceClaim: false,
  hipaaComplianceClaim: false,
  differentialPrivacyImplemented: false,
  teeImplemented: false,
  confidentialComputeImplemented: false,
  note: 'Engineering privacy controls are not legal approval. Counsel has not confirmed any privacy-law mapping.',
});

export const SIMULATION_PRIVACY_POLICY_VERSION = 'ppv_simulation_1';
export const EVIDENCE_KIND_CLEAN_ROOM = 'CLEAN_ROOM';
export const DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED = 'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED' as const;

export const SIMULATION_THRESHOLDS = Object.freeze({
  minCohortSize: 10,
  minCellSize: 5,
  maxGroupingDimensions: 2,
  maxOutputRowCount: 20,
  maxQueriesPerSession: 8,
  label: 'ENGINEERING_POLICY' as const satisfies ThresholdLabel,
  legalSufficiency: 'RESEARCH_REQUIRED' as const satisfies ThresholdLabel,
});

export const FORBIDDEN_QUERY_NEEDLES = Object.freeze([
  'SELECT',
  'select',
  'JOIN',
  'UNION',
  'DROP',
  'INSERT',
  'UPDATE',
  'DELETE',
  'COPY ',
  'pg_',
  'filesystem',
  'require(',
  'import ',
  'process.exit',
  'child_process',
  'eval(',
  'Function(',
  '#!/',
  'python',
  'javascript',
]);

export function canTransitionSession(from: CleanRoomSessionState, to: CleanRoomSessionState): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

export function canTransitionJob(from: CleanRoomJobState, to: CleanRoomJobState): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function isQueryOperation(value: string): value is QueryOperation {
  return (QUERY_OPERATIONS as readonly string[]).includes(value);
}
