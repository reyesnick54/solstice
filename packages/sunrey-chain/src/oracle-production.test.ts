import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DevelopmentHsmSimulator,
  InMemorySecretProvider,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  secretRef,
} from '../../security/src/index.ts';
import { defaultOracleSuiteId } from './oracle/crypto.ts';
import {
  ApiKeyReferenceAdapter,
  LocalProviderSimulator,
  OracleCollector,
  OracleIncidentControl,
  OracleOnboardingRegistry,
  SoftwareDevelopmentSigner,
  HsmOracleSigner,
  analyzeConcentration,
  analyzeIndependence,
  attachOnboardingEvidence,
  breakingSchemaChange,
  canonicalOracleSigningPurpose,
  consensusMustNotCallExternalApis,
  createCollectorIdentity,
  createOnboardingDraft,
  createProductionPlane,
  defaultEligibilityPolicy,
  developmentProductionFeed,
  emptyOnboardingEvidence,
  engineSubmissionPort,
  evaluateProductionContributionEligibility,
  feedDefinitionMustNotStoreCredentialValue,
  missingContractIsNeverConfirmed,
  normalizeExternalInteger,
  oracleFactCreationNeverMintsMoonRey,
  productionEligibilityRequiresEvidence,
  productionOracleReadiness,
  resolveAssignedCredential,
  rotateSigningKey,
  runProductionOracleE2E,
  runSunreyOracle,
  scoreQuality,
  simulatorForCategory,
  transitionOnboarding,
  twoEndpointsOneUpstreamAreNotAutomaticallyIndependent,
  validateExternalRecord,
} from './oracle/production/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function draftProvider(providerId = 'oracle_energy-a') {
  const signer = SoftwareDevelopmentSigner.fromLabel(providerId, defaultOracleSuiteId());
  if (!signer.ok) {
    throw new Error(signer.error.detail);
  }
  const created = createOnboardingDraft({
    providerId,
    legalEntityReference: 'legal.sim',
    controllerReference: `controller_${providerId}`,
    dataCategories: ['energy'],
    feeds: ['feed_energy_production_sim'],
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
    signingKey: {
      schemaVersion: 1,
      keyId: `key_${providerId}`,
      keyVersion: 1,
      publicKeyHex: signer.value.publicKey().publicKeyHex,
      cryptoSuite: defaultOracleSuiteId(),
      signerKind: 'SOFTWARE_DEVELOPMENT',
      rotatedFromKeyId: null,
      active: true,
    },
    cryptoSuite: defaultOracleSuiteId(),
    infrastructureRegion: 'sim-east',
    sourceRelationships: [],
    onboardingEvidence: emptyOnboardingEvidence(),
    securityReviewStatus: 'NOT_REVIEWED',
    commercialAgreementEvidenceReference: null,
  });
  if (!created.ok) {
    throw new Error(created.error.detail);
  }
  return { record: created.value, signer: signer.value };
}

