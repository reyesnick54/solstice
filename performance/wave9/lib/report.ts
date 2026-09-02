/**
 * Wave 9 qualification report writer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { QualificationEnvironment } from '../../lib/env-metadata.ts';
import { summarizeReport, type SuiteResult } from '../../lib/report.ts';

export type Wave9QualificationReport = {
  readonly schemaVersion: 1;
  readonly wave: 'wave9-readiness';
  readonly profile: 'smoke' | 'full';
  readonly environment: QualificationEnvironment;
  readonly suites: readonly SuiteResult[];
  readonly summary: ReturnType<typeof summarizeReport>;
  readonly disclaimer: string;
};

const WAVE9_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function wave9ResultsDir(timestamp?: string): string {
  const stamp = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  return join(WAVE9_ROOT, 'results', `wave9-${stamp}`);
}

export function writeWave9Report(
  report: Wave9QualificationReport,
  dir?: string,
): string {
  const outDir = dir ?? wave9ResultsDir();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  for (const suite of report.suites) {
    writeFileSync(join(outDir, `${suite.suite}.json`), `${JSON.stringify(suite, null, 2)}\n`);
  }
  return outDir;
}

export function buildWave9Report(input: {
  readonly profile: 'smoke' | 'full';
  readonly environment: QualificationEnvironment;
  readonly suites: readonly SuiteResult[];
}): Wave9QualificationReport {
  return {
    schemaVersion: 1,
    wave: 'wave9-readiness',
    profile: input.profile,
    environment: input.environment,
    suites: input.suites,
    summary: summarizeReport(input.suites),
    disclaimer:
      'ENGINEERING_MEASUREMENT from synthetic local/simulation environments. Not contractual production capacity, RPO, or RTO.',
  };
}
