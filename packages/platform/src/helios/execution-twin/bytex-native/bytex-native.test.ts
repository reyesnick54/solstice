import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';

import { BytexDeterministicEngine } from './deterministic-engine.ts';
import { sortMarketDataChronologically, assignInsertionIndices } from './market-data-queue.ts';
import { BytexOrderCoordinator } from './order-state.ts';
import { BytexPortfolioLedger } from './portfolio-state.ts';
import { BytexSimulationClock, unixNanosFromSeconds, utcInstantToUnixNanos } from './clock.ts';
import {
  BYTEX_INTERLEAVED_TIMER_EXPECTED,
  BYTEX_REFERENCE_CLOCK_SCRIPT_EXPECTED,
  BYTEX_SAME_TIMESTAMP_ORDER_EXPECTED,
  runBytexInterleavedTimerSpec,
  runBytexReferenceClockScript,
  runBytexSameTimestampRegistrationOrderSpec,
} from './reference-spec.ts';
import { assertReplayParity, runDeterministicReplay } from './replay.ts';
import { HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED } from './qualification.ts';

describe('HELIOS native BYTEX runtime (NATIVE03)', () => {
  it('matches BYTEX TestClock reference script', () => {
    assert.deepEqual(runBytexReferenceClockScript(), BYTEX_REFERENCE_CLOCK_SCRIPT_EXPECTED);
    assert.deepEqual(runBytexReferenceClockScript(), runBytexReferenceClockScript());
  });

  it('interleaves timers by time with registration tie-break', () => {
    assert.deepEqual(runBytexInterleavedTimerSpec(), BYTEX_INTERLEAVED_TIMER_EXPECTED);
    assert.deepEqual(runBytexSameTimestampRegistrationOrderSpec(), BYTEX_SAME_TIMESTAMP_ORDER_EXPECTED);
  });

  it('orders market data by created time then insertion index', () => {
    const data = assignInsertionIndices([
      { elementId: 'b', createdTimeNs: 2n, kind: 'BAR', instrumentId: 'BTC', payloadDigest: 'b' },
      { elementId: 'a', createdTimeNs: 1n, kind: 'BAR', instrumentId: 'BTC', payloadDigest: 'a' },
      { elementId: 'c', createdTimeNs: 2n, kind: 'BAR', instrumentId: 'BTC', payloadDigest: 'c' },
    ]);
    const sorted = sortMarketDataChronologically(data);
    assert.deepEqual(
      sorted.map((row) => row.elementId),
      ['a', 'b', 'c'],
    );
  });

  it('replays deterministically for same capsule observations seed and assumptions', () => {
    const input = {
      runId: 'run_parity',
      environment: 'BACKTEST' as const,
      randomSeed: 'seed-native03',
      capsuleContentHash: 'capsule_abc',
      executionAssumptionsDigest: 'assumptions_xyz',
      startAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
      marketData: [
        { elementId: 'm1', createdTimeNs: utcInstantToUnixNanos('2026-01-01T00:00:01.000Z'), kind: 'QUOTE' as const, instrumentId: 'SPY', payloadDigest: 'q1' },
        { elementId: 'm2', createdTimeNs: utcInstantToUnixNanos('2026-01-01T00:00:02.000Z'), kind: 'BAR' as const, instrumentId: 'SPY', payloadDigest: 'b1' },
      ],
    };
    const first = runDeterministicReplay(input);
    const second = runDeterministicReplay(input);
    assert.equal(assertReplayParity(first, second), true);
    assert.equal(first.outcomeDigest, second.outcomeDigest);
  });

  it('supports restart checkpoint without changing digest on full replay', () => {
    const base = {
      runId: 'run_restart',
      environment: 'BACKTEST' as const,
      randomSeed: 'seed-restart',
      capsuleContentHash: 'capsule_restart',
      executionAssumptionsDigest: 'assumptions_restart',
      startAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
      marketData: [
        { elementId: 'm1', createdTimeNs: utcInstantToUnixNanos('2026-01-01T00:00:01.000Z'), kind: 'QUOTE' as const, instrumentId: 'SPY', payloadDigest: 'q1' },
        { elementId: 'm2', createdTimeNs: utcInstantToUnixNanos('2026-01-01T00:00:02.000Z'), kind: 'BAR' as const, instrumentId: 'SPY', payloadDigest: 'b1' },
        { elementId: 'm3', createdTimeNs: utcInstantToUnixNanos('2026-01-01T00:00:03.000Z'), kind: 'TRADE' as const, instrumentId: 'SPY', payloadDigest: 't1' },
      ],
    };
    const full = runDeterministicReplay(base);
    const engine = new BytexDeterministicEngine(base);
    const checkpoint = engine.saveCheckpoint('ckpt_1');
    const resumed = new BytexDeterministicEngine(base);
    resumed.restoreCheckpoint(checkpoint, 0);
    const afterRestart = resumed.run();
    assert.equal(checkpoint.dispatchedMarketCount, 0);
    assert.equal(full.outcomeDigest, afterRestart.outcomeDigest);
  });

  it('applies BYTEX order lifecycle transitions', () => {
    const coordinator = new BytexOrderCoordinator();
    const order = coordinator.submit({
      clientOrderId: 'ord_1',
      instrumentId: 'SPY',
      side: 'BUY',
      quantityMinor: 100n,
      atNs: 1n,
    });
    assert.equal(order.status, 'ACCEPTED');
    coordinator.apply('ord_1', 'ORDER_PARTIAL_FILL', 2n, 40n);
    coordinator.apply('ord_1', 'ORDER_FILLED', 3n);
    assert.equal(coordinator.listOrders()[0]?.status, 'FILLED');
  });

  it('records portfolio lifecycle events on fills', () => {
    const ledger = new BytexPortfolioLedger();
    ledger.applyFill({
      atNs: 1n,
      instrumentId: 'SPY',
      side: 'BUY',
      quantityMinor: 10n,
      priceMinor: 100n,
      feeMinor: 5n,
    });
    ledger.applyFill({
      atNs: 2n,
      instrumentId: 'SPY',
      side: 'SELL',
      quantityMinor: 10n,
      priceMinor: 110n,
      feeMinor: 5n,
    });
    const kinds = ledger.eventsLog().map((e) => e.kind);
    assert.ok(kinds.includes('POSITION_OPENED'));
    assert.ok(kinds.includes('POSITION_CLOSED'));
  });

  it('refuses backwards clock advance', () => {
    const clock = new BytexSimulationClock(unixNanosFromSeconds(10));
    clock.advanceTime(unixNanosFromSeconds(20));
    assert.throws(() => clock.advanceTime(unixNanosFromSeconds(19)));
  });

  it('exports qualification marker', () => {
    assert.equal(HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED, 'HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED');
  });
});
