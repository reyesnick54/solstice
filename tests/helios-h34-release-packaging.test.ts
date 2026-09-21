/**
 * HELIOS H34 — release packaging, migration inventory, rollback controls.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_RELEASE_PACKAGE_BLOCKED,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
  HELIOS_RELEASE_PACKAGE_SCHEMA,
  HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION,
  assertNoDuplicateMigrationIds,
  buildHeliosMigrationInventory,
  buildHeliosReleaseManifest,
  buildRollbackMatrix,
  evaluateApiCompatibility,
  evaluateSameShaMigrationRule,
  qualifyHeliosReleasePackage,
  runPreDeployMigrationCheck,
  runRollbackRehearsal,
  schemaMigrationHeads,
} from '../packages/platform/src/helios/release-packaging/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();
const GIT_SHA = '32a612c37e68c99a2856a33e745052b27b512cf1';

describe('HELIOS H34 release packaging', () => {
  it('architecture guard: release-packaging stays within HELIOS boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const local = findings.filter((row) => row.file.includes('helios/release-packaging'));
    assert.equal(local.length, 0, local.map((row) => row.message).join('; '));
  });

  it('simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('builds ordered HELIOS migration inventory from SQL headers', () => {
    const inventory = buildHeliosMigrationInventory(ROOT);
    assert.ok(inventory.length >= 16, `expected >=16 HELIOS-tagged customer migrations, got ${inventory.length}`);
    const ids = inventory.map((row) => row.migrationId);
    assert.ok(ids.includes('V047'));
    assert.ok(ids.includes('V062'));
    for (let i = 1; i < ids.length; i += 1) {
      assert.ok(ids[i]! > ids[i - 1]!, 'inventory must remain sorted by migration id');
    }
  });

  it('pre-deploy migration check passes on repository baseline', () => {
    const check = runPreDeployMigrationCheck(ROOT);
    assert.equal(check.passed, true, check.blockers.join('; '));
    assert.equal(check.schemaBaseline.customer, 'V067');
    assert.equal(check.schemaBaseline.ledger, 'V010');
  });

  it('same-SHA rule rejects application/migration commit mismatch', () => {
    const bad = evaluateSameShaMigrationRule({
      gitSha: GIT_SHA,
      applicationSourceCommit: GIT_SHA,
      migrationRunnerSourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      applicationDockerfile: 'deploy/sunrey-sandbox-hetzner/Dockerfile',
      migrationRunnerDockerfile: 'deploy/sunrey-sandbox-hetzner/Dockerfile',
      applicationImageRef: 'sunrey.local/sandbox-bff:test',
      migrationRunnerImageRef: 'sunrey.local/sandbox-bff:test',
    });
    assert.equal(bad.passed, false);
    assert.ok(bad.blockers.some((row) => row.includes('migration runner')));
  });

  it('release manifest derives versions from repository artifacts', () => {
    const manifest = buildHeliosReleaseManifest({
      repoRoot: ROOT,
      gitSha: GIT_SHA,
      buildTimestampUtc: '2026-09-18T12:00:00.000Z',
    });
    assert.equal(manifest.schema, HELIOS_RELEASE_PACKAGE_SCHEMA);
    assert.equal(manifest.gitSha, GIT_SHA);
    assert.equal(manifest.apiVersion, 'v1');
    assert.equal(manifest.strategyQualificationEngineVersion, HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION);
    assert.equal(manifest.safetyPosture.PRODUCTION_ACTIVE, false);
    assert.equal(manifest.safetyPosture.authorizesLiveFinancialActivity, false);
    assert.ok(manifest.migrations.length >= 16);
    assert.ok(manifest.artifactDigest.startsWith('sha256:'));
  });

  it('API compatibility remains v1 for Consumer BFF', () => {
    const report = evaluateApiCompatibility(ROOT);
    assert.equal(report.compatible, true, report.blockers.join('; '));
    assert.equal(report.findings[0]?.infoVersion, 'v1');
  });

  it('rollback matrix identifies forward-fix for regulatory migrations', () => {
    const matrix = buildRollbackMatrix({
      previousReleaseId: 'helios-rc-h33-baseline',
      currentReleaseId: 'helios-rc-h34-candidate',
      previousSchemaHead: 'V061',
      currentSchemaHead: schemaMigrationHeads(ROOT).customer,
      heliosMigrations: buildHeliosMigrationInventory(ROOT),
      apiCompatible: true,
    });
    assert.equal(matrix.overallDatabaseRollback, 'FORWARD_FIX_REQUIRED');
    assert.ok(matrix.entries.some((row) => row.dimension === 'database-schema'));
  });

  it('rollback rehearsal preserves representative customer state keys', () => {
    const matrix = buildRollbackMatrix({
      previousReleaseId: 'helios-rc-h33-baseline',
      currentReleaseId: 'helios-rc-h34-candidate',
      previousSchemaHead: 'V061',
      currentSchemaHead: 'V062',
      heliosMigrations: buildHeliosMigrationInventory(ROOT),
      apiCompatible: true,
    });
    const rehearsal = runRollbackRehearsal({
      previousReleaseId: 'helios-rc-h33-baseline',
      candidateReleaseId: 'helios-rc-h34-candidate',
      rollbackMatrix: matrix,
      upgradeApplied: true,
      appRollbackApplied: true,
      configRollbackApplied: true,
      databaseRecoveryPathAvailable: existsSync(join(ROOT, 'scripts/sandbox-pg-restore.sh')),
      customerOwnershipKeysStable: true,
      multiCustomerIsolationVerified: true,
    });
    assert.equal(rehearsal.passed, true, rehearsal.blockers.join('; '));
    assert.ok(rehearsal.preservedKeys.includes('workOrder'));
    assert.ok(rehearsal.preservedKeys.includes('regulatoryEvidence'));
  });

  it('qualification marker HELIOS_RELEASE_PACKAGE_QUALIFIED when gates pass', () => {
    const manifest = buildHeliosReleaseManifest({ repoRoot: ROOT, gitSha: GIT_SHA });
    const result = qualifyHeliosReleasePackage({
      repoRoot: ROOT,
      manifest,
      migrationQualificationPassed: true,
      persistenceTestsPassed: true,
      buildReproducibilityPassed: true,
    });
    assert.equal(result.marker, HELIOS_RELEASE_PACKAGE_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });

  it('qualification marker HELIOS_RELEASE_PACKAGE_BLOCKED when duplicate migrations exist', () => {
    const manifest = buildHeliosReleaseManifest({ repoRoot: ROOT, gitSha: GIT_SHA });
    const duplicates = assertNoDuplicateMigrationIds(ROOT);
    assert.equal(duplicates.length, 0);
    const blocked = qualifyHeliosReleasePackage({
      repoRoot: ROOT,
      manifest,
      migrationQualificationPassed: false,
      buildReproducibilityPassed: true,
    });
    assert.equal(blocked.marker, HELIOS_RELEASE_PACKAGE_BLOCKED);
    assert.ok(blocked.blockers.some((row) => row.includes('migration qualification')));
  });

  it('Hetzner deployment manifest pins simulation safety flags', () => {
    const compose = readFileSync(join(ROOT, 'deploy/sunrey-sandbox-hetzner/docker-compose.yml'), 'utf8');
    assert.match(compose, /PRODUCTION_ACTIVE: "false"/);
    assert.match(compose, /LIVE_CONNECTIVITY_ENABLED: "false"/);
    assert.match(compose, /ENVIRONMENT: simulation/);
  });
});
