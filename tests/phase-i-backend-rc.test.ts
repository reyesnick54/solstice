import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const {
  evaluateBackendReleaseCandidate,
  RC_MANIFEST_REL,
  RC_VERSION,
  RC_ARTIFACTS_REL,
  REHEARSAL_PLACEHOLDER_DIGEST,
} = require('../scripts/qualify-backend-rc.mjs') as {
  evaluateBackendReleaseCandidate: (root?: string) => {
    findings: string[];
    status: Record<string, boolean>;
    version: string;
    screens: string[];
  };
  RC_MANIFEST_REL: string;
  RC_VERSION: string;
  RC_ARTIFACTS_REL: string;
  REHEARSAL_PLACEHOLDER_DIGEST: string;
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

  it('records real artifact evidence and labels the rehearsal digest', () => {
    assert.equal(RC_VERSION, 'sunrey-backend-v1.0.0-rc.2');
    const artifacts = JSON.parse(readFileSync(join(ROOT, RC_ARTIFACTS_REL), 'utf8')) as {
      rcVersion: string;
      publishedToRegistry: boolean;
      sourceHashes: Record<string, string>;
      sbom: { generated: boolean; digests: string[] };
      provenance: { generated: boolean; digest: string };
      container: { built: boolean; imageId?: string; publishedToRegistry?: boolean };
    };
    assert.equal(artifacts.rcVersion, RC_VERSION);
    assert.equal(artifacts.publishedToRegistry, false);
    assert.equal(artifacts.sbom.generated, true);
    assert.ok(artifacts.sbom.digests.length > 0);
    assert.equal(artifacts.provenance.generated, true);
    assert.match(artifacts.provenance.digest, /^[0-9a-f]{64}$/);
    for (const digest of Object.values(artifacts.sourceHashes)) {
      assert.match(digest, /^sha256:[0-9a-f]{64}$/);
      assert.notEqual(digest, REHEARSAL_PLACEHOLDER_DIGEST);
    }
    if (artifacts.container.built) {
      assert.match(String(artifacts.container.imageId), /^sha256:[0-9a-f]{64}$/);
      assert.notEqual(artifacts.container.imageId, REHEARSAL_PLACEHOLDER_DIGEST);
      assert.equal(artifacts.container.publishedToRegistry, false);
    }
    const release = JSON.parse(
      readFileSync(join(ROOT, 'infra/sunrey-production/releases/preproduction-release.json'), 'utf8'),
    ) as { containerDigest: string; containerDigestKind: string; databaseMigrationVersion: string };
    assert.equal(release.containerDigest, REHEARSAL_PLACEHOLDER_DIGEST);
    assert.equal(release.containerDigestKind, 'SIMULATION_REHEARSAL_PLACEHOLDER');
    assert.equal(release.databaseMigrationVersion, 'V040');
  });
});
