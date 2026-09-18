import { meanMinor, medianMinor, varianceMinorSquared } from './money.ts';
import type { EvaluationRunRecord, StatisticalSummary } from './types.ts';

const MINIMUM_SAMPLE_FOR_SIGNIFICANCE = 30;

export function summarizeRuns(runs: readonly EvaluationRunRecord[]): StatisticalSummary {
  const netResults = runs.map((row) => row.netResult.minorUnits);
  const sorted = [...netResults].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  const decisionCount = runs.reduce((acc, row) => acc + row.decisionCount, 0);
  const tradeCount = runs.reduce((acc, row) => acc + row.tradeCount, 0);
  const maxDrawdownBps = runs.reduce((acc, row) => Math.max(acc, row.maxDrawdownBps), 0);
  return Object.freeze({
    runCount: runs.length,
    decisionCount,
    tradeCount,
    meanNetResultMinor: meanMinor(netResults),
    medianNetResultMinor: medianMinor(netResults),
    bestNetResultMinor: sorted[sorted.length - 1] ?? '0',
    worstNetResultMinor: sorted[0] ?? '0',
    varianceMinorSquared: varianceMinorSquared(netResults),
    maxDrawdownBps,
    smallSampleWarning: runs.length < MINIMUM_SAMPLE_FOR_SIGNIFICANCE || decisionCount < MINIMUM_SAMPLE_FOR_SIGNIFICANCE,
    minimumSampleForSignificance: MINIMUM_SAMPLE_FOR_SIGNIFICANCE,
  });
}
