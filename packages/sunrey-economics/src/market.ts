/**
 * Deterministic SUNREY_COIN / MOONREY_COIN market.
 *
 * Price formation uses the canonical Exchange matching engine
 * (price-time priority, maker price). There is no hard-coded peg.
 */

import { asUtcInstant } from '../../domain/src/time.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import {
  asExchangeAccountId,
  asOrderId,
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from '../../sunrey-exchange/src/ids.ts';
import { applyFill, matchIncoming, sortBook } from '../../sunrey-exchange/src/matching.ts';
import { exchangePrice, quoteAssetQuantity } from '../../sunrey-exchange/src/price.ts';
import { sunreyMoonreyMarket } from '../../sunrey-exchange/src/native-clearing/markets.ts';
import type { DigitalOrder } from '../../sunrey-exchange/src/types.ts';
import { ACTOR_CLASSES, EXCHANGE_MARKET_ID, type ActorClass } from './ids.ts';
import { DeterministicRng, mulBps, ratioBps } from './seed.ts';
import type { DualEconomyMarketState, DualEconomyScenario } from './types.ts';

export type MarketBalances = {
  sunrey: Map<string, bigint>;
  moonrey: Map<string, bigint>;
};

export type DualMarketEngine = {
  readonly marketId: typeof EXCHANGE_MARKET_ID;
  readonly listing: ReturnType<typeof sunreyMoonreyMarket>;
  lastPriceUnits: bigint | null;
  trades: Array<{ readonly priceUnits: bigint; readonly quantity: bigint; readonly quote: bigint }>;
  orders: DigitalOrder[];
  sequence: number;
  conservedBase: bigint;
  conservedQuote: bigint;
  balances: MarketBalances;
};

export function createMarket(scenario: DualEconomyScenario): DualMarketEngine {
  const listing = sunreyMoonreyMarket();
  if (listing.marketId !== SUNREY_MOONREY_MARKET_ID) {
    throw new Error('canonical SUNREY_COIN/MOONREY_COIN market required');
  }
  const balances: MarketBalances = { sunrey: new Map(), moonrey: new Map() };
  for (const actor of ACTOR_CLASSES) {
    const sunrey = actor === 'MARKET_MAKER_SIMULATION_ACTOR' ? scenario.market.makerInventorySunrey : scenario.market.orderSize * 20n;
    const moonrey = actor === 'MARKET_MAKER_SIMULATION_ACTOR' ? scenario.market.makerInventoryMoonrey : scenario.market.orderSize * 40n;
    balances.sunrey.set(actor, sunrey);
    balances.moonrey.set(actor, moonrey);
  }
  const conservedBase = [...balances.sunrey.values()].reduce((sum, value) => sum + value, 0n);
  const conservedQuote = [...balances.moonrey.values()].reduce((sum, value) => sum + value, 0n);
  return {
    marketId: EXCHANGE_MARKET_ID,
    listing,
    lastPriceUnits: scenario.market.startingPriceUnits,
    trades: [],
    orders: [],
    sequence: 0,
    conservedBase,
    conservedQuote,
    balances,
  };
}

export function runMarketEpoch(engine: DualMarketEngine, scenario: DualEconomyScenario, rng: DeterministicRng, epoch: number): DualEconomyMarketState {
  const now = asUtcInstant(`2026-08-17T12:${String(epoch).padStart(2, '0')}:00.000Z`);
  const mid = engine.lastPriceUnits ?? scenario.market.startingPriceUnits;
  const actors: readonly ActorClass[] = [
    'MARKET_MAKER_SIMULATION_ACTOR',
    'HOUSEHOLD',
    'HUMAN_ENTREPRENEUR',
    'AI_OPERATOR',
    'ENERGY_PRODUCER',
    'COMPUTE_PROVIDER',
    'TREASURY_SIMULATION_ACTOR',
  ];
  for (const actor of actors) {
    const side: 'BUY' | 'SELL' = actor === 'HOUSEHOLD' || actor === 'HUMAN_ENTREPRENEUR' ? 'BUY' : actor === 'ENERGY_PRODUCER' || actor === 'COMPUTE_PROVIDER' ? 'SELL' : rng.nextBounded(2) === 0 ? 'BUY' : 'SELL';
    const spread = actor === 'MARKET_MAKER_SIMULATION_ACTOR' ? scenario.market.makerSpreadBps : scenario.market.volatilityBps;
    const priceUnits = rng.jitterBps(mid, spread);
    placeLimit(engine, actor, side, scenario.market.orderSize, priceUnits < 1n ? 1n : priceUnits, now);
  }
  const book = sortBook(engine.orders);
  const bestBid = book.bids[0]?.limitPrice?.priceUnits ?? null;
  const bestAsk = book.asks[0]?.limitPrice?.priceUnits ?? null;
  const spreadBps = bestBid !== null && bestAsk !== null && bestBid > 0n ? ratioBps(bestAsk - bestBid, bestBid) : null;
  const epochTrades = engine.trades.slice(-16);
  const volumeBase = epochTrades.reduce((sum, trade) => sum + trade.quantity, 0n);
  const volumeQuote = epochTrades.reduce((sum, trade) => sum + trade.quote, 0n);
  const impact = epochTrades.length >= 2 && epochTrades[0] ? ratioBps((engine.lastPriceUnits ?? mid) - epochTrades[0].priceUnits, epochTrades[0].priceUnits) : 0n;
  const sunreyLiquidity = book.asks.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n);
  const moonreyLiquidity = book.bids.reduce((sum, order) => {
    const price = order.limitPrice;
    return price ? sum + quoteAssetQuantity(price, order.remaining).scaledUnits : sum;
  }, 0n);
  return Object.freeze({
    marketId: EXCHANGE_MARKET_ID,
    lastPriceUnits: engine.lastPriceUnits,
    bestBid,
    bestAsk,
    spreadBps: spreadBps !== null && spreadBps < 0n ? -spreadBps : spreadBps,
    bidDepth: book.bids.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n),
    askDepth: sunreyLiquidity,
    volumeBase,
    volumeQuote,
    turnover: volumeBase + volumeQuote,
    priceImpactBps: impact < 0n ? -impact : impact,
    trades: epochTrades.length,
    priceDiscovery: 'SIMULATION_ORDER_FLOW_ONLY',
    sunreyLiquidity,
    moonreyLiquidity,
  });
}

