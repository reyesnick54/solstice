/**
 * HELIOS HEALTH07 — definitive integrated memory soak qualification.
 * CI uses shortened soak via SUNREY_BENCH_SOAK_QUALIFY_MS (default 45_000).
 * Production qualification: 3× 120_000 ms trials via scripts/helios-health07-memory-soak-qualify.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRIALS = 3;
const DURATION_MS = Number.parseInt(process.env.SUNREY_BENCH_SOAK_QUALIFY_MS ?? '45000', 10);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function runIntegratedSoakTrialInFreshProcess(trial: number): void {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      'scripts/sunrey-bench.mjs',
      'soak',
      '--soak-ms',
      String(DURATION_MS),
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUNREY_BENCH_HELIOS_INTEGRATED: '1',
      },
    },
  );
  assert.equal(
    result.status,
    0,
    `trial=${trial} integrated soak failed: ${(result.stderr || result.stdout || '').trim().slice(-800)}`,
  );
}

describe('HELIOS HEALTH07 memory soak final qualification', () => {
  it(`passes ${TRIALS} deterministic integrated soak trials`, () => {
    for (let trial = 0; trial < TRIALS; trial += 1) {
      runIntegratedSoakTrialInFreshProcess(trial);
    }
  });
});
