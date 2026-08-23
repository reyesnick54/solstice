import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { evaluateBackendReleaseCandidate, RC_MANIFEST_REL, RC_VERSION } = require('../scripts/qualify-backend-rc.mjs') as {
  evaluateBackendReleaseCandidate: (root?: string) => {
    findings: string[];
    status: Record<string, boolean>;
    version: string;
    screens: string[];
  };
  RC_MANIFEST_REL: string;
  RC_VERSION: string;
};
const { checkAuthorityMap } = require('../scripts/check-authority-map.mjs') as {
  checkAuthorityMap: (root: string) => { findings: string[]; map: { authorities: { id: string; owner: string; unique: boolean }[] } };
};
const { checkArchitectureFreeze } = require('../scripts/check-architecture-freeze.mjs') as {
  checkArchitectureFreeze: (root: string) => { findings: string[] };
};
const { checkProductionSafety } = require('../scripts/check-production-safety.mjs') as {
  checkProductionSafety: (root: string) => { findings: string[] };
};

const ROOT = join(import.meta.dirname, '..');

const UNIQUE = [
  ['ledger', 'packages/ledger'],
  ['kernel', 'packages/kernel'],
  ['execution-authority', 'packages/permissions'],
  ['identity', 'packages/identity'],
  ['compliance', 'packages/kernel'],
  ['sunrey-agent', 'packages/sunrey-agent'],
  ['exchange', 'packages/sunrey-exchange'],
  ['sunrey-chain-consensus', 'packages/sunrey-chain'],
  ['native-asset-supply', 'packages/sunrey-chain'],
  ['hin-rights', 'packages/information-market'],
  ['custody', 'packages/custody'],
] as const;

const FORBIDDEN = [
  'packages/ledger-v2',
  'packages/kernel-v2',
  'packages/moonrey-coin',
  'packages/provider-runtime',
  'packages/hin',
  'packages/activation',
  'packages/kill-switch',
];

describe('Phase I backend production release candidate', () => {
  it('keeps one owner for each frozen authority', () => {
    const { findings, map } = checkAuthorityMap(ROOT);
    assert.deepEqual(findings, []);
    for (const [id, owner] of UNIQUE) {
      const rows = map.authorities.filter((row) => row.id === id);
      assert.equal(rows.length, 1, id);
      assert.equal(rows[0]?.owner, owner, id);
      assert.equal(rows[0]?.unique, true, id);
    }
    assert.deepEqual(checkArchitectureFreeze(ROOT).findings, []);
    for (const pkg of FORBIDDEN) {
      assert.equal(existsSync(join(ROOT, pkg)), false, pkg);
    }
  });

  it('keeps production disabled while publishing the RC identifier', () => {
    assert.deepEqual(checkProductionSafety(ROOT).findings, []);
    const report = evaluateBackendReleaseCandidate(ROOT);
    assert.deepEqual(report.findings, []);
    assert.equal(report.version, RC_VERSION);
    assert.equal(report.status.BACKEND_PRODUCTION_RELEASE_CANDIDATE, true);
    assert.equal(report.status.PRODUCTION_READY, false);
    assert.equal(report.status.PRODUCTION_ACTIVE, false);
    assert.equal(report.status.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(report.status.MAINNET_ACTIVE, false);
  });

  it('records explicit external blockers and every Lovable screen', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, RC_MANIFEST_REL), 'utf8')) as {
      recommendation: string;
      externalGates: { missing: string[] };
      lovable: { screens: { id: string }[] };
      productionFlags: { PRODUCTION_READY: boolean };
    };
    assert.equal(manifest.recommendation, 'BACKEND_RC_READY_PENDING_EXTERNAL_GATES');
    assert.equal(manifest.productionFlags.PRODUCTION_READY, false);
    assert.ok(manifest.externalGates.missing.includes('external_security_audit'));
    assert.ok(manifest.externalGates.missing.includes('legal_counsel_review'));
    assert.ok(manifest.externalGates.missing.includes('production_hsm_kms'));
    const report = evaluateBackendReleaseCandidate(ROOT);
    for (const id of report.screens) {
      assert.ok(manifest.lovable.screens.some((row) => row.id === id), id);
    }
  });
});
