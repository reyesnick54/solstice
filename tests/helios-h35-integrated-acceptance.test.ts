/**
 * HELIOS H35 — integrated Hetzner + app acceptance (fast CI).
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED,
  HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
  HELIOS_INTEGRATED_ACCEPTANCE_SCHEMA,
  evaluateHeliosIntegratedAcceptance,
  verifyHeliosReleasePackageGate,
} from '../packages/platform/src/helios/integrated-acceptance/index.ts';
import {
  evaluateHeliosReleasePackageQualification,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
} from '../packages/platform/src/helios/release-package/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { runHeliosIntegratedAcceptanceLocal } from '../scripts/lib/helios-integrated-acceptance.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS H35 — integrated Hetzner + app acceptance', () => {
  it('architecture guard: integrated-acceptance stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/integrated-acceptance'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('release gate blocks when H34 manifest is absent', () => {
    const checks = verifyHeliosReleasePackageGate({ manifest: null });
    assert.ok(checks.some((row) => row.status === 'BLOCKED'));
  });

  it('release gate passes for qualified H34 manifest', () => {
    const manifest = evaluateHeliosReleasePackageQualification({
      releaseId: 'test-release',
      commitSha: 'abc123',
      artifactDigest: 'sha256:deadbeef',
      migrationImageDigest: 'sha256:feedface',
      configurationPackage: 'sha256:config',
      gates: [{ id: 'test', status: 'PASS' }],
      rollbackArtifactRef: 'docs/productization/sunrey-backend-rc-artifacts.json',
    });
    assert.equal(manifest.marker, HELIOS_RELEASE_PACKAGE_QUALIFIED);
    const checks = verifyHeliosReleasePackageGate({ manifest, expectedCommitSha: 'abc123' });
    assert.ok(checks.every((row) => row.status === 'PASS'));
  });

  it('local integrated acceptance produces machine-readable report', async () => {
    const manifestPath = join(ROOT, 'release/helios-release-package.json');
    const hadManifest = existsSync(manifestPath);
    const prior = hadManifest ? readFileSync(manifestPath, 'utf8') : null;

    if (!hadManifest) {
      const manifest = evaluateHeliosReleasePackageQualification({
        releaseId: 'helios-h35-ci',
        commitSha: 'ci-local',
        artifactDigest: 'sha256:ci-artifact',
        migrationImageDigest: 'sha256:ci-migrate',
        configurationPackage: 'sha256:ci-config',
        gates: [{ id: 'ci', status: 'PASS' }],
        rollbackArtifactRef: 'docs/productization/sunrey-backend-rc-artifacts.json',
      });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }

    try {
      const report = await runHeliosIntegratedAcceptanceLocal(
        JSON.parse(readFileSync(manifestPath, 'utf8')),
      );
      assert.equal(report.schema, HELIOS_INTEGRATED_ACCEPTANCE_SCHEMA);
      assert.ok(report.endToEndFlows.length >= 1);
      assert.ok(report.safetyPosture.every((row) => row.status === 'PASS'));
      assert.ok(
        report.marker === HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED ||
          report.marker === HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED,
      );
    } finally {
      if (hadManifest && prior != null) {
        writeFileSync(manifestPath, prior);
      } else if (!hadManifest) {
        try {
          unlinkSync(manifestPath);
        } catch {
          // best effort restore
        }
      }
    }
  });

  it('qualification marker constants are defined', () => {
    const sample = evaluateHeliosIntegratedAcceptance({
      releaseId: 'x',
      commitSha: 'x',
      artifactDigest: 'x',
      environment: 'simulation',
      deploymentTimestamp: new Date().toISOString(),
      mode: 'local',
      preDeployGates: [{ category: 'preDeploy', label: 'blocked', status: 'BLOCKED' }],
      migrations: [],
      healthChecks: [],
      readinessChecks: [],
      endToEndFlows: [],
      restartProof: [],
      multiCustomerProof: [],
      degradedStateTests: [],
      frontendBackendAcceptance: [],
      providerModelQualification: [],
      rollbackReadiness: [],
      operationalObservability: [],
      securityPosture: [],
      safetyPosture: [],
    });
    assert.equal(sample.marker, HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED);
    assert.equal(HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED, 'HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED');
  });
});