describe('Chunk 68 production oracle data plane', () => {
  it('keeps consensus off external APIs and never auto-mints', () => {
    assert.equal(consensusMustNotCallExternalApis(), true);
    assert.equal(oracleFactCreationNeverMintsMoonRey(), true);
    assert.equal(missingContractIsNeverConfirmed(), false);
    assert.equal(canonicalOracleSigningPurpose(), 'ORACLE_SIGNING');
  });

  it('requires configured evidence for production eligibility', () => {
    const { record } = draftProvider();
    assert.equal(record.productionEligibility, false);
    assert.equal(productionEligibilityRequiresEvidence(record), false);
    const evidenced = attachOnboardingEvidence(record, {
      technicalValidationRef: 'tech.1',
      securityReviewRef: 'sec.1',
      securityReviewStatus: 'REVIEWED_WITH_EVIDENCE',
      commercialAgreementRef: 'agreement.1',
      commercialAgreementState: 'CONFIRMED',
    });
    let current = evidenced;
    for (const next of ['TECHNICALLY_VALIDATED', 'TESTNET_ACTIVE', 'PRODUCTION_CANDIDATE'] as const) {
      const moved = transitionOnboarding(current, next);
      assert.equal(moved.ok, true, next);
      if (moved.ok) {
        current = moved.value;
      }
    }
    assert.equal(current.status, 'PRODUCTION_CANDIDATE');
    assert.equal(current.productionEligibility, true);
    const skipped = transitionOnboarding(draftProvider('oracle_skip').record, 'PRODUCTION_CANDIDATE');
    assert.equal(skipped.ok, false);
  });

  it('isolates collector credentials and refuses plaintext feed secrets', () => {
    const secrets = new InMemorySecretProvider('simulation', { 'oracle/src-a': 'token-a', 'oracle/src-b': 'token-b' });
    const identity = createCollectorIdentity({
      collectorId: 'collector_a',
      assignedSourceIds: ['src-a'],
      credentialRefs: { 'src-a': secretRef('simulation', 'oracle/src-a') },
      expiresAtUnix: 2_000_000_000n,
    });
    if (!identity.ok) {
      throw new Error(identity.error.detail);
    }
    const assigned = resolveAssignedCredential(identity.value, 'src-a', secrets, 1_700_000_000n);
    assert.equal(assigned.ok, true);
    const isolated = resolveAssignedCredential(identity.value, 'src-b', secrets, 1_700_000_000n);
    assert.equal(isolated.ok, false);
    if (!isolated.ok) {
      assert.equal(isolated.error.code, 'CREDENTIAL_ISOLATION_VIOLATION');
    }
    const leak = feedDefinitionMustNotStoreCredentialValue('{"api_key":"super-secret"}');
    assert.equal(leak.ok, false);
    const safe = feedDefinitionMustNotStoreCredentialValue('{"credentialRef":"secret://simulation/oracle/src-a"}');
    assert.equal(safe.ok, true);
  });

  it('validates schema and refuses floats, drift, and unbounded arrays', () => {
    const feed = developmentProductionFeed();
    const ok = validateExternalRecord(feed.schema, {
      identifier: 'plant_sim_1',
      numericValue: '100',
      unit: 'MWh',
      sourceTimestampUnix: '1700000000',
      schemaId: 'energy.resource.v1',
      schemaVersion: 1,
    });
    assert.equal(ok.ok, true);
    const float = validateExternalRecord(feed.schema, {
      identifier: 'plant_sim_1',
      numericValue: '100.5',
      unit: 'MWh',
      sourceTimestampUnix: '1700000000',
      schemaId: 'energy.resource.v1',
      schemaVersion: 1,
    });
    assert.equal(float.ok, false);
    const drift = validateExternalRecord(feed.schema, {
      identifier: 'plant_sim_1',
      numericValue: '100',
      unit: 'MWh',
      sourceTimestampUnix: '1700000000',
      schemaId: 'energy.resource.v2',
      schemaVersion: 2,
    });
    assert.equal(drift.ok, false);
    const unbounded = validateExternalRecord(feed.schema, {
      identifier: 'plant_sim_1',
      numericValue: '100',
      unit: 'MWh',
      sourceTimestampUnix: '1700000000',
      schemaId: 'energy.resource.v1',
      schemaVersion: 1,
      extras: { samples: Array.from({ length: 20 }, (_, i) => i) },
    });
    assert.equal(unbounded.ok, false);
    assert.equal(
      breakingSchemaChange(feed.schema, { ...feed.schema, version: 2, unit: 'kWh' }),
      true,
    );
  });

  it('normalizes integer energy vectors without consensus floats', () => {
    const converted = normalizeExternalInteger({
      sourceValue: '2',
      sourceUnit: 'MWh',
      targetUnit: 'MWh',
      targetScale: 0,
    });
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.value.mantissa, 2n);
    }
    const kwh = normalizeExternalInteger({
      sourceValue: '2',
      sourceUnit: 'kWh',
      targetUnit: 'MWh',
      targetScale: 0,
    });
    assert.equal(kwh.ok, false);
    const float = normalizeExternalInteger({
      sourceValue: '1e2',
      sourceUnit: 'MWh',
      targetUnit: 'MWh',
      targetScale: 0,
    });
    assert.equal(float.ok, false);
  });

  it('does not count two endpoints of one upstream as independent', () => {
    const left = {
      schemaVersion: 1 as const,
      sourceId: 'src-a',
      controllerId: 'ctl-1',
      upstreamOrganizationId: 'org-1',
      infrastructureRegion: 'east',
      sharedControlGroup: 'group-1',
    };
    const right = {
      schemaVersion: 1 as const,
      sourceId: 'src-b',
      controllerId: 'ctl-1',
      upstreamOrganizationId: 'org-1',
      infrastructureRegion: 'west',
      sharedControlGroup: 'group-1',
    };
    assert.equal(twoEndpointsOneUpstreamAreNotAutomaticallyIndependent(left, right, true), false);
    const clusters = analyzeIndependence(
      [
        {
          schemaVersion: 1,
          sourceId: 'src-a',
          version: 1,
          providerId: 'oracle_a',
          category: 'energy',
          factType: 'ENERGY_PRODUCTION',
          feedId: 'feed',
          unit: 'MWh',
          schemaId: 'energy.resource.v1',
          sourceSchemaVersion: 1,
          normalizationVersion: 'oracle.normalize.v1',
          authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
          credentialRef: null,
          controllerId: 'ctl-1',
          upstreamOrganizationId: 'org-1',
          infrastructureRegion: 'east',
          retired: false,
        },
        {
          schemaVersion: 1,
          sourceId: 'src-b',
          version: 1,
          providerId: 'oracle_b',
          category: 'energy',
          factType: 'ENERGY_PRODUCTION',
          feedId: 'feed',
          unit: 'MWh',
          schemaId: 'energy.resource.v1',
          sourceSchemaVersion: 1,
          normalizationVersion: 'oracle.normalize.v1',
          authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
          credentialRef: null,
          controllerId: 'ctl-1',
          upstreamOrganizationId: 'org-1',
          infrastructureRegion: 'west',
          retired: false,
        },
      ],
      true,
    );
    assert.equal(clusters[0]?.independent, false);
    const concentration = analyzeConcentration(
      [
        {
          schemaVersion: 1,
          sourceId: 'src-a',
          version: 1,
          providerId: 'oracle_a',
          category: 'energy',
          factType: 'ENERGY_PRODUCTION',
          feedId: 'feed',
          unit: 'MWh',
          schemaId: 'energy.resource.v1',
          sourceSchemaVersion: 1,
          normalizationVersion: 'oracle.normalize.v1',
          authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
          credentialRef: null,
          controllerId: 'ctl-1',
          upstreamOrganizationId: 'org-1',
          infrastructureRegion: 'east',
          retired: false,
        },
      ],
      1n,
      1,
    );
    assert.equal(concentration.sybilResistanceClaimed, false);
    assert.equal(concentration.warnings[0]?.kind, 'ORACLE_PROVIDER_CONCENTRATION');
  });

  it('scores quality with a versioned formula', () => {
    const profile = scoreQuality({
      sourceId: 'src-a',
      freshnessBps: 8_000,
      availabilityBps: 9_000,
      historicalConflictRateBps: 500,
      schemaValidityBps: 10_000,
      sourceIndependenceBps: 10_000,
      attestationLevelBps: 7_000,
      qualityClass: 'PRODUCTION_CANDIDATE',
    });
    assert.equal(profile.formulaVersion, 'oracle.quality.profile.v1');
    assert.equal(profile.engineeringGoverned, true);
    assert.ok(profile.scoreBps > 7_000);
  });

  it('simulates energy, compute, and manufacturing failure modes', () => {
    const secrets = new InMemorySecretProvider('simulation');
    const identity = createCollectorIdentity({
      collectorId: 'collector_sim',
      assignedSourceIds: ['src_sim'],
      credentialRefs: { src_sim: secretRef('simulation', 'oracle/src_sim') },
      expiresAtUnix: 2_000_000_000n,
    });
    if (!identity.ok) {
      throw new Error(identity.error.detail);
    }
    secrets.put('oracle/src_sim', 'token');
    const source = {
      schemaVersion: 1 as const,
      sourceId: 'src_sim',
      version: 1,
      providerId: 'oracle_sim',
      category: 'energy' as const,
      factType: 'ENERGY_PRODUCTION' as const,
      feedId: 'feed',
      unit: 'MWh' as const,
      schemaId: 'energy.resource.v1',
      sourceSchemaVersion: 1,
      normalizationVersion: 'oracle.normalize.v1',
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY' as const,
      credentialRef: secretRef('simulation', 'oracle/src_sim'),
      controllerId: 'ctl',
      upstreamOrganizationId: 'org',
      infrastructureRegion: 'lab',
      retired: false,
    };
    for (const category of ['energy', 'compute', 'manufacturing'] as const) {
      const healthy = simulatorForCategory(category, 'HEALTHY').retrieve(
        { source: { ...source, category }, identity: identity.value, nowUnix: 1_700_000_000n },
        secrets,
      );
      assert.equal(healthy.ok, true, category);
      const auth = simulatorForCategory(category, 'AUTH_FAILURE').retrieve(
        { source: { ...source, category }, identity: identity.value, nowUnix: 1_700_000_000n },
        secrets,
      );
      assert.equal(auth.ok, false);
      const outage = simulatorForCategory(category, 'PROVIDER_OUTAGE').retrieve(
        { source: { ...source, category }, identity: identity.value, nowUnix: 1_700_000_000n },
        secrets,
      );
      assert.equal(outage.ok, false);
    }
    const live = new ApiKeyReferenceAdapter().retrieve(
      { source: { ...source, authenticationMethod: 'API_KEY_REFERENCE' }, identity: identity.value, nowUnix: 1_700_000_000n },
      secrets,
    );
    assert.equal(live.ok, false);
  });

  it('supports hybrid PQC software signing and refuses unsupported HSM PQ claims', () => {
    const hybrid = SoftwareDevelopmentSigner.fromLabel('energy-pqc', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1);
    assert.equal(hybrid.ok, true);
    const hsm = new DevelopmentHsmSimulator();
    const software = SoftwareDevelopmentSigner.fromLabel('energy-hsm', defaultOracleSuiteId());
    if (!software.ok) {
      throw new Error(software.error.detail);
    }
    const hsmSigner = new HsmOracleSigner(hsm, software.value);
    assert.equal(hsmSigner.realHsmEvidenceExternal, true);
    assert.equal(hsm.capabilities().externalHsmPqSupported, false);
  });

  it('rotates signing keys while keeping historical keys', () => {
    const { record } = draftProvider('oracle_rotate');
    const registry = new OracleOnboardingRegistry();
    registry.put(record);
    const rotated = rotateSigningKey(record, {
      schemaVersion: 1,
      keyId: 'key_oracle_rotate_v2',
      keyVersion: 2,
      publicKeyHex: record.signingKey.publicKeyHex,
      cryptoSuite: record.cryptoSuite,
      signerKind: 'SOFTWARE_DEVELOPMENT',
      rotatedFromKeyId: record.signingKey.keyId,
      active: true,
    });
    assert.equal(rotated.ok, true);
    if (rotated.ok) {
      registry.put(rotated.value);
    }
    assert.equal(registry.historicalKeys('oracle_rotate').length >= 1, true);
  });

  it('suspends providers with evidence and refuses AI resumption', () => {
    const plane = createProductionPlane();
    const incidents = new OracleIncidentControl(plane.onboarding);
    const providerId = plane.providers[0]!.providerId;
    const suspended = incidents.apply({
      incidentId: 'inc-1',
      providerId,
      action: 'PROVIDER_SUSPENSION',
      actorKind: 'HUMAN',
      actorId: 'ops',
      evidenceRef: 'ev-1',
      atUnix: 1n,
    });
    assert.equal(suspended.ok, true);
    const ai = incidents.apply({
      incidentId: 'inc-2',
      providerId,
      action: 'RESUMPTION_APPROVAL',
      actorKind: 'AI',
      actorId: 'agent',
      evidenceRef: 'ev-2',
      atUnix: 2n,
    });
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.error.code, 'AI_CANNOT_RESTORE_PROVIDER');
    }
    const human = incidents.apply({
      incidentId: 'inc-3',
      providerId,
      action: 'RESUMPTION_APPROVAL',
      actorKind: 'HUMAN',
      actorId: 'ops',
      evidenceRef: 'ev-3',
      atUnix: 3n,
    });
    assert.equal(human.ok, true);
    assert.equal(plane.onboarding.get(providerId)?.status, 'TESTNET_ACTIVE');
    assert.equal(plane.onboarding.get(providerId)?.productionEligibility, false);
  });

  it('fails MoonRey eligibility without verified lineage and never mints from the collector', () => {
    const plane = createProductionPlane();
    const denied = evaluateProductionContributionEligibility({
      policy: defaultEligibilityPolicy([plane.feed.feedId], ['energy']),
      feed: plane.feed,
      providers: plane.providers,
      fact: undefined,
      category: 'energy',
      nowUnix: 1_700_000_000n,
      contribution: null,
      qualityBps: 9_000,
    });
    assert.equal(denied.ok, false);
    const readiness = productionOracleReadiness();
    assert.equal(readiness.technicalImplementation, 'ENGINEERING_VERIFIED');
    assert.equal(readiness.providerAgreementEvidence, 'NOT_PROVIDED');
    assert.equal(readiness.productionEligible, 'NOT_PROVIDED');
    assert.equal(readiness.developmentFixturesAreProductionFeeds, false);
  });

  it('runs the seven-validator E2E through MoonRey authorization', () => {
    const report = runProductionOracleE2E();
    assert.equal(report.validatorCount, 7);
    assert.equal(report.providerCount, 3);
    assert.equal(report.validatorsAgree, true);
    assert.equal(report.qualityStatus, 'VERIFIED');
    assert.equal(report.conflicted, true);
    assert.equal(report.automaticIssuance, false);
    assert.equal(report.consensusCalledExternalApi, false);
    assert.equal(report.formalMoonReyInvariants, true);
    assert.ok(report.issuanceId.startsWith('mir.'));
    assert.equal(report.explorerFeedId, 'feed_energy_production_sim');
  });

  it('exposes the sunrey-oracle CLI', () => {
    for (const args of [
      ['provider', 'status'],
      ['provider', 'onboard', 'oracle_cli'],
      ['provider', 'suspend'],
      ['feed', 'create'],
      ['feed', 'validate'],
      ['source', 'health'],
      ['readiness'],
      ['collector', 'run'],
    ]) {
      const result = runSunreyOracle(args);
      assert.equal(result.ok, true, args.join(' '));
    }
  });

  it('fuzzes the schema corpus without inventing values', () => {
    const feed = developmentProductionFeed();
    const corpus = ['100', '0', '999999', '1e2', '12.3', '', 'NaN', '-1'];
    for (const numericValue of corpus) {
      const result = validateExternalRecord(feed.schema, {
        identifier: 'plant_sim_1',
        numericValue,
        unit: 'MWh',
        sourceTimestampUnix: '1700000000',
        schemaId: 'energy.resource.v1',
        schemaVersion: 1,
      });
      if (numericValue === '100' || numericValue === '0' || numericValue === '999999') {
        assert.equal(result.ok, true);
      } else {
        assert.equal(result.ok, false);
      }
    }
  });

  it('publishes the required documentation and forbids a second oracle package', () => {
    for (const relative of [
      'docs/oracle/chunk-68-production-oracles.md',
      'docs/oracle/provider-onboarding.md',
      'docs/oracle/source-provenance.md',
      'docs/oracle/source-independence.md',
      'docs/oracle/production-eligibility.md',
      'docs/runbooks/oracle-provider-incident.md',
      'docs/runbooks/oracle-schema-change.md',
      'docs/architecture/chunk-68-production-oracles.md',
      'docs/architecture/chunks/chunk-68-production-oracles.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-oracle')), false);
    assert.equal(existsSync(join(ROOT, 'packages/oracle-collector')), false);
  });
});

void OracleCollector;
void engineSubmissionPort;
