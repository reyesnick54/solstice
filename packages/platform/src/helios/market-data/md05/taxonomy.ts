/**
 * HELIOS Market Data MD05 — feed roles, quality dimensions, qualification markers.
 *
 * Read-only market truth arbitration. Does not issue Execution Authority.
 */

export const HELIOS_MD05_SCHEMA = 'sunrey.helios.market-data.md05.v1' as const;

export const HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED =
  'HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED' as const;

export const HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED =
  'HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED' as const;

/** Redundant feed lane classification for arbitration. */
export const FEED_REPLICA_ROLES = [
  'PRIMARY_A',
  'PRIMARY_B',
  'SECONDARY_VENDOR',
  'SIP_OR_CONSOLIDATED',
  'DIRECT_VENUE',
] as const;
export type FeedReplicaRole = (typeof FEED_REPLICA_ROLES)[number];

export const MD05_QUALITY_DIMENSIONS = [
  'sequenceIntegrity',
  'freshness',
  'latency',
  'coverage',
  'timestampQuality',
  'revisionRate',
  'historicalReliability',
  'availability',
] as const;
export type Md05QualityDimension = (typeof MD05_QUALITY_DIMENSIONS)[number];

export const MD05_QUALITY_BANDS = ['STRONG', 'ACCEPTABLE', 'DEGRADED', 'FAILED'] as const;
export type Md05QualityBand = (typeof MD05_QUALITY_BANDS)[number];

export const FAILOVER_SCOPES = ['READ_ONLY_MARKET_DATA'] as const;
export type FailoverScope = (typeof FAILOVER_SCOPES)[number];

export const CONSENSUS_OUTCOMES = [
  'UNANIMOUS',
  'PRIMARY_SELECTED',
  'DIVERGENT',
  'INCOMPATIBLE',
  'INSUFFICIENT_SOURCES',
] as const;
export type ConsensusOutcome = (typeof CONSENSUS_OUTCOMES)[number];

export const FEED_REPLICA_HEALTH = ['ACTIVE', 'DEGRADED', 'STALE', 'UNAVAILABLE'] as const;
export type FeedReplicaHealth = (typeof FEED_REPLICA_HEALTH)[number];
