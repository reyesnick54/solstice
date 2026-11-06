import { DCF_ASSUMPTION_KEYS } from '../val04-probabilistic-dcf/taxonomy.ts';
import type { SinglePathDcfResult } from '../val04-probabilistic-dcf/types.ts';
import { DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE } from './taxonomy.ts';
import type {
  AssumptionSensitivity,
  ValuationUncertaintySource,
  ValuationUncertaintyState,
  VarianceContribution,
} from './types.ts';
import { mean, partialRankCorrelation, spearmanRankCorrelation, stdDev, variance } from './numeric.ts';

export function buildMonteCarloAttribution(paths: readonly SinglePathDcfResult[]): ValuationUncertaintyState {
  const enterpriseValues = paths.map((p) => p.enterpriseValue);
  const totalVar = variance(enterpriseValues);
  const evStd = stdDev(enterpriseValues);

  const assumptionSeries: Record<string, number[]> = {};
  for (const key of DCF_ASSUMPTION_KEYS) {
    assumptionSeries[key] = paths.map((p) => p.sampled[key]);
  }

  const sensitivities: AssumptionSensitivity[] = [];
  const rawRho: { key: string; rho: number; rhoPartial: number | null }[] = [];

  for (const key of DCF_ASSUMPTION_KEYS) {
    const series = assumptionSeries[key]!;
    const rho = spearmanRankCorrelation(series, enterpriseValues);
    const controls = DCF_ASSUMPTION_KEYS.filter((k) => k !== key).map((k) => assumptionSeries[k]!);
    const rhoPartial =
      controls.length <= 4 ? partialRankCorrelation(series, enterpriseValues, controls) : null;
    rawRho.push({ key, rho, rhoPartial });
    sensitivities.push(
      Object.freeze({
        assumptionKey: key,
        uncertaintySource: DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE[key],
        rankCorrelation: rho,
        partialRankCorrelation: rhoPartial,
        elasticityAtMedian: elasticityAtMedian(key, paths),
      }),
    );
  }

  const squared = rawRho.map((r) => ({ key: r.key, w: r.rho * r.rho }));
  const sumSq = squared.reduce((s, r) => s + r.w, 0) || 1;

  const varianceContributions: VarianceContribution[] = squared.map((row) => {
    const source = DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE[row.key as keyof typeof DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE];
    const fraction = row.w / sumSq;
    return Object.freeze({
      source,
      fractionOfExplainedVariance: fraction,
      absoluteVarianceShare: fraction * totalVar,
      method: 'RANK_CORRELATION' as const,
    });
  });

  const bySource = aggregateSources(varianceContributions, rawRho);

  return Object.freeze({
    totalEnterpriseValueVariance: totalVar,
    enterpriseValueStdDev: evStd,
    sources: bySource,
    assumptionSensitivities: Object.freeze(sensitivities),
    varianceContributions: Object.freeze(varianceContributions),
    sobolFirstOrder: null,
  });
}

function aggregateSources(
  contributions: readonly VarianceContribution[],
  rawRho: readonly { key: string; rho: number; rhoPartial: number | null }[],
): readonly ValuationUncertaintySource[] {
  const bucket = new Map<string, { varianceShare: number; rhos: number[]; partials: (number | null)[] }>();
  for (const c of contributions) {
    const prev = bucket.get(c.source) ?? { varianceShare: 0, rhos: [], partials: [] };
    prev.varianceShare += c.fractionOfExplainedVariance;
    bucket.set(c.source, prev);
  }
  for (const r of rawRho) {
    const source = DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE[r.key as keyof typeof DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE];
    const prev = bucket.get(source)!;
    prev.rhos.push(r.rho);
    prev.partials.push(r.rhoPartial);
  }
  return Object.freeze(
    [...bucket.entries()]
      .map(([source, agg]) =>
        Object.freeze({
          source: source as ValuationUncertaintySource['source'],
          label: source,
          varianceShare: agg.varianceShare,
          rankCorrelation: mean(agg.rhos),
          partialRankCorrelation: pickPartial(agg.partials),
          notes: Object.freeze([]),
        }),
      )
      .sort((a, b) => b.varianceShare - a.varianceShare),
  );
}

function pickPartial(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return mean(nums);
}

function elasticityAtMedian(key: string, paths: readonly SinglePathDcfResult[]): number | null {
  if (paths.length < 5) return null;
  const sorted = [...paths].sort((a, b) => a.enterpriseValue - b.enterpriseValue);
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  const lo = sorted[Math.max(0, Math.floor(sorted.length / 2) - 1)]!;
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 2) + 1)]!;
  const dY = hi.enterpriseValue - lo.enterpriseValue;
  const dX = (hi.sampled as Record<string, number>)[key]! - (lo.sampled as Record<string, number>)[key]!;
  if (Math.abs(dX) <= Number.EPSILON || mid.enterpriseValue === 0) return null;
  return (dY / mid.enterpriseValue) / dX;
}

/** Optional Sobol-style first-order estimates from binned conditional variance. */
export function buildSobolFirstOrder(
  paths: readonly SinglePathDcfResult[],
  assumptionKey: (typeof DCF_ASSUMPTION_KEYS)[number],
  bins = 8,
): VarianceContribution | null {
  if (paths.length < 2048) return null;
  const y = paths.map((p) => p.enterpriseValue);
  const x = paths.map((p) => p.sampled[assumptionKey]);
  const totalVar = variance(y);
  if (totalVar <= Number.EPSILON) return null;

  const order = x.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const binSize = Math.floor(order.length / bins);
  if (binSize < 16) return null;

  let between = 0;
  const grand = mean(y);
  for (let b = 0; b < bins; b += 1) {
    const slice = order.slice(b * binSize, (b + 1) * binSize);
    if (slice.length === 0) continue;
    const ys = slice.map((s) => y[s.i]!);
    const m = mean(ys);
    between += slice.length * (m - grand) ** 2;
  }
  between /= Math.max(1, order.length - 1);
  const fraction = Math.min(1, Math.max(0, between / totalVar));
  return Object.freeze({
    source: DCF_ASSUMPTION_TO_UNCERTAINTY_SOURCE[assumptionKey],
    fractionOfExplainedVariance: fraction,
    absoluteVarianceShare: fraction * totalVar,
    method: 'SOBOL_FIRST_ORDER',
  });
}

export function attachSobolAttribution(
  state: ValuationUncertaintyState,
  paths: readonly SinglePathDcfResult[],
): ValuationUncertaintyState {
  const sobol: VarianceContribution[] = [];
  for (const key of DCF_ASSUMPTION_KEYS) {
    const row = buildSobolFirstOrder(paths, key);
    if (row) sobol.push(row);
  }
  if (sobol.length === 0) return state;
  return Object.freeze({ ...state, sobolFirstOrder: Object.freeze(sobol) });
}
