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

const ROOT = join(import.meta.dirname, '..');

describe('repository JSON integrity', () => {
  it('rejects duplicate keys and keeps a single package.json test script', () => {
    const { findings, packageJson, manifest } = checkJsonIntegrity(ROOT);
    assert.deepEqual(findings, []);
    assert.equal(typeof packageJson?.scripts?.test, 'string');
    const pkgText = readFileSync(join(ROOT, 'package.json'), 'utf8');
    assert.equal([...pkgText.matchAll(/^\s*"test"\s*:/gm)].length, 1);
    assert.ok(String(packageJson?.scripts?.test).includes('packages/sunrey-chain/src/release-candidate/economic/**/*.test.ts'));
    assert.ok(String(packageJson?.scripts?.test).includes('packages/security/src/regulated/**/*.test.ts'));
    assert.ok(String(packageJson?.scripts?.test).includes('packages/payments/src/**/*.test.ts'));
    const ciText = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    assert.ok(ciText.indexOf('node scripts/check-json-integrity.mjs') < ciText.indexOf('npm ci --ignore-scripts'));
    parseJsonStrict(readFileSync(join(ROOT, 'docs/architecture/manifest.json'), 'utf8'), 'manifest');
    const ids = (manifest?.capabilities ?? []).map((item: { id: string }) => item.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
