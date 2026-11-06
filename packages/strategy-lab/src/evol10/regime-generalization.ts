/**
 * HELIOS EVOL10 — regime robustness and generalization engine for strategy genomes.
 *
 * Consumes per-regime performance summaries; does not classify regimes or execute.
 *
 * Evaluation hygiene: `RegimePerformanceMatrix` cells must be tagged only with
 * information knowable at bucket time (no future regime labels in historical decisions).
 */

import { integerSqrt } from '@solstice/risk';

import type { BacktestRun } from '../backtest.ts';
import {
  HELIOS_EVOL10_STRESS_REGIME_DIMENSIONS,
  type HeliosEvol10RegimeDimension,
  type HeliosEvol10MacroObservation,
  mapM13DimensionsToEvol10,
  mapMacroObservationToEvol10,
  mergeEvol10Tags,
} from './taxonomy.ts';
import type { MarketRegimeDimension } from '@solstice/platform/helios/regime';

export const HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED =
  'HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED' as const;

/** Per-genome performance in one EVOL10 tag bucket (historical window). */
export type RegimePerformanceCell = {
  readonly genomeId: string;
  readonly regimeDimension: HeliosEvol10RegimeDimension;
  /** Observation count / bar count in this bucket (caller-provided). */
  readonly observationCount: number;
  /** Total return in minor units over the bucket (same sign convention as backtests). */
  readonly totalReturnMinor: bigint;
};

/** Rows: regimes × columns: genomes (or vice versa via transpose). */
export type RegimePerformanceMatrix = {
  readonly methodologyVersion: 'helios-evol10-regime-matrix-v1';
  readonly cells: readonly RegimePerformanceCell[];
};

export type CrossRegimeRobustness = {
  readonly methodologyVersion: 'helios-evol10-cross-regime-robustness-v1';
  readonly genomeId: string;
  /** Mean of per-regime totalReturnMinor. */
  readonly meanReturnMinor: bigint;
  /** Population stdev of per-regime totalReturnMinor (0n if < 2 regimes). */
  readonly crossRegimeStdevMinor: bigint;
  /** max - min across regimes. */
  readonly spreadMinor: bigint;
};

export type LeaveOneRegimeOutFold = {
  readonly methodologyVersion: 'helios-evol10-loro-v1';
  readonly genomeId: string;
  readonly withheldRegime: HeliosEvol10RegimeDimension;
  /** Train aggregate: sum of totalReturnMinor over non-withheld regimes. */
  readonly trainReturnMinor: bigint;
  /** Held-out regime performance. */
  readonly testReturnMinor: bigint;
  /** test - train/N_train (N_train = number of regimes in train set). */
  readonly generalizationGapMinor: bigint;
};

export type LeaveOneRegimeOutEvaluation = {
  readonly folds: readonly LeaveOneRegimeOutFold[];
};

export type TemporalTransferAssessment = {
  readonly methodologyVersion: 'helios-evol10-temporal-transfer-v1';
  readonly genomeId: string;
  /** Earlier half vs later half aggregate returns (caller defines split). */
  readonly firstHalfReturnMinor: bigint;
  readonly secondHalfReturnMinor: bigint;
  /** second - first (transfer gap). */
  readonly temporalGapMinor: bigint;
};

export type StressRegimeAssessment = {
  readonly methodologyVersion: 'helios-evol10-stress-v1';
  readonly genomeId: string;
  /** Minimum totalReturnMinor among stress tags present in matrix. */
  readonly worstStressReturnMinor: bigint;
  readonly stressRegimesPresent: readonly HeliosEvol10RegimeDimension[];
};

/** Full EVOL10 report for one genome. */
export type Evol10GenomeRegimeReport = {
  readonly genomeId: string;
  readonly withinRegimePerformance: readonly RegimePerformanceCell[];
  readonly crossRegimeRobustness: CrossRegimeRobustness;
  /** max − min per-regime total return (larger = more fragile across regimes). */
  readonly crossRegimeDegradationMinor: bigint;
  readonly worstRegimePerformance: { readonly regime: HeliosEvol10RegimeDimension; readonly totalReturnMinor: bigint };
  readonly regimeConcentrationBps: bigint;
  readonly regimeTransitionPerformance: { readonly transitionCount: number; readonly transitionReturnMinor: bigint };
  readonly leaveOneRegimeOut: LeaveOneRegimeOutEvaluation;
  readonly temporalTransfer: TemporalTransferAssessment;
  readonly stressRegime: StressRegimeAssessment;
  readonly generalizationScoreBps: bigint;
  readonly nicheExceptionApplied: boolean;
};

