/**
 * MD13 continuous market-data fabric (deterministic simulation).
 */

import { applyBackpressure, type RawMarketEvent } from './backpressure.ts';
import { evaluateMarketDataCircuit } from './circuit.ts';
import { applyChaosToIngress, chaosExpectation } from './chaos.ts';
import type { Md13ChaosScenarioId, Md13FeedId } from './taxonomy.ts';
import type { Md13ChaosScenarioResult, Md13FabricMetrics, Md13RawIngressPacket } from './types.ts';

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function defaultPackets(feed: Md13FeedId, count: number, baseMs: number): Md13RawIngressPacket[] {
  return Array.from({ length: count }, (_, i) =>
    Object.freeze({
      packetId: `${feed}_pkt_${i}`,
      feedId: feed,
      sequence: i + 1,
      checksum: `chk_${feed}_${i + 1}`,
      payload: JSON.stringify({ px: 100 + i, feed }),
      sentAtMs: baseMs + i * 10,
    }),
  );
}

export function buildBaselineIngress(): readonly Md13RawIngressPacket[] {
  const base = 1_700_000_000_000;
  return Object.freeze([...defaultPackets('feed_a', 40, base), ...defaultPackets('feed_b', 30, base)]);
}

function dedupePackets(packets: readonly Md13RawIngressPacket[]): readonly Md13RawIngressPacket[] {
  const seen = new Set<string>();
  const out: Md13RawIngressPacket[] = [];
  for (const pkt of packets) {
    const key = `${pkt.feedId}:${pkt.sequence}:${pkt.checksum}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pkt);
  }
  return Object.freeze(out);
}

function sortByFeedSequence(packets: readonly Md13RawIngressPacket[]): readonly Md13RawIngressPacket[] {
  return Object.freeze(
    [...packets].sort((a, b) => {
      if (a.feedId !== b.feedId) return a.feedId.localeCompare(b.feedId);
      return a.sequence - b.sequence;
    }),
  );
}

function toRawEvents(packets: readonly Md13RawIngressPacket[], receivedAtMs: number): RawMarketEvent[] {
  return packets.map((pkt) =>
    Object.freeze({
      eventId: pkt.packetId,
      feedId: pkt.feedId,
      sequence: pkt.sequence,
      payloadChecksum: pkt.checksum,
      observedAtMs: receivedAtMs + (pkt.sentAtMs % 100),
      isRaw: true as const,
    }),
  );
}

export function runMd13FabricScenario(scenarioId: Md13ChaosScenarioId): Md13ChaosScenarioResult {
  const expectation = chaosExpectation(scenarioId);
  const ingress = buildBaselineIngress();
  const chaos = applyChaosToIngress(scenarioId, ingress);

  const normalized = sortByFeedSequence(dedupePackets(chaos.delivered));
  const rawEvents = toRawEvents(normalized, 1_700_000_000_100);

  const derived = rawEvents.slice(0, Math.min(12, rawEvents.length)).map((row) =>
    Object.freeze({
      eventId: `drv_${row.eventId}`,
      parentSequence: row.sequence,
      kind: 'vwap_tick' as const,
    }),
  );

  const backpressure = applyBackpressure({
    incoming: rawEvents,
    pendingRaw: [],
    derivedWork: derived,
    consumerLagMs: chaos.consumerLagMs,
    persistenceLagMs: chaos.persistenceLagMs,
    maxBuffer: scenarioId === 'backpressure' ? 24 : 256,
  });

  const latencies = backpressure.rawEvents.map((row) => Math.max(1, row.observedAtMs - row.sequence * 10));
  const sortedLatency = [...latencies].sort((a, b) => a - b);

  const gapRecoveryMs =
    expectation.expectGapRecovery || chaos.dropped > 0 || chaos.reordered
      ? Math.max(200, chaos.dropped * 120 + (chaos.reordered ? 400 : 0))
      : null;
  const snapshotRecoveryMs =
    expectation.expectSnapshotRecovery || chaos.processRestarted
      ? chaos.processRestarted
        ? 4_500
        : 2_800
      : null;

  const trust = evaluateMarketDataCircuit({
    feedAAvailable: !chaos.feedADown,
    feedBAvailable: !chaos.feedBDown,
    authoritativeSnapshotValid: chaos.snapshotValid,
    sequenceContiguous: chaos.sequenceContiguous,
    heartbeatFresh: chaos.heartbeatFresh,
    checksumValid: chaos.checksumValid,
    clockSane: chaos.clockSane,
  });

  const metrics: Md13FabricMetrics = Object.freeze({
    availabilityRatio: chaos.feedADown && chaos.feedBDown ? 0 : chaos.feedADown || chaos.feedBDown ? 0.92 : 0.998,
    freshnessMs: chaos.heartbeatFresh ? 120 : 9_500,
    latenciesMs: Object.freeze(latencies),
    gapRecoveryMs,
    snapshotRecoveryMs,
    desyncDurationMs: chaos.feedADown !== chaos.feedBDown ? 1_200 : 0,
  });

  let passed = backpressure.silentRawDrops === 0;
  if (expectation.rawPreservationRequired && backpressure.silentRawDrops > 0) {
    passed = false;
  }
  if (expectation.circuitMayUntrust && trust.circuit !== 'MARKET_DATA_UNTRUSTED' && scenarioId === 'both_feeds_fail') {
    passed = false;
  }
  if (
    scenarioId === 'checksum_mismatch' ||
    scenarioId === 'sequence_jump' ||
    scenarioId === 'stale_snapshot' ||
    scenarioId === 'both_feeds_fail' ||
    scenarioId === 'clock_jump'
  ) {
    if (trust.circuit !== 'MARKET_DATA_UNTRUSTED') passed = false;
  }

  const message =
    passed
      ? 'chaos scenario behaved within MD13 policy'
      : `chaos scenario failed: circuit=${trust.circuit} silentDrops=${backpressure.silentRawDrops}`;

  return Object.freeze({
    scenarioId,
    passed,
    silentRawDrops: backpressure.silentRawDrops,
    circuit: trust.circuit,
    metrics: Object.freeze({
      ...metrics,
      latenciesMs: Object.freeze(sortedLatency),
    }),
    backpressurePolicies: backpressure.state.policiesApplied,
    message,
  });
}

export function fabricLatencyPercentiles(metrics: Md13FabricMetrics): {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
} {
  const sorted = [...metrics.latenciesMs].sort((a, b) => a - b);
  return Object.freeze({
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  });
}
