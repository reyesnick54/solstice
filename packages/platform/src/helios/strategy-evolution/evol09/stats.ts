/**
 * HELIOS EVOL09 — DSR, PSR, correlations, effective trial count, BH-FDR.
 */

import {
  computeDeflatedSharpeRatio,
  computeProbabilityOfBacktestOverfitting,
} from '../../earnings-intelligence/anti-overfitting.ts';

import { EVOL09_MINIMUM_TRACK_RECORD_PERIODS, EVOL09_MIN_TRIALS_FOR_PBO } from './taxonomy.ts';
import type { EvolutionTrialRecord, MultipleTestingState, SelectionBiasAssessment } from './types.ts';

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDevSample(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function sharpeFromReturns(returns: readonly number[]): number | null {
  if (returns.length < EVOL09_MINIMUM_TRACK_RECORD_PERIODS) {
    return null;
  }
  const sd = stdDevSample(returns);
  if (sd <= 1e-12) {
    return null;
  }
  return mean(returns) / sd;
}

/** Pairwise Pearson correlation for equal-length series. */
function correlationSeries(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 2) {
    return null;
  }
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  if (den <= 1e-12) {
    return null;
  }
  return num / den;
}

export function maxAndMeanPairwiseBehavioralCorrelation(trials: readonly EvolutionTrialRecord[]): {
  maxAbs: number | null;
  meanAbs: number | null;
} {
  const series = trials
    .map((t) => t.behavioralSignature)
    .filter((s): s is readonly number[] => s !== null && s.length >= 2);
  if (series.length < 2) {
    return { maxAbs: null, meanAbs: null };
  }
  const n = Math.min(...series.map((s) => s.length));
  const trimmed = series.map((s) => s.slice(-n));
  const cors: number[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    for (let j = i + 1; j < trimmed.length; j += 1) {
      const c = correlationSeries(trimmed[i]!, trimmed[j]!);
      if (c !== null) {
        cors.push(Math.abs(c));
      }
    }
  }
  if (cors.length === 0) {
    return { maxAbs: null, meanAbs: null };
  }
  return {
    maxAbs: Math.max(...cors),
    meanAbs: cors.reduce((a, b) => a + b, 0) / cors.length,
  };
}

export function maxAndMeanPairwiseReturnCorrelation(trials: readonly EvolutionTrialRecord[]): {
  maxAbs: number | null;
  meanAbs: number | null;
} {
  const series = trials.map((t) => t.researchReturns).filter((r) => r.length >= 2);
  if (series.length < 2) {
    return { maxAbs: null, meanAbs: null };
  }
  const n = Math.min(...series.map((s) => s.length));
  const trimmed = series.map((s) => s.slice(-n));
  const cors: number[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    for (let j = i + 1; j < trimmed.length; j += 1) {
      const c = correlationSeries(trimmed[i]!, trimmed[j]!);
      if (c !== null) {
        cors.push(Math.abs(c));
      }
    }
  }
  if (cors.length === 0) {
    return { maxAbs: null, meanAbs: null };
  }
  const maxAbs = Math.max(...cors);
  const meanAbs = cors.reduce((a, b) => a + b, 0) / cors.length;
  return { maxAbs, meanAbs };
}

function hammingNormalized(fpA: string, fpB: string): number {
  const maxLen = Math.max(fpA.length, fpB.length);
  if (maxLen === 0) {
    return 0;
  }
  const len = Math.min(fpA.length, fpB.length);
  let diff = Math.abs(fpA.length - fpB.length);
  for (let i = 0; i < len; i += 1) {
    if (fpA[i] !== fpB[i]) {
      diff += 1;
    }
  }
  return diff / maxLen;
}

export function nearDuplicateGenomeRate(
  trials: readonly EvolutionTrialRecord[],
  threshold = 0.08,
): number | null {
  if (trials.length < 2) {
    return null;
  }
  let near = 0;
  let pairs = 0;
  for (let i = 0; i < trials.length; i += 1) {
    for (let j = i + 1; j < trials.length; j += 1) {
      pairs += 1;
      const d = hammingNormalized(
        trials[i]!.parameterVectorFingerprint,
        trials[j]!.parameterVectorFingerprint,
      );
      if (d <= threshold) {
        near += 1;
      }
    }
  }
  return pairs > 0 ? near / pairs : null;
}

