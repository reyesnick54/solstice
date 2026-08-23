import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeProductPlatform } from './platform.ts';
import type { EligibilityFacts } from './eligibility.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';
import { defaultEligibilityFacts } from './eligibility.ts';

export type ExchangeApiActor = {
  readonly ownerId: string;
  readonly accountIds: readonly string[];
  readonly approvedProposalId?: string | null;
  readonly authorityPresent: boolean;
};

export type ExchangeApiError = {
  readonly error: true;
  readonly code:
    | 'NOT_OWNED'
    | 'NOT_FOUND'
    | 'NOT_ELIGIBLE'
    | 'AUTHORITY_REQUIRED'
    | 'PROPOSAL_REQUIRED'
    | 'PRODUCTION_TRADING_DISABLED'
    | 'VALIDATION';
  readonly message: string;
};

export type ExchangeApiResult<T> = T | ExchangeApiError;

export function isExchangeApiError(value: unknown): value is ExchangeApiError {
  return Boolean(value && typeof value === 'object' && 'error' in value && (value as { error: unknown }).error === true);
}

export class ExchangeApplicationApi {
  private readonly platform: ExchangeProductPlatform;
  private readonly catalog: {
    listMarkets(): readonly {
      readonly marketId: string;
      readonly instrument: string;
      readonly baseAssetId: string;
      readonly quoteAssetId: string;
      readonly state: string;
    }[];
    snapshot(marketId: string): MarketDataSnapshot | null;
    trades(marketId: string): readonly ImmutableTrade[];
    ordersFor(ownerId: string): readonly DigitalOrder[];
    holdingsFor(ownerId: string): readonly {
      readonly assetId: string;
      readonly quantity: bigint;
      readonly reserved: bigint;
      readonly pendingSettlement: bigint;
    }[];
    now(): UtcInstant;
  };

  constructor(
    platform: ExchangeProductPlatform,
    catalog: {
      listMarkets(): readonly {
        readonly marketId: string;
        readonly instrument: string;
        readonly baseAssetId: string;
        readonly quoteAssetId: string;
        readonly state: string;
      }[];
      snapshot(marketId: string): MarketDataSnapshot | null;
      trades(marketId: string): readonly ImmutableTrade[];
      ordersFor(ownerId: string): readonly DigitalOrder[];
      holdingsFor(ownerId: string): readonly {
        readonly assetId: string;
        readonly quantity: bigint;
        readonly reserved: bigint;
        readonly pendingSettlement: bigint;
      }[];
      now(): UtcInstant;
    },
  ) {
    this.platform = platform;
    this.catalog = catalog;
  }

  markets() {
    return {
      schema: 'sunrey.consumer.exchange.markets.v1',
      productionTradingEnabled: false,
      items: this.catalog.listMarkets(),
    };
  }

  market(instrument: string) {
    const found = this.catalog.listMarkets().find((item) => item.instrument === instrument || item.marketId === instrument);
    if (!found) {
      return fail('NOT_FOUND', 'market not found');
    }
    const snapshot = this.catalog.snapshot(found.marketId);
    return {
      schema: 'sunrey.consumer.exchange.market.v1',
      ...found,
      productionTradingEnabled: false,
      ticker: snapshot ? this.platform.projectMarket({
        snapshot,
        trades: this.catalog.trades(found.marketId),
        now: this.catalog.now(),
        state: found.state,
      }).ticker : null,
    };
  }

  ticker(instrument: string) {
    return this.marketSlice(instrument, 'ticker');
  }

  orderBook(instrument: string) {
    return this.marketSlice(instrument, 'orderBook');
  }

  trades(instrument: string) {
    return this.marketSlice(instrument, 'trades');
  }

  candles(instrument: string) {
    return this.marketSlice(instrument, 'candles');
  }

  eligibility(actor: ExchangeApiActor, facts?: EligibilityFacts) {
    return this.platform.eligibility(facts ?? defaultEligibilityFacts(actor.ownerId));
  }

  preview(actor: ExchangeApiActor, input: {
    readonly marketId: string;
    readonly instrument: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
  }) {
    const market = this.catalog.listMarkets().find((item) => item.marketId === input.marketId);
    const snapshot = market ? this.catalog.snapshot(market.marketId) : null;
    return this.platform.preview({
      ownerId: actor.ownerId,
      marketId: input.marketId,
      instrument: input.instrument,
      side: input.side,
      quantity: input.quantity,
      estimatedPriceUnits: snapshot?.lastTrade?.price.priceUnits ?? snapshot?.bestAsk?.priceUnits ?? null,
      feeMinorUnits: 0n,
      marketState: market?.state ?? 'CLOSED',
      now: this.catalog.now(),
    });
  }

