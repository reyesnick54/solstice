import {
  CallbackReplayLedger,
  InMemoryOperationStore,
  PAYMENT_STATUS_RANK,
  QUERY_REQUIRED_BEFORE_RETRY,
  ReconciliationCoordinator,
  applyCallbackOrResponse,
  computeRequestDigest,
  digestCallbackPayload,
  dispatchExternalSideEffect,
  paymentDomainTransition,
  prepareOperation,
  providerIdempotencyKeyFor,
  refuseBlindRetry,
  type CallbackObservation,
  type CrashPoint,
  type OperationExecutionRecord,
  type OperationStore,
  type ProviderQueryOutcome,
  type ProviderSubmitOutcome,
  type RequestDigestFields,
} from '../../events/src/operation/index.ts';

export type PaymentRecoveryDraft = {
  readonly paymentId: string;
  readonly providerId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly beneficiary: string;
  readonly destination: string;
  readonly assetId?: string;
  readonly nativeAssetId?: string | null;
  readonly intentId?: string | null;
};

export type PaymentProviderPorts = {
  readonly submit: (record: OperationExecutionRecord) => Promise<ProviderSubmitOutcome>;
  readonly query: (record: OperationExecutionRecord) => Promise<ProviderQueryOutcome>;
};

export function paymentDigest(draft: PaymentRecoveryDraft): RequestDigestFields {
  return {
    operationKind: 'PAYMENT_RAIL_SUBMIT',
    amountMinor: draft.amountMinor,
    assetId: draft.assetId ?? draft.currency,
    currency: draft.currency,
    beneficiary: draft.beneficiary,
    destination: draft.destination,
    providerId: draft.providerId,
    network: null,
    nativeAssetId: draft.nativeAssetId ?? null,
  };
}

export function paymentProviderIdempotencyKey(draft: PaymentRecoveryDraft, lineage = 'lineage_1'): string {
  return providerIdempotencyKeyFor({
    businessKey: draft.paymentId,
    providerId: draft.providerId,
    attemptLineage: lineage,
  });
}

export class PaymentSideEffectRecovery {
  readonly callbacks = new CallbackReplayLedger();
  readonly coordinator: ReconciliationCoordinator;
  private duplicatePayments = 0;

  readonly store: OperationStore;
  private readonly ports: PaymentProviderPorts;

  constructor(store: OperationStore | undefined, ports: PaymentProviderPorts) {
    this.store = store ?? new InMemoryOperationStore();
    this.ports = ports;
    this.coordinator = new ReconciliationCoordinator(this.store);
  }

  duplicatePaymentCreated(): boolean {
    return this.duplicatePayments > 1;
  }

  paymentCount(): number {
    return this.duplicatePayments;
  }

  async prepare(draft: PaymentRecoveryDraft, now: string, crashAt?: CrashPoint): Promise<OperationExecutionRecord> {
    return prepareOperation(
      this.store,
      {
        operationId: `op_pay_${draft.paymentId}`,
        operationKind: 'PAYMENT_RAIL_SUBMIT',
        businessKey: draft.paymentId,
        idempotencyKey: paymentProviderIdempotencyKey(draft),
        digest: paymentDigest(draft),
        intentId: draft.intentId ?? null,
        now,
      },
      crashAt,
    );
  }

  async submitPrepared(
    record: OperationExecutionRecord,
    now: () => string,
    crashAt?: CrashPoint,
  ): Promise<OperationExecutionRecord> {
    const result = await dispatchExternalSideEffect(record, {
      store: this.store,
      now,
      crashAt,
      submit: async () => {
        this.duplicatePayments += 1;
        return this.ports.submit(record);
      },
    });
    if (!result.ok) {
      const error = new Error(result.code);
      error.name = result.code;
      throw error;
    }
    return result.record;
  }

  async retryUnknown(record: OperationExecutionRecord): Promise<never> {
    const refused = await refuseBlindRetry(record);
    const error = new Error(refused.code);
    error.name = QUERY_REQUIRED_BEFORE_RETRY;
    throw error;
  }

  async recoverByQuery(record: OperationExecutionRecord, now: string) {
    return this.coordinator.queryAndPropose(record, { query: (row) => this.ports.query(row) }, now, 'HUMAN');
  }

  applyProviderCallback(
    record: OperationExecutionRecord,
    observation: CallbackObservation,
    now: string,
  ): { readonly record: OperationExecutionRecord; readonly duplicate: boolean } {
    const ingested = this.callbacks.ingest(observation, now);
    if (ingested.duplicate) {
      return { record, duplicate: true };
    }
    const applied = applyCallbackOrResponse(record, observation, now);
    return { record: applied.record, duplicate: false };
  }

  applyLateSubmissionResponse(
    record: OperationExecutionRecord,
    incomingPaymentStatus: keyof typeof PAYMENT_STATUS_RANK,
  ) {
    return paymentDomainTransition(
      record.state === 'CONFIRMED' ? 'SETTLED' : 'SUBMITTED',
      incomingPaymentStatus,
    );
  }
}

export function paymentCallbackDigest(paymentId: string, providerEventId: string, status: string): string {
  return digestCallbackPayload(`${paymentId}|${providerEventId}|${status}`);
}

export { computeRequestDigest, paymentDomainTransition };
