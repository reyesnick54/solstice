/**
 * HELIOS MD09 — multi-venue crypto real-time market fabric taxonomy.
 */

export const HELIOS_MD09_SCHEMA = 'helios.md09-crypto-market-fabric.v1' as const;

export const MD09_MARKET_DATA_KINDS = [
  'spot_trade',
  'quote',
  'l2_book',
  'l3_book',
  'funding',
  'mark_price',
  'index_price',
  'open_interest',
  'liquidation',
  'venue_status',
] as const;
export type Md09MarketDataKind = (typeof MD09_MARKET_DATA_KINDS)[number];

export const MD09_VENUE_HEALTH_STATES = [
  'NORMAL',
  'DEGRADED',
  'STALE',
  'DESYNCHRONIZED',
  'UNAVAILABLE',
] as const;
export type Md09VenueHealthState = (typeof MD09_VENUE_HEALTH_STATES)[number];

export const MD09_REFERENCE_VENUES = [
  'kraken',
  'binance',
  'bybit',
  'okx',
  'bitget',
  'gate',
  'kucoin',
  'hyperliquid',
] as const;
