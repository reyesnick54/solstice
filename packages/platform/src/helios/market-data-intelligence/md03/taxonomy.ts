/**
 * HELIOS Market Data MD03 — generic exchange feed transport taxonomy.
 * CME-style dual feeds, incremental deltas, and market-recovery snapshots.
 */

export const HELIOS_MD03_FEED_INTERFACE_SCHEMA = 'sunrey.helios.market-data.md03-feed.v1' as const;
export const HELIOS_MD03_FEED_INTERFACE_AUTHORITY = 'REFERENCE_ONLY' as const;

export const MD03_FEED_ROLES = ['PRIMARY', 'SECONDARY'] as const;
export type Md03FeedRole = (typeof MD03_FEED_ROLES)[number];

export const MD03_FEED_MODES = ['INCREMENTAL', 'SNAPSHOT', 'RECOVERY'] as const;
export type Md03FeedMode = (typeof MD03_FEED_MODES)[number];

export const MD03_RECOVERY_PHASES = ['GAP_DETECTED', 'RECOVERY_REQUESTED', 'RECOVERY_IN_PROGRESS', 'RECOVERED', 'FAILED'] as const;
export type Md03RecoveryPhase = (typeof MD03_RECOVERY_PHASES)[number];

export const MD03_SEQUENCE_OUTCOMES = [
  'APPLIED',
  'DUPLICATE',
  'GAP',
  'REGRESSION',
  'STALE',
  'REJECTED_MALFORMED',
] as const;
export type Md03SequenceOutcome = (typeof MD03_SEQUENCE_OUTCOMES)[number];