/**
 * Similarity-adjusted effective trial count: shrinks raw count when correlations and duplicates are high.
 */
export function computeEffectiveIndependentTrials(input: {
  readonly totalTrials: number;
  readonly maxAbsReturnCorrelation: number | null;
  readonly maxAbsBehavioralCorrelation: number | null;
  readonly nearDuplicateGenomeRate: number | null;
}): number {
  if (input.totalTrials <= 0) {
    return 0;
  }
  const rhoR = input.maxAbsReturnCorrelation ?? 0;
  const rhoB = input.maxAbsBehavioralCorrelation ?? 0;
  const dup = input.nearDuplicateGenomeRate ?? 0;
  const correlationInflation = 1 + Math.max(0, rhoR) * 4 + Math.max(0, rhoB) * 3;
  const duplicateInflation = 1 + Math.max(0, dup) * 6;
  const divisor = correlationInflation * duplicateInflation;
  return Math.max(1, input.totalTrials / divisor);
}

export function buildMultipleTestingState(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly effectiveIndependentTrials: number;
}): MultipleTestingState {
  const strategyFamilyTrials: Record<string, number> = {};
  const featureFamilyTrials: Record<string, number> = {};
  let parameterTrials = 0;
  let maxGen = 0;

  for (const t of input.trials) {
    strategyFamilyTrials[t.strategyFamilyId] = (strategyFamilyTrials[t.strategyFamilyId] ?? 0) + 1;
    featureFamilyTrials[t.featureFamilyId] = (featureFamilyTrials[t.featureFamilyId] ?? 0) + 1;
    parameterTrials += 1;
    maxGen = Math.max(maxGen, t.generation);
  }

  return Object.freeze({
    totalTrials: input.trials.length,
    strategyFamilyTrials: Object.freeze({ ...strategyFamilyTrials }),
    featureFamilyTrials: Object.freeze({ ...featureFamilyTrials }),
    parameterTrials,
    generationCount: maxGen,
    effectiveIndependentTrials: input.effectiveIndependentTrials,
  });
}

export function buildSelectionBiasAssessment(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly effectiveIndependentTrials: number;
}): SelectionBiasAssessment {
  const { maxAbs, meanAbs } = maxAndMeanPairwiseReturnCorrelation(input.trials);
  const beh = maxAndMeanPairwiseBehavioralCorrelation(input.trials);
  const dupRate = nearDuplicateGenomeRate(input.trials);
  const n = input.trials.length;
  const inflation =
    n > 0 ? Math.min(1, input.effectiveIndependentTrials / n) : 0;
  const longest = Math.max(0, ...input.trials.map((t) => t.researchReturns.length));
  const meetsMinimumTrackRecord = longest >= EVOL09_MINIMUM_TRACK_RECORD_PERIODS;

  const notes: string[] = [];
  if (maxAbs !== null && maxAbs > 0.7) {
    notes.push('High pairwise return correlation among candidates; effective trial count is discounted.');
  }
  if (beh.maxAbs !== null && beh.maxAbs > 0.75) {
    notes.push('High behavioral signature correlation; candidates are not independent paths.');
  }
  if (dupRate !== null && dupRate > 0.2) {
    notes.push('Many near-duplicate genome fingerprints; lineages are not independent draws.');
  }
  if (!meetsMinimumTrackRecord) {
    notes.push(
      `Track record shorter than ${String(EVOL09_MINIMUM_TRACK_RECORD_PERIODS)} periods; Sharpe-style summaries are not primary evidence.`,
    );
  }

  return Object.freeze({
    maxPairwiseReturnCorrelation: maxAbs,
    meanPairwiseReturnCorrelation: meanAbs,
    maxPairwiseBehavioralCorrelation: beh.maxAbs,
    meanPairwiseBehavioralCorrelation: beh.meanAbs,
    nearDuplicateGenomeRate: dupRate,
    trialInflationFactor: inflation,
    meetsMinimumTrackRecord,
    notes: Object.freeze([...notes]),
  });
}

export function trialSharpeRatiosForPbo(trials: readonly EvolutionTrialRecord[]): readonly number[] {
  return Object.freeze(trials.map((t) => sharpeFromReturns(t.researchReturns)).filter((s): s is number => s !== null));
}

