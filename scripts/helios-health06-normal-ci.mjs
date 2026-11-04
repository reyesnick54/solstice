#!/usr/bin/env node
/**
 * HEALTH06 — GitHub Actions `ci` job equivalent (not the local superset `npm run ci`).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    console.error(`[health06-normal-ci] FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[health06-normal-ci] ok: ${label}`);
}

run('integrity preflight', 'node', ['scripts/check-json-integrity.mjs']);
run('validate json', 'node', ['scripts/validate-json.mjs']);
run('merge integrity', 'node', ['scripts/check-merge-integrity.mjs']);
run('case collisions', 'node', ['scripts/check-case-collisions.mjs']);
run('lockfiles', 'node', ['scripts/check-lockfiles.mjs']);
run('yaml integrity', 'node', ['scripts/check-yaml-integrity.mjs']);
run('free api catalog', 'node', ['scripts/validate-free-api-catalog.mjs']);
run('architectural invariants', 'python3', ['scripts/lint-architectural-invariants.py']);
run('extraction dryrun', 'python3', ['scripts/extraction-dryrun.py']);
run('package boundaries', 'python3', ['scripts/check-package-boundaries.py']);
run('lint architecture', 'npm', ['run', 'lint:architecture']);
run('naming audit', 'npm', ['run', 'naming:audit']);
run('authority map', 'node', ['scripts/check-authority-map.mjs']);
run('architecture freeze', 'node', ['scripts/check-architecture-freeze.mjs']);
run('build status', 'node', ['scripts/check-build-status.mjs']);
run('kernel gate', 'npm', ['run', 'gate']);
run('access economy guards', 'node', [
  '--experimental-strip-types',
  '--disable-warning=ExperimentalWarning',
  '--test',
  '--test-reporter=spec',
  'packages/access-economy/src/architecture-guards.test.ts',
]);
run('deployment posture', 'python3', ['scripts/check-deployment-posture.py']);
run('production safety', 'node', ['scripts/check-production-safety.mjs']);
run('api specs', 'node', ['scripts/check-api-specs.mjs']);
run('migration quality', 'node', ['scripts/check-migration-quality.mjs']);

run('rust check', 'bash', ['-lc', 'cd packages/sunrey-chain/rust && cargo check --workspace --locked']);
run('rust fmt', 'bash', ['-lc', 'cd packages/sunrey-chain/rust && cargo fmt --check']);
run('rust clippy', 'bash', [
  '-lc',
  'cd packages/sunrey-chain/rust && cargo clippy --all-targets --locked -- -D warnings',
]);
run('rust test', 'bash', ['-lc', 'cd packages/sunrey-chain/rust && cargo test --workspace --locked']);

run('generated drift', 'node', ['scripts/check-generated-drift.mjs']);
run('release audit', 'node', ['scripts/sunrey-release.mjs', 'audit']);
run('release sbom', 'node', ['scripts/sunrey-release.mjs', 'sbom']);
run('release provenance', 'node', ['scripts/sunrey-release.mjs', 'provenance']);
run('compare builds', 'node', ['scripts/sunrey-release.mjs', 'compare-builds']);
run('release sign', 'node', ['scripts/sunrey-release.mjs', 'sign']);
run('release verify', 'node', ['scripts/sunrey-release.mjs', 'verify']);
run('audit generate', 'node', ['scripts/sunrey-audit.mjs', 'generate']);
run('audit verify', 'node', ['scripts/sunrey-audit.mjs', 'verify', 'dist/sunrey-audit']);
run('static security lint', 'node', ['scripts/static-security-lint.mjs']);
run('test access', 'npm', ['run', 'test:access']);
run('fuzz smoke', 'npm', ['run', 'test:fuzz-smoke']);
run('formal smoke', 'npm', ['run', 'test:formal-smoke']);
run('typecheck regression gate', 'node', ['scripts/typecheck-regression-gate.mjs'], {
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim() },
});
run('secret scan', 'python3', ['scripts/secret-scan.py']);
run('secret scan self-test', 'python3', ['scripts/secret-scan.py', '--self-test']);
run('container pins', 'node', ['scripts/check-container-pins.mjs']);
run('qualify backend rc', 'npm', ['run', 'qualify:backend-rc']);

console.log('[health06-normal-ci] GitHub CI job equivalent: ok');
