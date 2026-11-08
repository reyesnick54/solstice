/**
 * HELIOS FORWARD ALPHA08 — DSR, PBO, White RC, Hansen SPA, block bootstrap.
 */

import {
  computeDeflatedSharpeRatio,
  computeProbabilityOfBacktestOverfitting,
} from '../../earnings-intelligence/anti-overfitting.ts';
import {
  computeEffectiveIndependentTrials,
  maxAndMeanPairwiseBehavioralCorrelation,
  maxAndMeanPairwiseReturnCorrelation,
  nearDuplicateGenomeRate,
} from '../../strategy-evolution/evol09/stats.ts';
import { HELIOS_EVOL09_SCHEMA } from '../../strategy-evolution/evol09/taxonomy.ts';
import type { EvolutionTrialRecord } from '../../strategy-evolution/evol09/types.ts';

import {
  ALPHA08_BLOCK_BOOTSTRAP_DEFAULT_BLOCK,
  ALPHA08_MINIMUM_FORWARD_PERIODS,
  ALPHA08_MIN_CANDIDATES_FOR_BOOTSTRAP,
  ALPHA08_SERIAL_DEPENDENCE_AUTOCORR_THRESHOLD,
} from './taxonomy.ts';
import type {
  BenchmarkCandidateComparison,
  ForwardMultipleTestingState,
  ForwardTrialCandidate,
  RealityCheckResult,
  SpaResult,
  StrategySelectionPenalty,
} from './types.ts';
import type { ForwardTrialCandidateId } from './types.ts';

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
  if (returns.length < ALPHA08_MINIMUM_FORWARD_PERIODS) {
    return null;
  }
  const sd = stdDevSample(returns);
  if (sd <= 1e-12) {
    return null;
  }
  return mean(returns) / sd;
}

function lag1Autocorrelation(values: readonly number[]): number | null {
  if (values.length < 3) {
    return null;
  }
  const xs = values.slice(0, -1);
  const ys = values.slice(1);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    num += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  const den = Math.sqrt(vx * vy);
  if (den <= 1e-12) {
    return null;
  }
  return num / den;
}

/** Deterministic Mulberry32 PRNG for simulation-stable bootstrap. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickBootstrapMethod(series: readonly (readonly number[])[]): {
  method: 'IID' | 'STATIONARY_BLOCK';
  blockLength: number | null;
} {
  const stacked = series.flat();
  const ac = lag1Autocorrelation(stacked);
  if (ac !== null && Math.abs(ac) > ALPHA08_SERIAL_DEPENDENCE_AUTOCORR_THRESHOLD) {
    return { method: 'STATIONARY_BLOCK', blockLength: ALPHA08_BLOCK_BOOTSTRAP_DEFAULT_BLOCK };
  }
  return { method: 'IID', blockLength: null };
}

function iidResampleRow(row: readonly number[], len: number, rnd: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    const idx = Math.floor(rnd() * row.length);
    out.push(row[idx]!);
  }
  return out;
}

/** Politis–Romano-style stationary block bootstrap (simplified, fixed block). */
function blockResampleRow(row: readonly number[], len: number, block: number, rnd: () => number): number[] {
  if (row.length === 0) {
    return [];
  }
  const out: number[] = [];
  while (out.length < len) {
    const start = Math.floor(rnd() * row.length);
    for (let b = 0; b < block && out.length < len; b += 1) {
      out.push(row[(start + b) % row.length]!);
    }
  }
  return out.slice(0, len);
}

function evolutionAdapter(candidates: readonly ForwardTrialCandidate[]): readonly EvolutionTrialRecord[] {
  return Object.freeze(
    candidates.map((c) =>
      Object.freeze({
        trialId: c.candidateId as unknown as EvolutionTrialRecord['trialId'],
        recordedAt: c.recordedAt,
        genomeId: c.genomeId,
        generation: c.trialFamily.evolutionGeneration,
        origin: 'MANUAL' as const,
        outcome: 'COMPLETED' as const,
        strategyFamilyId: c.trialFamily.strategyFamilyId,
        featureFamilyId: c.trialFamily.featureFamilyId,
        parameterVectorFingerprint: c.parameterVectorFingerprint,
        researchReturns: c.forwardExcessReturns,
        behavioralSignature: c.behavioralSignature,
      }),
    ),
  );
}

