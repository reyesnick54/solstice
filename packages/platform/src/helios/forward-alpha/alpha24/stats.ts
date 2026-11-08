import type { ForwardStrategyResearchRecord } from './types.ts';

export function isLoserStrategy(row: ForwardStrategyResearchRecord): boolean {
  return row.benchmarkRelativeBps < 0 || row.cumulativePnLMinor < 0n;
}

export function isSurvivingStrategy(row: ForwardStrategyResearchRecord): boolean {
  return row.lifecycle === 'ACTIVE' || row.lifecycle === 'SURVIVING' || row.lifecycle === 'CHALLENGER';
}

export function isRetiredStrategy(row: ForwardStrategyResearchRecord): boolean {
  return (
    row.lifecycle === 'RETIRED' ||
    row.lifecycle === 'TERMINATED' ||
    row.lifecycle === 'DEMOTED'
  );
}

export function activeStrategies(
  strategies: readonly ForwardStrategyResearchRecord[],
): readonly ForwardStrategyResearchRecord[] {
  return Object.freeze(strategies.filter((s) => s.lifecycle === 'ACTIVE' || s.lifecycle === 'CHALLENGER'));
}

export function meanBps(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / values.length);
}

export function weightedMeanBps(
  rows: readonly { readonly weightBps: number; readonly valueBps: number }[],
): number {
  const totalWeight = rows.reduce((acc, row) => acc + Math.max(0, row.weightBps), 0);
  if (totalWeight === 0) {
    return 0;
  }
  const weighted = rows.reduce((acc, row) => acc + row.valueBps * Math.max(0, row.weightBps), 0);
  return Math.round(weighted / totalWeight);
}
