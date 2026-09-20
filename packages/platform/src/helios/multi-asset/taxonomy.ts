/**
 * HELIOS Multi-Asset Expansion M03 — market session, calendar, and contract taxonomies.
 */

export const HELIOS_MULTI_ASSET_M03 = 'HELIOS_MULTI_ASSET_M03' as const;

export const MARKET_STATES = [
  'OPEN',
  'CLOSED',
  'PRE_MARKET',
  'POST_MARKET',
  'MAINTENANCE',
  'HALTED',
  'UNKNOWN',
] as const;
export type MarketState = (typeof MARKET_STATES)[number];

export const ROLL_STATES = [
  'NO_ROLL_REQUIRED',
  'APPROACHING_ROLL',
  'ROLL_ELIGIBLE',
  'ROLL_REQUIRED',
  'EXPIRED',
] as const;
export type RollState = (typeof ROLL_STATES)[number];

export const SESSION_MODES = [
  'REGULAR_SCHEDULED',
  'PRE_POST_EXTENDED',
  'TWENTY_FOUR_SEVEN',
  'TWENTY_THREE_FIVE',
  'FX_WEEKDAY',
] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SETTLEMENT_TYPES = ['CASH', 'PHYSICAL', 'FINANCIAL'] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const INSTRUMENT_KINDS = [
  'EQUITY',
  'ETF',
  'CRYPTO',
  'FUTURES',
  'COMMODITY_FUTURES',
  'FX',
  'CONTINUOUS_RESEARCH',
] as const;
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number];

export const VENUE_SIGNAL_KINDS = [
  'AUTHORITATIVE_HALT',
  'MAINTENANCE',
  'PROVIDER_OUTAGE',
  'STALE_FEED',
  'DEGRADED_VENUE',
  'UNKNOWN_STATUS',
] as const;
export type VenueSignalKind = (typeof VENUE_SIGNAL_KINDS)[number];

export const TRADABILITY_OUTCOMES = [
  'TRADABLE',
  'RESEARCH_ONLY',
  'CLOSED',
  'BLOCKED',
  'UNKNOWN',
] as const;
export type TradabilityOutcome = (typeof TRADABILITY_OUTCOMES)[number];

export const MARKET_CALENDAR_REASON_CODES = [
  'OK',
  'WEEKEND',
  'HOLIDAY',
  'EARLY_CLOSE',
  'OUTSIDE_SESSION',
  'PRE_MARKET',
  'POST_MARKET',
  'MAINTENANCE_WINDOW',
  'AUTHORITATIVE_HALT',
  'PROVIDER_OUTAGE',
  'STALE_FEED',
  'DEGRADED_VENUE',
  'UNKNOWN_CALENDAR',
  'UNKNOWN_STATUS',
  'CONTRACT_EXPIRED',
  'ROLL_REQUIRED',
  'CONTINUOUS_NOT_EXECUTABLE',
  'CALENDAR_MISSING',
] as const;
export type MarketCalendarReasonCode = (typeof MARKET_CALENDAR_REASON_CODES)[number];
