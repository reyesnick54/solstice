import { RATIO_UNIT, integerSqrt, ratioFromUnits, type Ratio } from '@solstice/risk';

export function totalReturnRatio(startingMinor: bigint, endingMinor: bigint): Ratio {
  if (startingMinor <= 0n) {
    return ratioFromUnits(0n);
  }
  return ratioFromUnits(((endingMinor - startingMinor) * RATIO_UNIT) / startingMinor);
}

export function activeReturnRatio(absolute: Ratio, benchmark: Ratio): Ratio {
  return ratioFromUnits(absolute.units - benchmark.units);
}

export function periodReturnsFromEquity(
  equity: readonly { readonly totalMinor: bigint }[],
): readonly bigint[] {
  const out: bigint[] = [];
  for (let i = 1; i < equity.length; i += 1) {
    const prev = equity[i - 1];
    const current = equity[i];
    if (!prev || !current || prev.totalMinor <= 0n) {
      continue;
    }
    out.push(((current.totalMinor - prev.totalMinor) * RATIO_UNIT) / prev.totalMinor);
  }
  return out;
}

function meanUnits(values: readonly bigint[]): bigint {
  if (values.length === 0) {
    return 0n;
  }
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

/** Tracking error: sample stdev of period active returns (scale-8 units). */
export function trackingErrorFromActiveSeries(activePeriodReturns: readonly bigint[]): Ratio | null {
  if (activePeriodReturns.length < 2) {
    return null;
  }
  const n = BigInt(activePeriodReturns.length);
  const avg = meanUnits(activePeriodReturns);
  const squared = activePeriodReturns.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0n);
  const variance = squared / (n - 1n);
  const stdev = integerSqrt(variance < 0n ? 0n : variance);
  return ratioFromUnits(stdev);
}

export function informationRatio(active: Ratio, trackingError: Ratio | null): Ratio | null {
  if (trackingError == null || trackingError.units === 0n) {
    return null;
  }
  return ratioFromUnits((active.units * RATIO_UNIT) / trackingError.units);
}

export function alignActivePeriodReturns(
  strategyEquity: readonly { readonly at: string; readonly totalMinor: bigint }[],
  benchmarkEquity: readonly { readonly at: string; readonly totalMinor: bigint }[],
): readonly bigint[] {
  const benchByAt = new Map(benchmarkEquity.map((row) => [row.at, row.totalMinor]));
  const active: bigint[] = [];
  for (let i = 1; i < strategyEquity.length; i += 1) {
    const prev = strategyEquity[i - 1];
    const current = strategyEquity[i];
    if (!prev || !current || prev.totalMinor <= 0n) {
      continue;
    }
    const benchPrev = benchByAt.get(prev.at);
    const benchCur = benchByAt.get(current.at);
    if (benchPrev == null || benchCur == null || benchPrev <= 0n) {
      continue;
    }
    const stratR = ((current.totalMinor - prev.totalMinor) * RATIO_UNIT) / prev.totalMinor;
    const benchR = ((benchCur - benchPrev) * RATIO_UNIT) / benchPrev;
    active.push(stratR - benchR);
  }
  return active;
}

export function sumRatioUnits(lines: readonly Ratio[]): Ratio {
  return ratioFromUnits(lines.reduce((sum, row) => sum + row.units, 0n));
}
