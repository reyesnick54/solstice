import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { DurableExchangeCoreStore } from '../../../persistence/src/exchange/durable-core-store.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../../sunrey-coin/src/ids.ts';
import { InMemoryCoinPort, InMemoryFiatPort } from '../adapters.ts';
import { SubjectScopedSunReyExchangeTool } from '../agent-tool.ts';
import { asExchangeAccountId, SUNREY_COIN_USD_MARKET_ID } from '../ids.ts';
import { matchIncoming } from '../matching.ts';
import { exchangePrice } from '../price.ts';
import { SunReyExchangeService } from '../service.ts';
import type { DigitalOrder } from '../types.ts';
import {
  EXCHANGE_CORE_POSTURE,
  MatchingSequencer,
  canTransitionOrder,
  captureExchangeCore,
  decodeSnapshot,
  encodeSnapshot,
  feeFromNotional,
  hydrateExchangeStore,
  priceWithinBand,
  productizeFeeSchedule,
  rejectClientFeeOverride,
  replayAcceptedOrders,
  resolveCancelFillRace,
  transitionOrder,
  validatePreTrade,
} from './index.ts';
import { measureExchangeCore } from './performance.ts';

const NOW = asUtcInstant('2026-08-23T06:00:00.000Z');
const GB = asJurisdiction('GB');
const CAPS = ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST', 'SUNREY_COIN_VIEW'] as const;

function customer(id: string, kyc: Customer['verification']['kycState'] = 'VERIFIED'): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: kyc,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-23T06:00:00.000Z'),
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

function harness(fee?: { makerBps: bigint; takerBps: bigint }) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('exchange-core-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
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
    feeSchedule: fee
      ? {
          scheduleId: 'fees:simulation-v1' as never,
          version: 1,
          makerFeeMinor: 0n,
          takerFeeMinor: 0n,
          listingFeeMinor: 0n,
          computeFeeMinor: 0n,
          makerBps: fee.makerBps,
          takerBps: fee.takerBps,
          commercialPermanence: 'SIMULATION_CONFIGURATION',
        }
      : undefined,
  });
  return { events, evidence, identity, customers, coin, fiat, exchange };
}

function provision(h: ReturnType<typeof harness>, actorId: string, identityId: string, customerId: string) {
  const cust = customer(customerId);
  h.customers.set(cust.id, cust);
  const result = h.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: cust.id,
    capabilities: [...CAPS] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { customer: cust, actor: result.value };
}

