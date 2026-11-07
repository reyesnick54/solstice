import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BACKPRESSURE_POLICIES,
  MARKET_DATA_CIRCUIT_STATES,
  evaluateMd13LiveDataResilienceQualification,
  gateResearchAndPaperExecution,
  evaluateMarketDataCircuit,
  HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED,
  MD13_CHAOS_SCENARIOS,
  sloTargetForFeed,
} from '../packages/platform/src/helios/market-data-live/md13/index.ts';

describe('HELIOS MD13 live data resilience qualification', () => {
  it('exposes circuit states including MARKET_DATA_UNTRUSTED', () => {
    assert.ok(MARKET_DATA_CIRCUIT_STATES.includes('MARKET_DATA_UNTRUSTED'));
    assert.ok(BACKPRESSURE_POLICIES.includes('SPILL_DURABLE_QUEUE'));
  });

  it('uses provider-specific latency targets', () => {
    const a = sloTargetForFeed('feed_a');
    const b = sloTargetForFeed('feed_b');
    assert.ok(a.p50LatencyMs < b.p50LatencyMs);
    assert.ok(a.freshnessMaxMs < b.freshnessMaxMs);
  });

  it('defines twenty-one chaos scenarios', () => {
    assert.equal(MD13_CHAOS_SCENARIOS.length, 21);
  });

  it('emits HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED when harness passes', () => {
    const result = evaluateMd13LiveDataResilienceQualification();
    assert.equal(
      result.marker,
      HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED,
      result.blockers.join('; '),
    );
  });

  it('blocks research and paper execution when untrusted', () => {
    const evaluation = evaluateMarketDataCircuit({
      feedAAvailable: true,
      feedBAvailable: false,
      authoritativeSnapshotValid: false,
      sequenceContiguous: true,
      heartbeatFresh: true,
      checksumValid: true,
      clockSane: true,
    });
    assert.equal(evaluation.circuit, 'MARKET_DATA_UNTRUSTED');
    const gate = gateResearchAndPaperExecution(evaluation);
    assert.equal(gate.ok, false);
  });
});