export function buildForwardMultipleTestingState(
  candidates: readonly ForwardTrialCandidate[],
): ForwardMultipleTestingState {
  const adapted = evolutionAdapter(candidates);
  const { maxAbs: maxReturnAbs } = maxAndMeanPairwiseReturnCorrelation(adapted);
  const { maxAbs: maxBehaviorAbs } = maxAndMeanPairwiseBehavioralCorrelation(adapted);
  const dupRate = nearDuplicateGenomeRate(adapted);

  const forwardEffective = computeEffectiveIndependentTrials({
    totalTrials: candidates.length,
    maxAbsReturnCorrelation: maxReturnAbs,
    maxAbsBehavioralCorrelation: maxBehaviorAbs,
    nearDuplicateGenomeRate: dupRate,
  });

  const strategyFamilyCounts: Record<string, number> = {};
  const signalFamilyCounts: Record<string, number> = {};
  const assetClassCounts: Record<string, number> = {};
  const featureFamilyCounts: Record<string, number> = {};
  const campaigns = new Set<string>();
  let priorCumulative = 0;
  let priorEffective = 0;

  for (const c of candidates) {
    const f = c.trialFamily;
    strategyFamilyCounts[f.strategyFamilyId] = (strategyFamilyCounts[f.strategyFamilyId] ?? 0) + 1;
    signalFamilyCounts[f.signalFamilyId] = (signalFamilyCounts[f.signalFamilyId] ?? 0) + 1;
    assetClassCounts[f.assetClassId] = (assetClassCounts[f.assetClassId] ?? 0) + 1;
    featureFamilyCounts[f.featureFamilyId] = (featureFamilyCounts[f.featureFamilyId] ?? 0) + 1;
    if (c.campaignId) {
      campaigns.add(c.campaignId);
    }
    priorCumulative = Math.max(priorCumulative, c.priorCumulativeResearchTrials);
    priorEffective = Math.max(priorEffective, c.priorEffectiveIndependentResearchTrials);
  }

  const combinedEffectiveTrialCount = priorEffective + forwardEffective;

  return Object.freeze({
    forwardMonitoredCandidates: candidates.length,
    strategyFamilyCounts: Object.freeze({ ...strategyFamilyCounts }),
    signalFamilyCounts: Object.freeze({ ...signalFamilyCounts }),
    assetClassCounts: Object.freeze({ ...assetClassCounts }),
    featureFamilyCounts: Object.freeze({ ...featureFamilyCounts }),
    campaignCount: campaigns.size,
    priorCumulativeResearchTrials: priorCumulative,
    priorEffectiveIndependentResearchTrials: priorEffective,
    forwardEffectiveIndependentTrials: forwardEffective,
    combinedEffectiveTrialCount,
    evol09Schema: HELIOS_EVOL09_SCHEMA,
  });
}

function buildAllCandidateComparisons(
  candidates: readonly ForwardTrialCandidate[],
): readonly BenchmarkCandidateComparison[] {
  return Object.freeze(
    candidates.map((c) => {
      const m = mean(c.forwardExcessReturns);
      const sd = stdDevSample(c.forwardExcessReturns);
      const t =
        c.forwardExcessReturns.length >= 2 && sd > 1e-12
          ? (m / sd) * Math.sqrt(c.forwardExcessReturns.length)
          : null;
      return Object.freeze({
        candidateId: c.candidateId,
        trialFamilyId: c.trialFamily.familyId,
        kind: c.kind,
        monitoringOutcome: c.monitoringOutcome,
        meanExcessReturn: m,
        excessSharpe: sharpeFromReturns(c.forwardExcessReturns),
        vsBenchmarkStudentizedT: t,
        beatsBenchmarkPointEstimate: m > 0,
      });
    }),
  );
}

function maxStudentizedExcess(comparisons: readonly BenchmarkCandidateComparison[]): number {
  const ts = comparisons
    .map((c) => c.vsBenchmarkStudentizedT)
    .filter((t): t is number => t !== null);
  return ts.length > 0 ? Math.max(...ts) : 0;
}

