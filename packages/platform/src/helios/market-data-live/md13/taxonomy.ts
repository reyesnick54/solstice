/**
 * HELIOS MARKET DATA — MD13 taxonomy (simulation / qualification only).
 */

export const HELIOS_MD13_SCHEMA = 'sunrey.helios.market-data-live.md13.v1' as const;

export const MARKET_DATA_CIRCUIT_STATES = Object.freeze([
  'TRUSTED',
  'DEGRADED',
  'MARKET_DATA_UNTRUSTED',
] as const);

export type MarketDataCircuitState = (typeof MARKET_DATA_CIRCUIT_STATES)[number];

/** Explicit backpressure policies — raw event preservation has priority. */
export const BACKPRESSURE_POLICIES = Object.freeze([
  'BUFFER',
  'SPILL_DURABLE_QUEUE',
  'SHED_NONCRITICAL_DERIVED',
  'MARK_FEED_DEGRADED',
] as const);

export type BackpressurePolicy = (typeof BACKPRESSURE_POLICIES)[number];

export const MD13_SLO_DIMENSIONS = Object.freeze([
  'availability',
  'freshness',
  'p50_latency_ms',
  'p95_latency_ms',
  'p99_latency_ms',
  'gap_recovery_time_ms',
  'snapshot_recovery_time_ms',
  'desynchronization_duration_ms',
] as const);

export type Md13SloDimension = (typeof MD13_SLO_DIMENSIONS)[number];

export const MD13_CHAOS_SCENARIOS = Object.freeze([
  'packet_loss',
  'duplicate_packets',
  'reordering',
  'websocket_disconnect',
  'tcp_disconnect',
  'provider_429',
  'provider_500',
  'dns_failure',
  'heartbeat_loss',
  'sequence_jump',
  'checksum_mismatch',
  'stale_snapshot',
  'clock_drift',
  'clock_jump',
  'feed_a_failure',
  'feed_b_failure',
  'both_feeds_fail',
  'slow_consumer',
  'backpressure',
  'persistence_slowdown',
  'process_restart',
] as const);

export type Md13ChaosScenarioId = (typeof MD13_CHAOS_SCENARIOS)[number];

export const MD13_FEED_IDS = Object.freeze(['feed_a', 'feed_b'] as const);
export type Md13FeedId = (typeof MD13_FEED_IDS)[number];

export type Md13FeedSloTarget = {
  readonly feedId: Md13FeedId;
  readonly providerId: string;
  readonly transport: 'websocket' | 'rest';
  readonly availabilityMinRatio: number;
  readonly freshnessMaxMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly gapRecoveryMaxMs: number;
  readonly snapshotRecoveryMaxMs: number;
  readonly desyncMaxMs: number;
};
