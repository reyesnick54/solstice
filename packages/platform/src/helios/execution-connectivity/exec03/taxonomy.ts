/**
 * HELIOS EXEC03 — idempotent execution intent and submission-ambiguity engine.
 * Simulation / fixture broker connectivity only. Does not issue Execution Authority.
 */

export const HELIOS_EXEC03_SCHEMA = 'sunrey.helios.execution-connectivity.exec03.v1' as const;

export const EXECUTION_INTENT_STATES = [
  'NOT_SUBMITTED',
  'SUBMITTING',
  'ACKNOWLEDGED',
  'SUBMISSION_UNKNOWN',
  'RECONCILING',
  'CONFIRMED',
  'REJECTED',
] as const;

export type ExecutionIntentState = (typeof EXECUTION_INTENT_STATES)[number];

export const EXEC03_AMBIGUITY_REASONS = [
  'NETWORK_TIMEOUT',
  'PROVIDER_RESPONSE_LOST',
  'PROCESS_RESTART_DURING_SUBMIT',
  'DROP_COPY_DIVERGENCE',
] as const;

export type Exec03AmbiguityReason = (typeof EXEC03_AMBIGUITY_REASONS)[number];

export const HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED =
  'HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED' as const;
export const HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED =
  'HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED' as const;

export const EXEC03_BLIND_RESUBMIT_FORBIDDEN = 'EXEC03_BLIND_RESUBMIT_FORBIDDEN' as const;
export const EXEC03_QUERY_REQUIRED_BEFORE_RETRY = 'EXEC03_QUERY_REQUIRED_BEFORE_RETRY' as const;
export const EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH = 'EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH' as const;
export const EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED = 'EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED' as const;
export const EXEC03_SAFE_WINDOW_NOT_ELAPSED = 'EXEC03_SAFE_WINDOW_NOT_ELAPSED' as const;
