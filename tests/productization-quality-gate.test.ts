import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { checkJsonIntegrity } = require('../scripts/check-json-integrity.mjs') as {
  checkJsonIntegrity: (root: string) => { findings: string[] };
};
const { checkAuthorityMap } = require('../scripts/check-authority-map.mjs') as {
  checkAuthorityMap: (root: string) => { findings: string[] };
};
const { checkArchitectureFreeze } = require('../scripts/check-architecture-freeze.mjs') as {
  checkArchitectureFreeze: (root: string) => { findings: string[] };
};
const { checkProductionSafety } = require('../scripts/check-production-safety.mjs') as {
  checkProductionSafety: (root: string) => { findings: string[]; seen: Record<string, number> };
};
const { checkApiSpecs } = require('../scripts/check-api-specs.mjs') as {
  checkApiSpecs: (root: string) => { findings: string[]; files: number };
};
const { checkYamlIntegrity } = require('../scripts/check-yaml-integrity.mjs') as {
  checkYamlIntegrity: (root: string) => { findings: string[] };
};
const { checkMigrationQuality } = require('../scripts/check-migration-quality.mjs') as {
  checkMigrationQuality: (root: string) => { findings: string[]; databases: string[] };
};

const ROOT = join(import.meta.dirname, '..');

describe('Phase A productization quality gate', () => {
  it('repository integrity includes productization JSON', () => {
    const { findings } = checkJsonIntegrity(ROOT);
    assert.deepEqual(findings, []);
    const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
    assert.equal([...pkg.matchAll(/^\s*"test"\s*:/gm)].length, 1);
    assert.match(pkg, /productization:preflight/);
    assert.match(pkg, /packages\/sunrey-chain\/src\/native-assets\/\*\.test\.ts/);
    assert.match(pkg, /packages\/sunrey-chain\/src\/production-ceremony\/\*\.test\.ts/);
    assert.match(pkg, /packages\/sunrey-chain\/src\/release-candidate\/mainnet\/\*\.test\.ts/);
  });

  it('authority map and architecture freeze validate', () => {
    assert.equal(existsSync(join(ROOT, 'docs/productization/sunrey-authority-map.json')), true);
    assert.equal(existsSync(join(ROOT, 'docs/productization/sunrey-architecture-freeze.json')), true);
    assert.deepEqual(checkAuthorityMap(ROOT).findings, []);
    assert.deepEqual(checkArchitectureFreeze(ROOT).findings, []);
  });

  it('production safety remains fail-closed and off', () => {
    const { findings, seen } = checkProductionSafety(ROOT);
    assert.deepEqual(findings, []);
    assert.ok(seen.PRODUCTION_READY > 0);
    assert.ok(seen.PRODUCTION_ACTIVE > 0);
    assert.ok(seen.LIVE_CONNECTIVITY_ENABLED > 0);
    assert.ok(seen.production_authorized > 0);
  });

  it('API specs and YAML validate', () => {
    const api = checkApiSpecs(ROOT);
    assert.deepEqual(api.findings, []);
    assert.ok(api.files >= 5);
    assert.deepEqual(checkYamlIntegrity(ROOT).findings, []);
  });

  it('migration directories start at V001 and increase', () => {
    const { findings, databases } = checkMigrationQuality(ROOT);
    assert.deepEqual(findings, []);
    assert.ok(databases.includes('customer'));
    assert.ok(databases.includes('ledger'));
  });

  it('CI names the required check groups', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    for (const needle of [
      '[INTEGRITY]',
      '[ARCHITECTURE]',
      '[TYPECHECK]',
      '[RUST]',
      '[TEST]',
      '[DATABASE]',
      '[API]',
      '[SECURITY]',
      '[GENERATED DRIFT]',
      '[PRODUCTION SAFETY]',
      'scripts/check-authority-map.mjs',
      'scripts/check-architecture-freeze.mjs',
      'scripts/check-production-safety.mjs',
      'scripts/check-api-specs.mjs',
      'scripts/check-migration-quality.mjs',
    ]) {
      assert.ok(ci.includes(needle), needle);
    }
    const preflightJson = ci.indexOf('node scripts/check-json-integrity.mjs');
    const install = ci.indexOf('npm ci --ignore-scripts');
    assert.ok(preflightJson >= 0 && install >= 0 && preflightJson < install);
  });

  it('Phase A closure and CI docs exist', () => {
    assert.equal(existsSync(join(ROOT, 'docs/productization/SUNREY_CI_QUALITY_GATE.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/productization/SUNREY_TEST_CLASSIFICATION.md')), true);
    const closure = readFileSync(join(ROOT, 'docs/productization/PHASE_A_CLOSURE_REPORT.md'), 'utf8');
    assert.match(closure, /PHASE A does not mean SunRey is production ready/);
    assert.match(closure, /READY_FOR_PHASE_B=true/);
    assert.match(closure, /PRODUCTION_READY=false/);
    assert.match(closure, /PRODUCTION_ACTIVE=false/);
    assert.match(closure, /LIVE_CONNECTIVITY_ENABLED=false/);
  });
});
