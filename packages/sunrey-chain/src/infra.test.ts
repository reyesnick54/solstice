import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { assembleReadinessRegistry, defaultDimensionCatalog, evaluateReadiness, DEFAULT_PRODUCTION_POLICY, ENGINEERING_ONLY_POLICY } from './mainnet/index.ts';
import {
  CONSENSUS_KEY_FORBIDDEN_AS_SERVICE_SECRET,
  InfrastructureAccessPolicy,
  SECRET_CLASSES,
  WORKLOAD_SERVICES,
  NETWORK_ZONES,
  authorizeNetworkPath,
  assertNotConsensusServiceSecret,
  cloudKmsCapabilities,
  collectReadinessArtifactDigests,
  createLocalHarness,
  createSoftwareKms,
  documentedEgressClasses,
  hashConfigurationBundle,
  markHsmVerified,
  parseContainerReference,
  refuseInferredPqc,
  runLocalProductionCandidateHarness,
  validateProductionCandidateConfig,
  awsAdapter,
} from './infra/index.ts';

describe('Chunk 66 SunRey production infrastructure', () => {
  it('reconciles Chunk 61–65 evidence with exact artifact digests', () => {
    const digests = collectReadinessArtifactDigests();
    for (const value of Object.values(digests)) {
      assert.match(value, /^[0-9a-f]{64}$/);
    }
    const records = defaultDimensionCatalog();
    const formal = records.find((row) => row.requirementId === 'REQ-FORMAL-001');
    assert.ok(formal);
    assert.equal(formal.verificationStatus, 'ENGINEERING_VERIFIED');
    assert.equal(formal.evidenceHash, digests.formalReportDigest);
    const formalExternal = records.find((row) => row.requirementId === 'REQ-FORMAL-002');
    assert.ok(formalExternal);
    assert.equal(formalExternal.verificationStatus, 'EXTERNAL_VERIFICATION_REQUIRED');
    const review = records.find((row) => row.requirementId === 'REQ-EXT-SEC-001');
    assert.ok(review);
    assert.equal(review.verificationStatus, 'NOT_PROVIDED');
    assert.equal(review.evidenceHash, null);
    const prep = records.find((row) => row.requirementId === 'REQ-EXT-SEC-PREP');
    assert.ok(prep);
    assert.equal(prep.verificationStatus, 'ENGINEERING_VERIFIED');
    assert.equal(prep.evidenceHash, digests.auditBundleDigest);
    const rot = records.find((row) => row.requirementId === 'REQ-ROT-001');
    assert.ok(rot);
    assert.equal(rot.verificationStatus, 'ENGINEERING_VERIFIED');
    assert.equal(rot.evidenceHash, digests.rootOfTrustRehearsalDigest);
    const realCeremony = records.find((row) => row.requirementId === 'REQ-ROT-002');
    assert.ok(realCeremony);
    assert.equal(realCeremony.verificationStatus, 'EXTERNAL_VERIFICATION_REQUIRED');
    const legal = records.find((row) => row.dimension === 'LEGAL');
    assert.ok(legal);
    assert.equal(legal.verificationStatus, 'NOT_PROVIDED');
    const infra = records.find((row) => row.dimension === 'INFRASTRUCTURE');
    assert.ok(infra);
    assert.equal(infra.verificationStatus, 'ENGINEERING_VERIFIED');
    assert.equal(evaluateReadiness(records, [], DEFAULT_PRODUCTION_POLICY), 'AWAITING_EXTERNAL_EVIDENCE');
  });

  it('adds infrastructure readiness to the mainnet registry without activating production', () => {
    const registry = assembleReadinessRegistry();
    assert.match(registry.infrastructureReadinessDigest ?? '', /^[0-9a-f]{64}$/);
    assert.equal(registry.candidate.mainnetEnabled, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(evaluateReadiness(defaultDimensionCatalog(), [], ENGINEERING_ONLY_POLICY), 'AWAITING_HUMAN_AUTHORIZATION');
  });

  it('gives each service a distinct workload identity', () => {
    const harness = createLocalHarness('LOCAL');
    assert.equal(harness.identities.list().length, WORKLOAD_SERVICES.length);
    assert.equal(harness.identities.assertDistinct('LOCAL').ok, true);
    const refs = new Set(harness.identities.list().map((row) => row.credentialRef.href));
    assert.equal(refs.size, WORKLOAD_SERVICES.length);
  });

  it('models every required secret class and rejects consensus keys as service secrets', () => {
    assert.equal(SECRET_CLASSES.length >= 10, true);
    assert.equal(CONSENSUS_KEY_FORBIDDEN_AS_SERVICE_SECRET.includes('VALIDATOR_CONSENSUS_SIGNING'), true);
    assert.throws(() => assertNotConsensusServiceSecret('VALIDATOR_CONSENSUS_SIGNING'));
  });

  it('rejects RPC retrieving the validator signer secret', () => {
    const harness = createLocalHarness('LOCAL');
    const denied = harness.provider.secrets().retrieve({
      identity: 'rpc',
      secretId: 'validator-signer',
      environment: 'LOCAL',
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'SECRET_ISOLATION');
    }
    const access = harness.access.authorize({
      identity: harness.identities.byService('rpc', 'LOCAL')!,
      resource: 'CONSENSUS_SIGNER',
      operation: 'RETRIEVE_SECRET',
    });
    assert.equal(access.ok, false);
  });

  it('rejects Explorer accessing the custody signing credential', () => {
    const harness = createLocalHarness('LOCAL');
    const denied = harness.provider.secrets().retrieve({
      identity: 'explorer',
      secretId: 'custody-signing',
      environment: 'LOCAL',
    });
    assert.equal(denied.ok, false);
    const access = new InfrastructureAccessPolicy('LOCAL').authorize({
      identity: harness.identities.byService('explorer', 'LOCAL')!,
      resource: 'CUSTODY_SIGNING_CREDENTIAL',
      operation: 'RETRIEVE_SECRET',
    });
    assert.equal(access.ok, false);
  });

  it('rejects oracle access to the governance key', () => {
    const harness = createLocalHarness('LOCAL');
    const denied = harness.provider.secrets().retrieve({
      identity: 'oracle_collector',
      secretId: 'governance-key-auth',
      environment: 'LOCAL',
    });
    assert.equal(denied.ok, false);
    const access = harness.access.authorize({
      identity: harness.identities.byService('oracle_collector', 'LOCAL')!,
      resource: 'GOVERNANCE_KEY',
      operation: 'RETRIEVE_SECRET',
    });
    assert.equal(access.ok, false);
  });

  it('rejects a wrong-environment secret and a test fixture in production candidate', () => {
    const harness = createLocalHarness('LOCAL');
    const wrongEnv = harness.provider.secrets().authorize({
      identity: 'rpc',
      secretId: 'rpc-service',
      environment: 'PRODUCTION_CANDIDATE',
    });
    assert.equal(wrongEnv.ok, false);
    const fixture = harness.provider.secrets().rejectFixtureInProductionCandidate('rpc-service', 'PRODUCTION_CANDIDATE');
    assert.equal(fixture.ok, false);
    if (!fixture.ok) {
      assert.equal(fixture.error.code, 'FIXTURE_REJECTED');
    }
  });

  it('rejects a mutable container reference', () => {
    const floating = parseContainerReference({ name: 'sunrey-node', tag: 'latest' });
    assert.equal(floating.ok, false);
    if (!floating.ok) {
      assert.equal(floating.error.code, 'MUTABLE_CONTAINER_REFERENCE');
    }
    const digest = parseContainerReference({
      name: 'sunrey-node',
      digest: `sha256:${'cd'.repeat(32)}`,
    });
    assert.equal(digest.ok, true);
  });

  it('rejects network-zone violations', () => {
    const publicToSigner = authorizeNetworkPath('PUBLIC_EDGE', 'SIGNER_PRIVATE');
    assert.equal(publicToSigner.ok, false);
    const rpcToHsm = authorizeNetworkPath('PUBLIC_RPC', 'SIGNER_PRIVATE');
    assert.equal(rpcToHsm.ok, false);
    const explorerToCustody = authorizeNetworkPath('PUBLIC_EDGE', 'CUSTODY_PRIVATE');
    assert.equal(explorerToCustody.ok, false);
    const publicToRpc = authorizeNetworkPath('PUBLIC_EDGE', 'PUBLIC_RPC');
    assert.equal(publicToRpc.ok, true);
    assert.equal(NETWORK_ZONES.length, 10);
    assert.equal(documentedEgressClasses().every((row) => row.consensusExecution === false), true);
  });

  it('refuses to mark an unverified HSM as verified', () => {
    const unverified = markHsmVerified('EXTERNAL_HSM_CONFIGURED_UNVERIFIED', null);
    assert.equal(unverified.ok, false);
    const simulation = markHsmVerified('SIMULATION_HSM', 'aa'.repeat(32));
    assert.equal(simulation.ok, false);
  });

  it('cannot infer PQC capability from classical signing', () => {
    const kms = createSoftwareKms();
    const capabilities = kms.capabilities();
    const inferred = refuseInferredPqc(capabilities, 'PQ_SUPPORTED');
    assert.equal(inferred.ok, false);
    const cloud = cloudKmsCapabilities({
      providerType: 'AWS',
      endpoint: 'kms.example.invalid',
      credentialRefHref: 'secret://local-infra/cloud/aws',
      declaredAlgorithms: [
        { algorithm: 'ED25519', supported: true, inferred: false, evidence: 'config' },
      ],
    });
    assert.equal(cloud.classical, true);
    assert.equal(cloud.postQuantum, false);
    assert.equal(cloud.hybrid, false);
    assert.equal(cloud.hardwarePqReadiness, 'HARDWARE_PROVIDER_UNCONFIRMED');
    const cloudPq = refuseInferredPqc(cloud, 'PQ_SUPPORTED');
    assert.equal(cloudPq.ok, false);
  });

  it('keeps secret values out of logs and readiness reports', () => {
    const harness = runLocalProductionCandidateHarness();
    const serialized = JSON.stringify(harness.report);
    assert.equal(serialized.includes('test-only-'), false);
    assert.equal(harness.report.secretValuePresent, false);
    for (const event of harness.audit.list()) {
      assert.equal(event.secretValuePresent, false);
      assert.equal(JSON.stringify(event).includes('test-only-'), false);
    }
  });

  it('validates production-candidate configuration', () => {
    const ok = validateProductionCandidateConfig({
      environment: 'PRODUCTION_CANDIDATE',
      networkId: 'net_sunrey_production_candidate_1',
      chainId: 'chn_sunrey_production_candidate_1',
      releaseArtifactDigest: 'aa'.repeat(32),
      floatingRelease: false,
      secretEnvironment: 'PRODUCTION_CANDIDATE',
      fixtureSecret: false,
      publicSignerExposure: false,
      publicValidatorAdminExposure: false,
      hsmReadiness: 'SOFTWARE_SECURE_PROVIDER',
      hsmMarkedVerified: false,
      container: {
        name: 'sunrey-node',
        digest: `sha256:${'ab'.repeat(32)}`,
        tag: null,
        immutable: true,
      },
    });
    assert.equal(ok.ok, true);
    const testnetKey = validateProductionCandidateConfig({
      environment: 'PRODUCTION_CANDIDATE',
      networkId: 'net_sunrey_production_candidate_1',
      chainId: 'chn_sunrey_production_candidate_1',
      releaseArtifactDigest: 'aa'.repeat(32),
      floatingRelease: false,
      secretEnvironment: 'TESTNET',
      fixtureSecret: false,
      publicSignerExposure: false,
      publicValidatorAdminExposure: false,
      hsmReadiness: 'SOFTWARE_SECURE_PROVIDER',
      hsmMarkedVerified: false,
      container: {
        name: 'sunrey-node',
        digest: `sha256:${'ab'.repeat(32)}`,
        tag: null,
        immutable: true,
      },
    });
    assert.equal(testnetKey.ok, false);
    const bundle = hashConfigurationBundle({
      bundleId: 'cfg_test',
      environment: 'PRODUCTION_CANDIDATE',
      protocolVersion: '1',
      networkId: 'net_sunrey_production_candidate_1',
      chainId: 'chn_sunrey_production_candidate_1',
      releaseArtifactDigest: 'aa'.repeat(32),
      providerConfigurationHash: 'bb'.repeat(32),
    });
    assert.match(bundle.configurationHash, /^[0-9a-f]{64}$/);
    assert.equal(bundle.mainnetEnabled, false);
  });

  it('validates cloud adapters without real credentials', () => {
    const aws = awsAdapter({
      providerId: 'aws-test',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'us-east-1',
      zone: 'use1-az1',
      credentialHref: 'secret://local-infra/cloud/aws',
      supportedCapabilities: ['KMS', 'OBJECT_STORAGE'],
      configurationVersion: 'aws-adapter-v1',
    });
    assert.equal(aws.validateConfiguration().ok, true);
    assert.equal(aws.verificationStatus(), 'CREDENTIALS_REQUIRED');
    assert.equal(aws.kms(), null);
  });
});
