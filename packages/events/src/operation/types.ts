/**
 * Chunk 155 — provider-neutral operational-effect record.
 *
 * Canonical delivery model is not magical exactly-once across external
 * systems. It is at-least-once event delivery + stable idempotency keys +
 * durable operation state + provider query/reconciliation + domain
 * deduplication.
 */

export const EXACTLY_ONCE_CLAIMED = false as const;
export const EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION = true as const;

export const OPERATION_STATES = [
  'PREPARED',
  'DISPATCHING',
  'SUBMITTED',
  'SUBMISSION_UNKNOWN',
  'CONFIRMED',
  'REJECTED_FINAL',
  'RECONCILIATION_REQUIRED',
  'COMPENSATION_REQUIRED',
  'COMPENSATED',
] as const;

export type OperationState = (typeof OPERATION_STATES)[number];

export const TERMINAL_OPERATION_STATES = [
  'CONFIRMED',
  'REJECTED_FINAL',
  'COMPENSATED',
] as const;

export type TerminalOperationState = (typeof TERMINAL_OPERATION_STATES)[number];

export const OPERATION_KINDS = [
  'PAYMENT_RAIL_SUBMIT',
  'CUSTODY_NATIVE_WITHDRAWAL',
  'EXCHANGE_SETTLEMENT',
  'HIN_CHAIN_ANCHOR',
  'ORACLE_OBSERVATION_COLLECT',
  'PROVIDER_WEBHOOK',
] as const;

export type OperationKind = (typeof OPERATION_KINDS)[number] | (string & {});

export const IDEMPOTENCY_PAYLOAD_MISMATCH = 'IDEMPOTENCY_PAYLOAD_MISMATCH' as const;
export const BLIND_RETRY_FORBIDDEN = 'BLIND_RETRY_FORBIDDEN' as const;
export const QUERY_REQUIRED_BEFORE_RETRY = 'QUERY_REQUIRED_BEFORE_RETRY' as const;
export const APPROVAL_BINDING_CHANGED = 'APPROVAL_BINDING_CHANGED' as const;
export const FAILOVER_REQUIRES_NEW_LINEAGE = 'FAILOVER_REQUIRES_NEW_LINEAGE' as const;
export const AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED =
  'AUTONOMOUS_FINANCIAL_RESOLUTION_REFUSED' as const;

export type OperationExecutionRecord = {
  readonly operationId: string;
  readonly operationKind: OperationKind;
  readonly businessKey: string;
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly intentId: string | null;
  readonly evidenceId: string | null;
  readonly providerId: string;
  readonly providerOperationRef: string | null;
  readonly state: OperationState;
  readonly attemptCount: number;
  readonly attemptLineage: string;
  readonly supersedesOperationId: string | null;
  readonly nativeAssetId: string | null;
  readonly preparedAt: string;
  readonly firstSubmittedAt: string | null;
  readonly lastObservedAt: string | null;
  readonly confirmedAt: string | null;
  readonly lastSafeErrorCode: string | null;
  readonly lastSafeErrorMessage: string | null;
  readonly revision: number;
  readonly leaseOwner: string | null;
  readonly leaseUntil: string | null;
};

export type RequestDigestFields = {
  readonly operationKind: string;
  readonly amountMinor: string;
  readonly assetId: string;
  readonly currency: string | null;
  readonly beneficiary: string | null;
  readonly destination: string | null;
  readonly providerId: string;
  readonly network: string | null;
  readonly nativeAssetId: string | null;
};

export type PrepareDraft = {
  readonly operationId: string;
  readonly operationKind: OperationKind;
  readonly businessKey: string;
  readonly idempotencyKey: string;
  readonly digest: RequestDigestFields;
  readonly correlationId?: string | null;
  readonly causationId?: string | null;
  readonly intentId?: string | null;
  readonly evidenceId?: string | null;
  readonly attemptLineage?: string;
  readonly supersedesOperationId?: string | null;
  readonly now: string;
};

export type IdempotencyConflict = {
  readonly code: typeof IDEMPOTENCY_PAYLOAD_MISMATCH;
  readonly existing: OperationExecutionRecord;
  readonly requestedDigest: string;
};

export type ProviderSubmitOutcome =
  | {
      readonly kind: 'ACCEPTED';
      readonly providerOperationRef: string;
    }
  | {
      readonly kind: 'REJECTED_FINAL';
      readonly safeErrorCode: string;
      readonly safeErrorMessage: string;
    }
  | {
      readonly kind: 'AMBIGUOUS';
      readonly safeErrorCode: string;
      readonly safeErrorMessage: string;
      readonly providerOperationRef?: string | null;
    };

export type ProviderQueryOutcome =
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'PENDING'; readonly providerOperationRef?: string | null }
  | { readonly kind: 'CONFIRMED'; readonly providerOperationRef: string }
  | { readonly kind: 'REJECTED_FINAL'; readonly safeErrorCode: string; readonly safeErrorMessage: string }
  | { readonly kind: 'UNKNOWN' };

export type CrashPoint =
  | 'BEFORE_PREPARED_COMMIT'
  | 'AFTER_PREPARED_COMMIT'
  | 'BEFORE_PROVIDER_CALL'
  | 'AFTER_PROVIDER_SUCCESS_BEFORE_RESULT'
  | 'AFTER_PROVIDER_FAILURE_BEFORE_RESULT'
  | 'AFTER_RESULT_BEFORE_OUTBOX'
  | 'AFTER_OUTBOX_BEFORE_CONSUMER'
  | 'AFTER_CONSUMER_EFFECT_BEFORE_INBOX';

export class SimulatedCrash extends Error {
  readonly point: CrashPoint;

  constructor(point: CrashPoint) {
    super(`SIMULATED_CRASH:${point}`);
    this.name = 'SimulatedCrash';
    this.point = point;
  }
}

export function isTerminalOperationState(state: OperationState): state is TerminalOperationState {
  return (TERMINAL_OPERATION_STATES as readonly string[]).includes(state);
}

export function freezeOperation(record: OperationExecutionRecord): OperationExecutionRecord {
  return Object.freeze({ ...record });
}
