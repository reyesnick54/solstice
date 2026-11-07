/**
 * Top-of-book and depth metrics derived only from visible book liquidity.
 */

import type { BookLevel, BookMetrics, BookTopOfBookMetrics } from './types.ts';

function micropriceMinor(bestBid: BookLevel, bestAsk: BookLevel): bigint {
  const bidQ = bestBid.quantityMinorUnits;
  const askQ = bestAsk.quantityMinorUnits;
  const denom = bidQ + askQ;
  if (denom === 0n) {
    return (bestBid.priceMinorUnits + bestAsk.priceMinorUnits) / 2n;
  }
  return (bestBid.priceMinorUnits * askQ + bestAsk.priceMinorUnits * bidQ) / denom;
}

export function computeTopOfBookMetrics(
  bids: readonly BookLevel[],
  asks: readonly BookLevel[],
): BookTopOfBookMetrics {
  const bestBid = bids[0] ?? null;
  const bestAsk = asks[0] ?? null;
  const midMinorUnits =
    bestBid && bestAsk ? (bestBid.priceMinorUnits + bestAsk.priceMinorUnits) / 2n : null;
  const spreadMinorUnits =
    bestBid && bestAsk ? bestAsk.priceMinorUnits - bestBid.priceMinorUnits : null;
  const micropriceMinorUnits = bestBid && bestAsk ? micropriceMinor(bestBid, bestAsk) : null;
  return Object.freeze({
    bestBid,
    bestAsk,
    midMinorUnits,
    spreadMinorUnits,
    micropriceMinorUnits,
  });
}

export function computeBookMetrics(
  bids: readonly BookLevel[],
  asks: readonly BookLevel[],
  executable: boolean,
): BookMetrics {
  const top = computeTopOfBookMetrics(bids, asks);
  const bidDepthMinorUnits = bids.reduce((sum, row) => sum + row.quantityMinorUnits, 0n);
  const askDepthMinorUnits = asks.reduce((sum, row) => sum + row.quantityMinorUnits, 0n);
  const total = bidDepthMinorUnits + askDepthMinorUnits;
  const imbalancePpm =
    total > 0n ? ((bidDepthMinorUnits - askDepthMinorUnits) * 1_000_000n) / total : null;
  return Object.freeze({
    ...top,
    bidDepthMinorUnits,
    askDepthMinorUnits,
    imbalancePpm,
    levelsBid: bids.length,
    levelsAsk: asks.length,
    executable,
  });
}
