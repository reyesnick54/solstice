import {
  InMemoryOperationStore,
  QUERY_REQUIRED_BEFORE_RETRY,
  ReconciliationCoordinator,
  dispatchExternalSideEffect,
  hinAnchorDomainTransition,
  prepareOperation,
  providerIdempotencyKeyFor,
  refuseBlindRetry,
  type OperationExecutionRecord,
  type OperationStore,
  type ProviderQueryOutcome,
  type ProviderSubmitOutcome,
} from '../../../../events/src/operation/index.ts';

export type HinAnchorDraft = {
  readonly anchorIntentId: string;
  readonly contentCommitment: string;
  readonly providerId: string;
};

export class HinAnchorRecovery {
  readonly coordinator: ReconciliationCoordinator;
  private submissions = 0;
  private lastTxRef: string | null = null;

  readonly store: OperationStore;
  private readonly ports: {
    readonly submit: (record: OperationExecutionRecord) => Promise<ProviderSubmitOutcome>;
    readonly query: (record: OperationExecutionRecord) => Promise<ProviderQueryOutcome>;
  };

  constructor(
    store: OperationStore | undefined,
    ports: {
      readonly submit: (record: OperationExecutionRecord) => Promise<ProviderSubmitOutcome>;
      readonly query: (record: OperationExecutionRecord) => Promise<ProviderQueryOutcome>;
    },
  ) {
    this.store = store ?? new InMemoryOperationStore();
    this.ports = ports;
    this.coordinator = new ReconciliationCoordinator(this.store);
  }

  economicallyDistinctAnchors(): number {
    return this.submissions;
  }

  async prepare(draft: HinAnchorDraft, now: string): Promise<OperationExecutionRecord> {
    return prepareOperation(this.store, {
      operationId: `op_hin_${draft.anchorIntentId}`,
      operationKind: 'HIN_CHAIN_ANCHOR',
      businessKey: draft.anchorIntentId,
      idempotencyKey: providerIdempotencyKeyFor({
        businessKey: draft.anchorIntentId,
        providerId: draft.providerId,
        attemptLineage: 'lineage_1',
      }),
      digest: {
        operationKind: 'HIN_CHAIN_ANCHOR',
        amountMinor: '0',
        assetId: 'HIN_COMMITMENT',
        currency: null,
        beneficiary: null,
        destination: draft.contentCommitment,
        providerId: draft.providerId,
        network: 'sunrey-chain',
        nativeAssetId: null,
      },
      now,
    });
  }

  async submitPrepared(
    record: OperationExecutionRecord,
    now: () => string,
  ): Promise<OperationExecutionRecord> {
    const existing = await this.store.getByBusinessKey('HIN_CHAIN_ANCHOR', record.businessKey);
    if (existing && existing.providerOperationRef && existing.state !== 'PREPARED') {
      return existing;
    }
    const result = await dispatchExternalSideEffect(record, {
      store: this.store,
      now,
      submit: async () => {
        this.submissions += 1;
        const outcome = await this.ports.submit(record);
        if (outcome.kind === 'ACCEPTED') {
          this.lastTxRef = outcome.providerOperationRef;
        }
        return outcome;
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

  applyLateAnchorStatus(
    current: keyof typeof import('../../../../events/src/operation/domains.ts').HIN_ANCHOR_RANK,
    incoming: keyof typeof import('../../../../events/src/operation/domains.ts').HIN_ANCHOR_RANK,
  ) {
    return hinAnchorDomainTransition(current, incoming);
  }

  lastSubmissionRef(): string | null {
    return this.lastTxRef;
  }
}
