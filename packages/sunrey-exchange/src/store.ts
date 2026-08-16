import type {
  BookEvent,
  ClearingInstruction,
  DigitalOrder,
  ExchangeAccount,
  ExchangeHold,
  ExchangeListing,
  ExchangeMarket,
  HaltRecord,
  ImmutableTrade,
  ListingDecision,
  MarketDataSnapshot,
  ReconciliationReport,
  SettlementRecord,
} from './types.ts';
import type { ExchangeAccountId, ExchangeMarketId, OrderId, TradeId } from './ids.ts';

export class ExchangeStore {
  readonly accounts = new Map<string, ExchangeAccount>();
  readonly listings = new Map<string, ExchangeListing>();
  readonly markets = new Map<string, ExchangeMarket>();
  readonly orders = new Map<string, DigitalOrder>();
  readonly ordersByIdempotency = new Map<string, OrderId>();
  readonly holds = new Map<string, ExchangeHold>();
  readonly trades = new Map<string, ImmutableTrade>();
  readonly settlements = new Map<string, SettlementRecord>();
  readonly settlementsByTrade = new Map<string, SettlementIdLike>();
  readonly clearing = new Map<string, ClearingInstruction>();
  readonly bookEvents: BookEvent[] = [];
  readonly marketData = new Map<string, MarketDataSnapshot>();
  readonly halts: HaltRecord[] = [];
  readonly reconciliations: ReconciliationReport[] = [];
  readonly listingDecisions: ListingDecision[] = [];
  sequenceByMarket = new Map<string, number>();
  orderSequence = 0;

  putExchangeAccount(account: ExchangeAccount): void {
    this.accounts.set(account.accountId, account);
  }
  putListing(listing: ExchangeListing): void {
    this.listings.set(listing.listingId, listing);
  }
  putMarket(market: ExchangeMarket): void {
    this.markets.set(market.marketId, market);
  }
  putOrder(order: DigitalOrder): void {
    this.orders.set(order.orderId, order);
    this.ordersByIdempotency.set(order.clientIdempotencyKey, order.orderId);
  }
  putHold(hold: ExchangeHold): void {
    this.holds.set(hold.holdId, hold);
  }
  putTrade(trade: ImmutableTrade): void {
    this.trades.set(trade.tradeId, trade);
  }
  putSettlement(record: SettlementRecord): void {
    this.settlements.set(record.settlementId, record);
    this.settlementsByTrade.set(record.tradeId, record.settlementId);
  }
  putClearing(instruction: ClearingInstruction): void {
    this.clearing.set(instruction.clearingId, instruction);
  }
  nextOrderSequence(): number {
    this.orderSequence += 1;
    return this.orderSequence;
  }
  nextMarketSequence(marketId: ExchangeMarketId): number {
    const next = (this.sequenceByMarket.get(marketId) ?? 0) + 1;
    this.sequenceByMarket.set(marketId, next);
    return next;
  }
  openOrders(marketId: ExchangeMarketId): DigitalOrder[] {
    return [...this.orders.values()].filter(
      (order) =>
        order.marketId === marketId && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
  }
  account(id: ExchangeAccountId): ExchangeAccount | undefined {
    return this.accounts.get(id);
  }
  order(id: OrderId): DigitalOrder | undefined {
    return this.orders.get(id);
  }
  trade(id: TradeId): ImmutableTrade | undefined {
    return this.trades.get(id);
  }
}

type SettlementIdLike = SettlementRecord['settlementId'];
