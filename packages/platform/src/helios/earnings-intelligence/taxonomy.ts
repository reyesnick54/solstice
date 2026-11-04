/**
 * EARN01 — HELIOS canonical earnings intelligence taxonomy.
 * Research and observation only; no execution authority.
 */

export const HELIOS_EARNINGS_INTELLIGENCE_SCHEMA = 'sunrey.helios.earn01.earnings-intelligence.v1' as const;

export const HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/earnings-intelligence' as const;

export const EARNINGS_ANNOUNCEMENT_STATES = [
  'EXPECTED',
  'CONFIRMED',
  'RELEASED',
  'CALL_SCHEDULED',
  'CALL_COMPLETED',
  'AMENDED',
  'CANCELLED',
  'UNKNOWN',
] as const;
export type EarningsAnnouncementState = (typeof EARNINGS_ANNOUNCEMENT_STATES)[number];

export const EARNINGS_SESSION_CLASSIFICATIONS = [
  'BEFORE_MARKET',
  'DURING_MARKET',
  'AFTER_MARKET',
  'NON_TRADING_DAY',
  'UNKNOWN',
] as const;
export type EarningsSessionClassification = (typeof EARNINGS_SESSION_CLASSIFICATIONS)[number];

export const EARNINGS_OBSERVATION_KINDS = [
  'release',
  'actual',
  'expectation',
  'consensus',
  'guidance',
  'transcript',
  'options',
  'market_reaction',
  'peer_context',
] as const;
export type EarningsObservationKind = (typeof EARNINGS_OBSERVATION_KINDS)[number];

export const HELIOS_EARN01_DOMAIN_QUALIFIED = 'HELIOS_EARN01_DOMAIN_QUALIFIED' as const;
export const HELIOS_EARN01_DOMAIN_BLOCKED = 'HELIOS_EARN01_DOMAIN_BLOCKED' as const;
