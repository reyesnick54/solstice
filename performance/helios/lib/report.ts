/**
 * HELIOS H33 capacity qualification report writer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CapacityQualificationReport } from '../../../packages/platform/src/helios/capacity/types.ts';

const HELIOS_PERF_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function heliosCapacityResultsDir(timestamp?: string): string {
  const stamp = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  return join(HELIOS_PERF_ROOT, 'results', `helios-h33-${stamp}`);
}

export function writeHeliosCapacityReport(
  report: CapacityQualificationReport,
  dir?: string,
): string {
  const outDir = dir ?? heliosCapacityResultsDir();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'capacity-qualification-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    join(outDir, 'safe-operating-envelope.json'),
    `${JSON.stringify(report.safeOperatingEnvelope, null, 2)}\n`,
  );
  return outDir;
}
