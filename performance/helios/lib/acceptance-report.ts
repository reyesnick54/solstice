/**
 * HELIOS H35 integrated acceptance report writer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HeliosIntegratedAcceptanceReport } from '../../../packages/platform/src/helios/integrated-acceptance/index.ts';

const HELIOS_PERF_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function heliosAcceptanceResultsDir(timestamp?: string): string {
  const stamp = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  return join(HELIOS_PERF_ROOT, 'results', `helios-h35-${stamp}`);
}

export function writeHeliosIntegratedAcceptanceReport(
  report: HeliosIntegratedAcceptanceReport,
  dir?: string,
): string {
  const outDir = dir ?? heliosAcceptanceResultsDir();
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, 'HELIOSIntegratedAcceptanceReport.json');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}
