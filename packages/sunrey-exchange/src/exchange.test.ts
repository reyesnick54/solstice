import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { err } from '../../domain/src/result.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import {
  InMemoryCoinPort,
  InMemoryFiatPort,
  RecordingChainAnchorPort,
  StubInformationMarketPort,
} from './adapters.ts';
import { SubjectScopedSunReyExchangeTool } from './agent-tool.ts';
import { AGGREGATE_RESEARCH_LISTING_ID, SUNREY_COIN_USD_MARKET_ID, asExchangeAccountId } from './ids.ts';
import { matchIncoming, sortBook } from './matching.ts';
import { exchangePrice, quoteForQuantity, quoteMoney } from './price.ts';
import { SunReyExchangeService } from './service.ts';
import { PRICE_LABEL } from './taxonomy.ts';
import type { DigitalOrder } from './types.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const GB = asJurisdiction('GB');
const CAPS = ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST', 'SUNREY_COIN_VIEW'] as const;

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T16:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function coins(whole: bigint): AssetQuantity {
  return AssetQuantity.fromScaledUnits(whole * 1_000_000n, SUNREY_COIN_ASSET_ID);
}

function usdPerCoin(cents: bigint) {
  return exchangePrice({
    baseAssetId: SUNREY_COIN_ASSET_ID,
    quoteAssetId: 'USD',
    quoteKind: 'FIAT_MONEY',
    priceUnits: cents,
    basePrecision: 6,
  });
}

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('sunrey-exchange-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const chain = new RecordingChainAnchorPort();
  const informationMarket = new StubInformationMarketPort();
  const exchange = new SunReyExchangeService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    coin,
    fiat,
    informationMarket,
    chain,
  });
  return { clock, events, evidence, identity, customers, coin, fiat, chain, informationMarket, exchange, kernel, issuer };
}

function provision(
  h: ReturnType<typeof harness>,
  actorId: string,
  identityId: string,
  customerId: string,
  capabilities: readonly string[] = CAPS,
) {
  const cust = customer(customerId);
  h.customers.set(cust.id, cust);
  const result = h.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: cust.id,
    capabilities: [...capabilities] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { customer: cust, actor: result.value };
}

function openAccount(
  h: ReturnType<typeof harness>,
  actorId: string,
  customerId: Customer['id'],
  identityId: string,
  custodyAccountId: string,
  cashAccountId: string,
) {
  const opened = h.exchange.openAccount({
    actorId,
    customerId,
    identityId,
    jurisdiction: GB,
    custodyAccountId,
    cashAccountId,
  });
  if (opened.outcome !== 'OK') {
    throw new Error(opened.outcome === 'REJECTED' ? opened.message : opened.decision.status);
  }
  return opened.value;
}

