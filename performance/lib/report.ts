/**
 * Machine-readable qualification report writer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { QualificationEnvironment } from './env-metadata.ts';
import type { QualificationStatus } from './targets.ts';

export type SuiteResult = {
  readonly suite: string;
  readonly status: QualificationStatus;
  readonly durationMs: number;
  readonly cases: readonly Record<string, unknown>[];
  readonly failures?: readonly string[];
  readonly notes?: readonly string[];
  readonly environment?: QualificationEnvironment;
};

export type QualificationReport = {
  readonly schemaVersion: 1;
  readonly wave: 'wave6-prompt16';
  readonly environment: QualificationEnvironment;
  readonly suites: readonly SuiteResult[];
  readonly summary: {
    readonly benchmarked: number;
    readonly targetMet: number;
    readonly targetNotMet: number;
    readonly notTested: number;
    readonly environmentLimited: number;
  };
};

const PERFORMANCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function resultsDir(timestamp?: string): string {
  const stamp = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  return join(PERFORMANCE_ROOT, 'results', `wave6-prompt16-${stamp}`);
}

export function summarizeReport(suites: readonly SuiteResult[]): QualificationReport['summary'] {
  const counts = {
    benchmarked: 0,
    targetMet: 0,
    targetNotMet: 0,
    notTested: 0,
    environmentLimited: 0,
  };
  for (const suite of suites) {
    switch (suite.status) {
      case 'BENCHMARKED':
        counts.benchmarked += 1;
        break;
      case 'TARGET_MET':
        counts.targetMet += 1;
        break;
      case 'TARGET_NOT_MET':
        counts.targetNotMet += 1;
        break;
      case 'NOT_TESTED':
        counts.notTested += 1;
        break;
      case 'ENVIRONMENT_LIMITED':
        counts.environmentLimited += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

export function writeReport(report: QualificationReport, dir?: string): string {
  const outDir = dir ?? resultsDir();
  mkdirSync(outDir, { recursive: true });
  const summaryPath = join(outDir, 'summary.json');
  writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const suite of report.suites) {
    writeFileSync(join(outDir, `${suite.suite}.json`), `${JSON.stringify(suite, null, 2)}\n`);
  }
  return outDir;
}

export function mergeSuiteStatus(cases: readonly { readonly status: QualificationStatus }[]): QualificationStatus {
  if (cases.some((row) => row.status === 'TARGET_NOT_MET')) return 'TARGET_NOT_MET';
  if (cases.every((row) => row.status === 'NOT_TESTED')) return 'NOT_TESTED';
  if (cases.some((row) => row.status === 'ENVIRONMENT_LIMITED')) return 'ENVIRONMENT_LIMITED';
  if (cases.every((row) => row.status === 'TARGET_MET')) return 'TARGET_MET';
  return 'BENCHMARKED';
}
