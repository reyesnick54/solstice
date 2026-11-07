/**
 * MD13 feed/provider-specific SLO targets — not universal latency promises.
 */

import type { Md13FeedId, Md13FeedSloTarget, Md13SloDimension } from './taxonomy.ts';

export const FEED_SPECIFIC_SLO_TARGETS: Readonly<Record<Md13FeedId, Md13FeedSloTarget>> = Object.freeze({
  feed_a: Object.freeze({
    feedId: 'feed_a',
    providerId: 'fixture_crypto_ws',
    transport: 'websocket',
    availabilityMinRatio: 0.995,
    freshnessMaxMs: 2_500,
    p50LatencyMs: 45,
    p95LatencyMs: 180,
    p99LatencyMs: 350,
    gapRecoveryMaxMs: 8_000,
    snapshotRecoveryMaxMs: 15_000,
    desyncMaxMs: 5_000,
  }),
  feed_b: Object.freeze({
    feedId: 'feed_b',
    providerId: 'fixture_equity_rest',
    transport: 'rest',
    availabilityMinRatio: 0.99,
    freshnessMaxMs: 15_000,
    p50LatencyMs: 120,
    p95LatencyMs: 450,
    p99LatencyMs: 900,
    gapRecoveryMaxMs: 30_000,
    snapshotRecoveryMaxMs: 60_000,
    desyncMaxMs: 20_000,
  }),
});

export function sloTargetForFeed(feedId: Md13FeedId): Md13FeedSloTarget {
  return FEED_SPECIFIC_SLO_TARGETS[feedId];
}

/**
 * Latency SLOs are defined per feed; comparing feeds with one universal bound is rejected.
 */
export function rejectUniversalLatencyTarget(dimension: Md13SloDimension, valueMs: number): void {
  if (
    dimension === 'p50_latency_ms' ||
    dimension === 'p95_latency_ms' ||
    dimension === 'p99_latency_ms'
  ) {
    const a = FEED_SPECIFIC_SLO_TARGETS.feed_a;
    const b = FEED_SPECIFIC_SLO_TARGETS.feed_b;
    const spansBoth =
      valueMs >= Math.min(a.p95LatencyMs, b.p95LatencyMs) &&
      valueMs <= Math.max(a.p99LatencyMs, b.p99LatencyMs);
    if (spansBoth) {
      throw new Error('MD13 rejects universal latency targets; use feed-specific SLO tables');
    }
  }
}

export function latencySloForFeed(
  feedId: Md13FeedId,
  dimension: 'p50_latency_ms' | 'p95_latency_ms' | 'p99_latency_ms',
): number {
  const target = sloTargetForFeed(feedId);
  switch (dimension) {
    case 'p50_latency_ms':
      return target.p50LatencyMs;
    case 'p95_latency_ms':
      return target.p95LatencyMs;
    case 'p99_latency_ms':
      return target.p99LatencyMs;
    default:
      throw new Error(`unsupported latency dimension ${dimension}`);
  }
}