function cellsForGenome(
  matrix: RegimePerformanceMatrix,
  genomeId: string,
): readonly RegimePerformanceCell[] {
  return matrix.cells.filter((c) => c.genomeId === genomeId);
}

function meanBigInt(values: readonly bigint[]): bigint {
  if (values.length === 0) {
    return 0n;
  }
  let sum = 0n;
  for (const v of values) {
    sum += v;
  }
  return sum / BigInt(values.length);
}

function stdevBigInt(values: readonly bigint[]): bigint {
  if (values.length < 2) {
    return 0n;
  }
  const m = meanBigInt(values);
  let sq = 0n;
  for (const v of values) {
    const d = v - m;
    sq += d * d;
  }
  const n = BigInt(values.length);
  return integerSqrt(sq / n);
}

/**
 * Cross-regime degradation: stdev of per-regime returns as a stability penalty (minor units).
 */
export function computeCrossRegimeRobustness(
  matrix: RegimePerformanceMatrix,
  genomeId: string,
): CrossRegimeRobustness {
  const cells = cellsForGenome(matrix, genomeId);
  const returns = cells.map((c) => c.totalReturnMinor);
  const meanReturnMinor = meanBigInt(returns);
  const crossRegimeStdevMinor = stdevBigInt(returns);
  let minR = returns[0] ?? 0n;
  let maxR = returns[0] ?? 0n;
  for (const r of returns) {
    if (r < minR) {
      minR = r;
    }
    if (r > maxR) {
      maxR = r;
    }
  }
  const spreadMinor = maxR - minR;
  return Object.freeze({
    methodologyVersion: 'helios-evol10-cross-regime-robustness-v1',
    genomeId,
    meanReturnMinor,
    crossRegimeStdevMinor,
    spreadMinor,
  });
}

/** Share of total |return| attributed to the best regime (Herfindahl-style concentration). */
export function computeRegimeConcentrationBps(matrix: RegimePerformanceMatrix, genomeId: string): bigint {
  const cells = cellsForGenome(matrix, genomeId);
  if (cells.length === 0) {
    return 0n;
  }
  let sumAbs = 0n;
  for (const c of cells) {
    const a = c.totalReturnMinor >= 0n ? c.totalReturnMinor : -c.totalReturnMinor;
    sumAbs += a;
  }
  if (sumAbs === 0n) {
    return 0n;
  }
  let maxAbs = 0n;
  for (const c of cells) {
    const a = c.totalReturnMinor >= 0n ? c.totalReturnMinor : -c.totalReturnMinor;
    if (a > maxAbs) {
      maxAbs = a;
    }
  }
  return (maxAbs * 10_000n) / sumAbs;
}

export function computeWorstRegimePerformance(
  matrix: RegimePerformanceMatrix,
  genomeId: string,
): { readonly regime: HeliosEvol10RegimeDimension; readonly totalReturnMinor: bigint } {
  const cells = cellsForGenome(matrix, genomeId);
  if (cells.length === 0) {
    return Object.freeze({ regime: 'sideways', totalReturnMinor: 0n });
  }
  let worst = cells[0];
  for (const c of cells) {
    if (!worst || c.totalReturnMinor < worst.totalReturnMinor) {
      worst = c;
    }
  }
  return Object.freeze({
    regime: worst!.regimeDimension,
    totalReturnMinor: worst!.totalReturnMinor,
  });
}

/**
 * Regime transition performance: optional aggregate P/L in bars tagged as transition (caller-supplied count).
 */
export function computeRegimeTransitionPerformance(input: {
  readonly genomeId: string;
  readonly matrix: RegimePerformanceMatrix;
  /** Return attributed to transition periods (minor units). */
  readonly transitionReturnMinor: bigint;
  readonly transitionCount: number;
}): { readonly transitionCount: number; readonly transitionReturnMinor: bigint } {
  void input.genomeId;
  void input.matrix;
  return Object.freeze({
    transitionCount: input.transitionCount,
    transitionReturnMinor: input.transitionReturnMinor,
  });
}

