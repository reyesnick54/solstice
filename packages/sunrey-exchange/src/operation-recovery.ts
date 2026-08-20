import {
  InMemoryOperationStore,
  exchangeDomainTransition,
  prepareOperation,
  providerIdempotencyKeyFor,
  type OperationExecutionRecord,
  type OperationStore,
  type RequestDigestFields,
} from '../../events/src/operation/index.ts';

export type SettlementPhase =
  | 'TRADE_RECORDED'
  | 'RESERVED'
  | 'DVP_IN_FLIGHT'
  | 'CHAIN_LEG_FINALIZED'
  | 'ACCOUNTING_UNCERTAIN'
  | 'SETTLED'
  | 'FAILED';

export type ExchangeSettlementDraft = {
  readonly tradeId: string;
  readonly settlementId: string;
  readonly buyAssetId: string;
  readonly sellAssetId: string;
  readonly buyQuantityMinor: string;
  readonly sellQuantityMinor: string;
};

export class ExchangeSettlementRecovery {
  private phase: SettlementPhase = 'TRADE_RECORDED';
  private reservationHeld = false;
  private settlementCallbacks = 0;
  private settlementsPosted = 0;
  private accountingUncertain = false;

  readonly store: OperationStore;

  constructor(store?: OperationStore) {
    this.store = store ?? new InMemoryOperationStore();
  }

  digest(draft: ExchangeSettlementDraft): RequestDigestFields {
    return {
      operationKind: 'EXCHANGE_SETTLEMENT',
      amountMinor: `${draft.buyQuantityMinor}:${draft.sellQuantityMinor}`,
      assetId: `${draft.buyAssetId}+${draft.sellAssetId}`,
      currency: null,
      beneficiary: null,
      destination: null,
      providerId: 'exchange.dvp',
      network: 'sunrey-chain',
      nativeAssetId: draft.buyAssetId,
    };
  }

  async prepare(draft: ExchangeSettlementDraft, now: string): Promise<OperationExecutionRecord> {
    return prepareOperation(this.store, {
      operationId: `op_set_${draft.settlementId}`,
      operationKind: 'EXCHANGE_SETTLEMENT',
      businessKey: draft.tradeId,
      idempotencyKey: providerIdempotencyKeyFor({
        businessKey: draft.tradeId,
        providerId: 'exchange.dvp',
        attemptLineage: 'lineage_1',
      }),
      digest: this.digest(draft),
      now,
    });
  }

  recordTrade(): SettlementPhase {
    this.phase = 'TRADE_RECORDED';
    return this.phase;
  }

  reserve(): SettlementPhase {
    this.reservationHeld = true;
    this.phase = exchangeDomainTransition(this.phase, 'RESERVED').next;
    return this.phase;
  }

  startDvp(): SettlementPhase {
    if (!this.reservationHeld) {
      this.reserve();
    }
    this.phase = exchangeDomainTransition(this.phase, 'DVP_IN_FLIGHT').next;
    return this.phase;
  }

  finalizeChainLeg(): SettlementPhase {
    this.phase = exchangeDomainTransition(this.phase, 'CHAIN_LEG_FINALIZED').next;
    return this.phase;
  }

  markAccountingUncertain(): SettlementPhase {
    this.accountingUncertain = true;
    if (this.phase === 'CHAIN_LEG_FINALIZED' || this.phase === 'SETTLED') {
      return this.phase;
    }
    this.phase = exchangeDomainTransition(this.phase, 'ACCOUNTING_UNCERTAIN').next;
    return this.phase;
  }

  applySettlementCallback(): SettlementPhase {
    this.settlementCallbacks += 1;
    if (this.settlementsPosted === 0) {
      this.settlementsPosted = 1;
    }
    this.phase = exchangeDomainTransition(this.phase, 'SETTLED').next;
    return this.phase;
  }

  restart(): SettlementPhase {
    if (this.phase === 'SETTLED') {
      return this.phase;
    }
    if (this.reservationHeld && this.phase === 'TRADE_RECORDED') {
      this.phase = 'RESERVED';
    }
    return this.phase;
  }

  restartSafe(): boolean {
    return this.settlementsPosted <= 1 && this.phase !== 'FAILED';
  }

  duplicateCallbackIsNoop(): boolean {
    const before = this.settlementsPosted;
    this.applySettlementCallback();
    return this.settlementsPosted === before || this.settlementsPosted === 1;
  }
}
