import type { EnsembleValueQuantile } from './types.ts';

export function weightedMeanBigint(
  samples: readonly { valueMinor: bigint; weight: number }[],
): bigint | null {
  if (samples.length === 0) return null;
  let weighted = 0;
  let totalWeight = 0;
  for (const row of samples) {
    if (row.weight <= 0) continue;
    weighted += Number(row.valueMinor) * row.weight;
    totalWeight += row.weight;
  }
  if (totalWeight <= 0) return null;
  return BigInt(Math.round(weighted / totalWeight));
}

export function coefficientOfVariation(values: readonly bigint[]): number | null {
  if (values.length < 2) return null;
  const nums = values.map((v) => Number(v));
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (mean === 0) return null;
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance) / Math.abs(mean);
}

export function mergeQuantiles(
  quantileLabels: readonly string[],
  perModel: readonly { weight: number; quantiles: readonly EnsembleValueQuantile[] }[],
): readonly EnsembleValueQuantile[] {
  return Object.freeze(
    quantileLabels.map((quantile) => {
      const rows = perModel
        .map((m) => {
          const q = m.quantiles.find((row) => row.quantile === quantile);
          if (!q?.equityValuePerShareMinor) return null;
          return Object.freeze({ valueMinor: q.equityValuePerShareMinor, weight: m.weight });
        })
        .filter((r): r is { valueMinor: bigint; weight: number } => r !== null);

      const evRows = perModel
        .map((m) => {
          const q = m.quantiles.find((row) => row.quantile === quantile);
          if (!q?.enterpriseValueMinor) return null;
          return Object.freeze({ valueMinor: q.enterpriseValueMinor, weight: m.weight });
        })
        .filter((r): r is { valueMinor: bigint; weight: number } => r !== null);

      return Object.freeze({
        quantile,
        equityValuePerShareMinor: weightedMeanBigint(rows),
        enterpriseValueMinor: weightedMeanBigint(evRows),
      });
    }),
  );
}
