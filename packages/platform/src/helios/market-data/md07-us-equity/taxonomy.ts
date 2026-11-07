/**
 * HELIOS Market Data MD07 — U.S. equity market-state taxonomies.
 */

export const HELIOS_MD07 = 'HELIOS_MD07' as const;

export const HELIOS_MD07_SCHEMA = 'sunrey.helios.md07.us-equity-market-state.v1' as const;
export const HELIOS_MD07_AUTHORITY = 'MARKET_DATA_OBSERVATION_ONLY' as const;

export const US_EQUITY_FEED_VIEW_KINDS = ['DIRECT_FEED_VIEW', 'CONSOLIDATED_VIEW'] as const;
export type UsEquityFeedViewKind = (typeof US_EQUITY_FEED_VIEW_KINDS)[number];

export const QUOTE_TOPOLOGY_STATES = [
  'NORMAL',
  'LOCKED',
  'CROSSED',
  'ONE_SIDED',
  'EMPTY',
] as const;
export type QuoteTopologyState = (typeof QUOTE_TOPOLOGY_STATES)[number];

export const US_EQUITY_LOT_CLASSIFICATIONS = ['ROUND', 'ODD', 'MIXED', 'UNKNOWN'] as const;
export type UsEquityLotClassification = (typeof US_EQUITY_LOT_CLASSIFICATIONS)[number];

export const US_EQUITY_AUCTION_KINDS = ['OPENING', 'CLOSING', 'IPO', 'HALT_REOPENING'] as const;
export type UsEquityAuctionKind = (typeof US_EQUITY_AUCTION_KINDS)[number];

export const US_EQUITY_TRADING_STATUSES = [
  'REGULAR',
  'PRE_MARKET',
  'AFTER_HOURS',
  'HALTED',
  'LIMITED',
  'AUCTION',
  'CLOSED',
  'UNKNOWN',
] as const;
export type UsEquityTradingStatusCode = (typeof US_EQUITY_TRADING_STATUSES)[number];

export const US_EQUITY_HALT_REASONS = [
  'NEWS_PENDING',
  'LULD',
  'REGULATORY',
  'OPERATIONAL',
  'IPO',
  'OTHER',
  'UNKNOWN',
  'NONE',
] as const;
export type UsEquityHaltReason = (typeof US_EQUITY_HALT_REASONS)[number];

export const SHORT_SALE_REFERENCE_STATES = [
  'REG_SHO_NOT_TRIGGERED',
  'REG_SHO_TRIGGERED',
  'SSR_ACTIVE',
  'SHORT_EXEMPT',
  'NOT_REPORTED',
  'UNKNOWN',
] as const;
export type ShortSaleReferenceState = (typeof SHORT_SALE_REFERENCE_STATES)[number];

export const US_EQUITY_IMBALANCE_SIDES = ['BUY', 'SELL', 'NONE', 'UNKNOWN'] as const;
export type UsEquityImbalanceSide = (typeof US_EQUITY_IMBALANCE_SIDES)[number];
