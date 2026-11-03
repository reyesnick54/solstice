/**
 * HELIOS OS04 — multi-venue provider adapter conformance taxonomy.
 */

export const HELIOS_VENUE_ADAPTER_SCHEMA_VERSION = 'helios.venue-adapter.v1' as const;

export const VENUE_CAPABILITY_AVAILABILITY = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type VenueCapabilityAvailability = (typeof VENUE_CAPABILITY_AVAILABILITY)[number];

export const VENUE_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;
export type VenueHealthState = (typeof VENUE_HEALTH_STATES)[number];

export const VENUE_ASSET_CLASSES = [
  'crypto_spot',
  'crypto_perpetual',
  'crypto_futures',
  'crypto_options',
] as const;
export type VenueAssetClass = (typeof VENUE_ASSET_CLASSES)[number];

export const VENUE_MARKET_DATA_TYPES = [
  'ticker',
  'order_book',
  'trades',
  'candles',
  'funding_rate',
  'open_interest',
  'index_price',
  'mark_price',
] as const;
export type VenueMarketDataType = (typeof VENUE_MARKET_DATA_TYPES)[number];

export const VENUE_TIMESTAMP_SEMANTICS = [
  'exchange_event_time_utc',
  'exchange_event_time_ms',
  'server_receive_time_utc',
  'unspecified',
] as const;
export type VenueTimestampSemantics = (typeof VENUE_TIMESTAMP_SEMANTICS)[number];

export const VENUE_ORDER_TYPES = [
  'MARKET',
  'LIMIT',
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
  'TAKE_PROFIT',
  'TAKE_PROFIT_LIMIT',
  'TRAILING_STOP',
] as const;
export type VenueOrderType = (typeof VENUE_ORDER_TYPES)[number];

export const VENUE_TIME_IN_FORCE = ['GTC', 'IOC', 'FOK', 'GTD', 'PO'] as const;
export type VenueTimeInForce = (typeof VENUE_TIME_IN_FORCE)[number];

export const VENUE_CONFORMANCE_OUTCOMES = ['PASS', 'FAIL', 'SKIPPED'] as const;
export type VenueConformanceOutcome = (typeof VENUE_CONFORMANCE_OUTCOMES)[number];

export const VENUE_CONFORMANCE_QUALIFICATION_MODES = ['fixture', 'readonly_live'] as const;
export type VenueConformanceQualificationMode =
  (typeof VENUE_CONFORMANCE_QUALIFICATION_MODES)[number];

export const HELIOS_OS04_VENUE_IDS = [
  'kraken',
  'binance',
  'bybit',
  'okx',
  'bitget',
  'gate',
  'kucoin',
  'hyperliquid',
] as const;
export type HeliosOs04VenueId = (typeof HELIOS_OS04_VENUE_IDS)[number];

export function isHeliosOs04VenueId(value: string): value is HeliosOs04VenueId {
  return (HELIOS_OS04_VENUE_IDS as readonly string[]).includes(value);
}
