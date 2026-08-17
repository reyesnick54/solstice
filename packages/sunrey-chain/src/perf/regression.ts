import type { BenchReport } from './types.ts';

export type RegressionFinding = {
  readonly name: string;
  readonly baselineMedianNs: number;
  readonly currentMedianNs: number;
  readonly ratio: number;
  readonly flagged: boolean;
};

const MICRO_SUITES = new Set(['crypto', 'mempool', 'wallet']);
const RATIO_BUDGET = 3;

export function compareReports(baseline: BenchReport, current: BenchReport): readonly RegressionFinding[] {
  const findings: RegressionFinding[] = [];
  for (const row of current.cases) {
    if (!MICRO_SUITES.has(row.suite) || !row.latency || row.latency.count === 0) {
      continue;
    }
    const prior = baseline.cases.find((item) => item.suite === row.suite && item.name === row.name);
    if (!prior?.latency || prior.latency.medianNs <= 0) {
      continue;
    }
    const ratio = row.latency.medianNs / prior.latency.medianNs;
    findings.push({
      name: `${row.suite}/${row.name}`,
      baselineMedianNs: prior.latency.medianNs,
      currentMedianNs: row.latency.medianNs,
      ratio,
      flagged: ratio >= RATIO_BUDGET,
    });
  }
  return findings;
}

export function regressionFailed(findings: readonly RegressionFinding[]): boolean {
  return findings.some((row) => row.flagged);
}
