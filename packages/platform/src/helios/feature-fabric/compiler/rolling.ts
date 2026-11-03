import type { TemporalObservation } from '../temporal-types.ts';

export function rollingSumMinor(
  series: readonly TemporalObservation[],
  window: number,
): bigint | null {
  if (window <= 0) {
    return null;
  }
  if (series.length < window) {
    return null;
  }
  const slice = series.slice(-window);
  let total = 0n;
  for (const row of slice) {
    total += row.valueMinor;
  }
  return total;
}

export function laggedValueMinor(series: readonly TemporalObservation[], lagPeriods: number): bigint | null {
  if (lagPeriods < 0) {
    return null;
  }
  const index = series.length - 1 - lagPeriods;
  if (index < 0) {
    return null;
  }
  return series[index]?.valueMinor ?? null;
}

export function crossSectionalRankBps(
  values: readonly { readonly instrumentId: string; readonly valueMinor: bigint }[],
  instrumentId: string,
): bigint | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => {
    if (a.valueMinor === b.valueMinor) {
      return a.instrumentId.localeCompare(b.instrumentId);
    }
    return a.valueMinor < b.valueMinor ? -1 : 1;
  });
  const index = sorted.findIndex((row) => row.instrumentId === instrumentId);
  if (index < 0) {
    return null;
  }
  const rank = index + 1;
  const scale = 10_000n;
  return (BigInt(rank) * scale) / BigInt(sorted.length);
}
