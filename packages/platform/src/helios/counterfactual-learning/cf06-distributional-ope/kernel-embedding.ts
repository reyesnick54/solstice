import type {
  Cf06LoggedTrajectorySample,
  CounterfactualQuantileEstimate,
  DistributionalPolicyEstimate,
  TailOutcomeState,
} from './types.ts';
import {
  formatMinor,
  invertSmoothedCdf,
  meanBigint,
  minorToNumberSafe,
  parseMinor,
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

function silvermanBandwidth(values: readonly number[], weights: readonly number[]): number {
  const n = values.length;
  if (n < 2) {
    const span = Math.max(1, Math.abs(values[0] ?? 1));
    return 0.01 * span;
  }
  let sumW = 0;
  let sumX = 0;
  for (let i = 0; i < n; i += 1) {
    sumW += weights[i]!;
    sumX += values[i]! * weights[i]!;
  }
  const mu = sumX / sumW;
  let varAcc = 0;
  for (let i = 0; i < n; i += 1) {
    const d = values[i]! - mu;
    varAcc += weights[i]! * d * d;
  }
  const varPop = varAcc / sumW;
  const sigma = Math.sqrt(Math.max(varPop, 1e-18));
  const iqrGuess = 1.349 * sigma;
  const nEff = sumW;
  const h = 1.06 * Math.min(sigma, iqrGuess / 1.34) * Math.pow(nEff, -1 / 5);
  return Math.max(h, 1e-9 * Math.max(Math.abs(mu), 1));
}

/**
 * Kernel-smoothed distributional embedding of counterfactual mean embeddings:
 * weights are IPS ratios πe/πb; CDF is Σ w_i Φ((y − y_i)/h) / Σ w_i.
 */
export function estimateDistributionalPolicyKernelEmbedding(input: {
  readonly samples: readonly Cf06LoggedTrajectorySample[];
  readonly validationStrength: Cf06ValidationStrength;
  readonly drawdownThresholdMinor?: string | null;
}): DistributionalPolicyEstimate {
  const { samples, validationStrength } = input;
  const thrDrawdown = input.drawdownThresholdMinor != null ? parseMinor(input.drawdownThresholdMinor) : 0n;

  if (samples.length === 0) {
    throw new Error('CF06: kernel embedding requires samples');
  }

  const outcomes = samples.map((s) => parseMinor(s.outcomeMinor));
  const wNorm = normalize(importanceWeights(samples));
  const valuesNum = outcomes.map((o) => minorToNumberSafe(formatMinor(o)));
  const h = silvermanBandwidth(valuesNum, wNorm);

  const minV = Math.min(...valuesNum);
  const maxV = Math.max(...valuesNum);
  const pad = Math.max(h * 4, (maxV - minV) * 0.05, 1);
  const lo = minV - pad;
  const hi = maxV + pad;

  const qAt = (target: number): bigint => {
    const yNum = invertSmoothedCdf(target, valuesNum, wNorm, h, lo, hi);
    return BigInt(Math.round(yNum));
  };

  const mean = weightedMeanBigint(outcomes, wNorm);
  const median = qAt(0.5);
  const p05 = qAt(0.05);
  const p10 = qAt(0.1);
  const p25 = qAt(0.25);
  const p75 = qAt(0.75);
  const p90 = qAt(0.9);
  const p95 = qAt(0.95);

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

  const order = outcomes.map((_, i) => i).sort((i, j) => (outcomes[i]! < outcomes[j]! ? -1 : outcomes[i]! > outcomes[j]! ? 1 : i - j));
  const n = outcomes.length;
  const k = Math.max(1, Math.floor(0.1 * n));

  let dwDen = 0;
  let dwNum = 0n;
  for (let r = 0; r < k; r += 1) {
    const i = order[r]!;
    dwDen += wNorm[i]!;
    dwNum += outcomes[i]! * BigInt(Math.round(wNorm[i]! * WEIGHT_SCALE));
  }
  const downside = dwDen > 0 ? dwNum / BigInt(Math.round(dwDen * WEIGHT_SCALE)) : outcomes[order[0]!]!;

  let upDen = 0;
  let upNum = 0n;
  for (let r = n - k; r < n; r += 1) {
    const i = order[r]!;
    upDen += wNorm[i]!;
    upNum += outcomes[i]! * BigInt(Math.round(wNorm[i]! * WEIGHT_SCALE));
  }
  const upside = upDen > 0 ? upNum / BigInt(Math.round(upDen * WEIGHT_SCALE)) : outcomes[order[n - 1]!]!;

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
    estimatorKind: 'KERNEL_DISTRIBUTIONAL_EMBEDDING_RESEARCH',
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
