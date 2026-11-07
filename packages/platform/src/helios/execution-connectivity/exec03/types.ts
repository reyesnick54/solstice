import type {
  Exec03AmbiguityReason,
  ExecutionIntentState,
  HELIOS_EXEC03_SCHEMA,
} from './taxonomy.ts';

export type OrderPayloadDigestFields = {
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly limitPriceMinorUnits: string | null;
  readonly currency: string;
  readonly timeInForce: string;
};

export type ExecutionIntent = {
  readonly schema: typeof HELIOS_EXEC03_SCHEMA;
  readonly operationId: string;
  readonly clientOrderId: string;
  readonly idempotencyKey: string;
  readonly providerAccountId: string;
  readonly providerId: string;
  readonly payloadHash: string;
  readonly payload: OrderPayloadDigestFields;
  readonly state: ExecutionIntentState;
  readonly providerOrderId: string | null;
  readonly attemptCount: number;
  readonly submittedOnce: boolean;
  readonly governedResubmitPermitted: boolean;
  readonly ambiguitySafeWindowEndsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly firstSubmittedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly confirmedAt: string | null;
  readonly liveBrokerConnected: false;
};

export type SubmissionAttempt = {
  readonly attemptId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly outcome:
    | 'IN_FLIGHT'
    | 'ACKNOWLEDGED'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'AMBIGUOUS'
    | 'GOVERNED_RESUBMIT';
  readonly brokerInvoked: boolean;
  readonly clientOrderId: string;
};

export type SubmissionReceipt = {
  readonly receiptId: string;
  readonly operationId: string;
  readonly attemptId: string;
  readonly clientOrderId: string;
  readonly providerOrderId: string;
  readonly receivedAt: string;
  readonly source: 'SUBMIT_RESPONSE' | 'RECONCILIATION' | 'DROP_COPY' | 'OPEN_ORDERS';
};

export type SubmissionAmbiguity = {
  readonly ambiguityId: string;
  readonly operationId: string;
  readonly attemptId: string;
  readonly reason: Exec03AmbiguityReason;
  readonly markedAt: string;
  readonly safeWindowEndsAt: string;
  readonly resolvedAt: string | null;
  readonly resolution: 'FOUND_AT_BROKER' | 'NOT_FOUND_AFTER_SAFE_WINDOW' | 'STILL_AMBIGUOUS' | null;
};

export type ProviderOrderLookupSignal = {
  readonly source: 'BROKER_QUERY' | 'DROP_COPY' | 'OPEN_ORDERS';
  readonly found: boolean;
  readonly providerOrderId: string | null;
  readonly status: 'ACKNOWLEDGED' | 'CONFIRMED' | 'REJECTED' | 'OPEN' | null;
  readonly observedAt: string;
};

export type ProviderOrderLookup = {
  readonly operationId: string;
  readonly clientOrderId: string;
  readonly queriedAt: string;
  readonly signals: readonly ProviderOrderLookupSignal[];
  readonly aggregateFound: boolean;
  readonly providerOrderId: string | null;
  readonly notFoundAfterSafeWindow: boolean;
};

export type RegisterExecutionIntentDraft = {
  readonly operationId: string;
  readonly clientOrderId: string;
  readonly idempotencyKey: string;
  readonly providerAccountId: string;
  readonly providerId: string;
  readonly payload: OrderPayloadDigestFields;
  readonly now: string;
  readonly safeWindowMs?: number;
};

export type Exec03FailureCode =
  | typeof import('./taxonomy.ts').EXEC03_BLIND_RESUBMIT_FORBIDDEN
  | typeof import('./taxonomy.ts').EXEC03_QUERY_REQUIRED_BEFORE_RETRY
  | typeof import('./taxonomy.ts').EXEC03_IDEMPOTENCY_PAYLOAD_MISMATCH
  | typeof import('./taxonomy.ts').EXEC03_GOVERNED_RESUBMIT_NOT_PERMITTED
  | typeof import('./taxonomy.ts').EXEC03_SAFE_WINDOW_NOT_ELAPSED
  | 'INTENT_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'BROKER_UNAVAILABLE';

export type Exec03Failure = {
  readonly code: Exec03FailureCode;
  readonly message: string;
};

export type Exec03IntentStoreSnapshot = {
  readonly intents: readonly ExecutionIntent[];
  readonly attempts: readonly SubmissionAttempt[];
  readonly receipts: readonly SubmissionReceipt[];
  readonly ambiguities: readonly SubmissionAmbiguity[];
};
