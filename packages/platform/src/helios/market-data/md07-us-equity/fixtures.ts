/**
 * Simulation fixtures for MD07 U.S. equity market-state qualification.
 */

import { asUtcInstant } from '@solstice/domain';
import type {
  ComposeUsEquityMarketStateInput,
  UsEquityFeedObservationBundle,
  UsEquityVenueQuoteObservation,
} from './types.ts';

export const MD07_FIXTURE_INSTRUMENT_ID = 'SECURITY:US:AAPL:XNAS' as const;
export const MD07_FIXTURE_SYMBOL = 'AAPL' as const;
export const MD07_FIXTURE_EVALUATED_AT = asUtcInstant('2026-09-16T14:30:00.000Z');
export const MD07_FIXTURE_SOURCE_TS = asUtcInstant('2026-09-16T14:29:58.500Z');
export const MD07_FIXTURE_ARRIVAL_TS = asUtcInstant('2026-09-16T14:29:59.000Z');

function venueQuote(
  venueId: string,
  bid: bigint,
  bidSize: bigint,
  ask: bigint,
  askSize: bigint,
): UsEquityVenueQuoteObservation {
  return Object.freeze({
    venueId,
    bidPriceMinorUnits: bid,
    bidSizeShares: bidSize,
    askPriceMinorUnits: ask,
    askSizeShares: askSize,
    sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
    arrivalTimestamp: MD07_FIXTURE_ARRIVAL_TS,
  });
}

export function md07ConsolidatedFeedFixture(): UsEquityFeedObservationBundle {
  return Object.freeze({
    viewKind: 'CONSOLIDATED_VIEW',
    providerId: 'fixture_consolidated',
    observedAt: MD07_FIXTURE_ARRIVAL_TS,
    venueQuotes: Object.freeze([
      venueQuote('XNAS', 227_48n, 500n, 227_52n, 300n),
      venueQuote('XNYS', 227_47n, 200n, 227_53n, 100n),
      venueQuote('ARCX', 227_46n, 37n, 227_54n, 25n),
    ]),
    lastTrade: Object.freeze({
      priceMinorUnits: 227_50n,
      sizeShares: 100n,
      lotClassification: 'ROUND',
      venueId: 'XNAS',
      tradeId: 'trade-fixture-1',
      sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
      arrivalTimestamp: MD07_FIXTURE_ARRIVAL_TS,
    }),
    depth: null,
    auctionImbalance: null,
    tradingStatus: Object.freeze({
      status: 'REGULAR',
      haltReason: 'NONE',
      haltActive: false,
      shortSaleRestriction: false,
      sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
      arrivalTimestamp: MD07_FIXTURE_ARRIVAL_TS,
    }),
    shortSaleState: 'REG_SHO_NOT_TRIGGERED',
  });
}

export function md07DirectFeedFixture(): UsEquityFeedObservationBundle {
  return Object.freeze({
    viewKind: 'DIRECT_FEED_VIEW',
    providerId: 'fixture_direct',
    observedAt: asUtcInstant('2026-09-16T14:29:59.200Z'),
    venueQuotes: Object.freeze([venueQuote('XNAS', 227_49n, 100n, 227_51n, 80n)]),
    lastTrade: Object.freeze({
      priceMinorUnits: 227_49n,
      sizeShares: 37n,
      lotClassification: 'ODD',
      venueId: 'XNAS',
      tradeId: 'trade-fixture-2',
      sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
      arrivalTimestamp: asUtcInstant('2026-09-16T14:29:59.200Z'),
    }),
    depth: Object.freeze({
      bids: Object.freeze([
        Object.freeze({ priceMinorUnits: 227_49n, quantityMinorUnits: 100n, depth: 1 }),
        Object.freeze({ priceMinorUnits: 227_48n, quantityMinorUnits: 200n, depth: 2 }),
      ]),
      asks: Object.freeze([
        Object.freeze({ priceMinorUnits: 227_51n, quantityMinorUnits: 80n, depth: 1 }),
        Object.freeze({ priceMinorUnits: 227_52n, quantityMinorUnits: 150n, depth: 2 }),
      ]),
      sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
      arrivalTimestamp: asUtcInstant('2026-09-16T14:29:59.200Z'),
      sequence: 42n,
    }),
    auctionImbalance: null,
    tradingStatus: Object.freeze({
      status: 'REGULAR',
      haltReason: 'NONE',
      haltActive: false,
      shortSaleRestriction: false,
      sourceTimestamp: MD07_FIXTURE_SOURCE_TS,
      arrivalTimestamp: asUtcInstant('2026-09-16T14:29:59.200Z'),
    }),
    shortSaleState: 'REG_SHO_NOT_TRIGGERED',
  });
}

export function md07CrossedMarketVenueQuote(): UsEquityVenueQuoteObservation {
  return venueQuote('BATS', 227_55n, 100n, 227_54n, 100n);
}

export function md07OpeningAuctionFixture(): UsEquityFeedObservationBundle {
  const base = md07ConsolidatedFeedFixture();
  return Object.freeze({
    ...base,
    auctionImbalance: Object.freeze({
      auctionKind: 'OPENING',
      pairedShares: 1_200_000n,
      imbalanceShares: 45_000n,
      imbalanceSide: 'BUY',
      indicativeClearingPriceMinorUnits: 227_48n,
      nearPriceMinorUnits: 227_47n,
      farPriceMinorUnits: 227_49n,
      sourceTimestamp: asUtcInstant('2026-09-16T13:29:00.000Z'),
      arrivalTimestamp: asUtcInstant('2026-09-16T13:29:00.100Z'),
    }),
    tradingStatus: Object.freeze({
      status: 'AUCTION',
      haltReason: 'NONE',
      haltActive: false,
      shortSaleRestriction: false,
      sourceTimestamp: asUtcInstant('2026-09-16T13:29:00.000Z'),
      arrivalTimestamp: asUtcInstant('2026-09-16T13:29:00.100Z'),
    }),
  });
}

export function md07ComposeFixtureInput(
  overrides: Partial<ComposeUsEquityMarketStateInput> = {},
): ComposeUsEquityMarketStateInput {
  return Object.freeze({
    instrumentId: MD07_FIXTURE_INSTRUMENT_ID,
    symbol: MD07_FIXTURE_SYMBOL,
    currency: 'USD',
    priceScale: 2,
    evaluatedAt: MD07_FIXTURE_EVALUATED_AT,
    referencePriceMinorUnits: 227_50n,
    directFeed: md07DirectFeedFixture(),
    consolidatedFeed: md07ConsolidatedFeedFixture(),
    roundLotPolicyAsOf: MD07_FIXTURE_EVALUATED_AT,
    ...overrides,
  });
}
