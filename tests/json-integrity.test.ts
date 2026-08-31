import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { checkJsonIntegrity, parseJsonStrict } = require('../scripts/check-json-integrity.mjs') as {
  checkJsonIntegrity: (root: string) => {
    findings: unknown[];
    packageJson?: { scripts?: { test?: string } };
    manifest?: { capabilities?: { id: string }[] };
  };
  parseJsonStrict: (text: string, label: string) => unknown;
};
const { REPOSITORY_TEST_GLOBS } = require('../scripts/run-repository-tests.mjs') as {
  REPOSITORY_TEST_GLOBS: string[];
};

const ROOT = join(import.meta.dirname, '..');

describe('repository JSON integrity', () => {
  it('rejects duplicate keys and keeps a single package.json test script', () => {
    const { findings, packageJson, manifest } = checkJsonIntegrity(ROOT);
    assert.deepEqual(findings, []);
    assert.equal(typeof packageJson?.scripts?.test, 'string');
    assert.equal(packageJson?.scripts?.test, 'node scripts/run-repository-tests.mjs');
    const pkgText = readFileSync(join(ROOT, 'package.json'), 'utf8');
    assert.equal([...pkgText.matchAll(/^\s*"test"\s*:/gm)].length, 1);
    const coverage = REPOSITORY_TEST_GLOBS.join(' ');
    assert.ok(coverage.includes('packages/sunrey-chain/src/release-candidate/economic/**/*.test.ts'));
    assert.ok(coverage.includes('packages/security/src/regulated/**/*.test.ts'));
    assert.ok(coverage.includes('packages/payments/src/**/*.test.ts'));
    assert.ok(coverage.includes('packages/persistence/src/**/*.test.ts'));
    const ciText = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    assert.ok(ciText.indexOf('node scripts/check-json-integrity.mjs') < ciText.indexOf('npm ci --ignore-scripts'));
    assert.ok(ciText.indexOf('node scripts/check-merge-integrity.mjs') < ciText.indexOf('npm ci --ignore-scripts'));
    const platformText = readFileSync(join(ROOT, '.github/workflows/sunrey-full-platform-candidate.yml'), 'utf8');
    assert.ok(
      platformText.indexOf('node scripts/check-merge-integrity.mjs') <
        platformText.indexOf('npm ci --ignore-scripts'),
    );
    parseJsonStrict(readFileSync(join(ROOT, 'docs/architecture/manifest.json'), 'utf8'), 'manifest');
    const ids = (manifest?.capabilities ?? []).map((item: { id: string }) => item.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
