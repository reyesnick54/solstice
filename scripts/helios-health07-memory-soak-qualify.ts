#!/usr/bin/env node
/**
 * HELIOS HEALTH07 — run 3× canonical 120s integrated memory soaks and emit qualification JSON.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance/helios/results/health07');
const SOAK_MS = Number.parseInt(process.env.SUNREY_BENCH_SOAK_MS ?? '120000', 10);
const TRIALS = Number.parseInt(process.env.SUNREY_BENCH_SOAK_TRIALS ?? '3', 10);
const LONG_PROFILE_MS = 900_000;

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function runTrial(trial: number): { readonly pass: boolean; readonly detail: string } {
  const jsonPath = join(OUT_DIR, `soak-trial-${trial}-${SOAK_MS}ms.json`);
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      'scripts/sunrey-bench.mjs',
      'soak',
      '--soak-ms',
      String(SOAK_MS),
      '--json',
      jsonPath,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, SUNREY_BENCH_HELIOS_INTEGRATED: '1' },
    },
  );
  const detail = (result.stderr || result.stdout || '').replace(/\s+/g, ' ').slice(0, 400);
  return { pass: result.status === 0, detail };
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const sha = gitSha();
  const trials: Array<{ readonly trial: number; readonly pass: boolean; readonly detail: string }> = [];
  let allPass = true;
  for (let i = 1; i <= TRIALS; i += 1) {
    const row = runTrial(i);
    trials.push({ trial: i, ...row });
    allPass &&= row.pass;
  }
  const marker = allPass ? 'HELIOS_MEMORY_SOAK_QUALIFIED' : 'HELIOS_MEMORY_SOAK_BLOCKED';
  const payload = {
    schema: 'sunrey.helios.memory-soak-final.v1',
    gitSha: sha,
    soakMs: SOAK_MS,
    trials,
    marker,
    longProfileMs: LONG_PROFILE_MS,
    longProfileCommand:
      'node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/sunrey-bench.mjs soak --soak-ms 900000',
  };
  writeFileSync(join(OUT_DIR, `health07-memory-soak-${sha.slice(0, 12)}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(allPass ? 0 : 1);
}

main();
