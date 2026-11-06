import type {
  Cf06LoggedTrajectorySample,
  CounterfactualQuantileEstimate,
  DistributionalPolicyEstimate,
  TailOutcomeState,
} from './types.ts';
import {
  formatMinor,
  meanBigint,
  parseMinor,
  quantileWeightedSorted,
  sqrtBigintFloor,
  variancePopulationBigint,
} from './numeric.ts';
import type { Cf06ValidationStrength } from './taxonomy.ts';

const WEIGHT_SCALE = 1_000_000;

function importanceWeights(samples: readonly Cf06LoggedTrajectorySample[]): number[] {
  return samples.map((s) => {
    const b = s.behaviorPolicyProbabilityBps;
    const e = s.evalPolicyProbabilityBps;
    if (!(b > 0 && e > 0)) {
      throw new Error('CF06: behavior and eval policy probabilities must be positive bps');
    }
    return e / b;
  });
}

function normalize(weights: number[]): number[] {
  let sum = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error('CF06: invalid importance weight');
    }
    sum += w;
  }
  if (!(sum > 0)) {
    throw new Error('CF06: importance weights sum to zero');
  }
  return weights.map((w) => w / sum);
}

function weightedMeanBigint(outcomes: readonly bigint[], wNorm: readonly number[]): bigint {
  let acc = 0n;
  for (let i = 0; i < outcomes.length; i += 1) {
    acc += outcomes[i]! * BigInt(Math.round(wNorm[i]! * WEIGHT_SCALE));
  }
  return acc / BigInt(WEIGHT_SCALE);
}

function orderIndicesByOutcome(outcomes: readonly bigint[]): number[] {
  return outcomes.map((_, i) => i).sort((i, j) => {
    const oi = outcomes[i]!;
    const oj = outcomes[j]!;
    if (oi < oj) {
      return -1;
    }
    if (oi > oj) {
      return 1;
    }
    return i - j;
  });
}

function directWeightedQuantile(outcomes: readonly bigint[], wNorm: readonly number[], q: number): bigint {
  const order = orderIndicesByOutcome(outcomes);
  const xs = order.map((i) => outcomes[i]!);
  const ws = normalize(order.map((i) => wNorm[i]!));
  return quantileWeightedSorted(xs, ws, q);
}

function weightedTailMean(outcomes: readonly bigint[], wNorm: readonly number[], lowerFrac: number, tail: 'LOW' | 'HIGH'): bigint {
  const n = outcomes.length;
  const order = orderIndicesByOutcome(outcomes);
  const k = Math.max(1, Math.floor(lowerFrac * n));
  const idxs = tail === 'LOW' ? order.slice(0, k) : order.slice(n - k);
  let den = 0;
  let num = 0n;
  for (const i of idxs) {
    const wi = wNorm[i]!;
    den += wi;
    num += outcomes[i]! * BigInt(Math.round(wi * WEIGHT_SCALE));
  }
  if (!(den > 0)) {
    return tail === 'LOW' ? outcomes[order[0]!]! : outcomes[order[n - 1]!]!;
  }
  return num / BigInt(Math.round(den * WEIGHT_SCALE));
}

/**
 * Quantile-based, IPS-weighted distributional estimator (research).
 * DR nuisance/Q̂ terms are intentionally omitted until validated state-conditional models exist.
 */
export function estimateDistributionalPolicyQuantileDoublyRobust(input: {
  readonly samples: readonly Cf06LoggedTrajectorySample[];
  readonly validationStrength: Cf06ValidationStrength;
  readonly drawdownThresholdMinor?: string | null;
}): DistributionalPolicyEstimate {
  const { samples, validationStrength } = input;
  const thrDrawdown = input.drawdownThresholdMinor != null ? parseMinor(input.drawdownThresholdMinor) : 0n;

  if (samples.length === 0) {
    throw new Error('CF06: quantile DR requires samples');
  }
  const outcomes = samples.map((s) => parseMinor(s.outcomeMinor));
  const wRaw = importanceWeights(samples);
  const wNorm = normalize(wRaw);

  const mean = weightedMeanBigint(outcomes, wNorm);
  const median = directWeightedQuantile(outcomes, wNorm, 0.5);
  const p05 = directWeightedQuantile(outcomes, wNorm, 0.05);
  const p10 = directWeightedQuantile(outcomes, wNorm, 0.1);
  const p25 = directWeightedQuantile(outcomes, wNorm, 0.25);
  const p75 = directWeightedQuantile(outcomes, wNorm, 0.75);
  const p90 = directWeightedQuantile(outcomes, wNorm, 0.9);
  const p95 = directWeightedQuantile(outcomes, wNorm, 0.95);

  const qe = (v: bigint, levelBps: number, se: bigint | null): CounterfactualQuantileEstimate => ({
    probabilityMassBps: levelBps,
    valueMinor: formatMinor(v),
    standardErrorMinor: se === null ? null : formatMinor(se),
  });

  const lossW = outcomes.reduce((acc, y, i) => acc + (y < 0n ? wNorm[i]! : 0), 0);
  const probLossBps = Math.round(lossW * 10000);

  let pddBps: number | null = null;
  const anyDd = samples.some((s) => s.peakToTroughDrawdownMinor != null);
  if (anyDd) {
    let sdd = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const dd = samples[i]!.peakToTroughDrawdownMinor;
      if (dd != null && parseMinor(dd) > thrDrawdown) {
        sdd += wNorm[i]!;
      }
    }
    pddBps = Math.round(sdd * 10000);
  }

  let esi = 0n;
  let wc = 0n;
  for (let i = 0; i < outcomes.length; i += 1) {
    if (outcomes[i]! <= p05) {
      const wi = BigInt(Math.round(wNorm[i]! * WEIGHT_SCALE));
      esi += outcomes[i]! * wi;
      wc += wi;
    }
  }
  const es = wc > 0n ? esi / wc : p05;

  const downside = weightedTailMean(outcomes, wNorm, 0.1, 'LOW');
  const upside = weightedTailMean(outcomes, wNorm, 0.1, 'HIGH');

  const tails: TailOutcomeState = {
    probabilityOfLossBps: probLossBps,
    probabilityOfDrawdownAboveThresholdBps: pddBps,
    expectedShortfallBelowP05Minor: formatMinor(es),
    upsideTailMeanMinor: formatMinor(upside),
    downsideTailMeanMinor: formatMinor(downside),
  };

  const unweightedMean = meanBigint([...outcomes]);
  const mVar = variancePopulationBigint(outcomes, unweightedMean);
  const mSe = sqrtBigintFloor(mVar / BigInt(outcomes.length));

  return {
    schema: 'sunrey.helios.cf06.distributional-policy-estimate.v1',
    estimatorKind: 'QUANTILE_DOUBLY_ROBUST_RESEARCH',
    validationStrength,
    sampleCountEffective: outcomes.length,
    quantiles: {
      mean: qe(mean, 0, mSe),
      median: qe(median, 5000, null),
      p05: qe(p05, 500, null),
      p10: qe(p10, 1000, null),
      p25: qe(p25, 2500, null),
      p75: qe(p75, 7500, null),
      p90: qe(p90, 9000, null),
      p95: qe(p95, 9500, null),
    },
    tails,
  };
}
