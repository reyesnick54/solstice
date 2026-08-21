import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
} from '../../../../config/src/flags.ts';
import {
  allCriticalVersionsExplicit,
  assembleLaunchCandidateFreeze,
  attemptActivateProductionFromLaunchFreeze,
  attemptEnableMainnetFromLaunchFreeze,
  attemptIssueAuthorityFromLaunchFreeze,
  attemptMintFromLaunchFreeze,
  attemptMutateFrozenLaunchCandidate,
  assertLaunchFreezeImmutable,
  bindExactVersion,
  buildLaunchFreezeOfflinePackage,
  collectedBindingsForTests,
  CRITICAL_LAUNCH_FREEZE_COMPONENTS,
  diffProductionLaunchCandidates,
  evaluateCurrentRepositoryLaunchFreeze,
  evaluateLaunchCandidateStaleness,
  fixtureEvidenceLaunchFreeze,
  hashLaunchFreezeMaterial,
  implicitVersionRejected,
  inputFromFreeze,
  launchFreezeContainsPrivateKey,
  launchFreezeContainsSecret,
  observationFromFreeze,
  rejectFloatingComponentVersions,
  rejectPrivateKey,
  rejectSecretValue,
  snapshotExternalEvidence,
  snapshotOperatingScope,
  snapshotProviderBindings,
  supersedeLaunchCandidateFreeze,
  withLaunchFreezeOverrides,
} from './launch-freeze/index.ts';
import { fixtureEvidenceRegistry } from './launch-freeze/fixtures.ts';
import { defaultOperatingScopeCatalog } from '../../mainnet/operating-scope/index.ts';

