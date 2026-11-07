import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MD13_CHAOS_SCENARIOS,
  MD13_SLO_DIMENSIONS,
  applyBackpressure,
  evaluateMarketDataCircuit,
  gateResearchAndPaperExecution,
  listMd13ChaosScenarios,
  runMd13LiveDataResilienceHarness,
  evaluateMd13LiveDataResilienceQualification,
  HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED,
  FEED_SPECIFIC_SLO_TARGETS,
  latencySloForFeed,
  fabricLatencyPercentiles,
  runMd13FabricScenario,
} from './index.ts';

describe('HELIOS MD13 live market-data resilience', () => {
  it('declares eight feed-scoped SLO dimensions without universal latency tables', () => {
    assert.equal(MD13_SLO_DIMENSIONS.length, 8);
    assert.notEqual(
      FEED_SPECIFIC_SLO_TARGETS.feed_a.p99LatencyMs,
      FEED_SPECIFIC_SLO_TARGETS.feed_b.p99LatencyMs,
    );
    assert.equal(latencySloForFeed('feed_a', 'p99_latency_ms'), FEED_SPECIFIC_SLO_TARGETS.feed_a.p99LatencyMs);
  });

  it('never silently drops raw events under backpressure spill', () => {
    const events = Array.from({ length: 40 }, (_, i) =>
      Object.freeze({
        eventId: `evt_${i}`,
        feedId: 'feed_a' as const,
        sequence: i + 1,
        payloadChecksum: `c_${i}`,
        observedAtMs: 1000 + i,
        isRaw: true as const,
      }),
    );
    const result = applyBackpressure({
      incoming: events,
      pendingRaw: [],
      derivedWork: [{ eventId: 'd1', parentSequence: 1, kind: 'vwap_tick' }],
      consumerLagMs: 2_500,
      persistenceLagMs: 15_000,
      maxBuffer: 10,
    });
    assert.equal(result.silentRawDrops, 0);
    assert.equal(result.state.bufferDepth + result.state.durableQueueDepth, events.length);
    assert.ok(result.state.policiesApplied.includes('SPILL_DURABLE_QUEUE'));
  });

  it('fails closed research when MARKET_DATA_UNTRUSTED', () => {
    const evaluation = evaluateMarketDataCircuit({
      feedAAvailable: false,
      feedBAvailable: false,
      authoritativeSnapshotValid: false,
      sequenceContiguous: false,
      heartbeatFresh: false,
      checksumValid: false,
      clockSane: false,
    });
    assert.equal(evaluation.circuit, 'MARKET_DATA_UNTRUSTED');
    const gate = gateResearchAndPaperExecution(evaluation);
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, 'MARKET_DATA_UNTRUSTED');
  });

  it('runs full chaos matrix', () => {
    assert.equal(listMd13ChaosScenarios().length, MD13_CHAOS_SCENARIOS.length);
    assert.equal(MD13_CHAOS_SCENARIOS.length, 21);
  });

  it('qualifies HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED', () => {
    const qualification = evaluateMd13LiveDataResilienceQualification();
    if (!qualification.qualified) {
      assert.fail(qualification.blockers.join('; '));
    }
    assert.equal(qualification.marker, HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED);
    const pct = fabricLatencyPercentiles(qualification.report.scenarios[0]!.metrics);
    assert.ok(pct.p50 <= pct.p95);
    assert.ok(pct.p95 <= pct.p99);
  });

  it('individual untrusted scenarios set circuit correctly', () => {
    for (const scenario of ['both_feeds_fail', 'checksum_mismatch', 'sequence_jump'] as const) {
      const row = runMd13FabricScenario(scenario);
      assert.equal(row.circuit, 'MARKET_DATA_UNTRUSTED');
      assert.equal(row.silentRawDrops, 0);
    }
  });

  it('harness report is internally consistent', () => {
    const report = runMd13LiveDataResilienceHarness();
    assert.equal(report.scenarios.length, 21);
    assert.equal(report.feedScopedSlo, true);
  });
});
