/**
 * HELIOS OS03 — institutional paper execution and order-book simulation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  applySlippageToPrice,
  DEFAULT_SLIPPAGE_MODEL,
  buildMarginSnapshot,
  computeFundingPayment,
  evaluateLiquidation,
  evaluateOs03ExecutionSimulationQualification,
  fundingEvent,
  HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED,
  OS03_FIXTURE_NOW,
  sampleBar,
  samplePerpetualSpec,
  SimulatedVenue,
  staleLevel2Snapshot,
  thinLevel2Snapshot,
  deepLevel2Snapshot,
  gapLevel2Snapshot,
  type SimulatedFill,
  type SimulatedWorkingOrder,
  type SubmitOrderResult,
} from '../packages/platform/src/helios/execution-twin/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = OS03_FIXTURE_NOW;

function requireAcceptedOrder(result: SubmitOrderResult): SimulatedWorkingOrder {
  assert.equal(result.accepted, true);
  if (!result.accepted) {
    throw new Error('expected accepted submit');
  }
  return result.order;
}

function fillFingerprint(fills: readonly SimulatedFill[]): string {
  return fills
    .map(
      (f) =>
        `${f.fillId}|${f.quantityUnits}|${f.priceMinorUnits}|${f.liquidityRole}|${f.evidence.executionFidelityLevel}`,
    )
    .join(';');
}

function runDeterministicScenario(): string {
  const venue = new SimulatedVenue(NOW, {
    venueId: 'sim-replay',
    latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
  });
  venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
  venue.submitOrder({
    clientOrderId: 'c1',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    side: 'BUY',
    orderType: 'MARKET',
    timeInForce: 'GTC',
    quantityUnits: 25n,
    currency: 'USD',
  });
  venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.001Z'));
  venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.001Z')) });
  return fillFingerprint(venue.getFills());
}

describe('HELIOS OS03 execution simulation', () => {
  it('respects helios boundary lint and simulation posture', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('partial fill on thin book with LEVEL_2 fidelity', () => {
    const venue = new SimulatedVenue(NOW, { venueId: 'sim-thin' });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'thin',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 10n,
      currency: 'USD',
    });
    const accepted = requireAcceptedOrder(submitted);
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.010Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.010Z')) });
    const order = venue.getOrder(accepted.orderId)!;
    assert.equal(order.status, 'PARTIALLY_FILLED');
    assert.equal(order.fills.length, 1);
    assert.equal(order.fills[0]!.quantityUnits, 2n);
    assert.equal(order.fills[0]!.evidence.executionFidelityLevel, 'LEVEL_2_BOOK');
    assert.equal(order.fills[0]!.evidence.grantsExecutionAuthority, false);
  });

  it('FOK fails when liquidity insufficient', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'sim-fok',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'fok',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'FOK',
      quantityUnits: 10n,
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.002Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.002Z')) });
    const order = venue.getOrder(requireAcceptedOrder(submitted).orderId)!;
    assert.equal(order.status, 'REJECTED');
    assert.equal(venue.getFills().length, 0);
  });

  it('IOC partial fill then cancels remainder', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'sim-ioc',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'ioc',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'IOC',
      quantityUnits: 10n,
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.003Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.003Z')) });
    const order = venue.getOrder(requireAcceptedOrder(submitted).orderId)!;
    assert.equal(order.status, 'CANCELLED');
    assert.equal(order.fills.length, 1);
    assert.equal(order.fills[0]!.quantityUnits, 2n);
  });

  it('no fill when limit not marketable across wide gap', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'sim-gap',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'gap',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      limitPriceMinorUnits: 99_000_00n,
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.004Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.004Z')) });
    const order = venue.getOrder(requireAcceptedOrder(submitted).orderId)!;
    assert.equal(order.fills.length, 0);
    assert.equal(order.status, 'WORKING');
  });

  it('fast cancel prevents fill when cancel wins latency race', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'sim-cancel',
      latencyModel: Object.freeze({ submitLatencyMs: 50, cancelLatencyMs: 1, replaceLatencyMs: 4 }),
    });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'cancel',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    venue.cancelOrder(requireAcceptedOrder(submitted).orderId);
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.005Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.005Z')) });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.100Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.100Z')) });
    const order = venue.getOrder(requireAcceptedOrder(submitted).orderId)!;
    assert.equal(order.status, 'CANCELLED');
    assert.equal(venue.getFills().length, 0);
  });

  it('stale book does not produce fills', () => {
    const venue = new SimulatedVenue(NOW, { venueId: 'sim-stale', maxBookAgeMs: 1_000 });
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: staleLevel2Snapshot(NOW) });
    const submitted = venue.submitOrder({
      clientOrderId: 'stale',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.006Z'));
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: staleLevel2Snapshot(asUtcInstant('2026-11-03T06:00:00.006Z')) });
    assert.equal(venue.getFills().length, 0);
    assert.equal(venue.getOrder(requireAcceptedOrder(submitted).orderId)!.fills.length, 0);
  });

  it('bar fills declare BAR fidelity and close-only mode', () => {
    const venue = new SimulatedVenue(NOW, {
      venueId: 'sim-bar',
      barExecutionMode: 'CLOSE_ONLY',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    venue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(NOW) });
    venue.submitOrder({
      clientOrderId: 'bar',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    venue.advanceClock(asUtcInstant('2026-11-03T06:00:00.007Z'));
    venue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(asUtcInstant('2026-11-03T06:00:00.007Z')) });
    const fill = venue.getFills()[0]!;
    assert.equal(fill.evidence.executionFidelityLevel, 'BAR');
    assert.equal(fill.evidence.barExecutionMode, 'CLOSE_ONLY');
    assert.equal(fill.priceMinorUnits, sampleBar(NOW).closeMinorUnits);
  });

  it('funding and liquidation models operate on perpetual spec', () => {
    const spec = samplePerpetualSpec();
    const event = fundingEvent('fund1', spec.instrumentId, NOW, 25, 100_000_00n, 'USD');
    const accrual = computeFundingPayment({ spec, event, positionUnits: 10n });
    assert.ok(accrual.paymentMinorUnits >= 0n);
    const snapshot = buildMarginSnapshot({
      accountId: 'acct1',
      collateralMinorUnits: 100n,
      currency: 'USD',
      positionUnits: 5n,
      entryPriceMinorUnits: 100_000_00n,
      markPriceMinorUnits: 90_000_00n,
      spec,
    });
    const liquidation = evaluateLiquidation(snapshot, 90_000_00n, 'liq-evidence-1');
    assert.equal(liquidation.liquidated, true);
  });

  it('market impact slippage is deterministic', () => {
    const a = applySlippageToPrice('BUY', 100_00n, 50n, Object.freeze({ impactBpsPerUnit: 2, maxImpactBps: 100 }));
    const b = applySlippageToPrice('BUY', 100_00n, 50n, Object.freeze({ impactBpsPerUnit: 2, maxImpactBps: 100 }));
    assert.equal(a, b);
    assert.ok(a > 100_00n);
  });

  it('deterministic replay produces identical fill fingerprints', () => {
    const first = runDeterministicScenario();
    const second = runDeterministicScenario();
    assert.equal(first, second);
    assert.ok(first.length > 0);
  });

  it('HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED when adversarial checks pass', () => {
    const thinVenue = new SimulatedVenue(NOW, { venueId: 'q-thin' });
    thinVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const thinSubmitted = thinVenue.submitOrder({
      clientOrderId: 'q-thin',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 10n,
      currency: 'USD',
    });
    thinVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.000Z'));
    thinVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.000Z')),
    });
    const thinOrder = thinVenue.getOrder(requireAcceptedOrder(thinSubmitted).orderId)!;

    const fokVenue = new SimulatedVenue(NOW, {
      venueId: 'q-fok',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    fokVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const fokSubmitted = fokVenue.submitOrder({
      clientOrderId: 'q-fok',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'FOK',
      quantityUnits: 10n,
      currency: 'USD',
    });
    fokVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.001Z'));
    fokVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.001Z')),
    });

    const iocVenue = new SimulatedVenue(NOW, {
      venueId: 'q-ioc',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    iocVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: thinLevel2Snapshot(NOW) });
    const iocSubmitted = iocVenue.submitOrder({
      clientOrderId: 'q-ioc',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'IOC',
      quantityUnits: 10n,
      currency: 'USD',
    });
    iocVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.002Z'));
    iocVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: thinLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.002Z')),
    });
    const iocOrder = iocVenue.getOrder(requireAcceptedOrder(iocSubmitted).orderId)!;

    const cancelVenue = new SimulatedVenue(NOW, {
      venueId: 'q-cancel',
      latencyModel: Object.freeze({ submitLatencyMs: 50, cancelLatencyMs: 1, replaceLatencyMs: 4 }),
    });
    cancelVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: deepLevel2Snapshot(NOW) });
    const cancelSubmitted = cancelVenue.submitOrder({
      clientOrderId: 'q-cancel',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    cancelVenue.cancelOrder(requireAcceptedOrder(cancelSubmitted).orderId);
    cancelVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.003Z'));
    cancelVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: deepLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.003Z')),
    });
    cancelVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.100Z'));

    const staleVenue = new SimulatedVenue(NOW, { venueId: 'q-stale', maxBookAgeMs: 500 });
    staleVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: staleLevel2Snapshot(NOW) });
    staleVenue.submitOrder({
      clientOrderId: 'q-stale',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    staleVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.004Z'));
    staleVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: staleLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.004Z')),
    });

    const barVenue = new SimulatedVenue(NOW, {
      venueId: 'q-bar',
      barExecutionMode: 'CLOSE_ONLY',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    barVenue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(NOW) });
    barVenue.submitOrder({
      clientOrderId: 'q-bar',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    barVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.005Z'));
    barVenue.onMarketUpdate({ kind: 'BAR', bar: sampleBar(asUtcInstant('2026-11-03T06:00:01.005Z')) });
    const barFill = barVenue.getFills()[0]!;

    const gapVenue = new SimulatedVenue(NOW, {
      venueId: 'q-gap',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    gapVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: gapLevel2Snapshot(NOW) });
    const gapMarketSubmitted = gapVenue.submitOrder({
      clientOrderId: 'q-gap-mkt',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'MARKET',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      currency: 'USD',
    });
    gapVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.006Z'));
    gapVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: gapLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.006Z')),
    });
    const gapMarketOrder = gapVenue.getOrder(requireAcceptedOrder(gapMarketSubmitted).orderId)!;

    const limitVenue = new SimulatedVenue(NOW, {
      venueId: 'q-limit-gap',
      latencyModel: Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 }),
    });
    limitVenue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: gapLevel2Snapshot(NOW) });
    const limitSubmitted = limitVenue.submitOrder({
      clientOrderId: 'q-limit',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      side: 'BUY',
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      quantityUnits: 1n,
      limitPriceMinorUnits: 99_000_00n,
      currency: 'USD',
    });
    limitVenue.advanceClock(asUtcInstant('2026-11-03T06:00:01.007Z'));
    limitVenue.onMarketUpdate({
      kind: 'LEVEL_2_BOOK',
      snapshot: gapLevel2Snapshot(asUtcInstant('2026-11-03T06:00:01.007Z')),
    });
    const limitOrder = limitVenue.getOrder(requireAcceptedOrder(limitSubmitted).orderId)!;

    const spec = samplePerpetualSpec();
    const fundingOk =
      computeFundingPayment({
        spec,
        event: fundingEvent('qf', spec.instrumentId, NOW, 10, 100_000_00n, 'USD'),
        positionUnits: 2n,
      }).paymentMinorUnits >= 0n;
    const liqOk = evaluateLiquidation(
      buildMarginSnapshot({
        accountId: 'q',
        collateralMinorUnits: 50n,
        currency: 'USD',
        positionUnits: 3n,
        entryPriceMinorUnits: 100_000_00n,
        markPriceMinorUnits: 80_000_00n,
        spec,
      }),
      80_000_00n,
      'ev',
    ).liquidated;

    const sampleFill = thinOrder.fills[0]!;
    const evidenceComplete =
      sampleFill.evidence.observationRefs.length > 0 &&
      sampleFill.evidence.fillModelVersion.length > 0 &&
      sampleFill.evidence.feeModelVersion.length > 0 &&
      sampleFill.evidence.latencyAssumption.length > 0 &&
      sampleFill.evidence.slippageAssumption.length > 0 &&
      sampleFill.evidence.evidenceRefs.length > 0;

    const result = evaluateOs03ExecutionSimulationQualification({
      thinBookPartialFill: thinOrder.status === 'PARTIALLY_FILLED',
      gapWideSpread:
        gapMarketOrder.fills.length === 1 &&
        gapMarketOrder.fills[0]!.priceMinorUnits ===
          applySlippageToPrice('BUY', 102_000_00n, 1n, DEFAULT_SLIPPAGE_MODEL),
      noFillWhenLimitNotMarketable: limitOrder.fills.length === 0 && limitOrder.status === 'WORKING',
      fastCancelBeforeFill: cancelVenue.getFills().length === 0,
      staleBookNoFill: staleVenue.getFills().length === 0,
      fundingEventModeled: fundingOk,
      liquidationModeled: liqOk,
      fokFailure: fokVenue.getOrder(requireAcceptedOrder(fokSubmitted).orderId)!.status === 'REJECTED',
      iocPartial: iocOrder.fills.length === 1 && iocOrder.status === 'CANCELLED',
      marketImpactApproximation: applySlippageToPrice('BUY', 100_00n, 10n, Object.freeze({ impactBpsPerUnit: 1, maxImpactBps: 50 })) > 100_00n,
      deterministicReplay: runDeterministicScenario() === runDeterministicScenario(),
      barFidelityExplicit: barFill.evidence.executionFidelityLevel === 'BAR' && barFill.evidence.barExecutionMode === 'CLOSE_ONLY',
      fillEvidenceComplete: evidenceComplete,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    });

    assert.equal(result.marker, HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED, result.blockers.join('; '));
  });
});
