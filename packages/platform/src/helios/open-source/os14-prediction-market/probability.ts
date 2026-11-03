/**
 * Implied market probability representation (integer ppm — not objective truth).
 */

/** Parts-per-million scale for probabilities in [0, 1]. */
export const PROBABILITY_PPM_SCALE = 1_000_000n as const;

/** USDC minor units (6 decimal places) for CLOB depth and notional research. */
export const USDC_MINOR_SCALE = 1_000_000n as const;

export function assertProbabilityPpm(value: bigint): void {
  if (value < 0n || value > PROBABILITY_PPM_SCALE) {
    throw new Error('PROBABILITY_PPM_OUT_OF_RANGE');
  }
}

export function midImpliedMarketProbabilityPpm(yesBidPpm: bigint, yesAskPpm: bigint): bigint {
  assertProbabilityPpm(yesBidPpm);
  assertProbabilityPpm(yesAskPpm);
  if (yesBidPpm > yesAskPpm) {
    throw new Error('CROSSED_YES_MARKET');
  }
  return (yesBidPpm + yesAskPpm) / 2n;
}

export function spreadPpm(bidPpm: bigint, askPpm: bigint): bigint {
  assertProbabilityPpm(bidPpm);
  assertProbabilityPpm(askPpm);
  if (askPpm < bidPpm) {
    return 0n;
  }
  return askPpm - bidPpm;
}

/** Research prior vs implied market mid — not labeled as "true" probability. */
export function researchEdgeVsImpliedMarketPpm(
  impliedMarketMidPpm: bigint,
  researchPriorPpm: bigint,
): bigint {
  assertProbabilityPpm(impliedMarketMidPpm);
  assertProbabilityPpm(researchPriorPpm);
  return impliedMarketMidPpm - researchPriorPpm;
}

export function feeAdjustedResearchEdgePpm(
  rawEdgePpm: bigint,
  feePpmPerSide: bigint,
  sides: 1 | 2 = 2,
): bigint {
  if (feePpmPerSide < 0n) {
    throw new Error('FEE_PPM_NEGATIVE');
  }
  const totalFee = feePpmPerSide * BigInt(sides);
  return rawEdgePpm - totalFee;
}

/** Fixed-point imbalance in ppm: +1_000_000 = fully YES-heavy, -1_000_000 = fully NO-heavy. */
export function bookImbalancePpm(yesSideUsdMinor: bigint, noSideUsdMinor: bigint): bigint {
  if (yesSideUsdMinor < 0n || noSideUsdMinor < 0n) {
    throw new Error('NEGATIVE_BOOK_NOTIONAL');
  }
  const denom = yesSideUsdMinor + noSideUsdMinor;
  if (denom === 0n) {
    return 0n;
  }
  return ((yesSideUsdMinor - noSideUsdMinor) * PROBABILITY_PPM_SCALE) / denom;
}