export function computeEvol09DeflatedSharpe(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly trialCountForAdjustment: number;
}): number | null {
  /** Aggregate research returns for a single track-record DSR (research window only). */
  const lengths = input.trials.map((t) => t.researchReturns.length);
  const n = Math.min(...lengths);
  if (input.trials.length === 0 || n < EVOL09_MINIMUM_TRACK_RECORD_PERIODS) {
    return null;
  }
  const stacked = new Array<number>(n).fill(0);
  for (const t of input.trials) {
    const r = t.researchReturns;
    const start = r.length - n;
    for (let i = 0; i < n; i += 1) {
      stacked[i]! += r[start + i]! / input.trials.length;
    }
  }
  return computeDeflatedSharpeRatio({
    returns: stacked,
    trialCount: Math.max(1, Math.round(input.trialCountForAdjustment)),
  });
}

/**
 * Probabilistic Sharpe Ratio (simplified): P(SR* > 0) assuming approximately normal SR with Bailey & López de Prado SR variance.
 */
export function computeProbabilisticSharpeRatio(input: {
  readonly returns: readonly number[];
  readonly trialsAdjusted: number;
}): number | null {
  const { returns, trialsAdjusted } = input;
  if (returns.length < EVOL09_MINIMUM_TRACK_RECORD_PERIODS) {
    return null;
  }
  const sr = sharpeFromReturns(returns);
  if (sr === null) {
    return null;
  }
  const n = returns.length;
  const m = mean(returns);
  const s = stdDevSample(returns);
  if (s <= 1e-12) {
    return null;
  }
  const sk =
    returns.length >= 3
      ? returns.reduce((acc, v) => acc + (v - m) ** 3, 0) / returns.length / s ** 3
      : 0;
  const ku =
    returns.length >= 4
      ? returns.reduce((acc, v) => acc + (v - m) ** 4, 0) / returns.length / s ** 4
      : 3;
  const srVar = (1 - sk * sr + ((ku - 1) / 4) * sr ** 2) / Math.max(1, n - 1);
  const srStd = Math.sqrt(Math.max(srVar, 1e-12));
  const euler = 0.5772156649;
  const trials = Math.max(1, trialsAdjusted);
  const expectedMax =
    srStd *
    ((1 - euler) * approximateInverseNormalCdf(1 - 1 / trials) +
      euler * approximateInverseNormalCdf(1 - 1 / (trials * Math.E)));
  const threshold = expectedMax;
  const z = (sr - threshold) / srStd;
  return normalCdf(z);
}

function approximateInverseNormalCdf(p: number): number {
  const clamped = Math.min(0.9999, Math.max(0.0001, p));
  return Math.sqrt(2) * erfinv(2 * clamped - 1);
}

function erfinv(x: number): number {
  const a = 0.147;
  const ln = Math.log(1 - x ** 2);
  const first = 2 / (Math.PI * a) + ln / 2;
  return Math.sign(x) * Math.sqrt(Math.sqrt(first ** 2 - ln / a) - first);
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function computeEvol09Pbo(trials: readonly EvolutionTrialRecord[]): number | null {
  const ratios = trialSharpeRatiosForPbo(trials);
  return computeProbabilityOfBacktestOverfitting({ trialSharpeRatios: ratios });
}

export function benjaminiHochbergFdr(input: {
  readonly pValues: readonly number[];
  readonly q: number;
}): { adjustedPValues: readonly number[]; rejected: readonly boolean[]; applicable: boolean } {
  const m = input.pValues.length;
  if (m === 0) {
    return {
      adjustedPValues: Object.freeze([]),
      rejected: Object.freeze([]),
      applicable: false,
    };
  }
  const order = input.pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m).fill(1);
  let runningMin = 1;
  for (let k = m - 1; k >= 0; k -= 1) {
    const rank = k + 1;
    const bh = (order[k]!.p * m) / rank;
    runningMin = Math.min(runningMin, bh);
    adjusted[order[k]!.i] = Math.min(1, runningMin);
  }
  const rejected = adjusted.map((ap) => ap <= input.q + 1e-9);
  return {
    adjustedPValues: Object.freeze(adjusted),
    rejected: Object.freeze(rejected.map((r) => !!r)),
    applicable: m >= 2,
  };
}
