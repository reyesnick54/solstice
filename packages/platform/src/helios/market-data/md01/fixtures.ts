import type { MarketQuoteEvent, MarketTradeEvent } from '@solstice/provider-sdk';
import {
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_SCHEMA_VERSION,
} from '@solstice/provider-sdk';

const BASE = {
  schemaVersion: MARKET_DATA_EVENT_SCHEMA_VERSION,
  authority: MARKET_DATA_EVENT_AUTHORITY,
  grantsExecutionAuthority: false as const,
  instrumentId: 'helios:equity:AAPL:USD',
  venueId: 'XNAS',
  providerId: 'simulation-market-data',
  sourceFeedId: 'fixture-quote-trade',
  sourceSequence: 42n,
  eventTime: '2026-03-01T14:30:00.000Z',
  exchangeTime: '2026-03-01T14:30:00.000Z',
  providerPublishTime: '2026-03-01T14:30:00.100Z',
  sunreyReceiveTime: '2026-03-01T14:30:00.250Z',
  normalizedTime: '2026-03-01T14:30:00.300Z',
  knowableAt: '2026-03-01T14:30:00.300Z',
  sourceRef: 'fixture:md01:trade-quote:1',
  entitlementRef: 'entitlement:sandbox_test:fixture',
  qualityState: 'VALID' as const,
};

export function md01TradeEventFixture(overrides?: Partial<MarketTradeEvent>): MarketTradeEvent {
  return Object.freeze({
    ...BASE,
    eventKind: 'MarketTradeEvent',
    eventId: 'md01-fixture-trade-1',
    tradeId: 't-1',
    price: '187.2500',
    quantity: '100.0000',
    aggressorSide: 'buy',
    ...overrides,
  });
}

export function md01QuoteEventFixture(overrides?: Partial<MarketQuoteEvent>): MarketQuoteEvent {
  return Object.freeze({
    ...BASE,
    eventKind: 'MarketQuoteEvent',
    eventId: 'md01-fixture-quote-1',
    bidPrice: '187.2400',
    bidQuantity: '500.0000',
    askPrice: '187.2600',
    askQuantity: '400.0000',
    sourceSequence: 41n,
    ...overrides,
  });
}

export function md01DelayedQuoteFixture(): MarketQuoteEvent {
  return md01QuoteEventFixture({
    eventId: 'md01-fixture-quote-delayed',
    providerPublishTime: '2026-03-01T14:29:50.000Z',
    sunreyReceiveTime: '2026-03-01T14:30:05.000Z',
    knowableAt: '2026-03-01T14:30:05.000Z',
    qualityState: 'DEGRADED_STALE',
  });
}