function loroFolds(matrix: RegimePerformanceMatrix, genomeId: string): readonly LeaveOneRegimeOutFold[] {
  const cells = cellsForGenome(matrix, genomeId);
  const folds: LeaveOneRegimeOutFold[] = [];
  for (const hold of cells) {
    const trainCells = cells.filter((c) => c.regimeDimension !== hold.regimeDimension);
    let trainReturnMinor = 0n;
    for (const c of trainCells) {
      trainReturnMinor += c.totalReturnMinor;
    }
    const nTrain = trainCells.length;
    const trainMean = nTrain > 0 ? trainReturnMinor / BigInt(nTrain) : 0n;
    const generalizationGapMinor = hold.totalReturnMinor - trainMean;
    folds.push(
      Object.freeze({
        methodologyVersion: 'helios-evol10-loro-v1',
        genomeId,
        withheldRegime: hold.regimeDimension,
        trainReturnMinor,
        testReturnMinor: hold.totalReturnMinor,
        generalizationGapMinor,
      }),
    );
  }
  return Object.freeze(folds);
}

export function buildLeaveOneRegimeOutEvaluation(
  matrix: RegimePerformanceMatrix,
  genomeId: string,
): LeaveOneRegimeOutEvaluation {
  return Object.freeze({ folds: loroFolds(matrix, genomeId) });
}

export function computeTemporalTransferAssessment(input: {
  readonly genomeId: string;
  readonly firstHalfReturnMinor: bigint;
  readonly secondHalfReturnMinor: bigint;
}): TemporalTransferAssessment {
  return Object.freeze({
    methodologyVersion: 'helios-evol10-temporal-transfer-v1',
    genomeId: input.genomeId,
    firstHalfReturnMinor: input.firstHalfReturnMinor,
    secondHalfReturnMinor: input.secondHalfReturnMinor,
    temporalGapMinor: input.secondHalfReturnMinor - input.firstHalfReturnMinor,
  });
}

export function computeStressRegimeAssessment(
  matrix: RegimePerformanceMatrix,
  genomeId: string,
): StressRegimeAssessment {
  const cells = cellsForGenome(matrix, genomeId);
  const stressCells = cells.filter((c) =>
    (HELIOS_EVOL10_STRESS_REGIME_DIMENSIONS as readonly string[]).includes(c.regimeDimension),
  );
  const stressRegimesPresent = Object.freeze([
    ...new Set(stressCells.map((c) => c.regimeDimension)),
  ]) as readonly HeliosEvol10RegimeDimension[];
  let worstStressReturnMinor = 0n;
  if (stressCells.length > 0) {
    worstStressReturnMinor = stressCells[0]!.totalReturnMinor;
    for (const c of stressCells) {
      if (c.totalReturnMinor < worstStressReturnMinor) {
        worstStressReturnMinor = c.totalReturnMinor;
      }
    }
  }
  return Object.freeze({
    methodologyVersion: 'helios-evol10-stress-v1',
    genomeId,
    worstStressReturnMinor,
    stressRegimesPresent,
  });
}

/**
 * Generalization score (higher is better): rewards stable moderate performance when not niche-declared.
 * Returned value is a deterministic index in basis points relative to `meanReturnScaleMinor`.
 */
export function computeGeneralizationScoreBps(input: {
  readonly meanReturnMinor: bigint;
  readonly crossRegimeStdevMinor: bigint;
  /** Worst single-regime return; magnitudes below zero penalize tail risk. */
  readonly worstReturnMinor: bigint;
  readonly meanReturnScaleMinor: bigint;
  /** When true and gated, tail and dispersion penalties are discounted (niche exception). */
  readonly regimeSpecialistDeclared: boolean;
}): bigint {
  const scale = input.meanReturnScaleMinor > 0n ? input.meanReturnScaleMinor : 1_000_000n;
  const tailPenalty = input.worstReturnMinor < 0n ? -input.worstReturnMinor : 0n;
  if (input.regimeSpecialistDeclared) {
    const raw = input.meanReturnMinor - input.crossRegimeStdevMinor / 4n - tailPenalty / 8n;
    return (raw * 10_000n) / scale;
  }
  const raw = input.meanReturnMinor - input.crossRegimeStdevMinor / 2n - tailPenalty / 3n;
  return (raw * 10_000n) / scale;
}

