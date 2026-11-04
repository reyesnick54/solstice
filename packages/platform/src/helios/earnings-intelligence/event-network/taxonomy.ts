/**
 * HELIOS EARN08 — earnings event network (peer transfer, attention, PEAD diagnostics).
 * Research and association support only; does not grant Execution Authority.
 */

export const HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA = 'sunrey.helios.earnings-event-network.v1' as const;
export const HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY = 'REFERENCE_ONLY' as const;

export const EARNINGS_PEER_RELATIONSHIP_TYPES = [
  'SAME_INDUSTRY',
  'SAME_SUBINDUSTRY',
  'COMPETITOR',
  'SUPPLIER',
  'CUSTOMER',
  'ETF_COMPONENT',
  'INDEX_COMPONENT',
  'COMMON_COMMODITY_EXPOSURE',
] as const;
export type EarningsPeerRelationshipType = (typeof EARNINGS_PEER_RELATIONSHIP_TYPES)[number];

/** Supply-chain edges require explicit evidence; taxonomy encodes the gate in qualification. */
export const EVIDENCE_REQUIRED_PEER_RELATIONSHIPS = [
  'SUPPLIER',
  'CUSTOMER',
  'COMPETITOR',
] as const satisfies readonly EarningsPeerRelationshipType[];

export const EARNINGS_SURPRISE_STATES = [
  'BEAT',
  'MISS',
  'INLINE',
  'MIXED',
  'UNKNOWN',
] as const;
export type EarningsSurpriseState = (typeof EARNINGS_SURPRISE_STATES)[number];

export const EARNINGS_GUIDANCE_DIRECTIONS = [
  'RAISED',
  'LOWERED',
  'MAINTAINED',
  'WITHDRAWN',
  'MIXED',
  'UNKNOWN',
] as const;
export type EarningsGuidanceDirection = (typeof EARNINGS_GUIDANCE_DIRECTIONS)[number];

export const EARNINGS_SIGNAL_DIRECTIONS = [
  'IMPROVING',
  'DETERIORATING',
  'STABLE',
  'MIXED',
  'UNKNOWN',
] as const;
export type EarningsSignalDirection = (typeof EARNINGS_SIGNAL_DIRECTIONS)[number];

export const MARKET_CAP_BUCKETS = ['MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO', 'UNKNOWN'] as const;
export type MarketCapBucket = (typeof MARKET_CAP_BUCKETS)[number];

export const LIQUIDITY_BUCKETS = ['HIGH', 'MEDIUM', 'LOW', 'ILLIQUID', 'UNKNOWN'] as const;
export type LiquidityBucket = (typeof LIQUIDITY_BUCKETS)[number];

export const MARKET_REGIME_LABELS = [
  'RISK_ON',
  'RISK_OFF',
  'NEUTRAL',
  'HIGH_VOL',
  'LOW_VOL',
  'UNKNOWN',
] as const;
export type MarketRegimeLabel = (typeof MARKET_REGIME_LABELS)[number];

export const PEAD_RESEARCH_HORIZON_DAYS = [1, 5, 20, 60] as const;
export type PeaDResearchHorizonDays = (typeof PEAD_RESEARCH_HORIZON_DAYS)[number];

export const HELIOS_EARN08_EVENT_NETWORK_QUALIFIED = 'HELIOS_EARN08_EVENT_NETWORK_QUALIFIED' as const;
export const HELIOS_EARN08_EVENT_NETWORK_BLOCKED = 'HELIOS_EARN08_EVENT_NETWORK_BLOCKED' as const;

export const HELIOS_EARN08 = 'HELIOS_EARN08' as const;
