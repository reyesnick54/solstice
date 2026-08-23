import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import type { ExchangePrice } from '../price.ts';
import { ExchangeStore } from '../store.ts';
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
  SettlementRecord,
} from '../types.ts';
import type { ProductizedInstrument } from './instrument.ts';
import type { ProductizedFeeSchedule } from './fees.ts';

export type EncodedBigint = string;

export type ExchangeCoreSnapshot = {
  readonly schema: 'sunrey-exchange-core/1';
  readonly productionActive: false;
  readonly liveTradingEnabled: false;
  readonly accounts: readonly ExchangeAccount[];
  readonly listings: readonly ExchangeListing[];
  readonly markets: readonly ExchangeMarket[];
  readonly instruments: readonly ProductizedInstrument[];
  readonly orders: readonly DigitalOrder[];
  readonly holds: readonly ExchangeHold[];
  readonly trades: readonly ImmutableTrade[];
  readonly settlements: readonly SettlementRecord[];
  readonly clearing: readonly ClearingInstruction[];
  readonly bookEvents: readonly BookEvent[];
  readonly halts: readonly HaltRecord[];
  readonly feeSchedule: ProductizedFeeSchedule;
  readonly orderSequence: number;
  readonly sequenceByMarket: readonly { readonly marketId: string; readonly sequence: number }[];
  readonly idempotency: readonly { readonly key: string; readonly orderId: string }[];
};

export function captureExchangeCore(input: {
  readonly store: ExchangeStore;
  readonly instruments: readonly ProductizedInstrument[];
  readonly feeSchedule: ProductizedFeeSchedule;
}): ExchangeCoreSnapshot {
  return Object.freeze({
    schema: 'sunrey-exchange-core/1',
    productionActive: false,
    liveTradingEnabled: false,
    accounts: [...input.store.accounts.values()],
    listings: [...input.store.listings.values()],
    markets: [...input.store.markets.values()],
    instruments: [...input.instruments],
    orders: [...input.store.orders.values()],
    holds: [...input.store.holds.values()],
    trades: [...input.store.trades.values()],
    settlements: [...input.store.settlements.values()],
    clearing: [...input.store.clearing.values()],
    bookEvents: [...input.store.bookEvents],
    halts: [...input.store.halts],
    feeSchedule: input.feeSchedule,
    orderSequence: input.store.orderSequence,
    sequenceByMarket: [...input.store.sequenceByMarket.entries()].map(([marketId, sequence]) => ({
      marketId,
      sequence,
    })),
    idempotency: [...input.store.ordersByIdempotency.entries()].map(([key, orderId]) => ({
      key,
      orderId,
    })),
  });
}

export function hydrateExchangeStore(snapshot: ExchangeCoreSnapshot, target = new ExchangeStore()): ExchangeStore {
  if (snapshot.schema !== 'sunrey-exchange-core/1') {
    throw new Error('unsupported Exchange core snapshot schema');
  }
  if (snapshot.productionActive !== false || snapshot.liveTradingEnabled !== false) {
    throw new Error('snapshot must keep live trading disabled');
  }
  target.accounts.clear();
  target.listings.clear();
  target.markets.clear();
  target.orders.clear();
  target.ordersByIdempotency.clear();
  target.holds.clear();
  target.trades.clear();
  target.settlements.clear();
  target.settlementsByTrade.clear();
  target.clearing.clear();
  target.bookEvents.length = 0;
  target.halts.length = 0;
  target.marketData.clear();
  target.sequenceByMarket = new Map();
  for (const account of snapshot.accounts) {
    target.putExchangeAccount(account);
  }
  for (const listing of snapshot.listings) {
    target.putListing(listing);
  }
  for (const market of snapshot.markets) {
    target.putMarket(market);
  }
  for (const order of snapshot.orders) {
    target.putOrder(order);
  }
  for (const hold of snapshot.holds) {
    target.putHold(hold);
  }
  for (const trade of snapshot.trades) {
    target.putTrade(trade);
  }
  for (const settlement of snapshot.settlements) {
    target.putSettlement(settlement);
  }
  for (const instruction of snapshot.clearing) {
    target.putClearing(instruction);
  }
  for (const event of snapshot.bookEvents) {
    target.bookEvents.push(event);
  }
  for (const halt of snapshot.halts) {
    target.halts.push(halt);
  }
  target.orderSequence = snapshot.orderSequence;
  for (const row of snapshot.sequenceByMarket) {
    target.sequenceByMarket.set(row.marketId, row.sequence);
  }
  for (const row of snapshot.idempotency) {
    target.ordersByIdempotency.set(row.key, row.orderId as DigitalOrder['orderId']);
  }
  return target;
}

export function encodeSnapshot(snapshot: ExchangeCoreSnapshot): string {
  return JSON.stringify(snapshot, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function decodeSnapshot(raw: string): ExchangeCoreSnapshot {
  const parsed = JSON.parse(raw, reviveExchangeValue) as ExchangeCoreSnapshot;
  if (parsed.schema !== 'sunrey-exchange-core/1') {
    throw new Error('unsupported Exchange core snapshot schema');
  }
  return parsed;
}

function reviveExchangeValue(key: string, value: unknown): unknown {
  if (
    typeof value === 'string' &&
    /^-?\d+$/.test(value) &&
    (key === 'scaledUnits' ||
      key === 'minorUnits' ||
      key === 'priceUnits' ||
      key === 'makerFeeMinor' ||
      key === 'takerFeeMinor' ||
      key === 'listingFeeMinor' ||
      key === 'computeFeeMinor' ||
      key === 'makerBps' ||
      key === 'takerBps' ||
      key === 'listingBps' ||
      key === 'priceIncrement' ||
      key === 'quantityIncrement' ||
      key === 'minimumOrderSize' ||
      key === 'maximumOrderSize' ||
      key === 'minimumNotional' ||
      key === 'maximumNotional' ||
      key === 'maxSlippageUnits' ||
      key === 'maxNotionalMinor')
  ) {
    return BigInt(value);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.scaledUnits === 'bigint' && typeof record.assetId === 'string') {
      return AssetQuantity.fromScaledUnits(record.scaledUnits, record.assetId);
    }
    if (typeof record.minorUnits === 'bigint' && typeof record.currency === 'string') {
      return Money.fromMinorUnits(record.minorUnits, record.currency as Money['currency']);
    }
  }
  void (null as ExchangePrice | null);
  return value;
}
