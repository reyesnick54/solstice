#!/usr/bin/env node
/**
 * Canonical internal security assurance runner (Wave 6 Prompt 17).
 *
 * Does NOT constitute independent audit or penetration-test certification.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\nsecurity-assurance: FAILED at step "${label}"`);
    process.exit(result.status ?? 1);
  }
  console.log(`security-assurance: ${label} ok`);
}

console.log('SunRey internal security assurance (not independent certification)\n');

run('secret-scan', 'python3', ['scripts/secret-scan.py']);
run('secret-scan-self-test', 'python3', ['scripts/secret-scan.py', '--self-test']);
run('static-security-lint', 'node', ['scripts/static-security-lint.mjs']);
run('npm-audit', 'npm', ['audit', '--audit-level=moderate']);
run('sbom-generation', 'npm', ['run', 'testnet:sbom']);

const sbomPath = join(root, 'dist/testnet-release/sbom.cdx.json');
if (!existsSync(sbomPath)) {
  console.error('security-assurance: SBOM output missing');
  process.exit(1);
}
const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
if (sbom.bomFormat !== 'CycloneDX') {
  console.error('security-assurance: SBOM format unexpected');
  process.exit(1);
}
console.log('security-assurance: sbom-format ok');

run(
  'security-tests',
  'node',
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    'tests/wave-6-prompt-17-security-assurance.test.ts',
    'services/api/src/logging.test.ts',
    'packages/identity/src/authorization.test.ts',
    'packages/identity/src/authentication-service.test.ts',
    'packages/provider-sdk/src/transport.test.ts',
    'packages/sunrey-agent/src/productization-security.test.ts',
    'tests/phase-b-security.test.ts',
    'tests/phase-c-security.test.ts',
  ],
);

const cargoToml = join(root, 'packages/sunrey-chain/rust/Cargo.toml');
if (existsSync(cargoToml)) {
  const audit = spawnSync('cargo', ['audit', '--locked'], {
    cwd: join(root, 'packages/sunrey-chain/rust'),
    encoding: 'utf8',
  });
  const stderr = audit.stderr ?? '';
  const stdout = audit.stdout ?? '';
  if (audit.status === 0) {
    console.log('security-assurance: cargo-audit ok');
  } else if (audit.error?.code === 'ENOENT' || /no such command:\s*`audit`/i.test(stderr)) {
    console.log('security-assurance: cargo-audit skipped (cargo-audit not installed)');
  } else {
    if (stdout.length > 0) {
      process.stdout.write(stdout);
    }
    if (stderr.length > 0) {
      process.stderr.write(stderr);
    }
    console.error('security-assurance: cargo-audit reported vulnerabilities or failed');
    process.exit(audit.status ?? 1);
  }
}

console.log('\nsecurity-assurance: ALL STEPS PASSED');
console.log('Reminder: internal checks are NOT independent security certification.');
