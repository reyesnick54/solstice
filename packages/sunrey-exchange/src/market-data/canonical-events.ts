/**
 * MD01 — Exchange market-data event contract (extends canonical Exchange owner).
 */

export {
  MARKET_DATA_EVENT_SCHEMA_VERSION,
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY,
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  MARKET_EVENT_QUALITY_STATES,
  validateMarketDataEventEnvelope,
  isDecimalString,
  type CanonicalMarketDataEvent,
  type CanonicalMarketDataEventKind,
  type MarketTradeEvent,
  type MarketQuoteEvent,
  type MarketBookUpdate,
  type MarketBookSnapshot,
  type MarketStatusEvent,
  type AuctionEvent,
  type ImbalanceEvent,
  type ReferencePriceEvent,
  type SettlementPriceEvent,
  type OpenInterestEvent,
  type FundingRateEvent,
  type IndexPriceEvent,
  type MarkPriceEvent,
} from '@solstice/provider-sdk';

export const EXCHANGE_MARKET_DATA_OBSERVATION_ONLY = 'MARKET_OBSERVATION_ONLY' as const;
