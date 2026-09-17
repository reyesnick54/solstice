/**
 * HELIOS H17 — chronological realistic strategy evaluation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assertEvaluationReproducible,
  assertNoFutureInformationLeak,
  buildChronologicalObservation,
  buildExecutionTimeline,
  buildReferenceCapsule,
  chronologicalEvaluationManifest,
  ChronologicalEvaluationStore,
  DEFAULT_CONSERVATIVE_LATENCY,
  deterministicEvaluationSeed,
  freezeStrategyCapsule,
  informationTimeLeakFixture,
  isKnowableAt,
  manifestViewAt,
  runChronologicalEvaluation,
  simulateRealisticFill,
  sortObservationsChronologically,
  validateLatencyModel,
  verifyCapsuleFingerprint,
  EXPLICIT_COSTS,
  SIM_ETF_1,
} from '../packages/strategy-lab/src/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T07:30:00.000Z');
const SOURCE_EVENT = asUtcInstant('2026-03-01T10:00:00.000Z');
const KNOWABLE_AT = asUtcInstant('2026-03-01T10:00:03.000Z');
const EVAL_EARLY = asUtcInstant('2026-03-01T10:00:01.000Z');

describe('HELIOS H17 chronological strategy evaluation', () => {
  it('rejects future-information leak (source-time vs arrival-time)', () => {
    assert.equal(isKnowableAt(EVAL_EARLY, KNOWABLE_AT), false);
    const leak = assertNoFutureInformationLeak({
      evaluationTime: EVAL_EARLY,
      knowableAt: KNOWABLE_AT,
      observationId: 'obs_leak_test',
    });
    assert.equal(leak.ok, false);
    const view = manifestViewAt(informationTimeLeakFixture(), EVAL_EARLY);
    assert.equal(view.ok, true);
    if (!view.ok) {
      return;
    }
    const leaked = view.value.observations.find(
      (row) => row.instrumentId === SIM_ETF_1 && row.at === SOURCE_EVENT,
    );
    assert.equal(leaked, undefined, 'report knowable at 10:00:03 must not appear at 10:00:01');
  });

  it('processes observations in deterministic chronological order', () => {
    const manifest = informationTimeLeakFixture();
    const sorted = sortObservationsChronologically(manifest.observations);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      assert.ok(prev && current);
      assert.ok(Date.parse(prev.informationTime.knowableAt) <= Date.parse(current.informationTime.knowableAt));
    }
  });

  it('does not assume zero latency by default', () => {
    const timeline = buildExecutionTimeline({
      observationAvailableAt: SOURCE_EVENT,
      latency: DEFAULT_CONSERVATIVE_LATENCY,
    });
    assert.ok(Date.parse(timeline.decisionAt) > Date.parse(SOURCE_EVENT));
    assert.ok(Date.parse(timeline.executionEligibilityAt) > Date.parse(timeline.decisionAt));
    const zeroLatency = validateLatencyModel({
      ...DEFAULT_CONSERVATIVE_LATENCY,
      zeroLatencyAssumed: true as never,
    });
    assert.equal(zeroLatency.ok, false);
  });

  it('applies bid/ask realistic fills, fees, and slippage', () => {
    const obs = buildChronologicalObservation({
      observationId: 'obs_fill',
      instrumentId: SIM_ETF_1,
      sourceEventTime: NOW,
      sunreyArrivalTime: NOW,
      ingestionTime: NOW,
      providerId: 'fixture',
      providerSequence: 1,
      openMinor: 10_000n,
      highMinor: 10_100n,
      lowMinor: 9_900n,
      closeMinor: 10_000n,
      bidMinor: 9_990n,
      askMinor: 10_010n,
    });
    const buy = simulateRealisticFill({
      side: 'BUY',
      quantity: 1n,
      observation: obs,
      costs: EXPLICIT_COSTS,
      cashMinor: 100_000n,
      ownedQuantity: 0n,
      executionAt: NOW,
    });
    assert.equal(buy.ok, true);
    if (!buy.ok) {
      return;
    }
    assert.equal(buy.value.bidAskUsed, true);
    assert.ok(buy.value.priceMinor >= obs.askMinor!);
    assert.ok(buy.value.feeMinor > 0n);
    assert.ok(buy.value.spreadCostMinor > 0n);
    assert.ok(buy.value.slippageCostMinor > 0n);

    const sell = simulateRealisticFill({
      side: 'SELL',
      quantity: 1n,
      observation: obs,
      costs: EXPLICIT_COSTS,
      cashMinor: 0n,
      ownedQuantity: 1n,
      executionAt: NOW,
    });
    assert.equal(sell.ok, true);
    if (!sell.ok) {
      return;
    }
    assert.ok(sell.value.priceMinor <= obs.bidMinor!);
  });

  it('returns no fill when market is closed', () => {
    const obs = buildChronologicalObservation({
      observationId: 'obs_closed',
      instrumentId: SIM_ETF_1,
      sourceEventTime: NOW,
      sunreyArrivalTime: NOW,
      ingestionTime: NOW,
      providerId: 'fixture',
      providerSequence: 1,
      openMinor: 10_000n,
      highMinor: 10_100n,
      lowMinor: 9_900n,
      closeMinor: 10_000n,
      bidMinor: 9_990n,
      askMinor: 10_010n,
      sessionOpen: false,
    });
    const fill = simulateRealisticFill({
      side: 'BUY',
      quantity: 1n,
      observation: obs,
      costs: EXPLICIT_COSTS,
      cashMinor: 100_000n,
      ownedQuantity: 0n,
      executionAt: NOW,
    });
    assert.equal(fill.ok, true);
    if (!fill.ok) {
      return;
    }
    assert.equal(fill.value.filled, false);
    assert.equal(fill.value.marketClosed, true);
  });

  it('keeps missing data explicit and does not silently replace gaps', () => {
    const manifest = chronologicalEvaluationManifest();
    assert.ok(manifest.gapsExplicit.length > 0);
    assert.ok(manifest.limitations.some((row) => row.includes('gap') || row.includes('Gap')));
    const view = manifestViewAt(manifest, asUtcInstant('2026-04-08T00:00:00.000Z'));
    assert.equal(view.ok, true);
    if (!view.ok) {
      return;
    }
    const unavailable = view.value.observations.find((row) => row.instrumentId === SIM_ETF_1 && !row.available);
    assert.ok(unavailable);
  });

  it('isolates train and test partitions chronologically in walk-forward mode', () => {
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    const result = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'WALK_FORWARD',
        runKind: 'EXPERIMENT',
        partition: 'OUT_OF_SAMPLE_TEST',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
        seed: deterministicEvaluationSeed(capsule.value, manifest),
        customerId: null,
        walkForward: { trainDays: 5, testDays: 3 },
      },
      createdAt: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.value.walkForwardRunId);
  });

  it('reproduces identical output for same capsule, manifest, and configuration', () => {
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    const seed = deterministicEvaluationSeed(capsule.value, manifest);
    const config = {
      mode: 'HISTORICAL_BACKTEST' as const,
      runKind: 'EXPERIMENT' as const,
      partition: 'TRAIN' as const,
      period: manifest.timeRange,
      startingCapitalMinor: 100_000n,
      latency: DEFAULT_CONSERVATIVE_LATENCY,
      costs: EXPLICIT_COSTS,
      operatingResearchCostMinor: 0n,
      seed,
      customerId: null,
    };
    const first = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config,
      createdAt: NOW,
      store: new ChronologicalEvaluationStore(),
    });
    const second = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config,
      createdAt: NOW,
      store: new ChronologicalEvaluationStore(),
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(assertEvaluationReproducible(first.value.record, second.value.record), true);
  });

  it('binds evaluation record to strategy capsule fingerprint', () => {
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    assert.equal(verifyCapsuleFingerprint(capsule.value), true);
    const manifest = chronologicalEvaluationManifest();
    const result = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'REPLAY',
        runKind: 'OFFICIAL_QUALIFICATION',
        partition: 'VALIDATION',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: 'cust_h17_a',
      },
      createdAt: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.record.capsuleFingerprint, capsule.value.fingerprint);
    assert.equal(result.value.record.datasetManifestHash, manifest.hash);
  });

  it('persists negative evaluations without deletion', () => {
    const store = new ChronologicalEvaluationStore();
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    const result = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'HISTORICAL_BACKTEST',
        runKind: 'OFFICIAL_QUALIFICATION',
        partition: 'OUT_OF_SAMPLE_TEST',
        period: manifest.timeRange,
        startingCapitalMinor: 100n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 10_000n,
        seed: null,
        customerId: 'cust_h17_b',
      },
      createdAt: NOW,
      store,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(store.refuseDelete().ok, false);
    assert.ok(store.snapshot().records.length >= 1);
    const failed = store.snapshot().records.find((row) => row.qualificationOutcome === 'FAILED');
    assert.ok(failed || result.value.record.metrics.netEconomicsMinor <= 0n);
  });

  it('includes benchmark comparison against cash and buy-and-hold', () => {
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    const result = runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'HISTORICAL_BACKTEST',
        runKind: 'EXPERIMENT',
        partition: 'TRAIN',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: null,
      },
      createdAt: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const kinds = result.value.record.benchmarks.map((row) => row.kind);
    assert.ok(kinds.includes('CASH_NO_ACTION'));
    assert.ok(kinds.includes('BUY_AND_HOLD') || kinds.includes('HELIOS_H14_REFERENCE'));
  });

  it('remains restart-safe via immutable evaluation store snapshot', () => {
    const store = new ChronologicalEvaluationStore();
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'REPLAY',
        runKind: 'OFFICIAL_QUALIFICATION',
        partition: 'TRAIN',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: 'restart-seed',
        customerId: 'cust_restart',
      },
      createdAt: NOW,
      store,
    });
    const snap1 = store.snapshot();
    const snap2 = store.snapshot();
    assert.deepEqual(snap1.records.map((row) => row.evaluationId), snap2.records.map((row) => row.evaluationId));
    assert.equal(snap1.officialQualificationHistory.length, snap2.officialQualificationHistory.length);
  });

  it('isolates customer-private evaluations', () => {
    const store = new ChronologicalEvaluationStore();
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'REPLAY',
        runKind: 'EXPERIMENT',
        partition: 'TRAIN',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: 'cust_private_a',
      },
      createdAt: NOW,
      store,
    });
    runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'REPLAY',
        runKind: 'EXPERIMENT',
        partition: 'TRAIN',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: 'cust_private_b',
      },
      createdAt: NOW,
      store,
    });
    assert.equal(store.listForCustomer('cust_private_a').length, 1);
    assert.equal(store.listForCustomer('cust_private_b').length, 1);
    assert.notEqual(
      store.listForCustomer('cust_private_a')[0]?.evaluationId,
      store.listForCustomer('cust_private_b')[0]?.evaluationId,
    );
  });

  it('rejects tampered strategy capsule fingerprint', () => {
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const tampered = Object.freeze({
      ...capsule.value,
      fingerprint: 'deadbeef',
    });
    const manifest = chronologicalEvaluationManifest();
    const result = runChronologicalEvaluation({
      capsule: tampered,
      manifest,
      config: {
        mode: 'REPLAY',
        runKind: 'EXPERIMENT',
        partition: 'TRAIN',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: null,
      },
      createdAt: NOW,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'CAPSULE_FINGERPRINT_MISMATCH');
    }
  });

  it('tracks official qualification history immutably', () => {
    const store = new ChronologicalEvaluationStore();
    const clock = new FrozenClock(NOW);
    const capsule = buildReferenceCapsule(clock.now());
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    const manifest = chronologicalEvaluationManifest();
    runChronologicalEvaluation({
      capsule: capsule.value,
      manifest,
      config: {
        mode: 'HISTORICAL_BACKTEST',
        runKind: 'OFFICIAL_QUALIFICATION',
        partition: 'VALIDATION',
        period: manifest.timeRange,
        startingCapitalMinor: 100_000n,
        latency: DEFAULT_CONSERVATIVE_LATENCY,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 0n,
        seed: null,
        customerId: null,
      },
      createdAt: NOW,
      store,
    });
    const history = store.officialHistory(capsule.value.fingerprint, manifest.hash);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.runKind, 'OFFICIAL_QUALIFICATION');
  });

  it('passes Helios architecture boundary guard', () => {
    const violations = lintHeliosBoundary(process.cwd());
    assert.equal(violations.length, 0, violations.map((row) => row.message).join('\n'));
  });
});
