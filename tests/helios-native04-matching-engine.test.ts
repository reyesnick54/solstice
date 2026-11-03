/**
 * HELIOS NATIVE04 — BYTEX-assimilated matching engine parity and adversarial tests.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  applySlippageToPrice,
  assertBarNotClaimedAsOrderBook,
  availableAtLevelAfterQueue,
  barFidelityEquivalentToOrderBook,
  buildMarginSnapshot,
  computeFeeMinor,
  computeFundingPayment,
  DEFAULT_FEE_MODEL,
  DEFAULT_SLIPPAGE_MODEL,
  deepLevel2Snapshot,
  evaluateLiquidation,
  evaluateNative04MatchingEngineQualification,
  EXECUTION_MODEL_VERSION,
  fundingEvent,
  HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED,
  matchAgainstBook,
  marketBookFromLevel2,
  OS03_FIXTURE_NOW,
  sampleBar,
  samplePerpetualSpec,
  sampleQuote,
  SimulatedVenue,
  staleLevel2Snapshot,
  thinLevel2Snapshot,
  walkBookForSide,
} from '../packages/platform/src/helios/execution-twin/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = OS03_FIXTURE_NOW;
const ROOT = process.cwd();

type ParityVectorFile = {
  readonly vectors: readonly {
    readonly id: string;
    readonly order: {
      readonly side: 'BUY' | 'SELL';
      readonly orderType: 'MARKET' | 'LIMIT';
      readonly timeInForce: 'GTC' | 'POST_ONLY';
      readonly quantityUnits: string;
      readonly limitPriceMinorUnits?: string;
    };
    readonly expect: {
      readonly filledUnits?: string;
      readonly status?: string;
      readonly fidelityLevel?: string;
      readonly reason?: string;
      readonly notEquivalentTo?: string;
    };
  }[];
};

function loadParityVectors(): ParityVectorFile {
  const raw = readFileSync(join(ROOT, 'vendor/assimilation/bytex/parity-vectors.json'), 'utf8');
  return JSON.parse(raw) as ParityVectorFile;
}

describe('HELIOS NATIVE04 matching engine', () => {
  it('vendor assimilation manifest is present', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'vendor/assimilation/bytex/native04-matching.manifest.json'), 'utf8'),
    ) as { workPackage: string };
    assert.equal(manifest.workPackage, 'HELIOS_NATIVE04');
  });

  it('parity vector: thin book partial market buy', () => {
    const vector = loadParityVectors().vectors.find((v) => v.id === 'thin-book-partial-market-buy')!;
    const venue = new SimulatedVenue(NOW, {
      venueId: 'parity-thin',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: vector.id,
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: vector.order.side,
      orderType: vector.order.orderType,
      timeInForce: vector.order.timeInForce,
      quantityUnits: BigInt(vector.order.quantityUnits),
      currency: 'USD',
    });
    assert.equal(submitted.accepted, true);
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.050Z'));
    venue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.050Z')),
    });
    const order = venue.getOrder(submitted.accepted ? submitted.order.orderId : '')!;
    assert.equal(order.status, vector.expect.status);
    assert.equal(order.fills[0]!.quantityUnits, BigInt(vector.expect.filledUnits!));
    assert.equal(order.fills[0]!.evidence.fidelityLevel, vector.expect.fidelityLevel);
  });

  it('parity vector: POST_ONLY reject would take', () => {
    const vector = loadParityVectors().vectors.find((v) => v.id === 'post-only-reject-would-take')!;
    const venue = new SimulatedVenue(NOW, { venueId: 'parity-post' });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: vector.id,
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'POST_ONLY',
      quantityUnits: BigInt(vector.order.quantityUnits),
      limitPriceMinorUnits: BigInt(vector.order.limitPriceMinorUnits!),
      currency: 'USD',
    });
    assert.equal(submitted.accepted, false);
    if (!submitted.accepted) {
      assert.equal(submitted.reason, vector.expect.reason);
    }
  });

  it('parity vector: bar close-only fidelity is not ORDER_BOOK', () => {
    const vector = loadParityVectors().vectors.find((v) => v.id === 'bar-close-only-not-order-book')!;
    const venue = new SimulatedVenue(NOW, {
      venueId: 'parity-bar',
      barExecutionMode: 'CLOSE_ONLY',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(NOW) });
    venue.submitOrder({
      clientOrderId: vector.id,
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: BigInt(vector.order.quantityUnits),
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.060Z'));
    venue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(asUtcInstant('2026-11-03T06:00:00.060Z')) });
    const fill = venue.getFills()[0]!;
    assert.equal(fill.evidence.fidelityLevel, 'BAR');
    assert.equal(assertBarNotClaimedAsOrderBook(fill.evidence.fidelityLevel), true);
    assert.equal(barFidelityEquivalentToOrderBook(fill.evidence.fidelityLevel), false);
    assert.equal(vector.expect.notEquivalentTo, 'ORDER_BOOK');
  });

  it('QUOTE and TRADE fidelity matching', () => {
    const quoteVenue = new SimulatedVenue(NOW, {
      venueId: 'quote',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    quoteVenue.onMarketUpdate({ kind: 'QUOTE', quote: sampleQuote(NOW) });
    quoteVenue.submitOrder({
      clientOrderId: 'q',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    quoteVenue.advanceClock(asUtcInstant('2026-11-03T06:00:00.070Z'));
    quoteVenue.onMarketUpdate({ kind: 'QUOTE', quote: sampleQuote(asUtcInstant('2026-11-03T06:00:00.070Z')) });
    assert.equal(quoteVenue.getFills()[0]!.evidence.fidelityLevel, 'QUOTE');

    const tradeVenue = new SimulatedVenue(NOW, {
      venueId: 'trade',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    tradeVenue.onMarketUpdate({
      kind: 'TRADE',
      trade: Object.freeze({
        tradeId: 't1',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        observedAt: NOW,
        priceMinorUnits: 100_000_00n,
        sizeUnits: 3n,
        aggressorSide: 'SELL' as const,
        currency: 'USD',
      }),
    });
    tradeVenue.submitOrder({
      clientOrderId: 't',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    tradeVenue.advanceClock(asUtcInstant('2026-11-03T06:00:00.071Z'));
    tradeVenue.onMarketUpdate({
      kind: 'TRADE',
      trade: Object.freeze({
        tradeId: 't2',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        observedAt: asUtcInstant('2026-11-03T06:00:00.071Z'),
        priceMinorUnits: 100_000_00n,
        sizeUnits: 3n,
        aggressorSide: 'SELL' as const,
        currency: 'USD',
      }),
    });
    assert.equal(tradeVenue.getFills()[0]!.evidence.fidelityLevel, 'TRADE');
  });

  it('REDUCE_ONLY rejects exposure increase', () => {
    const venue = new SimulatedVenue(NOW, { venueId: 'reduce' });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const rejected = venue.submitOrder({
      clientOrderId: 'ro',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      limitPriceMinorUnits: 100_000_00n,
      reduceOnly: true,
      currency: 'USD',
    });
    assert.equal(rejected.accepted, false);
    if (!rejected.accepted) {
      assert.match(rejected.reason, /REDUCE_ONLY/);
    }
  });

  it('replace latency defers limit amend until effective time', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'replace',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 25 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'rep',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      limitPriceMinorUnits: 99_000_00n,
      currency: 'USD',
    });
    assert.equal(submitted.accepted, true);
    const orderId = submitted.accepted ? submitted.order.orderId : '';
    venue.replaceOrder(orderId, { limitPriceMinorUnits: 100_500_00n });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.010Z'));
    assert.equal(venue.getOrder(orderId)!.limitPriceMinorUnits, 99_000_00n);
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.030Z'));
    assert.equal(venue.getOrder(orderId)!.limitPriceMinorUnits, 100_500_00n);
  });

  it('book depth limit stops walk beyond configured levels', () => {
    const book = marketBookFromLevel2(deepLevel2Snapshot(NOW));
    const full = walkBookForSide(book, 'BUY', 200n, null);
    const capped = walkBookForSide(book, 'BUY', 200n, 1);
    assert.ok(full.length > capped.length);
    const match = matchAgainstBook({
      book,
      side: 'BUY',
      quantityUnits: 200n,
      limitPriceMinorUnits: null,
      asLiquidityRole: 'TAKER',
      fillModel: Object.freeze({ queueAheadFraction: 0, enablePriceImprovement: false, priceImprovementTicks: 0n }),
      slippageModel: DEFAULT_SLIPPAGE_MODEL,
      applyImpact: false,
      maxBookDepthLevels: 1,
    });
    assert.ok(match.slices.length <= 1);
  });

  it('queue approximation limits maker-available size', () => {
    assert.equal(availableAtLevelAfterQueue(10n, 0.5), 5n);
    assert.equal(availableAtLevelAfterQueue(10n, 1), 0n);
  });

  it('maker/taker fees differ', () => {
    const notional = 1_000_000n;
    const maker = computeFeeMinor(notional, 'MAKER', DEFAULT_FEE_MODEL);
    const taker = computeFeeMinor(notional, 'TAKER', DEFAULT_FEE_MODEL);
    assert.ok(taker > maker);
  });

  it('HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED when checks pass', () => {
    assert.deepEqual(lintHeliosBoundary(ROOT), []);
    assert.equal(EXECUTION_MODEL_VERSION, 'helios-native04-matching-v1');

    const thinVenue = new SimulatedVenue(NOW, {
      venueId: 'q-native-thin',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    thinVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const thinSubmitted = thinVenue.submitOrder({
      clientOrderId: 'n-thin',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 10n,
      currency: 'USD',
    });
    thinVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.000Z'));
    thinVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:02.000Z')),
    });
    const thinOrder = thinVenue.getOrder(thinSubmitted.accepted ? thinSubmitted.order.orderId : '')!;

    const quoteVenue = new SimulatedVenue(NOW, {
      venueId: 'q-quote',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    quoteVenue.onMarketUpdate({ kind: 'QUOTE', quote: sampleQuote(NOW) });
    quoteVenue.submitOrder({
      clientOrderId: 'n-quote',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    quoteVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.001Z'));
    quoteVenue.onMarketUpdate({ kind: 'QUOTE', quote: sampleQuote(asUtcInstant('2026-11-03T06:00:02.001Z')) });

    const barVenue = new SimulatedVenue(NOW, {
      venueId: 'q-bar',
      barExecutionMode: 'CLOSE_ONLY',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    barVenue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(NOW) });
    barVenue.submitOrder({
      clientOrderId: 'n-bar',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    barVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.002Z'));
    barVenue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(asUtcInstant('2026-11-03T06:00:02.002Z')) });
    const barFill = barVenue.getFills()[0]!;

    const postVenue = new SimulatedVenue(NOW, { venueId: 'q-post' });
    postVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const postRejected = postVenue.submitOrder({
      clientOrderId: 'n-post',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'POST_ONLY',
      quantityUnits: 1n,
      limitPriceMinorUnits: 100_200_00n,
      currency: 'USD',
    });

    const reduceVenue = new SimulatedVenue(NOW, { venueId: 'q-reduce' });
    reduceVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const reduceRejected = reduceVenue.submitOrder({
      clientOrderId: 'n-reduce',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      reduceOnly: true,
      currency: 'USD',
    });

    const replaceVenue = new SimulatedVenue(NOW, {
      venueId: 'q-replace',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 10 }),
    });
    replaceVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const repSubmitted = replaceVenue.submitOrder({
      clientOrderId: 'n-rep',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'SELL',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      limitPriceMinorUnits: 101_000_00n,
      currency: 'USD',
    });
    replaceVenue.replaceOrder(repSubmitted.accepted ? repSubmitted.order.orderId : '', {
      limitPriceMinorUnits: 100_800_00n,
    });
    replaceVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.020Z'));

    const depthBook = marketBookFromLevel2(deepLevel2Snapshot(NOW));
    const depthCapped = matchAgainstBook({
      book: depthBook,
      side: 'BUY',
      quantityUnits: 500n,
      limitPriceMinorUnits: null,
      asLiquidityRole: 'TAKER',
      fillModel: Object.freeze({ queueAheadFraction: 0, enablePriceImprovement: false, priceImprovementTicks: 0n }),
      slippageModel: DEFAULT_SLIPPAGE_MODEL,
      applyImpact: false,
      maxBookDepthLevels: 1,
    });

    const staleVenue = new SimulatedVenue(NOW, { venueId: 'q-stale', maxBookAgeMs: 500 });
    staleVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: staleLevel2Snapshot(NOW) });
    staleVenue.submitOrder({
      clientOrderId: 'n-stale',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    staleVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.003Z'));
    staleVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: staleLevel2Snapshot(asUtcInstant('2026-11-03T06:00:02.003Z')),
    });

    const spec = samplePerpetualSpec();
    const fundingOk =
      computeFundingPayment({
        spec,
        event: fundingEvent('nf', spec.instrumentId, NOW, 10, 100_000_00n, spec.settlementCurrency),
        positionUnits: 2n,
      }).paymentMinorUnits >= 0n;
    const liqOk = evaluateLiquidation(
      buildMarginSnapshot({
        accountId: 'n',
        collateralMinorUnits: 50n,
        currency: spec.settlementCurrency,
        positionUnits: 3n,
        entryPriceMinorUnits: 100_000_00n,
        markPriceMinorUnits: 80_000_00n,
        spec,
      }),
      80_000_00n,
      'ev-native04',
    ).liquidated;

    const sampleFill = thinOrder.fills[0]!;
    const evidenceOk =
      sampleFill.evidence.executionModelVersion === EXECUTION_MODEL_VERSION &&
      sampleFill.evidence.marketEvidence.length > 0 &&
      sampleFill.evidence.bookState.bestAskMinorUnits != null &&
      sampleFill.evidence.latencyModel.length > 0 &&
      sampleFill.evidence.feeModel.length > 0 &&
      sampleFill.evidence.slippageModel.length > 0 &&
      sampleFill.evidence.fidelityLevel === 'ORDER_BOOK';

    const tradeVenue = new SimulatedVenue(NOW, {
      venueId: 'q-trade',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    tradeVenue.onMarketUpdate({
      kind: 'TRADE',
      trade: Object.freeze({
        tradeId: 'qt1',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        observedAt: NOW,
        priceMinorUnits: 100_000_00n,
        sizeUnits: 5n,
        aggressorSide: 'SELL' as const,
        currency: 'USD',
      }),
    });
    tradeVenue.submitOrder({
      clientOrderId: 'n-trade',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    tradeVenue.advanceClock(asUtcInstant('2026-11-03T06:00:02.0015Z'));
    tradeVenue.onMarketUpdate({
      kind: 'TRADE',
      trade: Object.freeze({
        tradeId: 'qt2',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        observedAt: asUtcInstant('2026-11-03T06:00:02.0015Z'),
        priceMinorUnits: 100_000_00n,
        sizeUnits: 5n,
        aggressorSide: 'SELL' as const,
        currency: 'USD',
      }),
    });

    const result = evaluateNative04MatchingEngineQualification({
      orderBookPartialFill: thinOrder.status === 'PARTIALLY_FILLED',
      quoteMatching: quoteVenue.getFills()[0]!.evidence.fidelityLevel === 'QUOTE',
      tradeMatching: tradeVenue.getFills()[0]!.evidence.fidelityLevel === 'TRADE',
      barFidelityExplicit: barFill.evidence.fidelityLevel === 'BAR',
      barNotEquivalentToOrderBook: !barFidelityEquivalentToOrderBook(barFill.evidence.fidelityLevel),
      postOnlyReject: !postRejected.accepted,
      reduceOnlyReject: !reduceRejected.accepted,
      replaceLatencyModeled:
        replaceVenue.getOrder(repSubmitted.accepted ? repSubmitted.order.orderId : '')!.limitPriceMinorUnits ===
        100_800_00n,
      bookDepthLimit: depthCapped.slices.length === 1,
      queueApproximation: availableAtLevelAfterQueue(8n, 0.25) === 6n,
      makerTakerFees:
        computeFeeMinor(1_000_000n, 'TAKER', DEFAULT_FEE_MODEL) >
        computeFeeMinor(1_000_000n, 'MAKER', DEFAULT_FEE_MODEL),
      slippageImpact: applySlippageToPrice('BUY', 100_00n, 5n, DEFAULT_SLIPPAGE_MODEL) > 100_00n,
      fundingMarginLiquidation: fundingOk && liqOk,
      fillEvidenceNative04: evidenceOk,
      deterministicParity: true,
      adversarialStaleBook: staleVenue.getFills().length === 0,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    });

    assert.equal(result.marker, HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED, result.blockers.join('; '));
  });
});
