/**
 * DSR / PBO diagnostics for evolution qualification (simplified CSCV-style PBO).
 */

export type EvolutionAntiOverfittingDiagnostics = {
  readonly deflatedSharpeRatio: number | null;
  readonly probabilityOfBacktestOverfitting: number | null;
  readonly trialCount: number;
  readonly multipleTestingAdjusted: boolean;
  readonly sampleSizePermitsDiagnostics: boolean;
};

const MIN_TRIALS_FOR_PBO = 8;
const MIN_RETURNS_FOR_DSR = 30;

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function skewness(values: readonly number[]): number {
  if (values.length < 3) {
    return 0;
  }
  const m = mean(values);
  const s = stdDev(values);
  if (s === 0) {
    return 0;
  }
  const n = values.length;
  const m3 = values.reduce((acc, v) => acc + (v - m) ** 3, 0) / n;
  return m3 / s ** 3;
}

function kurtosis(values: readonly number[]): number {
  if (values.length < 4) {
    return 3;
  }
  const m = mean(values);
  const s = stdDev(values);
  if (s === 0) {
    return 3;
  }
  const n = values.length;
  const m4 = values.reduce((acc, v) => acc + (v - m) ** 4, 0) / n;
  return m4 / s ** 4;
}

export function computeDeflatedSharpeRatio(input: {
  readonly returns: readonly number[];
  readonly trialCount: number;
}): number | null {
  if (input.returns.length < MIN_RETURNS_FOR_DSR || input.trialCount < 1) {
    return null;
  }
  const sr = mean(input.returns) / (stdDev(input.returns) || 1);
  const n = input.returns.length;
  const sk = skewness(input.returns);
  const ku = kurtosis(input.returns);
  const srVar = (1 - sk * sr + ((ku - 1) / 4) * sr ** 2) / Math.max(1, n - 1);
  const srStd = Math.sqrt(Math.max(srVar, 1e-12));
  const euler = 0.5772156649;
  const trials = Math.max(1, input.trialCount);
  const expectedMaxSr =
    srStd *
    ((1 - euler) * inverseNormalCdf(1 - 1 / trials) + euler * inverseNormalCdf(1 - 1 / (trials * Math.E)));
  return (sr - expectedMaxSr) / srStd;
}

function inverseNormalCdf(p: number): number {
  const clamped = Math.min(0.9999, Math.max(0.0001, p));
  return Math.sqrt(2) * erfinv(2 * clamped - 1);
}

function erfinv(x: number): number {
  const a = 0.147;
  const ln = Math.log(1 - x ** 2);
  const first = 2 / (Math.PI * a) + ln / 2;
  return Math.sign(x) * Math.sqrt(Math.sqrt(first ** 2 - ln / a) - first);
}

export function computeProbabilityOfBacktestOverfitting(input: {
  readonly trialSharpeRatios: readonly number[];
}): number | null {
  if (input.trialSharpeRatios.length < MIN_TRIALS_FOR_PBO) {
    return null;
  }
  const sorted = [...input.trialSharpeRatios].sort((a, b) => b - a);
  const best = sorted[0] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (best <= median) {
    return 0.5;
  }
  const logRatio = Math.log((best + 1e-6) / (median + 1e-6));
  return Math.max(0, Math.min(1, 0.5 - logRatio * 0.15));
}

export function buildAntiOverfittingDiagnostics(input: {
  readonly holdoutReturns: readonly number[];
  readonly trialSharpeRatios: readonly number[];
  readonly trialCount: number;
}): EvolutionAntiOverfittingDiagnostics {
  const sampleSizePermitsDiagnostics =
    input.holdoutReturns.length >= MIN_RETURNS_FOR_DSR &&
    input.trialSharpeRatios.length >= MIN_TRIALS_FOR_PBO;
  const deflatedSharpeRatio = computeDeflatedSharpeRatio({
    returns: input.holdoutReturns,
    trialCount: input.trialCount,
  });
  const probabilityOfBacktestOverfitting = computeProbabilityOfBacktestOverfitting({
    trialSharpeRatios: input.trialSharpeRatios,
  });
  const multipleTestingAdjusted = deflatedSharpeRatio !== null ? deflatedSharpeRatio > 0 : false;
  return Object.freeze({
    deflatedSharpeRatio,
    probabilityOfBacktestOverfitting,
    trialCount: input.trialCount,
    multipleTestingAdjusted,
    sampleSizePermitsDiagnostics,
  });
}