function argmaxCandidate(
  comparisons: readonly BenchmarkCandidateComparison[],
): ForwardTrialCandidateId | null {
  let best: BenchmarkCandidateComparison | null = null;
  for (const row of comparisons) {
    if (!best || row.meanExcessReturn > best.meanExcessReturn) {
      best = row;
    }
  }
  return best?.candidateId ?? null;
}

export function runWhiteRealityCheck(input: {
  readonly candidates: readonly ForwardTrialCandidate[];
  readonly bootstrapReplications?: number;
  readonly seed?: number;
}): RealityCheckResult | null {
  if (input.candidates.length < ALPHA08_MIN_CANDIDATES_FOR_BOOTSTRAP) {
    return null;
  }
  const comparisons = buildAllCandidateComparisons(input.candidates);
  const observed = maxStudentizedExcess(comparisons);
  const rows = input.candidates.map((c) => c.forwardExcessReturns);
  const n = Math.min(...rows.map((r) => r.length));
  if (n < 2) {
    return null;
  }
  const trimmed = rows.map((r) => r.slice(-n));
  const centered = trimmed.map((r) => {
    const m = mean(r);
    return r.map((x) => x - m);
  });

  const { method, blockLength } = pickBootstrapMethod(centered);
  const reps = input.bootstrapReplications ?? 400;
  const seed = input.seed ?? 0x414c5048;
  const rnd = mulberry32(seed);

  let exceed = 0;
  for (let b = 0; b < reps; b += 1) {
    const bootRows =
      method === 'STATIONARY_BLOCK' && blockLength !== null
        ? centered.map((row) => blockResampleRow(row, n, blockLength, rnd))
        : centered.map((row) => iidResampleRow(row, n, rnd));
    const bootComparisons: BenchmarkCandidateComparison[] = bootRows.map((row, i) => {
      const c = input.candidates[i]!;
      const m = mean(row);
      const sd = stdDevSample(row);
      const t = sd > 1e-12 ? (m / sd) * Math.sqrt(row.length) : null;
      return Object.freeze({
        candidateId: c.candidateId,
        trialFamilyId: c.trialFamily.familyId,
        kind: c.kind,
        monitoringOutcome: c.monitoringOutcome,
        meanExcessReturn: m,
        excessSharpe: sharpeFromReturns(row),
        vsBenchmarkStudentizedT: t,
        beatsBenchmarkPointEstimate: m > 0,
      });
    });
    const bootMax = maxStudentizedExcess(bootComparisons);
    if (bootMax >= observed - 1e-12) {
      exceed += 1;
    }
  }

  const pValue = (exceed + 1) / (reps + 1);
  return Object.freeze({
    test: 'WHITE_REALITY_CHECK',
    bootstrapMethod: method,
    blockLength,
    bootstrapReplications: reps,
    seed,
    observedMaxStudentizedExcess: observed,
    pValue,
    nullRejectedAt05: pValue <= 0.05,
    allCandidateComparisons: comparisons,
    argmaxCandidateId: argmaxCandidate(comparisons),
  });
}

export function runHansenSpaTest(input: {
  readonly candidates: readonly ForwardTrialCandidate[];
  readonly bootstrapReplications?: number;
  readonly seed?: number;
}): SpaResult | null {
  if (input.candidates.length < ALPHA08_MIN_CANDIDATES_FOR_BOOTSTRAP) {
    return null;
  }
  const comparisons = buildAllCandidateComparisons(input.candidates);
  const spaStatistic = maxStudentizedExcess(comparisons);
  const rows = input.candidates.map((c) => c.forwardExcessReturns);
  const n = Math.min(...rows.map((r) => r.length));
  if (n < 2) {
    return null;
  }
  const trimmed = rows.map((r) => r.slice(-n));
  const { method, blockLength } = pickBootstrapMethod(trimmed);
  const reps = input.bootstrapReplications ?? 400;
  const seed = (input.seed ?? 0x414c5048) ^ 0x5f3759df;
  const rnd = mulberry32(seed);

  let exceed = 0;
  for (let b = 0; b < reps; b += 1) {
    const bootRows =
      method === 'STATIONARY_BLOCK' && blockLength !== null
        ? trimmed.map((row) => blockResampleRow(row, n, blockLength, rnd))
        : trimmed.map((row) => iidResampleRow(row, n, rnd));
    const bootStats = bootRows.map((row) => {
      const m = mean(row);
      const sd = stdDevSample(row);
      return sd > 1e-12 ? (m / sd) * Math.sqrt(row.length) : 0;
    });
    const bootSpa = bootStats.length > 0 ? Math.max(...bootStats) : 0;
    if (bootSpa >= spaStatistic - 1e-12) {
      exceed += 1;
    }
  }

  const pValue = (exceed + 1) / (reps + 1);
  return Object.freeze({
    test: 'HANSEN_SPA',
    bootstrapMethod: method,
    blockLength,
    bootstrapReplications: reps,
    seed,
    spaStatistic,
    pValue,
    consistentSuperiorityClaimed: pValue <= 0.05,
    allCandidateComparisons: comparisons,
    argmaxCandidateId: argmaxCandidate(comparisons),
  });
}