export function evaluateEvol10GenomeRegimeReport(input: {
  readonly matrix: RegimePerformanceMatrix;
  readonly genomeId: string;
  readonly regimeSpecialistDeclared?: boolean;
  /** Declared operating mandate: when set, EVOL10 applies niche exception if strategy is gated. */
  readonly regimeSpecialistGated?: boolean;
  readonly transition?: { readonly transitionCount: number; readonly transitionReturnMinor: bigint };
  readonly temporal?: { readonly firstHalfReturnMinor: bigint; readonly secondHalfReturnMinor: bigint };
  readonly meanReturnScaleMinor?: bigint;
}): Evol10GenomeRegimeReport {
  const genomeId = input.genomeId;
  const robust = computeCrossRegimeRobustness(input.matrix, genomeId);
  const worst = computeWorstRegimePerformance(input.matrix, genomeId);
  const conc = computeRegimeConcentrationBps(input.matrix, genomeId);
  const degradation = robust.spreadMinor;
  const loro = buildLeaveOneRegimeOutEvaluation(input.matrix, genomeId);
  const stress = computeStressRegimeAssessment(input.matrix, genomeId);
  const temporal = computeTemporalTransferAssessment({
    genomeId,
    firstHalfReturnMinor: input.temporal?.firstHalfReturnMinor ?? 0n,
    secondHalfReturnMinor: input.temporal?.secondHalfReturnMinor ?? 0n,
  });
  const transition = computeRegimeTransitionPerformance({
    genomeId,
    matrix: input.matrix,
    transitionCount: input.transition?.transitionCount ?? 0,
    transitionReturnMinor: input.transition?.transitionReturnMinor ?? 0n,
  });
  const specialist =
    Boolean(input.regimeSpecialistDeclared) && Boolean(input.regimeSpecialistGated);
  const score = computeGeneralizationScoreBps({
    meanReturnMinor: robust.meanReturnMinor,
    crossRegimeStdevMinor: robust.crossRegimeStdevMinor,
    worstReturnMinor: worst.totalReturnMinor,
    meanReturnScaleMinor: input.meanReturnScaleMinor ?? 1_000_000n,
    regimeSpecialistDeclared: specialist,
  });
  return Object.freeze({
    genomeId,
    withinRegimePerformance: cellsForGenome(input.matrix, genomeId),
    crossRegimeRobustness: robust,
    crossRegimeDegradationMinor: degradation,
    worstRegimePerformance: worst,
    regimeConcentrationBps: conc,
    regimeTransitionPerformance: transition,
    leaveOneRegimeOut: loro,
    temporalTransfer: temporal,
    stressRegime: stress,
    generalizationScoreBps: score,
    nicheExceptionApplied: specialist,
  });
}

/**
 * Map HELIOS M13 dimensions plus optional macro tags to EVOL10 tags for labeling buckets.
 */
export function labelEvol10RegimeDimensions(input: {
  readonly m13Dimensions: readonly MarketRegimeDimension[];
  readonly macro?: HeliosEvol10MacroObservation;
}): readonly HeliosEvol10RegimeDimension[] {
  const fromM13 = mapM13DimensionsToEvol10(input.m13Dimensions);
  const fromMacro = mapMacroObservationToEvol10(input.macro);
  return mergeEvol10Tags(fromM13, fromMacro);
}

/**
 * Qualifies when generalization score and worst-regime floor pass thresholds for non-specialists,
 * or when niche exception applies with gated specialist declaration.
 */
export function evaluateEvol10RegimeGeneralizationQualification(input: {
  readonly report: Evol10GenomeRegimeReport;
  readonly minGeneralizationScoreBps?: bigint;
  readonly minWorstRegimeReturnMinor?: bigint;
}): { readonly qualified: boolean; readonly token: typeof HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED } {
  const minScore = input.minGeneralizationScoreBps ?? -500_000n;
  const minWorst = input.minWorstRegimeReturnMinor ?? -2_000_000n;
  const okScore = input.report.generalizationScoreBps >= minScore;
  const okTail = input.report.worstRegimePerformance.totalReturnMinor >= minWorst;
  const specialistOk =
    input.report.nicheExceptionApplied &&
    okTail &&
    input.report.crossRegimeRobustness.meanReturnMinor > 0n;
  const qualified = (okScore && okTail) || specialistOk;
  return Object.freeze({
    qualified,
    token: HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED,
  });
}

/**
 * Convenience: extract total return from a backtest for filling matrix cells.
 */
export function backtestTotalReturnMinor(run: BacktestRun): bigint {
  return run.results.totalReturn.units;
}
