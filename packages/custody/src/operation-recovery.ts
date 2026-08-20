import {
  APPROVAL_BINDING_CHANGED,
  InMemoryOperationStore,
  QUERY_REQUIRED_BEFORE_RETRY,
  ReconciliationCoordinator,
  approvalBindingUnchanged,
  custodyDomainTransition,
  dispatchExternalSideEffect,
  prepareOperation,
  providerIdempotencyKeyFor,
  refuseBlindRetry,
  type ApprovalBindingFields,
  type CrashPoint,
  type OperationExecutionRecord,
  type OperationStore,
  type ProviderQueryOutcome,
  type ProviderSubmitOutcome,
  type RequestDigestFields,
} from '../../events/src/operation/index.ts';

export type CustodyWithdrawalDraft = {
  readonly withdrawalId: string;
  readonly providerId: string;
  readonly quantityMinor: string;
  readonly assetId: string;
  readonly nativeAssetId: string;
  readonly destination: string;
  readonly network: string;
  readonly feePolicyId: string;
  readonly canonicalSemantics: string;
  readonly approval: ApprovalBindingFields;
};

export type CustodyProviderPorts = {
  readonly submit: (record: OperationExecutionRecord) => Promise<ProviderSubmitOutcome>;
  readonly query: (record: OperationExecutionRecord) => Promise<ProviderQueryOutcome>;
  readonly queryChain?: (record: OperationExecutionRecord) => Promise<ProviderQueryOutcome>;
};

export function custodyDigest(draft: CustodyWithdrawalDraft): RequestDigestFields {
  return {
    operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
    amountMinor: draft.quantityMinor,
    assetId: draft.assetId,
    currency: null,
    beneficiary: null,
    destination: draft.destination,
    providerId: draft.providerId,
    network: draft.network,
    nativeAssetId: draft.nativeAssetId,
  };
}

export class CustodyWithdrawalRecovery {
  readonly coordinator: ReconciliationCoordinator;
  private withdrawalsCreated = 0;
  private approvalsIssued = 0;

  readonly store: OperationStore;
  private readonly ports: CustodyProviderPorts;

  constructor(store: OperationStore | undefined, ports: CustodyProviderPorts) {
    this.store = store ?? new InMemoryOperationStore();
    this.ports = ports;
    this.coordinator = new ReconciliationCoordinator(this.store);
  }

  duplicateWithdrawalCreated(): boolean {
    return this.withdrawalsCreated > 1;
  }

  approvalDuplicated(): boolean {
    return this.approvalsIssued > 1;
  }

  bindApproval(draft: CustodyWithdrawalDraft): ApprovalBindingFields {
    this.approvalsIssued += 1;
    return draft.approval;
  }

  assertApprovalReusable(approved: ApprovalBindingFields, retry: ApprovalBindingFields): void {
    if (!approvalBindingUnchanged(approved, retry)) {
      const error = new Error(APPROVAL_BINDING_CHANGED);
      error.name = APPROVAL_BINDING_CHANGED;
      throw error;
    }
  }

  async prepare(draft: CustodyWithdrawalDraft, now: string, crashAt?: CrashPoint): Promise<OperationExecutionRecord> {
    this.assertApprovalReusable(draft.approval, {
      destination: draft.destination,
      assetId: draft.assetId,
      quantityMinor: draft.quantityMinor,
      feePolicyId: draft.feePolicyId,
      network: draft.network,
      canonicalSemantics: draft.canonicalSemantics,
    });
    return prepareOperation(
      this.store,
      {
        operationId: `op_wd_${draft.withdrawalId}`,
        operationKind: 'CUSTODY_NATIVE_WITHDRAWAL',
        businessKey: draft.withdrawalId,
        idempotencyKey: providerIdempotencyKeyFor({
          businessKey: draft.withdrawalId,
          providerId: draft.providerId,
          attemptLineage: 'lineage_1',
        }),
        digest: custodyDigest(draft),
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
        this.withdrawalsCreated += 1;
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
    const queried = await this.coordinator.queryAndPropose(
      record,
      { query: (row) => this.ports.query(row) },
      now,
      'HUMAN',
    );
    if (queried.record.state !== 'CONFIRMED' && this.ports.queryChain) {
      const chain = await this.ports.queryChain(record);
      if (chain.kind === 'CONFIRMED') {
        const confirmed = await this.coordinator.markReconciled(
          queried.record,
          now,
          `chain:${chain.providerOperationRef}`,
        );
        return { ...queried, record: confirmed };
      }
    }
    return queried;
  }

  applyLateCustodyStatus(
    current: keyof typeof import('../../events/src/operation/domains.ts').CUSTODY_STATUS_RANK,
    incoming: keyof typeof import('../../events/src/operation/domains.ts').CUSTODY_STATUS_RANK,
  ) {
    return custodyDomainTransition(current, incoming);
  }
}
