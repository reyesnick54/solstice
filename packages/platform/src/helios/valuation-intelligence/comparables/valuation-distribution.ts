import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import type { ComparableValuationDistribution } from './types.ts';

export function buildComparableValuationDistribution(
  values: readonly number[],
  weights: readonly number[],
): ComparableValuationDistribution {
  if (values.length === 0) {
    return Object.freeze({
      p05: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      sampleCount: 0,
      effectiveSampleWeight: 0,
    });
  }

  const expanded = expandWeightedSamples(values, weights, 256);
  const pct = distributionPercentiles(expanded);
  const effectiveSampleWeight = weights.reduce((a, b) => a + b, 0);

  return Object.freeze({
    ...pct,
    sampleCount: values.length,
    effectiveSampleWeight,
  });
}

function expandWeightedSamples(
  values: readonly number[],
  weights: readonly number[],
  targetSize: number,
): readonly number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return values;

  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    const reps = Math.max(1, Math.round((w / total) * targetSize));
    for (let r = 0; r < reps; r++) {
      out.push(values[i]!);
    }
  }
  return Object.freeze(out);
}

/** Deterministic seeded Gaussian copula adjustment for research (optional). */
export function applySeededCopulaSpread(
  values: readonly number[],
  seed: number,
  dependency: number,
): readonly number[] {
  if (values.length < 4 || dependency <= 0) return values;
  const rng = mulberry32(seed);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Object.freeze(
    values.map((v) => {
      const u = rng();
      const z = inverseNormalCdf(u);
      const shock = dependency * z * (mean * 0.02);
      return v + shock;
    }),
  );
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function inverseNormalCdf(p: number): number {
  const x = p <= 0 ? 1e-6 : p >= 1 ? 1 - 1e-6 : p;
  return Math.sqrt(2) * erfinv(2 * x - 1);
}

function erfinv(x: number): number {
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const first = 2 / (Math.PI * a) + ln / 2;
  const sign = x < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.sqrt(first * first - ln / a) - first);
}