function currentFreeze() {
  return evaluateCurrentRepositoryLaunchFreeze(process.cwd(), {
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
}

describe('Chunk 164 production launch candidate freeze', () => {
  it('1. freeze hash is deterministic', () => {
    const first = currentFreeze();
    const second = assembleLaunchCandidateFreeze(inputFromFreeze(first.freeze));
    assert.equal(first.freeze.freezeHash, second.freezeHash);
    assert.equal(first.freeze.freezeHash.length, 64);
    assert.equal(hashLaunchFreezeMaterial(inputFromFreeze(first.freeze)), first.freeze.freezeHash);
  });

  it('2. all critical component versions are explicit', () => {
    const evaluation = currentFreeze();
    assert.equal(allCriticalVersionsExplicit(evaluation.freeze.bindings), true);
    assert.equal(evaluation.freeze.bindings.length, CRITICAL_LAUNCH_FREEZE_COMPONENTS.length);
    for (const row of evaluation.freeze.bindings) {
      assert.ok(row.componentId.length > 0);
      assert.ok(row.schemaVersion.length > 0);
      assert.ok(row.contentVersion.length > 0);
      assert.ok(row.contentHash.length > 0);
      assert.equal(implicitVersionRejected(row.contentVersion), false);
    }
  });

  it('3. latest version is rejected', () => {
    assert.equal(implicitVersionRejected('latest'), true);
    assert.equal(implicitVersionRejected('current'), true);
    assert.equal(implicitVersionRejected('default'), true);
    assert.equal(implicitVersionRejected('main'), true);
    assert.equal(implicitVersionRejected('HEAD'), true);
    assert.throws(() =>
      bindExactVersion({
        componentId: 'mainnet-rc',
        schemaVersion: '1',
        contentVersion: 'latest',
        contentHash: 'a'.repeat(64),
      }),
    );
    const evaluation = currentFreeze();
    const floating = [
      ...evaluation.freeze.bindings.filter((row) => row.componentId !== 'mainnet-rc'),
      {
        componentId: 'mainnet-rc',
        schemaVersion: '1',
        contentVersion: 'latest',
        contentHash: evaluation.freeze.mainnetRcHash,
      },
    ];
    assert.deepEqual(rejectFloatingComponentVersions(floating), ['mainnet-rc:latest']);
    const rejected = assembleLaunchCandidateFreeze({
      ...inputFromFreeze(evaluation.freeze),
      bindings: floating,
    });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.blockers.includes('FLOATING_VERSION_REJECTED'), true);
  });

  it('4. manifest change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      architectureManifestHash: 'b'.repeat(64),
    });
    assert.equal(stale.stale, true);
    assert.equal(stale.status, 'STALE');
    assert.equal(stale.reasons.includes('ARCHITECTURE_MANIFEST_CHANGED'), true);
  });

  it('5. source commit change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      sourceCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    assert.equal(stale.reasons.includes('SOURCE_COMMIT_CHANGED'), true);
  });

  it('6. parameter hash change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      productionParameterPackageHash: 'c'.repeat(64),
    });
    assert.equal(stale.reasons.includes('PARAMETER_PACKAGE_CHANGED'), true);
  });

  it('7. economic authorization change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      productionEconomicAuthorizationHash: 'd'.repeat(64),
    });
    assert.equal(stale.reasons.includes('ECONOMIC_AUTHORIZATION_CHANGED'), true);
  });

  it('8. validator set change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      validatorCandidateSetHash: 'e'.repeat(64),
    });
    assert.equal(stale.reasons.includes('VALIDATOR_SET_CHANGED'), true);
  });

  it('9. genesis change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      genesisCandidateHash: 'f'.repeat(64),
    });
    assert.equal(stale.reasons.includes('GENESIS_CHANGED'), true);
  });

  it('10. external evidence expiry stales freeze', () => {
    const before = fixtureEvidenceLaunchFreeze(process.cwd(), '2026-08-21T00:00:00.000Z', '2026-08-21T12:00:00.000Z');
    const expired = snapshotExternalEvidence(fixtureEvidenceRegistry('2026-08-21T12:00:00.000Z'), '2026-08-22T00:00:00.000Z');
    const stale = evaluateLaunchCandidateStaleness(before.freeze, {
      ...observationFromFreeze(before.freeze),
      externalEvidenceSnapshotHash: expired.snapshotHash,
      externalEvidenceExpired: expired.expired,
    });
    assert.equal(expired.expired, true);
    assert.equal(stale.reasons.includes('EXTERNAL_EVIDENCE_EXPIRED'), true);
  });

  it('11. evidence revocation stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      externalEvidenceRevoked: true,
    });
    assert.equal(stale.reasons.includes('EXTERNAL_EVIDENCE_REVOKED'), true);
  });

  it('12. operating scope change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      operatingScopeSnapshotHash: '1'.repeat(64),
    });
    assert.equal(stale.reasons.includes('OPERATING_SCOPE_CHANGED'), true);
    const scope = snapshotOperatingScope(defaultOperatingScopeCatalog());
    assert.ok(scope.rows.length > 0);
    assert.ok(scope.rows.every((row) => row.eligibility === false || row.status.length > 0));
  });

  it('13. provider binding change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      providerBindingSnapshotHash: '2'.repeat(64),
    });
    assert.equal(stale.reasons.includes('PROVIDER_BINDING_CHANGED'), true);
    const providers = snapshotProviderBindings();
    assert.ok(providers.rows.every((row) => row.credentialDescriptorRef.length > 0));
    assert.equal(JSON.stringify(providers).includes('BEGIN PRIVATE KEY'), false);
  });

  it('14. migration change stales freeze', () => {
    const evaluation = currentFreeze();
    const stale = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      databaseMigrationManifestHash: '3'.repeat(64),
    });
    assert.equal(stale.reasons.includes('DATABASE_MIGRATION_CHANGED'), true);
    assert.ok(evaluation.migrations.databases.length > 0);
    assert.ok(evaluation.migrations.databases.some((db) => db.migrations.length > 0));
  });

  it('15. secret value is rejected', () => {
    const evaluation = currentFreeze();
    assert.equal(launchFreezeContainsSecret({ apiKey: 'sk-live-secret-value' }), true);
    assert.throws(() => rejectSecretValue({ apiKey: 'sk-live-secret-value' }));
    const rejected = assembleLaunchCandidateFreeze({
      ...inputFromFreeze(evaluation.freeze),
      sourceCommit: 'apiKey=supersecret-token-value',
    });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.blockers.includes('SECRET_VALUE_REJECTED'), true);
  });

  it('16. private key is rejected', () => {
    const evaluation = currentFreeze();
    const material = { privateKey: '-----BEGIN ' + 'PRIVATE KEY-----abc-----END ' + 'PRIVATE KEY-----' };
    const materials = [
      { privateKey: '-----BEGIN ' + 'PRIVATE KEY-----abc-----END PRIVATE KEY-----' },
      { privateKey: `-----BEGIN ${'PRIVATE'} KEY-----abc-----END ${'PRIVATE'} KEY-----` },
      { privateKey: '-----BEGIN SIMULATION PRIVATE KEY-----fixture' },
    ];
    for (const material of materials) {
      assert.equal(launchFreezeContainsPrivateKey(material), true);
      assert.throws(() => rejectPrivateKey(material));
    }
    const material = { privateKey: '-----BEGIN SIMULATION PRIVATE KEY-----fixture' };
    assert.equal(launchFreezeContainsPrivateKey(material), true);
    assert.throws(() => rejectPrivateKey(material));
    const rejected = assembleLaunchCandidateFreeze({
      ...inputFromFreeze(evaluation.freeze),
      sourceCommit: 'privateKey-mnemonic-seedphrase',
    });
    assert.equal(rejected.blockers.includes('PRIVATE_KEY_REJECTED'), true);
  });

  it('17. frozen candidate is immutable', () => {
    const evaluation = currentFreeze();
    assertLaunchFreezeImmutable(evaluation.freeze);
    assert.equal(Object.isFrozen(evaluation.freeze), true);
    assert.throws(() => attemptMutateFrozenLaunchCandidate(evaluation.freeze, { freezeId: 'mutated' }));
    const next = withLaunchFreezeOverrides(evaluation.freeze, { freezeId: 'sunrey.production.launch-candidate.freeze.v2' });
    assert.notEqual(next.freezeId, evaluation.freeze.freezeId);
    assert.notEqual(next.freezeHash, evaluation.freeze.freezeHash);
    assert.equal(evaluation.freeze.freezeId, 'sunrey.production.launch-candidate.freeze.v1');
  });

  it('18. supersession preserves history', () => {
    const evaluation = currentFreeze();
    const result = supersedeLaunchCandidateFreeze(evaluation.freeze, {
      ...inputFromFreeze(evaluation.freeze),
      freezeId: 'sunrey.production.launch-candidate.freeze.v2',
    });
    assert.equal(result.previous.status, 'SUPERSEDED');
    assert.equal(result.previous.supersededBy, result.next.freezeId);
    assert.equal(result.historyPreserved, true);
    assert.equal(result.history.includes(evaluation.freeze.freezeHash), true);
    assert.equal(result.history.includes(result.next.freezeHash), true);
    assert.notEqual(result.next.freezeHash, evaluation.freeze.freezeHash);
  });

  it('19. fixture evidence cannot produce production-ready freeze', () => {
    const fixture = fixtureEvidenceLaunchFreeze();
    assert.equal(fixture.freeze.reviewClass, 'INCOMPLETE_REVIEW_CANDIDATE');
    assert.notEqual(fixture.freeze.status, 'FROZEN_FOR_REVIEW');
    assert.equal(fixture.freeze.blockers.includes('FIXTURE_EVIDENCE_CANNOT_SATISFY_PRODUCTION'), true);
    const requested = assembleLaunchCandidateFreeze({
      ...inputFromFreeze(fixture.freeze),
      requestFrozenForReview: true,
      productionParametersComplete: true,
      externalEvidenceComplete: true,
      humanAuthorizationComplete: true,
      fixtureEvidenceUsed: true,
    });
    assert.notEqual(requested.status, 'FROZEN_FOR_REVIEW');
    assert.equal(requested.reviewClass, 'INCOMPLETE_REVIEW_CANDIDATE');
  });

  it('20. unconfigured tokenomics remain visible', () => {
    const evaluation = currentFreeze();
    assert.equal(evaluation.productionParametersComplete, false);
    assert.ok(evaluation.unconfiguredTokenomics.length > 0);
    assert.equal(evaluation.freeze.blockers.includes('PRODUCTION_PARAMETERS_UNCONFIGURED'), true);
    assert.ok(
      evaluation.freeze.status === 'AWAITING_PRODUCTION_PARAMETERS' ||
        evaluation.freeze.status === 'AWAITING_EXTERNAL_EVIDENCE' ||
        evaluation.freeze.status === 'AWAITING_HUMAN_AUTHORIZATION',
    );
  });

  it('21. freeze cannot mint', () => {
    assert.equal(attemptMintFromLaunchFreeze(), 'MINT_FORBIDDEN');
    assert.equal(currentFreeze().productionActive, false);
  });

  it('22. freeze cannot issue Execution Authority', () => {
    assert.equal(attemptIssueAuthorityFromLaunchFreeze(), 'EXECUTION_AUTHORITY_FORBIDDEN');
  });

  it('23. freeze cannot enable mainnet', () => {
    const evaluation = currentFreeze();
    assert.equal(attemptEnableMainnetFromLaunchFreeze(), 'MAINNET_ENABLE_FORBIDDEN');
    assert.equal(attemptActivateProductionFromLaunchFreeze(), 'PRODUCTION_ACTIVATION_FORBIDDEN');
    assert.equal(evaluation.freeze.mainnetEnabled, false);
    assert.equal(evaluation.freeze.productionActivated, false);
  });

  it('24. LIVE flags remain false', () => {
    const evaluation = currentFreeze();
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(evaluation.freeze.liveConnectivityEnabled, false);
    assert.equal(evaluation.configuration.environment, 'simulation');
    const offline = buildLaunchFreezeOfflinePackage(evaluation.freeze);
    assert.equal(offline.rawSecretsPresent, false);
    assert.equal(offline.asymmetricKeyMaterialPresent, false);
    const collected = collectedBindingsForTests();
    assert.equal(collected.productionParametersComplete, false);
    const envIgnored = evaluateLaunchCandidateStaleness(evaluation.freeze, {
      ...observationFromFreeze(evaluation.freeze),
      environmental: { cpuTemperature: 99, temporaryLocalTestDurationMs: 5, wallClockMonitoringMetric: 'now' },
    });
    assert.equal(envIgnored.stale, false);
    assert.equal(envIgnored.environmentalMetricsIgnored, true);
    const diff = diffProductionLaunchCandidates(
      evaluation.freeze,
      withLaunchFreezeOverrides(evaluation.freeze, { genesisCandidateHash: '9'.repeat(64) }),
    );
    assert.equal(diff.autoApproved, false);
    assert.ok(diff.changes.some((change) => change.classification === 'GENESIS'));
  });
});
