import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import type { SurveillanceAlert } from '../../../market-surveillance/src/types.ts';
import { SUNREY_COIN_USD_MARKET_ID } from '../ids.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';
import {
  defaultEligibilityFacts,
  evaluateProductEligibility,
  type EligibilityFacts,
} from './eligibility.ts';
import {
  buildOrderPreview,
  candlesFromTrades,
  ExchangeMarketStream,
  marketStatus,
  orderBookFromSnapshot,
  tickerFromSnapshot,
  tradePrints,
} from './market-data.ts';
import { transitionClearing } from './clearing.ts';
import { reconcileExchangePositions, type PositionView } from './reconciliation.ts';
import {
  createFillObligation,
  ExchangeSettlementCoordinator,
  type SettlementRails,
} from './settlement.ts';
import type { SettlementFailureCode, SettlementReferences } from './types.ts';
import { observeExchangeSnapshot, openMarketAbuseCase } from './surveillance.ts';
import type {
  ClearingRecord,
  FillObligation,
  MarketAbuseCase,
  OrderPreview,
  PersistentBreak,
  ProductEligibilityDecision,
} from './types.ts';

export type RecordedFillInput = {
  readonly trade: ImmutableTrade;
  readonly buyerAccountId: string;
  readonly sellerAccountId: string;
  readonly buyerParticipantId: string;
  readonly sellerParticipantId: string;
  readonly buyerCashAccountId: string;
  readonly sellerCashAccountId: string;
  readonly buyerCustodyRef?: string | null;
  readonly sellerCustodyRef?: string | null;
  readonly makerHoldId?: string | null;
  readonly takerHoldId?: string | null;
  readonly quoteRail: FillObligation['quoteRail'];
  readonly baseRail: FillObligation['baseRail'];
  readonly at: UtcInstant;
};

export class ExchangeProductPlatform {
  readonly productionTradingEnabled = false;
  readonly coordinator: ExchangeSettlementCoordinator;
  readonly stream = new ExchangeMarketStream();
  private readonly obligations = new Map<string, FillObligation>();
  private readonly obligationsByTrade = new Map<string, string>();
  private readonly clearing = new Map<string, ClearingRecord>();
  private readonly breaks: PersistentBreak[] = [];
  private readonly alerts: SurveillanceAlert[] = [];
  private readonly cases: MarketAbuseCase[] = [];

  constructor(rails: SettlementRails) {
    this.coordinator = new ExchangeSettlementCoordinator(rails);
  }

  recordFill(input: RecordedFillInput): { readonly obligation: FillObligation; readonly clearing: ClearingRecord } {
    const trade = input.trade;
    const existingId = this.obligationsByTrade.get(trade.tradeId);
    if (existingId) {
      const obligation = this.obligations.get(existingId)!;
      return { obligation, clearing: this.clearing.get(obligation.obligationId)! };
    }
    const obligation = createFillObligation({
      tradeId: trade.tradeId,
      marketId: trade.marketId,
      buyerAccountId: input.buyerAccountId,
      sellerAccountId: input.sellerAccountId,
      buyerParticipantId: input.buyerParticipantId,
      sellerParticipantId: input.sellerParticipantId,
      buyerCashAccountId: input.buyerCashAccountId,
      sellerCashAccountId: input.sellerCashAccountId,
      buyerCustodyRef: input.buyerCustodyRef ?? null,
      sellerCustodyRef: input.sellerCustodyRef ?? null,
      baseAssetId: trade.quantity.assetId,
      quoteAssetId: trade.price.quoteAssetId,
      quoteKind: trade.price.quoteKind,
      quantity: trade.quantity.scaledUnits,
      priceUnits: trade.price.priceUnits,
      quoteMinorUnits: trade.quoteAmount.minorUnits,
      makerFeeMinorUnits: trade.makerFee.minorUnits,
      takerFeeMinorUnits: trade.takerFee.minorUnits,
      currency: trade.quoteAmount.currency,
      makerOrderId: trade.makerOrderId,
      takerOrderId: trade.takerOrderId,
      makerHoldId: input.makerHoldId ?? null,
      takerHoldId: input.takerHoldId ?? null,
      quoteRail: input.quoteRail,
      baseRail: input.baseRail,
      at: input.at,
    });
    const clearing = this.coordinator.open(obligation, input.at);
    this.obligations.set(obligation.obligationId, obligation);
    this.obligationsByTrade.set(trade.tradeId, obligation.obligationId);
    this.clearing.set(obligation.obligationId, clearing);
    return { obligation, clearing };
  }

  settle(input: {
    readonly obligationId: string;
    readonly at: UtcInstant;
    readonly authority: ExecutionAuthority | null;
    readonly actorId: string;
    readonly kind?: 'SETTLE' | 'RETRY' | 'REPAIR';
  }): ClearingRecord {
    const obligation = this.obligations.get(input.obligationId);
    const current = this.clearing.get(input.obligationId);
    if (!obligation || !current) {
      throw new Error('unknown obligation');
    }
    const next = this.coordinator.settle({
      obligation,
      clearing: current,
      at: input.at,
      authority: input.authority,
      actorId: input.actorId,
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
    });
    this.clearing.set(input.obligationId, next);
    return next;
  }