export function computeStrategySelectionPenalty(input: {
  readonly candidates: readonly ForwardTrialCandidate[];
  readonly multipleTesting: ForwardMultipleTestingState;
}): StrategySelectionPenalty {
  const sharpeList = input.candidates
    .map((c) => sharpeFromReturns(c.forwardExcessReturns))
    .filter((s): s is number => s !== null);
  const pbo =
    sharpeList.length >= 8
      ? computeProbabilityOfBacktestOverfitting({ trialSharpeRatios: sharpeList })
      : null;

  const lengths = input.candidates.map((c) => c.forwardExcessReturns.length);
  const n = lengths.length > 0 ? Math.min(...lengths) : 0;
  let aggregated: number[] = [];
  if (n >= ALPHA08_MINIMUM_FORWARD_PERIODS) {
    aggregated = new Array<number>(n).fill(0);
    for (const c of input.candidates) {
      const r = c.forwardExcessReturns;
      const start = r.length - n;
      for (let i = 0; i < n; i += 1) {
        aggregated[i]! += r[start + i]! / input.candidates.length;
      }
    }
  }

  const trialCount = Math.max(1, Math.round(input.multipleTesting.combinedEffectiveTrialCount));
  const deflatedSharpeRatio =
    aggregated.length >= ALPHA08_MINIMUM_FORWARD_PERIODS
      ? computeDeflatedSharpeRatio({ returns: aggregated, trialCount })
      : null;

  const forwardN = input.multipleTesting.forwardMonitoredCandidates;
  const inflation =
    forwardN > 0
      ? input.multipleTesting.forwardEffectiveIndependentTrials / forwardN
      : 0;

  const notes: string[] = [];
  if (input.multipleTesting.priorCumulativeResearchTrials > forwardN) {
    notes.push(
      `Prior research trial carryover (${String(input.multipleTesting.priorCumulativeResearchTrials)}) retained; forward evidence does not erase search cost.`,
    );
  }
  if (inflation < 0.5) {
    notes.push('High cross-candidate correlation reduces effective forward trial count.');
  }
  if (pbo !== null && pbo > 0.5) {
    notes.push('Elevated probability of backtest overfitting across the forward trial universe.');
  }

  const dsrPenalty = deflatedSharpeRatio !== null && deflatedSharpeRatio < 0 ? 25 : 0;
  const pboPenalty = pbo !== null && pbo > 0.5 ? 15 : 0;
  const carryoverPenalty = Math.min(
    50,
    Math.round(Math.log10(1 + input.multipleTesting.priorCumulativeResearchTrials) * 5),
  );
  const selectionPenaltyBps = dsrPenalty + pboPenalty + carryoverPenalty;

  return Object.freeze({
    deflatedSharpeRatio,
    probabilityOfBacktestOverfitting: pbo,
    combinedEffectiveTrialCount: input.multipleTesting.combinedEffectiveTrialCount,
    trialInflationFromCorrelation: inflation,
    priorResearchTrialCarryover: input.multipleTesting.priorCumulativeResearchTrials,
    selectionPenaltyBps,
    notes: Object.freeze([...notes]),
  });
}
