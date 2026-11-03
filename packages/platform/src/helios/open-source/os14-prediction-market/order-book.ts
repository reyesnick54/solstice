/**
 * CLOB normalization — paired YES/NO book structure (ported from upstream BookSide/ClobBook).
 */

import type { UtcInstant } from '@solstice/domain';
import { assertProbabilityPpm, bookImbalancePpm, midImpliedMarketProbabilityPpm, spreadPpm } from './probability.ts';
import type {
  PredictionBookLevel,
  PredictionMicrostructureMetrics,
  PredictionOrderBook,
  PredictionOrderBookSide,
} from './types.ts';
import { HELIOS_OS14_PREDICTION_MARKET_AUTHORITY, HELIOS_OS14_PREDICTION_MARKET_SCHEMA } from './taxonomy.ts';
import type { CrossOutcomeConsistencyCode } from './taxonomy.ts';

export type RawBookLevel = {
  readonly impliedProbabilityPpm: bigint;
  readonly sizeUsdcMinor: bigint;
};

export function normalizeBookSide(
  levels: readonly RawBookLevel[],
  side: 'bid' | 'ask',
): PredictionOrderBookSide {
  const sorted = [...levels].sort((a, b) => {
    const cmp =
      side === 'bid'
        ? Number(b.impliedProbabilityPpm - a.impliedProbabilityPpm)
        : Number(a.impliedProbabilityPpm - b.impliedProbabilityPpm);
    return cmp;
  });

  let total = 0n;
  const normalized: PredictionBookLevel[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const level = sorted[i]!;
    assertProbabilityPpm(level.impliedProbabilityPpm);
    if (level.sizeUsdcMinor < 0n) {
      throw new Error('NEGATIVE_SIZE');
    }
    total += level.sizeUsdcMinor;
    normalized.push(
      Object.freeze({
        impliedProbabilityPpm: level.impliedProbabilityPpm,
        sizeUsdcMinor: level.sizeUsdcMinor,
        depthRank: i + 1,
      }),
    );
  }

  return Object.freeze({
    levels: Object.freeze(normalized),
    totalUsdcMinor: total,
    bestImpliedProbabilityPpm: normalized[0]?.impliedProbabilityPpm ?? null,
  });
}

export function buildPredictionOrderBook(input: {
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly yesBidLevels: readonly RawBookLevel[];
  readonly yesAskLevels: readonly RawBookLevel[];
  readonly noBidLevels: readonly RawBookLevel[];
  readonly noAskLevels: readonly RawBookLevel[];
  readonly sequence?: bigint | null;
}): PredictionOrderBook {
  const yesBids = normalizeBookSide(input.yesBidLevels, 'bid');
  const yesAsks = normalizeBookSide(input.yesAskLevels, 'ask');
  const noBids = normalizeBookSide(input.noBidLevels, 'bid');
  const noAsks = normalizeBookSide(input.noAskLevels, 'ask');

  return Object.freeze({
    schema: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
    instrumentId: input.instrumentId,
    marketSlug: input.marketSlug,
    sourceTimestamp: input.sourceTimestamp,
    arrivalTimestamp: input.arrivalTimestamp,
    yesBids,
    yesAsks,
    noBids,
    noAsks,
    sequence: input.sequence ?? null,
  });
}

function sumSideDepth(...sides: readonly PredictionOrderBookSide[]): bigint {
  return sides.reduce((acc, side) => acc + side.totalUsdcMinor, 0n);
}

export function assessCrossOutcomeConsistency(book: PredictionOrderBook): {
  readonly code: CrossOutcomeConsistencyCode;
  readonly complementSumBestAskPpm: bigint | null;
  readonly complementSumBestBidPpm: bigint | null;
} {
  const yesAsk = book.yesAsks.bestImpliedProbabilityPpm;
  const noAsk = book.noAsks.bestImpliedProbabilityPpm;
  const yesBid = book.yesBids.bestImpliedProbabilityPpm;
  const noBid = book.noBids.bestImpliedProbabilityPpm;

  if (yesAsk === null || noAsk === null || yesBid === null || noBid === null) {
    return Object.freeze({
      code: 'INSUFFICIENT_DEPTH',
      complementSumBestAskPpm: null,
      complementSumBestBidPpm: null,
    });
  }

  const askSum = yesAsk + noAsk;
  const bidSum = yesBid + noBid;
  const driftTolerancePpm = 50_000n;

  if (askSum < 1_000_000n - driftTolerancePpm || bidSum > 1_000_000n + driftTolerancePpm) {
    return Object.freeze({
      code: 'CROSSED_COMPLEMENT',
      complementSumBestAskPpm: askSum,
      complementSumBestBidPpm: bidSum,
    });
  }

  if (askSum > 1_000_000n + driftTolerancePpm || bidSum < 1_000_000n - driftTolerancePpm) {
    return Object.freeze({
      code: 'COMPLEMENT_DRIFT',
      complementSumBestAskPpm: askSum,
      complementSumBestBidPpm: bidSum,
    });
  }

  return Object.freeze({
    code: 'COMPLEMENT_OK',
    complementSumBestAskPpm: askSum,
    complementSumBestBidPpm: bidSum,
  });
}

export function computeMicrostructureMetrics(book: PredictionOrderBook): PredictionMicrostructureMetrics {
  const yesBid = book.yesBids.bestImpliedProbabilityPpm;
  const yesAsk = book.yesAsks.bestImpliedProbabilityPpm;
  if (yesBid === null || yesAsk === null) {
    throw new Error('YES_BBO_REQUIRED');
  }

  const impliedMarketMidPpm = midImpliedMarketProbabilityPpm(yesBid, yesAsk);
  const yesSpread = spreadPpm(yesBid, yesAsk);

  const yesHeavyUsd =
    book.yesBids.totalUsdcMinor + book.noAsks.totalUsdcMinor;
  const noHeavyUsd =
    book.noBids.totalUsdcMinor + book.yesAsks.totalUsdcMinor;

  const cross = assessCrossOutcomeConsistency(book);

  return Object.freeze({
    impliedMarketMidPpm,
    yesSpreadPpm: yesSpread,
    bookImbalancePpm: bookImbalancePpm(yesHeavyUsd, noHeavyUsd),
    bidDepthUsdcMinor: sumSideDepth(book.yesBids, book.noBids),
    askDepthUsdcMinor: sumSideDepth(book.yesAsks, book.noAsks),
    totalVisibleLiquidityUsdcMinor: sumSideDepth(book.yesBids, book.yesAsks, book.noBids, book.noAsks),
    crossOutcomeConsistency: cross.code,
    complementSumBestAskPpm: cross.complementSumBestAskPpm,
    complementSumBestBidPpm: cross.complementSumBestBidPpm,
  });
}
