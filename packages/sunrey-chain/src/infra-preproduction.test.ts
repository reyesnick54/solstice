import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_DATA_MARKET_ENABLED, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { parseContainerReference } from './infra/services.ts';
import {
  CANONICAL_PLATFORM_SERVICES,
  PLATFORM_DEPLOYMENT_ENVIRONMENTS,
  PROMOTION_STAGES,
  autoscalingHook,
  catalogComplete,
  createReleaseConfiguration,
  databasePlan,
  deploymentPosture,
  detectManualDrift,
  environmentBoundary,
  evaluatePromotion,
  iacModulesPresent,
  listMigrationVersions,
  objectStoragePlan,
  productionFailsClosedWithoutKms,
  queuePlan,
  refuseFloatingImage,
  refuseLiveActivation,
  refuseProductionWithoutKms,
  renderPreproductionChart,
  replicasFor,
  rehearsalRelease,
  rollbackPlan,
  runPreproductionRehearsal,
  secretPlan,
  smokeRehearsal,
  tlsPlan,
  validateRenderedManifests,
  verifyReleaseSignature,
} from './infra/preproduction/index.ts';

describe('Phase I Prompt 4 preproduction infrastructure', () => {
  it('standardizes six isolated environments without live activation', () => {
    assert.deepEqual([...PLATFORM_DEPLOYMENT_ENVIRONMENTS], [
      'LOCAL',
      'TEST',
      'SANDBOX',
      'STAGING',
      'PREPRODUCTION',
      'PRODUCTION',
    ]);
    for (const environment of PLATFORM_DEPLOYMENT_ENVIRONMENTS) {
      const boundary = environmentBoundary(environment);
      assert.equal(refuseLiveActivation(boundary), true);
      assert.equal(boundary.productionAuthorized, false);
      assert.equal(boundary.mainnetEnabled, false);
      assert.equal(boundary.liveProviders, false);
    }
    const namespaces = new Set(PLATFORM_DEPLOYMENT_ENVIRONMENTS.map((row) => environmentBoundary(row).namespace));
    assert.equal(namespaces.size, PLATFORM_DEPLOYMENT_ENVIRONMENTS.length);
    assert.notEqual(environmentBoundary('SANDBOX').namespace, environmentBoundary('PREPRODUCTION').namespace);
    assert.equal(environmentBoundary('PRODUCTION').promotionRequiresHuman, true);
    assert.equal(environmentBoundary('PRODUCTION').kmsRequired, true);
    assert.equal(productionFailsClosedWithoutKms('PRODUCTION'), true);
    assert.equal(refuseProductionWithoutKms('PRODUCTION', false).ok, false);
    assert.equal(refuseProductionWithoutKms('PREPRODUCTION', false).ok, true);
  });

  it('deploys every canonical service and excludes unused legacy workloads', () => {
    assert.equal(catalogComplete(), true);
    assert.equal(CANONICAL_PLATFORM_SERVICES.includes('api'), true);
    assert.equal(CANONICAL_PLATFORM_SERVICES.includes('bff'), true);
    assert.equal(CANONICAL_PLATFORM_SERVICES.includes('agent'), true);
    assert.equal(CANONICAL_PLATFORM_SERVICES.includes('exchange'), true);
    assert.equal(CANONICAL_PLATFORM_SERVICES.includes('rpc'), true);
    const preprod = replicasFor('api', 'PREPRODUCTION');
    const local = replicasFor('api', 'LOCAL');
    assert.equal(preprod >= 2, true);
    assert.equal(local, 1);
    const hook = autoscalingHook('rpc');
    assert.equal(hook.maxReplicas >= hook.minReplicas, true);
  });

  it('productizes persistent database, queues, and object storage', () => {
    const db = databasePlan('PREPRODUCTION');
    assert.equal(db.tlsRequired, true);
    assert.equal(db.backupEnabled, true);
    assert.equal(db.connectionPooling, true);
    assert.equal(db.roleSeparation.includes('MIGRATOR'), true);
    assert.equal(db.migrateBeforeIncompatibleRollout, true);
    assert.equal(db.haModel, 'PRIMARY_SYNC_REPLICA');
    assert.equal(db.credentialRefs.APP_READWRITE.href.startsWith('secret://'), true);
    const queue = queuePlan('PREPRODUCTION');
    assert.equal(queue.persistent, true);
    assert.equal(queue.processMemoryForbiddenForCritical, true);
    assert.deepEqual([...queue.channels], ['events', 'jobs', 'workflows', 'dead-letters']);
    const storage = objectStoragePlan('PREPRODUCTION');
    assert.equal(storage.publicAccess, false);
    assert.equal(storage.versioning, true);
    assert.equal(storage.purposes.includes('EVIDENCE'), true);
    assert.equal(storage.purposes.includes('VAULT_OBJECTS'), true);
  });

  it('wires secret references and TLS without plaintext public APIs', () => {
    const secrets = secretPlan('PREPRODUCTION');
    assert.equal(secrets.referencesOnly, true);
    assert.equal(secrets.rawCredentialsCommitted, false);
    assert.equal(secrets.bindings.every((row) => row.href.startsWith('secret://')), true);
    const tls = tlsPlan('PREPRODUCTION');
    assert.equal(tls.publicPlaintextForbidden, true);
    assert.equal(tls.confirmedDns, false);
    assert.equal(tls.domainTemplates.futureApi, 'api.sunrey.xyz');
  });

  it('uses signed immutable artifacts and a versioned release record', () => {
    const floating = parseContainerReference({ name: 'sunrey-platform', tag: 'latest' });
    assert.equal(floating.ok, false);
    assert.equal(refuseFloatingImage('latest'), true);
    const release = rehearsalRelease('PREPRODUCTION');
    assert.match(release.containerDigest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(release.productionAuthorized, false);
    assert.equal(release.chainConfig.mainnetEnabled, false);
    assert.equal(release.signed, true);
    const verified = verifyReleaseSignature(release, false);
    assert.equal(verified.ok, true);
    assert.throws(() =>
      createReleaseConfiguration({
        environment: 'PREPRODUCTION',
        applicationVersion: 'x',
        containerDigest: 'latest',
        databaseMigrationVersion: 'V001',
        policyVersions: {},
        agentPolicyVersion: 'a',
        toolVersions: {},
        providerConfigReferences: [],
        networkId: 'net_x',
        chainId: 'chn_x',
        testnetBound: true,
      }),
    );
  });

  it('renders helm manifests for preproduction and keeps production gated', () => {
    const manifests = renderPreproductionChart('PREPRODUCTION');
    const validated = validateRenderedManifests(manifests, 'PREPRODUCTION');
    assert.equal(validated.ok, true, validated.failures.join('; '));
    const text = manifests.map((row) => row.yaml).join('\n');
    for (const service of CANONICAL_PLATFORM_SERVICES) {
      assert.match(text, new RegExp(`name: ${service}`));
    }
    assert.match(text, /kind: NetworkPolicy/);
    assert.match(text, /secret:\/\//);
    assert.equal(text.includes('strategy-lab'), false);
    const iac = iacModulesPresent();
    assert.equal(iac.ok, true, iac.missing.join('; '));
  });

  it('runs a local rehearsal with smoke, rollback, migration, and drift', () => {
    const rehearsal = runPreproductionRehearsal('PREPRODUCTION');
    assert.equal(rehearsal.ok, true, rehearsal.failures.join('; '));
    assert.equal(rehearsal.cloudApplied, false);
    assert.equal(rehearsal.mutated, false);
    assert.equal(rehearsal.smokeOk, true);
    assert.equal(rehearsal.smoke.length, 15);
    assert.equal(rehearsal.rollback.financialSchemaDestructiveRollbackSafe, false);
    assert.equal(rehearsal.rollback.application, 'PREVIOUS_SIGNED_DIGEST');
    assert.equal(rehearsal.migration.fromZero.ok, true);
    assert.equal(rehearsal.migration.upgradeFromPrior.ok, true);
    assert.equal(rehearsal.drift.classification, 'UNAUTHORIZED_DRIFT');
    assert.equal(rehearsal.promotionGated, true);
    const smoke = smokeRehearsal('PREPRODUCTION');
    assert.equal(smoke.every((row) => row.ok), true);
    const migrations = listMigrationVersions();
    assert.equal(migrations.databases.includes('ledger'), true);
    assert.equal(rollbackPlan().database, 'FORWARD_FIX_ONLY');
    const drift = detectManualDrift('a', 'b');
    assert.equal(drift.visible, true);
  });

  it('keeps CI promotion sequential and production human-gated', () => {
    assert.deepEqual([...PROMOTION_STAGES], [
      'BUILD',
      'TEST',
      'SIGN',
      'STAGING',
      'PREPRODUCTION',
      'HUMAN_APPROVAL',
      'FUTURE_PRODUCTION',
    ]);
    const skip = evaluatePromotion('BUILD', 'PREPRODUCTION', { signed: true, humanApproved: false });
    assert.equal(skip.allowed, false);
    const unsigned = evaluatePromotion('TEST', 'SIGN', { signed: false, humanApproved: false });
    assert.equal(unsigned.allowed, true);
    const toStaging = evaluatePromotion('SIGN', 'STAGING', { signed: false, humanApproved: false });
    assert.equal(toStaging.allowed, false);
    const production = evaluatePromotion('PREPRODUCTION', 'FUTURE_PRODUCTION', {
      signed: true,
      humanApproved: true,
    });
    assert.equal(production.allowed, false);
    assert.equal(production.productionDeployed, false);
    assert.equal(production.humanApprovalRequired, true);
  });

  it('verifies deployment posture remains simulation-only', () => {
    const posture = deploymentPosture();
    assert.equal(posture.ok, true);
    assert.equal(posture.productionAuthorized, false);
    assert.equal(posture.mainnetInactive, true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
  });
});
