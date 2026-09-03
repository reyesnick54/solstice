#!/usr/bin/env node
/**
 * Canonical repository static validation orchestrator.
 *
 * Runs lightweight deterministic integrity checks. Does not recurse into
 * npm run ci or other expensive end-to-end suites.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = Object.freeze([
  { name: 'json-integrity', command: 'node', args: ['scripts/check-json-integrity.mjs'] },
  { name: 'merge-integrity', command: 'node', args: ['scripts/check-merge-integrity.mjs'] },
  { name: 'yaml-integrity', command: 'node', args: ['scripts/check-yaml-integrity.mjs'] },
  { name: 'case-collisions', command: 'node', args: ['scripts/check-case-collisions.mjs'] },
  { name: 'architectural-invariants', command: 'python3', args: ['scripts/lint-architectural-invariants.py'] },
  { name: 'extraction-dryrun', command: 'python3', args: ['scripts/extraction-dryrun.py'] },
  { name: 'package-boundaries', command: 'python3', args: ['scripts/check-package-boundaries.py'] },
  { name: 'architecture-linter', command: 'npm', args: ['run', 'lint:architecture'] },
  { name: 'kernel-gating', command: 'npm', args: ['run', 'gate'] },
  { name: 'deployment-posture', command: 'python3', args: ['scripts/check-deployment-posture.py'] },
  { name: 'production-safety', command: 'node', args: ['scripts/check-production-safety.mjs'] },
  { name: 'provider-catalog', command: 'node', args: ['scripts/validate-free-api-catalog.mjs'] },
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  {
    name: 'architecture-guards-access-economy',
    command: 'node',
    args: [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      '--test-reporter=spec',
      'packages/access-economy/src/architecture-guards.test.ts',
    ],
  },
  {
    name: 'rust-check',
    command: 'bash',
    args: ['-lc', 'cd packages/sunrey-chain/rust && cargo check --workspace --locked'],
  },
]);

function runStep(step) {
  const result = spawnSync(step.command, step.args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const only = process.argv.slice(2);
  const steps = only.length > 0 ? STEPS.filter((step) => only.includes(step.name)) : STEPS;
  if (only.length > 0 && steps.length === 0) {
    console.error(`validate: unknown step(s): ${only.join(', ')}`);
    console.error(`available: ${STEPS.map((step) => step.name).join(', ')}`);
    process.exit(2);
  }

  for (const step of steps) {
    console.log(`\n==> validate:${step.name}`);
    runStep(step);
  }

  console.log('\nvalidate: ok');
}

main();