function placeLimit(
  engine: DualMarketEngine,
  actor: ActorClass,
  side: 'BUY' | 'SELL',
  quantityUnits: bigint,
  priceUnits: bigint,
  now: ReturnType<typeof asUtcInstant>,
): void {
  const price = exchangePrice({
    baseAssetId: SUNREY_COIN_NATIVE_ASSET_ID,
    quoteAssetId: MOONREY_COIN_NATIVE_ASSET_ID,
    quoteKind: 'ASSET',
    priceUnits,
    quoteScale: 0,
    basePrecision: 6,
    rounding: 'FLOOR',
  });
  const quantity = AssetQuantity.fromScaledUnits(quantityUnits, SUNREY_COIN_NATIVE_ASSET_ID);
  const quote = quoteAssetQuantity(price, quantity);
  if (side === 'SELL' && (engine.balances.sunrey.get(actor) ?? 0n) < quantityUnits) {
    return;
  }
  if (side === 'BUY' && (engine.balances.moonrey.get(actor) ?? 0n) < quote.scaledUnits) {
    return;
  }
  engine.sequence += 1;
  const incoming: DigitalOrder = Object.freeze({
    orderId: asOrderId(`xord_${actor}_${engine.sequence}`),
    version: 1 as DigitalOrder['version'],
    exchangeAccountId: asExchangeAccountId(`xacct_${actor}`),
    beneficialParticipantId: actor,
    marketId: SUNREY_MOONREY_MARKET_ID,
    family: 'DIGITAL_ASSET',
    side,
    orderType: 'LIMIT',
    quantity,
    remaining: quantity,
    limitPrice: price,
    createdAt: now,
    timeInForce: 'GTC',
    status: 'OPEN',
    clientIdempotencyKey: `idem_${actor}_${engine.sequence}`,
    authorizationRef: null,
    holdId: null,
    coinHoldId: null,
    sourceAccountId: `cust_${actor}`,
    sequence: engine.sequence,
  });
  const matched = matchIncoming(incoming, engine.orders, { selfTrade: 'CANCEL_INCOMING' });
  if (matched.rejectIncoming) {
    return;
  }
  let taker = incoming;
  for (const match of matched.matches) {
    settleDvp(engine, match.taker.beneficialParticipantId, match.maker.beneficialParticipantId, match.taker.side, match.quantity.scaledUnits, quoteAssetQuantity(match.price, match.quantity).scaledUnits);
    engine.orders = engine.orders.map((order) => (order.orderId === match.maker.orderId ? applyFill(order, match.quantity) : order));
    taker = applyFill(taker, match.quantity);
    engine.lastPriceUnits = match.price.priceUnits;
    engine.trades.push({
      priceUnits: match.price.priceUnits,
      quantity: match.quantity.scaledUnits,
      quote: quoteAssetQuantity(match.price, match.quantity).scaledUnits,
    });
  }
  engine.orders = engine.orders.filter((order) => order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED');
  if (taker.status === 'OPEN' || taker.status === 'PARTIALLY_FILLED') {
    engine.orders.push(taker);
  }
}

function settleDvp(engine: DualMarketEngine, taker: string, maker: string, takerSide: 'BUY' | 'SELL', base: bigint, quote: bigint): void {
  const buyer = takerSide === 'BUY' ? taker : maker;
  const seller = takerSide === 'BUY' ? maker : taker;
  debit(engine.balances.moonrey, buyer, quote);
  credit(engine.balances.moonrey, seller, quote);
  debit(engine.balances.sunrey, seller, base);
  credit(engine.balances.sunrey, buyer, base);
}

function debit(book: Map<string, bigint>, actor: string, amount: bigint): void {
  const next = (book.get(actor) ?? 0n) - amount;
  if (next < 0n) {
    throw new Error(`DVP debit would go negative for ${actor}`);
  }
  book.set(actor, next);
}

function credit(book: Map<string, bigint>, actor: string, amount: bigint): void {
  book.set(actor, (book.get(actor) ?? 0n) + amount);
}

export function marketConserves(engine: DualMarketEngine): boolean {
  const base = [...engine.balances.sunrey.values()].reduce((sum, value) => sum + value, 0n);
  const quote = [...engine.balances.moonrey.values()].reduce((sum, value) => sum + value, 0n);
  return base === engine.conservedBase && quote === engine.conservedQuote;
}

export function holderShares(book: Map<string, bigint>): bigint[] {
  return [...book.values()];
}

export function priceVolatilityBps(engine: DualMarketEngine): bigint {
  if (engine.trades.length < 2) {
    return 0n;
  }
  const prices = engine.trades.map((trade) => trade.priceUnits);
  const min = prices.reduce((left, right) => (left < right ? left : right));
  const max = prices.reduce((left, right) => (left > right ? left : right));
  return ratioBps(max - min, min === 0n ? 1n : min);
}
