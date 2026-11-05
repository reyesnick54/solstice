/**
 * HELIOS HEALTH07 — definitive integrated memory soak qualification.
 * CI uses shortened soak via SUNREY_BENCH_SOAK_QUALIFY_MS (default 45_000).
 * Production qualification: 3× 120_000 ms trials via scripts/helios-health07-memory-soak-qualify.ts
 *
 * Runs in a fresh Node process when invoked from the full repository suite so prior
 * tests do not inflate steady-state heap plateau checks.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { createHeliosIntegratedMemoryHarness } from '../packages/platform/src/helios/hardening/memory-soak-snapshot.ts';
import { runSoak } from '../packages/sunrey-chain/src/perf/soak.ts';
import {
  evaluateHeliosMemorySoakQualification,
  HELIOS_MEMORY_SOAK_QUALIFIED,
} from '../packages/sunrey-chain/src/perf/memory-soak-qualification.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const TRIALS = 3;
const DURATION_MS = Number.parseInt(process.env.SUNREY_BENCH_SOAK_QUALIFY_MS ?? '45000', 10);

function runIntegratedSoakTrials(): void {
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const integrated = createHeliosIntegratedMemoryHarness();
    const report = runSoak({
      durationMs: DURATION_MS,
      integrated,
    });
    const memory = report.invariants.find((row) => row.id === 'MEMORY_GROWTH_BUDGET');
    assert.equal(memory?.ok, true, `trial=${trial} ${memory?.detail}`);
    const qualification = evaluateHeliosMemorySoakQualification({
      invariants: report.invariants,
      memorySnapshots: report.memorySnapshots,
      durationMs: DURATION_MS,
    });
    assert.equal(qualification.marker, HELIOS_MEMORY_SOAK_QUALIFIED);
    assert.equal(qualification.ok, true, qualification.blockers.join('; '));
    assert.ok(report.memorySnapshots.length >= 2);
    const phased = report.memorySnapshots.filter((row) => row.memoryPhase === 'STEADY_STATE');
    assert.ok(phased.length >= 1, 'expected STEADY_STATE phase samples');
  }
}

describe('HELIOS HEALTH07 memory soak final qualification', () => {
  it(`passes ${TRIALS} deterministic integrated soak trials`, () => {
    if (process.env.HELIOS_HEALTH07_SOAK_CHILD !== '1') {
      const result = spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          '--disable-warning=ExperimentalWarning',
          '--test',
          '--test-reporter=spec',
          SELF,
        ],
        {
          cwd: ROOT,
          env: { ...process.env, HELIOS_HEALTH07_SOAK_CHILD: '1' },
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return;
    }
    runIntegratedSoakTrials();
  });
});
