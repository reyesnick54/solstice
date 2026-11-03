/**
 * Deterministic sandbox fixtures (shapes aligned with upstream mock_data.py @ OS14 SHA).
 * No live Polymarket network access.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { buildPredictionOrderBook, type RawBookLevel } from './order-book.ts';
import { canonicalPredictionMarketInstrumentId, outcomeIdFor } from './entity-resolution.ts';
import type { PredictionMarketInstrument } from './types.ts';
import {
  HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
  HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
} from './taxonomy.ts';

export const OS14_FIXTURE_VENUE_ID = 'polymarket_simulation' as const;
export const OS14_FIXTURE_NOW = asUtcInstant('2026-07-19T14:02:00.000Z');

type DemoMarketRow = {
  readonly slug: string;
  readonly question: string;
  readonly category: 'crypto' | 'economics' | 'politics';
  readonly impliedMidPpm: bigint;
  readonly volumeUsdcMinor: bigint;
  readonly resolveAt: UtcInstant;
  readonly yesBidPpm: bigint;
  readonly yesAskPpm: bigint;
};

const DEMO_MARKETS: readonly DemoMarketRow[] = Object.freeze([
  {
    slug: 'btc-100k-by-eoy',
    question: 'Will BTC hit $100k by end of year',
    category: 'crypto',
    impliedMidPpm: 310_000n,
    volumeUsdcMinor: 3_100_000_000_000n,
    resolveAt: asUtcInstant('2026-12-31T18:02:00.000Z'),
    yesBidPpm: 290_000n,
    yesAskPpm: 330_000n,
  },
  {
    slug: 'fed-cut-sep',
    question: 'Will the Fed cut rates in September',
    category: 'economics',
    impliedMidPpm: 680_000n,
    volumeUsdcMinor: 8_400_000_000_000n,
    resolveAt: asUtcInstant('2026-09-17T18:02:00.000Z'),
    yesBidPpm: 660_000n,
    yesAskPpm: 700_000n,
  },
  {
    slug: 'eth-4k-july',
    question: 'Will ETH close above $4k in July',
    category: 'crypto',
    impliedMidPpm: 120_000n,
    volumeUsdcMinor: 1_200_000_000_000n,
    resolveAt: asUtcInstant('2026-07-31T18:02:00.000Z'),
    yesBidPpm: 100_000n,
    yesAskPpm: 140_000n,
  },
  {
    slug: 'us-recession-2026',
    question: 'Will the US enter recession in 2026',
    category: 'economics',
    impliedMidPpm: 420_000n,
    volumeUsdcMinor: 2_700_000_000_000n,
    resolveAt: asUtcInstant('2027-02-03T18:02:00.000Z'),
    yesBidPpm: 400_000n,
    yesAskPpm: 440_000n,
  },
  {
    slug: 'sol-250-eoy',
    question: 'Will SOL hit $250 by end of year',
    category: 'crypto',
    impliedMidPpm: 540_000n,
    volumeUsdcMinor: 1_900_000_000_000n,
    resolveAt: asUtcInstant('2026-12-31T18:02:00.000Z'),
    yesBidPpm: 520_000n,
    yesAskPpm: 560_000n,
  },
  {
    slug: 'election-turnout-record',
    question: 'Will 2026 turnout set a record',
    category: 'politics',
    impliedMidPpm: 370_000n,
    volumeUsdcMinor: 4_200_000_000_000n,
    resolveAt: asUtcInstant('2026-11-05T18:02:00.000Z'),
    yesBidPpm: 350_000n,
    yesAskPpm: 390_000n,
  },
]);

export function demoPredictionMarkets(): readonly DemoMarketRow[] {
  return DEMO_MARKETS;
}

export function demoPredictionMarketInstrument(row: DemoMarketRow): PredictionMarketInstrument {
  const instrumentId = canonicalPredictionMarketInstrumentId({
    venueId: OS14_FIXTURE_VENUE_ID,
    marketSlug: row.slug,
  });
  const yesOutcomeId = outcomeIdFor(instrumentId, 'YES');
  const noOutcomeId = outcomeIdFor(instrumentId, 'NO');
  return Object.freeze({
    schema: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
    instrumentId,
    marketSlug: row.slug,
    question: row.question,
    category: row.category,
    venueId: OS14_FIXTURE_VENUE_ID,
    currency: 'USDC',
    outcomes: Object.freeze([
      Object.freeze({
        outcomeId: yesOutcomeId,
        side: 'YES',
        complementaryOutcomeId: noOutcomeId,
        tokenSymbol: null,
      }),
      Object.freeze({
        outcomeId: noOutcomeId,
        side: 'NO',
        complementaryOutcomeId: yesOutcomeId,
        tokenSymbol: null,
      }),
    ]),
    resolution: Object.freeze({
      resolutionState: 'OPEN',
      resolveAt: row.resolveAt,
      resolvedAt: null,
      resolutionSourceId: null,
      resolutionCriteriaHash: null,
    }),
    researchOnly: true,
    permitsLiveWagering: false,
  });
}

function level(pricePpm: bigint, sizeUsd: bigint): RawBookLevel {
  return Object.freeze({ impliedProbabilityPpm: pricePpm, sizeUsdcMinor: sizeUsd });
}

/** YES-heavy book skew aligned with upstream demo_book(). */
export function demoPredictionOrderBook(
  row: DemoMarketRow,
  timestamps: { readonly source: UtcInstant; readonly arrival: UtcInstant },
) {
  const instrumentId = canonicalPredictionMarketInstrumentId({
    venueId: OS14_FIXTURE_VENUE_ID,
    marketSlug: row.slug,
  });

  const yesBidLevels: RawBookLevel[] = [];
  const yesAskLevels: RawBookLevel[] = [];
  const noBidLevels: RawBookLevel[] = [];
  const noAskLevels: RawBookLevel[] = [];

  for (let i = 0; i < 5; i += 1) {
    const bidOffset = BigInt(i) * 5_000n;
    const askOffset = BigInt(i) * 5_000n;
    yesBidLevels.push(level(row.yesBidPpm - bidOffset, BigInt(8_000_000 - i * 800_000)));
    yesAskLevels.push(level(row.yesAskPpm + askOffset, BigInt(3_000_000 - i * 300_000)));
    noBidLevels.push(level(1_000_000n - row.yesAskPpm - askOffset, BigInt(2_500_000 - i * 250_000)));
    noAskLevels.push(level(1_000_000n - row.yesBidPpm + bidOffset, BigInt(6_000_000 - i * 600_000)));
  }

  return buildPredictionOrderBook({
    instrumentId,
    marketSlug: row.slug,
    sourceTimestamp: timestamps.source,
    arrivalTimestamp: timestamps.arrival,
    yesBidLevels,
    yesAskLevels,
    noBidLevels,
    noAskLevels,
    sequence: 1n,
  });
}

export function demoPrimaryMarketFixture() {
  const row = DEMO_MARKETS[0]!;
  const instrument = demoPredictionMarketInstrument(row);
  const orderBook = demoPredictionOrderBook(row, {
    source: OS14_FIXTURE_NOW,
    arrival: asUtcInstant('2026-07-19T14:02:05.000Z'),
  });
  return Object.freeze({ row, instrument, orderBook, volumeUsdcMinor: row.volumeUsdcMinor });
}
