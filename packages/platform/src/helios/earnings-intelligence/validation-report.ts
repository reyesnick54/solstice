import type { UtcInstant } from '@solstice/domain';
import { HELIOS_EARNINGS_INTELLIGENCE_SCHEMA } from './taxonomy.ts';
import type { EarningsValidationReport } from './types.ts';
import { compareAllBenchmarks, epsMaeImprovementBps } from './benchmarks.ts';
import { buildAntiOverfittingDiagnostics } from './anti-overfitting.ts';
import { buildRegimeSliceReports, type RegimeTaggedOutcome } from './regime-slices.ts';
import { resolveEarningsRealityGate } from './reality-gate.ts';
import type { ChronologySummary } from './types.ts';
import type { EarningsForecast } from './types.ts';
import type { EarningsTrialRegistry } from './trial-registry.ts';

export function buildEarningsValidationReport(input: {
  readonly generatedAt: UtcInstant;
  readonly gitSha: string;
  readonly chronology: ChronologySummary;
  readonly chronologyValid: boolean;
  readonly holdoutRows: readonly RegimeTaggedOutcome[];
  readonly heliosForecast: EarningsForecast;
  readonly trialRegistry: EarningsTrialRegistry;
  readonly trialSharpeRatios: readonly number[];
  readonly holdoutReturns: readonly number[];
  readonly architectureComplete: boolean;
}): EarningsValidationReport {
  const benchmarks = compareAllBenchmarks(input.holdoutRows, input.heliosForecast);
  const helios = benchmarks.find((row) => row.strategy === 'HELIOS_FULL_STACK')!;
  const naive = benchmarks.find((row) => row.strategy === 'NAIVE_SEASONAL_EARNINGS')!;
  const antiOverfitting = buildAntiOverfittingDiagnostics({
    holdoutReturns: input.holdoutReturns,
    trialSharpeRatios: input.trialSharpeRatios,
    trialCount: input.trialRegistry.listTrials().length,
  });
  const regimeSlices = buildRegimeSliceReports(input.holdoutRows, ['TECH', 'HEALTH', 'ENERGY']);
  const reality = resolveEarningsRealityGate({
    architectureComplete: input.architectureComplete,
    chronologyValid: input.chronologyValid,
    holdoutEventCount: input.chronology.holdoutEventCount,
    forecast: helios.forecast,
    investment: helios.investment,
    antiOverfitting,
    forwardPaperEvidencePresent: false,
    liveTradingEnabled: false,
  });

  return Object.freeze({
    schema: HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
    generatedAt: input.generatedAt,
    gitSha: input.gitSha,
    chronology: input.chronology,
    benchmarks,
    heliosVsNaiveEpsMaeImprovementBps: epsMaeImprovementBps(helios.forecast, naive.forecast),
    regimeSlices,
    antiOverfitting,
    realityGate: reality.status,
    realityGateNotes: reality.notes,
    insignificantAlphaNotPromoted: reality.insignificantAlphaNotPromoted,
  });
}