function openExchange(
  h: ReturnType<typeof harness>,
  actorId: string,
  customerId: Customer['id'],
  identityId: string,
  custodyAccountId: string,
  cashAccountId: string,
) {
  const opened = h.exchange.openExchangeAccount({
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

describe('Phase G Exchange production core', () => {
  it('keeps production and live trading disabled', () => {
    assert.equal(EXCHANGE_CORE_POSTURE.CORE_CODE_COMPLETE_CANDIDATE, true);
    assert.equal(EXCHANGE_CORE_POSTURE.PRODUCTION_READY, false);
    assert.equal(EXCHANGE_CORE_POSTURE.PRODUCTION_ACTIVE, false);
    assert.equal(EXCHANGE_CORE_POSTURE.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(EXCHANGE_CORE_POSTURE.production_authorized, false);
    assert.equal(EXCHANGE_CORE_POSTURE.LIVE_TRADING_ENABLED, false);
  });

  it('productizes the instrument registry with server-authoritative status', () => {
    const h = harness();
    const instruments = h.exchange.productizedInstruments();
    const spot = instruments.find((row) => row.marketId === SUNREY_COIN_USD_MARKET_ID);
    assert.ok(spot);
    assert.equal(spot.baseAsset, SUNREY_COIN_ASSET_ID);
    assert.equal(spot.quoteAsset, 'USD');
    assert.equal(spot.marketType, 'SPOT');
    assert.equal(spot.status, 'OPEN');
    assert.equal(spot.priceIncrement, 1n);
    assert.ok(spot.quantityIncrement > 0n);
    assert.ok(spot.minimumOrderSize > 0n);
    assert.equal(spot.custodyRequirements, 'SIMULATION_CUSTODY');
    assert.equal(spot.liveTradingEnabled, false);
    h.exchange.setAuthoritativeMarketState(SUNREY_COIN_USD_MARKET_ID, 'SUSPENDED');
    assert.equal(h.exchange.productizedInstruments().find((row) => row.marketId === SUNREY_COIN_USD_MARKET_ID)?.status, 'SUSPENDED');
  });

  it('rejects invalid tick size, quantity increment, and client fee override', () => {
    const h = harness();
    const seller = provision(h, 'actor_tick', 'idn_tick', 'cust_tick');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_tick');
    const account = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_tick', 'cash_tick');
    const instrument = h.exchange.productizedInstruments().find((row) => row.marketId === SUNREY_COIN_USD_MARKET_ID)!;
    instrument && h.exchange.instruments.put({ ...instrument, priceIncrement: 5n, quantityIncrement: 2_000_000n });
    const tick = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(2n),
      limitPrice: usdPerCoin(201n),
      clientIdempotencyKey: 'bad-tick',
    });
    assert.equal(tick.outcome, 'REJECTED');
    if (tick.outcome === 'REJECTED') {
      assert.equal(tick.code, 'INVALID_TICK_SIZE');
    }
    const qty = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'bad-qty',
    });
    assert.equal(qty.outcome, 'REJECTED');
    if (qty.outcome === 'REJECTED') {
      assert.equal(qty.code, 'INVALID_QUANTITY');
    }
    const fee = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(2n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'fee-override',
      feeOverride: { takerBps: 0n },
    });
    assert.equal(fee.outcome, 'REJECTED');
    if (fee.outcome === 'REJECTED') {
      assert.equal(fee.code, 'CLIENT_FEE_OVERRIDE_FORBIDDEN');
    }
    assert.equal(rejectClientFeeOverride({ feeOverride: 1 }).ok, false);
  });

  it('reserves buy quote plus fees and sell base, and rejects insufficient funds', () => {
    const h = harness({ makerBps: 5n, takerBps: 10n });
    const seller = provision(h, 'actor_rs', 'idn_rs', 'cust_rs');
    const buyer = provision(h, 'actor_rb', 'idn_rb', 'cust_rb');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_rs');
    h.fiat.seed('cash_rb', Money.fromMinorUnits(1_200n, 'USD'));
    const sellerAccount = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_rs', 'cash_rs');
    const buyerAccount = openExchange(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_rb', 'cash_rb');
    const sell = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'reserve-sell',
    });
    assert.equal(sell.outcome, 'OK');
    assert.equal(h.coin.position(seller.customer.id).available.scaledUnits, 0n);
    assert.equal(h.coin.position(seller.customer.id).held.scaledUnits, 10_000_000n);
    const poor = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'reserve-buy-poor',
    });
    assert.equal(poor.outcome, 'REJECTED');
    if (poor.outcome === 'REJECTED') {
      assert.equal(poor.code, 'INSUFFICIENT_FUNDS');
    }
    h.fiat.seed('cash_rb', Money.fromMinorUnits(2n, 'USD'));
    const buy = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'reserve-buy-ok',
    });
    assert.equal(buy.outcome, 'OK');
  });

  it('matches limit and protected market orders, partial and multiple fills, and maker/taker fees', () => {
    const h = harness({ makerBps: 10n, takerBps: 20n });
    const seller = provision(h, 'actor_m1', 'idn_m1', 'cust_m1');
    const seller2 = provision(h, 'actor_m2', 'idn_m2', 'cust_m2');
    const buyer = provision(h, 'actor_mb', 'idn_mb', 'cust_mb');
    h.coin.seed(seller.customer.id, coins(4n), 'custody_m1');
    h.coin.seed(seller2.customer.id, coins(6n), 'custody_m2');
    h.fiat.seed('cash_mb', Money.fromMinorUnits(50_00n, 'USD'));
    const a = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_m1', 'cash_m1');
    const b = openExchange(h, seller2.actor.actorId, seller2.customer.id, seller2.actor.subjectId, 'custody_m2', 'cash_m2');
    const c = openExchange(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_mb', 'cash_mb');
    assert.equal(
      h.exchange.placeDigitalOrder({
        actorId: seller.actor.actorId,
        customerId: seller.customer.id,
        exchangeAccountId: a.accountId,
        marketId: SUNREY_COIN_USD_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: coins(4n),
        limitPrice: usdPerCoin(200n),
        clientIdempotencyKey: 'ask-4',
      }).outcome,
      'OK',
    );
    assert.equal(
      h.exchange.placeDigitalOrder({
        actorId: seller2.actor.actorId,
        customerId: seller2.customer.id,
        exchangeAccountId: b.accountId,
        marketId: SUNREY_COIN_USD_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: coins(6n),
        limitPrice: usdPerCoin(210n),
        clientIdempotencyKey: 'ask-6',
      }).outcome,
      'OK',
    );
    const buy = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: c.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'buy-10',
    });
    assert.equal(buy.outcome, 'OK');
    if (buy.outcome === 'OK') {
      assert.equal(buy.value.status, 'FILLED');
      assert.equal(buy.value.filledQuantity?.scaledUnits, 10_000_000n);
    }
    const trades = h.exchange.trades(SUNREY_COIN_USD_MARKET_ID);
    assert.equal(trades.length, 2);
    assert.equal(trades[0]!.price.priceUnits, 200n);
    assert.equal(trades[1]!.price.priceUnits, 210n);
    assert.equal(trades[0]!.takerFee.minorUnits, feeFromNotional(trades[0]!.quoteAmount.minorUnits, 20n, 0n));
    assert.equal(trades[0]!.makerFee.minorUnits, feeFromNotional(trades[0]!.quoteAmount.minorUnits, 10n, 0n));
    const emptyMarket = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: c.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'MARKET',
      quantity: coins(1n),
      clientIdempotencyKey: 'mkt-empty',
    });
    assert.equal(emptyMarket.outcome, 'REJECTED');
  });

  it('cancels remaining reservations and resolves cancel/fill races without over-release', () => {
    const h = harness();
    const seller = provision(h, 'actor_c', 'idn_c', 'cust_c');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_c');
    const account = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_c', 'cash_c');
    const sell = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'cancel-resting',
    });
    assert.equal(sell.outcome, 'OK');
    if (sell.outcome === 'OK') {
      const cancelled = h.exchange.cancelDigitalOrder({
        actorId: seller.actor.actorId,
        customerId: seller.customer.id,
        orderId: sell.value.orderId,
        clientIdempotencyKey: 'cancel-1',
      });
      assert.equal(cancelled.outcome, 'OK');
      assert.equal(h.coin.position(seller.customer.id).held.scaledUnits, 0n);
      assert.equal(h.coin.position(seller.customer.id).available.scaledUnits, 10_000_000n);
    }
    const fillThenCancel = resolveCancelFillRace({
      state: 'OPEN',
      remainingUnits: 10n,
      originalUnits: 10n,
      events: [
        { kind: 'FILL', orderId: 'o1', sequence: 1, fillUnits: 6n },
        { kind: 'CANCEL', orderId: 'o1', sequence: 2 },
      ],
    });
    assert.equal(fillThenCancel.state, 'CANCELLED');
    assert.equal(fillThenCancel.filledUnits, 6n);
    assert.equal(fillThenCancel.releasedUnits, 4n);
    assert.equal(fillThenCancel.overRelease, false);
    const cancelThenFill = resolveCancelFillRace({
      state: 'OPEN',
      remainingUnits: 10n,
      originalUnits: 10n,
      events: [
        { kind: 'CANCEL', orderId: 'o1', sequence: 1 },
        { kind: 'FILL', orderId: 'o1', sequence: 2, fillUnits: 6n },
      ],
    });
    assert.equal(cancelThenFill.state, 'CANCELLED');
    assert.equal(cancelThenFill.filledUnits, 0n);
    const sequencer = new MatchingSequencer();
    sequencer.beginMatch('o2');
    assert.equal(sequencer.requestCancel('o2').deferred, true);
    assert.equal(sequencer.endMatch('o2'), true);
  });

  it('enforces halt, close-only, price band, and agent mandate', () => {
    const h = harness();
    const seller = provision(h, 'actor_ctl', 'idn_ctl', 'cust_ctl');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_ctl');
    const account = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_ctl', 'cash_ctl');
    h.exchange.setPriceBand({
      marketId: SUNREY_COIN_USD_MARKET_ID,
      referenceUnits: 200n,
      bandBps: 100n,
    });
    const band = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(250n),
      clientIdempotencyKey: 'band',
    });
    assert.equal(band.outcome, 'REJECTED');
    if (band.outcome === 'REJECTED') {
      assert.equal(band.code, 'PRICE_BAND');
    }
    assert.equal(priceWithinBand(201n, { marketId: 'm', referenceUnits: 200n, bandBps: 100n }), true);
    h.exchange.setAuthoritativeMarketState(SUNREY_COIN_USD_MARKET_ID, 'CLOSE_ONLY');
    const closeOnly = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'close-only',
    });
    assert.equal(closeOnly.outcome, 'REJECTED');
    if (closeOnly.outcome === 'REJECTED') {
      assert.equal(closeOnly.code, 'MARKET_CLOSE_ONLY');
    }
    h.exchange.setAuthoritativeMarketState(SUNREY_COIN_USD_MARKET_ID, 'OPEN');
    const halt = h.exchange.halt({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      scope: 'MARKET',
      targetId: SUNREY_COIN_USD_MARKET_ID,
      reason: 'core halt',
    });
    assert.equal(halt.outcome, 'OK');
    const halted = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'halted-core',
    });
    assert.equal(halted.outcome, 'REJECTED');
    h.exchange.resumeMarket(SUNREY_COIN_USD_MARKET_ID);
    const agent = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'agent-order',
      agentGenerated: true,
      agentMandateValid: false,
    });
    assert.equal(agent.outcome, 'REJECTED');
    if (agent.outcome === 'REJECTED') {
      assert.equal(agent.code, 'AGENT_MANDATE_REQUIRED');
    }
  });

  it('is idempotent, blocks cross-user access, and refuses Agent self-execution', () => {
    const h = harness();
    const seller = provision(h, 'actor_id', 'idn_id', 'cust_id');
    const other = provision(h, 'actor_ot', 'idn_ot', 'cust_ot');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_id');
    const account = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_id', 'cash_id');
    const first = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: account.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'same-core',
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
      clientIdempotencyKey: 'same-core',
    });
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome === 'OK' && second.outcome === 'OK') {
      assert.equal(first.value.orderId, second.value.orderId);
      const stolen = h.exchange.cancelDigitalOrder({
        actorId: other.actor.actorId,
        customerId: other.customer.id,
        orderId: first.value.orderId,
        clientIdempotencyKey: 'steal',
      });
      assert.equal(stolen.outcome, 'REJECTED');
      if (stolen.outcome === 'REJECTED') {
        assert.equal(stolen.code, 'OWNERSHIP_MISMATCH');
      }
    }
    const tool = new SubjectScopedSunReyExchangeTool(h.exchange);
    assert.equal(tool.placeDigitalOrder().ok, false);
    assert.equal(tool.matchIncoming().ok, false);
    const proposal = tool.createOrderProposal(
      { kind: 'NOT_AN_ACTOR' },
      { marketId: SUNREY_COIN_USD_MARKET_ID, side: 'BUY', quantityScaled: '1' },
    );
    assert.equal(proposal.ok, false);
  });

  it('survives restart via snapshot and replays matching without duplicating fills', () => {
    const h = harness();
    const seller = provision(h, 'actor_rec', 'idn_rec', 'cust_rec');
    const buyer = provision(h, 'actor_recb', 'idn_recb', 'cust_recb');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_rec');
    h.fiat.seed('cash_recb', Money.fromMinorUnits(50_00n, 'USD'));
    const sellerAccount = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_rec', 'cash_rec');
    const buyerAccount = openExchange(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_recb', 'cash_recb');
    h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'rec-sell',
    });
    h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'rec-buy',
    });
    const snapshot = h.exchange.exportCoreSnapshot();
    assert.equal(snapshot.productionActive, false);
    assert.equal(snapshot.trades.length, 1);
    const encoded = encodeSnapshot(snapshot);
    const decoded = decodeSnapshot(encoded);
    const restored = new SunReyExchangeService({
      kernel: new ComplianceKernel(new AuthorityIssuer('restore'), new EvidenceVault(new FrozenClock(NOW)), new FrozenClock(NOW)),
      issuer: new AuthorityIssuer('restore'),
      evidence: new EvidenceVault(new FrozenClock(NOW)),
      events: new DomainEventLog(),
      clock: new FrozenClock(NOW),
      identity: h.identity.service,
      catalog: {
        customers: { get: (id) => h.customers.get(id) },
        products: { get: () => undefined },
        legalEntities: { get: () => undefined },
      },
      coin: new InMemoryCoinPort(),
      fiat: new InMemoryFiatPort(),
    });
    restored.restoreCoreSnapshot(decoded);
    assert.equal(restored.trades(SUNREY_COIN_USD_MARKET_ID).length, 1);
    const open = restored.replayBook(SUNREY_COIN_USD_MARKET_ID);
    assert.equal(open.asks.length, 1);
    assert.equal(open.asks[0]!.remaining.scaledUnits, 4_000_000n);
    const replay = restored.replayMarket(SUNREY_COIN_USD_MARKET_ID);
    assert.equal(replay.deterministic, true);
    assert.equal(replay.duplicateFills, false);
    assert.equal(replay.trades[0]!.price.priceUnits, 200n);
    const dir = mkdtempSync(join(tmpdir(), 'exchange-core-'));
    const durable = new DurableExchangeCoreStore(dir);
    durable.save(snapshot);
    const reopened = durable.reopen();
    const loaded = reopened.load();
    assert.ok(loaded);
    assert.equal(loaded.trades.length, 1);
    assert.equal(loaded.liveTradingEnabled, false);
  });

  it('validates lifecycle transitions and pre-trade KYC', () => {
    assert.equal(canTransitionOrder('CREATED', 'VALIDATING'), true);
    assert.equal(canTransitionOrder('VALIDATING', 'ACCEPTED'), true);
    assert.equal(canTransitionOrder('OPEN', 'FILLED'), true);
    assert.equal(transitionOrder('FILLED', 'OPEN').ok, false);
    const refused = validatePreTrade({
      actorAuthenticated: true,
      actorOwnsAccount: true,
      account: {
        accountId: asExchangeAccountId('xacct_kyc'),
        customerId: asCustomerId('cust_kyc'),
        identityId: 'idn',
        legalEntityId: 'le',
        jurisdiction: GB,
        custodyAccountId: 'c',
        cashAccountId: 'cash',
        marketPermissions: ['DIGITAL_ASSET'],
        status: 'ACTIVE_SIMULATION',
        createdAt: NOW,
      },
      customer: customer('cust_kyc', 'IN_PROGRESS'),
      instrument: undefined,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(1n),
      limitPrice: usdPerCoin(200n),
      feeSchedule: productizeFeeSchedule({
        scheduleId: 'fees:simulation-v1' as never,
        version: 1,
        makerFeeMinor: 0n,
        takerFeeMinor: 0n,
        listingFeeMinor: 0n,
        computeFeeMinor: 0n,
        commercialPermanence: 'SIMULATION_CONFIGURATION',
      }),
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'KYC_REQUIRED');
    }
  });

  it('replays the same accepted sequence to the same prices', () => {
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
    const first = matchIncoming(taker, [maker], { selfTrade: 'CANCEL_INCOMING' });
    const second = matchIncoming(taker, [maker], { selfTrade: 'CANCEL_INCOMING' });
    assert.equal(first.matches[0]!.price.priceUnits, second.matches[0]!.price.priceUnits);
    assert.equal(first.matches[0]!.quantity.scaledUnits, second.matches[0]!.quantity.scaledUnits);
    const replay = replayAcceptedOrders({
      accepted: [maker, taker],
      feeSchedule: productizeFeeSchedule({
        scheduleId: 'fees:simulation-v1' as never,
        version: 1,
        makerFeeMinor: 0n,
        takerFeeMinor: 0n,
        listingFeeMinor: 0n,
        computeFeeMinor: 0n,
        commercialPermanence: 'SIMULATION_CONFIGURATION',
      }),
      quoteCurrency: 'USD',
    });
    const again = replayAcceptedOrders({
      accepted: [maker, taker],
      feeSchedule: productizeFeeSchedule({
        scheduleId: 'fees:simulation-v1' as never,
        version: 1,
        makerFeeMinor: 0n,
        takerFeeMinor: 0n,
        listingFeeMinor: 0n,
        computeFeeMinor: 0n,
        commercialPermanence: 'SIMULATION_CONFIGURATION',
      }),
      quoteCurrency: 'USD',
    });
    assert.equal(replay.trades[0]!.price.priceUnits, again.trades[0]!.price.priceUnits);
    assert.equal(replay.trades[0]!.quantity.scaledUnits, again.trades[0]!.quantity.scaledUnits);
  });

  it('records a non-production performance baseline', () => {
    const cases = measureExchangeCore({ orders: 64 });
    assert.equal(cases.every((row) => row.productionSlaClaim === false), true);
    assert.ok(cases.some((row) => row.name === 'order_validation'));
    assert.ok(cases.some((row) => row.name === 'matching_latency'));
    assert.ok(cases.some((row) => row.name === 'recovery'));
  });

  it('hydrates an empty store from a captured snapshot', () => {
    const h = harness();
    const snapshot = h.exchange.exportCoreSnapshot();
    const store = hydrateExchangeStore(snapshot);
    assert.ok(store.markets.get(SUNREY_COIN_USD_MARKET_ID));
    const captured = captureExchangeCore({
      store,
      instruments: snapshot.instruments,
      feeSchedule: snapshot.feeSchedule,
    });
    assert.equal(captured.schema, 'sunrey-exchange-core/1');
  });
});
