/**
 * Deterministic fixed-point ratios for risk analytics.
 *
 * Scale 8: 100_000_000 units = 1 whole (100 percent).
 * 60 percent = 60_000_000. 30 percent = 30_000_000.
 *
 * All arithmetic is bigint. No JavaScript number enters an authoritative path.
 * Statistical outputs (volatility, drawdown) are analytical estimates, not Money.
 */

export const RATIO_SCALE = 8 as const;
export const RATIO_UNIT = 100_000_000n;

export type Ratio = {
  readonly units: bigint;
  readonly scale: typeof RATIO_SCALE;
};

export function ratioFromUnits(units: bigint): Ratio {
  return Object.freeze({ units, scale: RATIO_SCALE });
}

export function ratioZero(): Ratio {
  return ratioFromUnits(0n);
}

export function ratioPercent(percent: bigint): Ratio {
  return ratioFromUnits(percent * 1_000_000n);
}

export function shareOf(partMinor: bigint, wholeMinor: bigint): Ratio {
  if (wholeMinor <= 0n) {
    return ratioZero();
  }
  return ratioFromUnits((partMinor * RATIO_UNIT) / wholeMinor);
}

export function applyRatio(amountMinor: bigint, ratio: Ratio): bigint {
  return (amountMinor * ratio.units) / RATIO_UNIT;
}

export function ratioCmp(left: Ratio, right: Ratio): -1 | 0 | 1 {
  if (left.units < right.units) {
    return -1;
  }
  if (left.units > right.units) {
    return 1;
  }
  return 0;
}

export function integerSqrt(value: bigint): bigint {
  if (value <= 0n) {
    return 0n;
  }
  let x0 = value;
  let x1 = (x0 + 1n) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

export function serializeRatio(ratio: Ratio): { readonly units: string; readonly scale: typeof RATIO_SCALE } {
  return { units: ratio.units.toString(), scale: RATIO_SCALE };
}