  attachOutcome(input: {
    readonly obligationId: string;
    readonly at: UtcInstant;
    readonly state: 'SETTLED' | 'FAILED' | 'REQUIRES_REVIEW';
    readonly refs?: Partial<SettlementReferences>;
    readonly failureCode?: SettlementFailureCode | null;
  }): ClearingRecord {
    const current = this.clearing.get(input.obligationId);
    if (!current) {
      throw new Error('unknown obligation');
    }
    let next = current.state === 'PENDING' ? transitionClearing(current, 'VALIDATED', input.at) : current;
    if (next.state === 'VALIDATED') {
      next = transitionClearing(next, 'READY_TO_SETTLE', input.at);
    }
    if (next.state === 'READY_TO_SETTLE') {
      next = transitionClearing(next, 'SETTLING', input.at, { incrementAttempt: true });
    }
    next = transitionClearing(next, input.state, input.at, {
      ...(input.refs !== undefined ? { refs: input.refs } : {}),
      failureCode: input.failureCode ?? null,
    });
    this.clearing.set(input.obligationId, next);
    return next;
  }

  confirmFinality(input: {
    readonly obligationId: string;
    readonly at: UtcInstant;
    readonly custodyConfirmation?: 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE';
    readonly chainFinality?: 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'UNAVAILABLE';
    readonly fromWebhookAlone?: boolean;
  }): ClearingRecord {
    const current = this.clearing.get(input.obligationId);
    if (!current) {
      throw new Error('unknown obligation');
    }
    const next = this.coordinator.applyVerifiedFinality({
      clearing: current,
      at: input.at,
      ...(input.custodyConfirmation !== undefined ? { custodyConfirmation: input.custodyConfirmation } : {}),
      ...(input.chainFinality !== undefined ? { chainFinality: input.chainFinality } : {}),
      ...(input.fromWebhookAlone !== undefined ? { fromWebhookAlone: input.fromWebhookAlone } : {}),
    });
    this.clearing.set(input.obligationId, next);
    return next;
  }

  obligationForTrade(tradeId: string): FillObligation | undefined {
    const id = this.obligationsByTrade.get(tradeId);
    return id ? this.obligations.get(id) : undefined;
  }

  clearingFor(obligationId: string): ClearingRecord | undefined {
    return this.clearing.get(obligationId);
  }

  listObligations(): readonly FillObligation[] {
    return [...this.obligations.values()];
  }

  listClearing(): readonly ClearingRecord[] {
    return [...this.clearing.values()];
  }

  reconcile(input: {
    readonly exchangePositions: readonly PositionView[];
    readonly ledgerPositions: readonly PositionView[];
    readonly custodyPositions: readonly PositionView[];
    readonly chainPositions: readonly PositionView[];
    readonly at: UtcInstant;
  }) {
    const report = reconcileExchangePositions({
      obligations: this.listObligations(),
      clearing: this.listClearing(),
      ...input,
    });
    this.breaks.push(...report.breaks);
    return report;
  }

  listBreaks(): readonly PersistentBreak[] {
    return [...this.breaks];
  }

  eligibility(facts: EligibilityFacts = defaultEligibilityFacts('owner')): ProductEligibilityDecision {
    return evaluateProductEligibility(facts);
  }

  observe(input: Parameters<typeof observeExchangeSnapshot>[0]): readonly SurveillanceAlert[] {
    const found = observeExchangeSnapshot(input);
    this.alerts.push(...found);
    for (const alert of found) {
      this.cases.push(openMarketAbuseCase({ alert, fillIds: input.trades.map((trade) => trade.tradeId) }));
    }
    return found;
  }

  listAlerts(): readonly SurveillanceAlert[] {
    return [...this.alerts];
  }

  listCases(): readonly MarketAbuseCase[] {
    return [...this.cases];
  }

  preview(input: {
    readonly ownerId: string;
    readonly marketId: string;
    readonly instrument: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
    readonly estimatedPriceUnits: bigint | null;
    readonly feeMinorUnits: bigint;
    readonly marketState: string;
    readonly now: UtcInstant;
    readonly facts?: EligibilityFacts;
    readonly approvedProposalId?: string | null;
  }): OrderPreview {
    return buildOrderPreview({
      marketId: input.marketId,
      instrument: input.instrument,
      side: input.side,
      quantity: input.quantity,
      estimatedPriceUnits: input.estimatedPriceUnits,
      feeMinorUnits: input.feeMinorUnits,
      marketState: input.marketState,
      eligibility: this.eligibility(input.facts ?? defaultEligibilityFacts(input.ownerId, input.marketId)),
      requiredApproval: input.approvedProposalId ? 'APPROVED_PROPOSAL' : 'EXECUTION_AUTHORITY',
      expiresAt: null,
      now: input.now,
    });
  }

  projectMarket(input: {
    readonly snapshot: MarketDataSnapshot;
    readonly trades: readonly ImmutableTrade[];
    readonly now: UtcInstant;
    readonly state: string;
  }) {
    return Object.freeze({
      ticker: tickerFromSnapshot(input.snapshot, input.now),
      orderBook: orderBookFromSnapshot(input.snapshot, input.now),
      trades: tradePrints(input.trades, input.snapshot.marketId),
      candles: candlesFromTrades({
        marketId: input.snapshot.marketId,
        trades: input.trades,
        periodMs: 60_000,
        now: input.now,
      }),
      status: marketStatus(input.snapshot.marketId, input.state, input.now),
    });
  }

  publishMarket(input: {
    readonly snapshot: MarketDataSnapshot;
    readonly trade?: ImmutableTrade;
    readonly order?: DigitalOrder;
    readonly at: UtcInstant;
  }): void {
    this.stream.publishFromBook(input);
  }
}

export function defaultMarketId(): string {
  return SUNREY_COIN_USD_MARKET_ID;
}
