#!/usr/bin/env node
/**
 * HELIOS H31 — full adversarial / chaos resilience qualification runner.
 * Expensive scenarios; not part of default PR CI.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    'tests/helios-h31-chaos-qualification.test.ts',
  ],
  {
    cwd: ROOT,
    env: { ...process.env, HELIOS_CHAOS_QUALIFY: '1', HELIOS_FAULT_INJECTION: '1' },
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