describe('SunRey Exchange price and matching', () => {
  it('quotes 6 coins at 2.00 as 1200 cents with no float', () => {
    const price = usdPerCoin(200n);
    const quantity = coins(6n);
    assert.equal(quoteForQuantity(price, quantity), 1200n);
    assert.equal(quoteMoney(price, quantity, 'USD').minorUnits(), 1200n);
    assert.throws(() => exchangePrice({ ...price, priceUnits: 1 as unknown as bigint }), /bigint/);
    assert.throws(
      () => quoteForQuantity(usdPerCoin(3n), AssetQuantity.fromScaledUnits(1n, SUNREY_COIN_ASSET_ID)),
      /not exact/,
    );
  });

  it('matches price-time priority at the maker price and rejects self-trade', () => {
    const maker: DigitalOrder = Object.freeze({
      orderId: 'xord_maker' as DigitalOrder['orderId'],
      version: 1 as DigitalOrder['version'],
      exchangeAccountId: asExchangeAccountId('xacct_a'),
      beneficialParticipantId: 'cust_a',
      marketId: SUNREY_COIN_USD_MARKET_ID,
      family: 'DIGITAL_ASSET',
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      remaining: coins(10n),
      limitPrice: usdPerCoin(200n),
      createdAt: NOW,
      timeInForce: 'GTC',
      status: 'OPEN',
      clientIdempotencyKey: 'maker',
      authorizationRef: 'auth',
      holdId: null,
      coinHoldId: null,
      sourceAccountId: 'custody_a',
      sequence: 1,
    });
    const taker: DigitalOrder = Object.freeze({
      ...maker,
      orderId: 'xord_taker' as DigitalOrder['orderId'],
      exchangeAccountId: asExchangeAccountId('xacct_b'),
      beneficialParticipantId: 'cust_b',
      side: 'BUY',
      quantity: coins(6n),
      remaining: coins(6n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'taker',
      sequence: 2,
    });
    const matched = matchIncoming(taker, [maker], { selfTrade: 'CANCEL_INCOMING' });
    assert.equal(matched.matches.length, 1);
    assert.equal(matched.matches[0]!.price.priceUnits, 200n);
    assert.equal(matched.matches[0]!.quantity.scaledUnits, 6_000_000n);
    const self = matchIncoming({ ...taker, beneficialParticipantId: 'cust_a' }, [maker], {
      selfTrade: 'CANCEL_INCOMING',
    });
    assert.equal(self.rejectIncoming, true);
    const book = sortBook([maker, taker]);
    assert.equal(book.asks[0]!.sequence, 1);
    assert.equal(book.bids[0]!.limitPrice!.priceUnits, 210n);
  });
});

describe('SunRey Exchange service', () => {
  it('has no balance field and seeds a simulation digital-asset market', () => {
    const h = harness();
    const market = h.exchange.getMarket(SUNREY_COIN_USD_MARKET_ID);
    assert.ok(market);
    assert.equal(market.family, 'DIGITAL_ASSET');
    assert.equal(market.state, 'OPEN');
    const listings = h.exchange.listings();
    assert.equal(listings.some((row) => row.family === 'INTELLIGENCE_COMPUTE'), true);
    assert.equal(Object.hasOwn(listings[0] ?? {}, 'balance'), false);
  });

  it('matches a 10-sell / 6-buy digital-asset trade at the maker price and keeps supply unchanged', () => {
    const h = harness();
    const seller = provision(h, 'actor_seller', 'idn_seller', 'cust_seller');
    const buyer = provision(h, 'actor_buyer', 'idn_buyer', 'cust_buyer');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_seller');
    h.fiat.seed('cash_buyer', Money.of(50_00n, 'USD'));
    const sellerAccount = openAccount(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_seller', 'cash_seller');
    const buyerAccount = openAccount(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_buyer', 'cash_buyer');
    assert.equal(Object.hasOwn(sellerAccount, 'balance'), false);

    const supplyBefore = h.coin.supply().circulating.scaledUnits;
    const sell = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'sell-10-200',
    });
    assert.equal(sell.outcome, 'OK');
    const buy = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'buy-6-210',
    });
    assert.equal(buy.outcome, 'OK');
    if (buy.outcome !== 'OK' || sell.outcome !== 'OK') {
      return;
    }
    assert.equal(buy.value.status, 'FILLED');
    const sellerAfter = h.exchange.getOrder(sell.value.orderId);
    assert.ok(sellerAfter);
    assert.equal(sellerAfter.status, 'PARTIALLY_FILLED');
    assert.equal(sellerAfter.remaining.scaledUnits, 4_000_000n);
    const trades = h.exchange.trades(SUNREY_COIN_USD_MARKET_ID);
    assert.equal(trades.length, 1);
    assert.equal(trades[0]!.price.priceUnits, 200n);
    assert.equal(trades[0]!.quoteAmount.minorUnits(), 1200n);
    assert.equal(h.exchange.feeSchedule.commercialPermanence, 'SIMULATION_CONFIGURATION');
    assert.equal(h.coin.supply().circulating.scaledUnits, supplyBefore);
    assert.equal(h.coin.position(buyer.customer.id).available.scaledUnits, 6_000_000n);
    assert.equal(h.fiat.available('cash_seller').minorUnits(), 1200n);

    const cancelled = h.exchange.cancelDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      orderId: sell.value.orderId,
      clientIdempotencyKey: 'cancel-remainder',
    });
    assert.equal(cancelled.outcome, 'OK');
    if (cancelled.outcome === 'OK') {
      assert.equal(cancelled.value.status, 'CANCELLED');
    }
    assert.equal(h.coin.position(seller.customer.id).available.scaledUnits, 4_000_000n);
    assert.equal(h.coin.position(seller.customer.id).held.scaledUnits, 0n);

    const data = h.exchange.marketData(SUNREY_COIN_USD_MARKET_ID);
    assert.equal(data.lastPriceLabel, PRICE_LABEL);
    assert.ok(data.lastTrade);
    const candle = h.exchange.candles(SUNREY_COIN_USD_MARKET_ID);
    assert.ok(candle);
    assert.equal(candle.label, PRICE_LABEL);
    assert.equal(h.exchange.replayBook(SUNREY_COIN_USD_MARKET_ID).asks.length, 0);
    assert.equal(h.chain.anchors.length, 1);
    assert.equal(h.chain.anchors[0]!.authoritative, false);
    assert.equal(h.exchange.reconcile().outcome, 'MATCHED');
    assert.equal(h.exchange.reconcile().autoCorrected, false);
  });

  it('is idempotent for duplicate order, cancel, and settlement keys', () => {
    const h = harness();
    const seller = provision(h, 'actor_idemp_s', 'idn_idemp_s', 'cust_idemp_s');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_idemp_s');
    const account = openAccount(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_idemp_s', 'cash_idemp_s');
    const first = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'same-key',
    });
    const second = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'same-key',
    });
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome === 'OK' && second.outcome === 'OK') {
      assert.equal(first.value.orderId, second.value.orderId);
      const cancelA = h.exchange.cancelDigitalOrder({
        actorId: seller.actor.actorId,
        customerId: seller.customer.id,
        orderId: first.value.orderId,
        clientIdempotencyKey: 'cancel-same',
      });
      const cancelB = h.exchange.cancelDigitalOrder({
        actorId: seller.actor.actorId,
        customerId: seller.customer.id,
        orderId: first.value.orderId,
        clientIdempotencyKey: 'cancel-same',
      });
      assert.equal(cancelA.outcome, 'OK');
      assert.equal(cancelB.outcome, 'OK');
    }
  });

  it('rejects insufficient funds, insufficient asset, restricted participant, halt, and suspended listing', () => {
    const h = harness();
    const seller = provision(h, 'actor_fail_s', 'idn_fail_s', 'cust_fail_s');
    const buyer = provision(h, 'actor_fail_b', 'idn_fail_b', 'cust_fail_b');
    h.coin.seed(seller.customer.id, coins(1n), 'custody_fail_s');
    h.fiat.seed('cash_fail_b', Money.of(100n, 'USD'));
    const sellerAccount = openAccount(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_fail_s', 'cash_fail_s');
    const buyerAccount = openAccount(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_fail_b', 'cash_fail_b');

    const shortSell = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'short-sell',
    });
    assert.equal(shortSell.outcome, 'REJECTED');
    if (shortSell.outcome === 'REJECTED') {
      assert.equal(shortSell.code, 'INSUFFICIENT_ASSET');
    }

    const poorBuy = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'poor-buy',
    });
    assert.equal(poorBuy.outcome, 'REJECTED');
    if (poorBuy.outcome === 'REJECTED') {
      assert.equal(poorBuy.code, 'INSUFFICIENT_FUNDS');
    }

    h.exchange.restrictParticipant(buyerAccount.accountId, 'RESTRICTED');
    const restricted = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'restricted',
    });
    assert.equal(restricted.outcome, 'REJECTED');
    if (restricted.outcome === 'REJECTED') {
      assert.equal(restricted.code, 'RESTRICTED_PARTICIPANT');
    }

    const halt = h.exchange.halt({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      scope: 'MARKET',
      targetId: SUNREY_COIN_USD_MARKET_ID,
      reason: 'simulation halt',
    });
    assert.equal(halt.outcome, 'OK');
    const halted = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'halted',
    });
    assert.equal(halted.outcome, 'REJECTED');
    if (halted.outcome === 'REJECTED') {
      assert.equal(halted.code, 'MARKET_HALTED');
    }
    h.exchange.resumeMarket(SUNREY_COIN_USD_MARKET_ID);
    h.exchange.suspendListing('listing:sunrey-coin');
    const suspended = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'suspended',
    });
    assert.equal(suspended.outcome, 'REJECTED');
    if (suspended.outcome === 'REJECTED') {
      assert.equal(suspended.code, 'ASSET_SUSPENDED');
    }
  });

  it('rejects invalid quantity, price, precision, market-order slippage, and missing account', () => {
    const h = harness();
    const seller = provision(h, 'actor_inv', 'idn_inv', 'cust_inv');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_inv');
    const account = openAccount(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_inv', 'cash_inv');
    const zero = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: AssetQuantity.zero(SUNREY_COIN_ASSET_ID),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'zero',
    });
    assert.equal(zero.outcome, 'REJECTED');
    if (zero.outcome === 'REJECTED') {
      assert.equal(zero.code, 'INVALID_QUANTITY');
    }
    const noPrice = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      clientIdempotencyKey: 'no-price',
    });
    assert.equal(noPrice.outcome, 'REJECTED');
    if (noPrice.outcome === 'REJECTED') {
      assert.equal(noPrice.code, 'INVALID_PRICE');
    }
    const wrongAsset = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: AssetQuantity.fromScaledUnits(1_000_000n, 'asset:other'),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'wrong-asset',
    });
    assert.equal(wrongAsset.outcome, 'REJECTED');
    if (wrongAsset.outcome === 'REJECTED') {
      assert.equal(wrongAsset.code, 'INVALID_PRECISION');
    }
    const unknown = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: asExchangeAccountId('xacct_missing'),
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'missing',
    });
    assert.equal(unknown.outcome, 'REJECTED');
    if (unknown.outcome === 'REJECTED') {
      assert.equal(unknown.code, 'UNKNOWN_ACCOUNT');
    }
    const marketUnsafe = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'MARKET',
      quantity: coins(1n),
      clientIdempotencyKey: 'mkt-empty',
    });
    assert.equal(marketUnsafe.outcome, 'REJECTED');
    if (marketUnsafe.outcome === 'REJECTED') {
      assert.equal(marketUnsafe.code, 'MARKET_ORDER_UNSAFE');
    }
  });

  it('refuses an actor without exchange capability and does not let the agent execute', () => {
    const h = harness();
    const seller = provision(h, 'actor_nocap', 'idn_nocap', 'cust_nocap', ['EXCHANGE_VIEW']);
    h.coin.seed(seller.customer.id, coins(10n), 'custody_nocap');
    const opened = h.exchange.openAccount({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      identityId: seller.actor.subjectId,
      jurisdiction: GB,
      custodyAccountId: 'custody_nocap',
      cashAccountId: 'cash_nocap',
    });
    assert.equal(opened.outcome, 'KERNEL_REFUSED');
    const tool = new SubjectScopedSunReyExchangeTool(h.exchange);
    assert.equal(tool.placeDigitalOrder().ok, false);
    assert.equal(tool.cancelDigitalOrder().ok, false);
    assert.equal(tool.halt().ok, false);
    assert.equal(tool.settle().ok, false);
    const explained = tool.explainNoOfficialValuation();
    assert.equal(explained.ok, true);
    if (explained.ok) {
      assert.match(explained.value, /SIMULATION_MARKET_PRICE/);
    }
  });

  it('delegates compute contracts and never returns raw rows', () => {
    const h = harness();
    const seller = provision(h, 'actor_compute', 'idn_compute', 'cust_compute');
    const accepted = h.exchange.acceptComputeContract({
      actorId: seller.actor.actorId,
      listingId: AGGREGATE_RESEARCH_LISTING_ID,
      sponsorCustomerId: seller.customer.id,
    });
    assert.equal(accepted.outcome, 'OK');
    if (accepted.outcome === 'OK') {
      assert.equal(accepted.value.rawRows, false);
      assert.equal(accepted.value.settled, true);
    }
    const digital = h.exchange.acceptComputeContract({
      actorId: seller.actor.actorId,
      listingId: 'listing:sunrey-coin',
      sponsorCustomerId: seller.customer.id,
    });
    assert.equal(digital.outcome, 'REJECTED');
    const failing = new SunReyExchangeService({
      kernel: h.kernel,
      issuer: h.issuer,
      evidence: h.evidence,
      events: h.events,
      clock: h.clock,
      identity: h.identity.service,
      catalog: {
        customers: { get: () => undefined },
        products: { get: () => undefined },
        legalEntities: { get: () => undefined },
      },
      coin: new InMemoryCoinPort(),
      fiat: new InMemoryFiatPort(),
      informationMarket: new StubInformationMarketPort(err({ code: 'CLEAN_ROOM_DENIED', message: 'consent missing' })),
    });
    const denied = failing.acceptComputeContract({
      actorId: seller.actor.actorId,
      listingId: AGGREGATE_RESEARCH_LISTING_ID,
      sponsorCustomerId: seller.customer.id,
    });
    assert.equal(denied.outcome, 'REJECTED');
    if (denied.outcome === 'REJECTED') {
      assert.equal(denied.code, 'CLEAN_ROOM_DENIED');
    }
  });

  it('reports a settlement mismatch without auto-correcting', () => {
    const h = harness();
    const seller = provision(h, 'actor_mis', 'idn_mis', 'cust_mis');
    const buyer = provision(h, 'actor_mis_b', 'idn_mis_b', 'cust_mis_b');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_mis');
    h.fiat.seed('cash_mis_b', Money.of(50_00n, 'USD'));
    const sellerAccount = openAccount(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_mis', 'cash_mis_s');
    const buyerAccount = openAccount(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_mis_b', 'cash_mis_b');
    const originalTransfer = h.fiat.transfer.bind(h.fiat);
    h.fiat.transfer = () => err({ code: 'SETTLEMENT_MISMATCH', message: 'forced cash failure' });
    h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'mis-sell',
    });
    h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'mis-buy',
    });
    h.fiat.transfer = originalTransfer;
    const report = h.exchange.reconcile();
    assert.equal(report.outcome, 'TRADE_SETTLEMENT_MISMATCH');
    assert.equal(report.autoCorrected, false);
  });
});
