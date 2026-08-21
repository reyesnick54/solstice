#!/usr/bin/env node
/**
 * Practical local pre-PR subset of the production-grade quality gate.
 * Reuses existing scripts. Does not run the full CI demo/SBOM matrix.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  { group: 'INTEGRITY', command: ['node', 'scripts/check-json-integrity.mjs'] },
  { group: 'INTEGRITY', command: ['node', 'scripts/check-merge-integrity.mjs'] },
  { group: 'INTEGRITY', command: ['node', 'scripts/check-yaml-integrity.mjs'] },
  { group: 'INTEGRITY', command: ['node', 'scripts/check-lockfiles.mjs'] },
  { group: 'ARCHITECTURE', command: ['python3', 'scripts/lint-architectural-invariants.py'] },
  { group: 'ARCHITECTURE', command: ['python3', 'scripts/extraction-dryrun.py'] },
  { group: 'ARCHITECTURE', command: ['npm', 'run', 'lint:architecture'] },
  { group: 'ARCHITECTURE', command: ['node', 'scripts/check-authority-map.mjs'] },
  { group: 'ARCHITECTURE', command: ['node', 'scripts/check-architecture-freeze.mjs'] },
  { group: 'PRODUCTION SAFETY', command: ['python3', 'scripts/check-deployment-posture.py'] },
  { group: 'PRODUCTION SAFETY', command: ['node', 'scripts/check-production-safety.mjs'] },
  { group: 'ARCHITECTURE', command: ['npm', 'run', 'gate'] },
  { group: 'API', command: ['node', 'scripts/check-api-specs.mjs'] },
  { group: 'DATABASE', command: ['node', 'scripts/check-migration-quality.mjs'] },
  { group: 'GENERATED DRIFT', command: ['node', 'scripts/check-generated-drift.mjs'] },
  { group: 'TYPECHECK', command: ['npm', 'run', 'typecheck'] },
  { group: 'TEST', command: ['npm', 'test'] },
  { group: 'SECURITY', command: ['python3', 'scripts/secret-scan.py'] },
];

function run(group, command) {
  console.log(`\n==> [${group}] ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n[${group}] failed: ${command.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function rustAvailable() {
  const cargo = spawnSync('cargo', ['--version'], { encoding: 'utf8' });
  return cargo.status === 0;
}

function postgresAvailable() {
  if (process.env.SUNREY_PG_HOST) return true;
  const pg = spawnSync('pg_isready', ['-q'], { encoding: 'utf8' });
  return pg.status === 0;
}

function main() {
  console.log('SunRey productization preflight (practical pre-PR subset)');
  for (const step of STEPS) {
    run(step.group, step.command);
  }

  if (rustAvailable() && existsSync(join(ROOT, 'packages/sunrey-chain/rust/Cargo.toml'))) {
    run('RUST', ['bash', '-lc', 'cd packages/sunrey-chain/rust && cargo fmt --check && cargo clippy --all-targets --locked -- -D warnings && cargo test --workspace --locked']);
  } else {
    console.log('\n==> [RUST] skipped (cargo not available in this environment)');
  }

  if (postgresAvailable()) {
    run('DATABASE', ['npm', 'run', 'db:migrate']);
    run('DATABASE', ['npm', 'run', 'test:persistence']);
  } else {
    console.log('\n==> [DATABASE] migrate/persistence skipped (PostgreSQL not available; ordering check already ran)');
  }

  console.log('\nproductization preflight: ok');
}

main();