  orders(actor: ExchangeApiActor) {
    return {
      schema: 'sunrey.consumer.exchange.orders.v1',
      items: this.catalog.ordersFor(actor.ownerId).map((order) => this.orderView(order, actor)),
    };
  }

  order(actor: ExchangeApiActor, orderId: string) {
    const order = this.catalog.ordersFor(actor.ownerId).find((item) => item.orderId === orderId);
    if (!order) {
      const foreign = this.catalog.ordersFor('__probe__').length;
      void foreign;
      return fail('NOT_OWNED', 'order is not visible for this owner');
    }
    return this.orderView(order, actor);
  }

  submitOrder(actor: ExchangeApiActor, input: {
    readonly marketId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
    readonly proposalId?: string | null;
  }): ExchangeApiResult<{ readonly accepted: true; readonly requiresExecution: true; readonly proposalId: string | null }> {
    void input;
    if (this.platform.productionTradingEnabled) {
      return fail('PRODUCTION_TRADING_DISABLED', 'production trading remains disabled');
    }
    const eligibility = this.platform.eligibility(defaultEligibilityFacts(actor.ownerId, input.marketId));
    if (!eligibility.canTrade.allowed) {
      return fail('NOT_ELIGIBLE', eligibility.canTrade.reasonCodes.join(','));
    }
    if (!actor.approvedProposalId && !input.proposalId && !actor.authorityPresent) {
      return fail('PROPOSAL_REQUIRED', 'agent-originated orders require an approved proposal');
    }
    return {
      accepted: true,
      requiresExecution: true,
      proposalId: input.proposalId ?? actor.approvedProposalId ?? null,
    };
  }

  cancelOrder(actor: ExchangeApiActor, orderId: string) {
    const order = this.catalog.ordersFor(actor.ownerId).find((item) => item.orderId === orderId);
    if (!order) {
      return fail('NOT_OWNED', 'order is not visible for this owner');
    }
    return { cancelled: true, orderId, productionTradingEnabled: false };
  }

  fills(actor: ExchangeApiActor) {
    const owned = new Set(actor.accountIds);
    const items = this.platform.listObligations().filter(
      (item) => owned.has(item.buyerAccountId) || owned.has(item.sellerAccountId),
    );
    return {
      schema: 'sunrey.consumer.exchange.fills.v1',
      items: items.map((obligation) => {
        const clearing = this.platform.clearingFor(obligation.obligationId);
        return {
          tradeId: obligation.tradeId,
          obligationId: obligation.obligationId,
          marketId: obligation.marketId,
          quantity: obligation.quantity.toString(),
          priceUnits: obligation.priceUnits.toString(),
          clearingState: clearing?.state ?? 'PENDING',
          fillIsFinalSettlement: obligation.fillIsFinalSettlement,
        };
      }),
    };
  }

  holdings(actor: ExchangeApiActor) {
    return {
      schema: 'sunrey.consumer.exchange.holdings.v1',
      items: this.catalog.holdingsFor(actor.ownerId),
      productionTradingEnabled: false,
    };
  }

  stream(after: number, topics?: readonly ('ticker' | 'trade' | 'order-book' | 'order-status')[]) {
    const events = this.platform.stream.after(after, topics);
    return {
      schema: 'sunrey.consumer.exchange.stream.v1',
      privilegedTopicsExposed: false,
      sse: this.platform.stream.encodeSse(events),
      events,
    };
  }

  private marketSlice(instrument: string, key: 'ticker' | 'orderBook' | 'trades' | 'candles') {
    const found = this.catalog.listMarkets().find((item) => item.instrument === instrument || item.marketId === instrument);
    if (!found) {
      return fail('NOT_FOUND', 'market not found');
    }
    const snapshot = this.catalog.snapshot(found.marketId);
    if (!snapshot) {
      return fail('NOT_FOUND', 'market data unavailable');
    }
    const projected = this.platform.projectMarket({
      snapshot,
      trades: this.catalog.trades(found.marketId),
      now: this.catalog.now(),
      state: found.state,
    });
    return projected[key];
  }

  private orderView(order: DigitalOrder, actor: ExchangeApiActor) {
    void actor;
    const obligation = [...this.platform.listObligations()].find(
      (item) => item.makerOrderId === order.orderId || item.takerOrderId === order.orderId,
    );
    const clearing = obligation ? this.platform.clearingFor(obligation.obligationId) : undefined;
    return {
      orderId: order.orderId,
      marketId: order.marketId,
      side: order.side,
      status: order.status,
      quantity: order.quantity.scaledUnits.toString(),
      remaining: order.remaining.scaledUnits.toString(),
      clearingState: clearing?.state ?? null,
      fillIsNotSettlement: clearing ? clearing.state !== 'SETTLED' : true,
    };
  }
}

function fail(code: ExchangeApiError['code'], message: string): ExchangeApiError {
  return { error: true, code, message };
}
