/**
 * HELIOS MARKET DATA MD02 — precision market time taxonomy.
 */

export const HELIOS_MD02_PRECISION_TIME_SCHEMA = 'sunrey.helios.market-data.md02.v1' as const;

export const HELIOS_MD02_PRECISION_TIME_QUALIFIED = 'HELIOS_MD02_PRECISION_TIME_QUALIFIED' as const;
export const HELIOS_MD02_PRECISION_TIME_BLOCKED = 'HELIOS_MD02_PRECISION_TIME_BLOCKED' as const;

export const CLOCK_DISCIPLINE_STATES = [
  'SYNCHRONIZED',
  'DEGRADED',
  'UNTRUSTED',
  'UNKNOWN',
] as const;
export type ClockDisciplineStateKind = (typeof CLOCK_DISCIPLINE_STATES)[number];

export const CLOCK_SYNC_SOURCES = ['NTP', 'PTP', 'SOFTWARE_WALL_CLOCK', 'HARDWARE_TIMESTAMP'] as const;
export type ClockSyncSource = (typeof CLOCK_SYNC_SOURCES)[number];

export const TIMESTAMP_PRECISIONS = ['NANOSECOND', 'MICROSECOND', 'MILLISECOND', 'SECOND', 'UNKNOWN'] as const;
export type TimestampPrecision = (typeof TIMESTAMP_PRECISIONS)[number];

/** Wall-clock tolerance before declaring source clocks ahead of ingestion. */
export const DEFAULT_CLOCK_AHEAD_TOLERANCE_MS = 5_000;
