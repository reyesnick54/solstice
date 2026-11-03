/**
 * CLOB order-book analytics for prediction-market YES/NO contracts.
 */

import { PREDICTION_PROBABILITY_SCALE } from './taxonomy.ts';
import type { CloBookMetrics, CloOrderBookSnapshot } from './types.ts';

function sumQuantity(levels: readonly { readonly quantityMinorUnits: bigint }[]): bigint {
  let total = 0n;
  for (const level of levels) {
    total += level.quantityMinorUnits;
  }
  return total;
}

export function computeClobBookMetrics(snapshot: CloOrderBookSnapshot): CloBookMetrics {
  const bids = snapshot.book.bids;
  const asks = snapshot.book.asks;
  const bestBidMinor = bids[0]?.priceMinorUnits ?? null;
  const bestAskMinor = asks[0]?.priceMinorUnits ?? null;
  const midMinor =
    bestBidMinor !== null && bestAskMinor !== null
      ? (bestBidMinor + bestAskMinor) / 2n
      : bestBidMinor ?? bestAskMinor;
  const spreadMinor =
    bestBidMinor !== null && bestAskMinor !== null ? bestAskMinor - bestBidMinor : null;
  const spreadBps =
    spreadMinor !== null && midMinor !== null && midMinor > 0n
      ? Number((spreadMinor * 10_000n) / midMinor)
      : null;
  const bidDepth = sumQuantity(bids);
  const askDepth = sumQuantity(asks);
  const totalDepth = bidDepth + askDepth;
  const imbalanceScaled =
    totalDepth > 0n ? Number((bidDepth - askDepth) * 10_000n / totalDepth) / 10_000 : 0;

  return Object.freeze({
    contractInstrumentId: snapshot.contractInstrumentId,
    bestBidMinor,
    bestAskMinor,
    midMinor,
    spreadMinor,
    spreadBps,
    bidDepthContracts: bidDepth,
    askDepthContracts: askDepth,
    imbalanceScaled,
    volume24hContracts: snapshot.volume24hContracts,
  });
}

export function complementGapMinor(yesMidMinor: bigint | null, noMidMinor: bigint | null): bigint | null {
  if (yesMidMinor === null || noMidMinor === null) {
    return null;
  }
  const sum = yesMidMinor + noMidMinor;
  const gap = sum > PREDICTION_PROBABILITY_SCALE ? sum - PREDICTION_PROBABILITY_SCALE : PREDICTION_PROBABILITY_SCALE - sum;
  return gap;
}
