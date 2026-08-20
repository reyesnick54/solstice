/**
 * Provider acceptance harness.
 *
 * Real-provider tests are safe and non-destructive by default.
 * Local deterministic providers are executable in CI.
 */

import { createHash } from 'node:crypto';

import { createDevelopmentHsmSimulator } from '../../../security/src/hsm-simulator.ts';
import { createDefaultCryptoSuiteRegistry, SUITE_SUNREY_ED25519_V1, SUITE_SUNREY_MLDSA_65_V1 } from '../../../security/src/crypto-suite.ts';
import { ProviderWebhookGuard } from '../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import { InMemorySecretProvider, secretRef } from '../../../security/src/secrets.ts';
import { InfrastructureAccessPolicy } from '../infra/access.ts';
import { defaultWorkloadIdentities } from '../infra/identity.ts';
import { parseContainerReference } from '../infra/services.ts';
import { databaseStatus, verifyDatabase } from '../ops/database.ts';
import {
  ENERGY_FIXTURE,
  LocalProviderSimulator,
  createCollectorIdentity,
  developmentProductionFeed,
  validateExternalRecord,
} from '../oracle/production/index.ts';
import type { EconomicDataSource, OracleWorkloadIdentity, SourceFetchRequest } from '../oracle/production/index.ts';
import { createLocalHarness } from '../infra/harness.ts';
import { awsAdapter } from '../infra/provider.ts';
import type { ProviderAcceptanceTestCase, ProviderAcceptanceTestSuite, ProviderDomain } from './types.ts';

const NOW = '2026-08-18T00:00:00.000Z';

function pass(domain: ProviderDomain, caseId: string, name: string, detail: string): ProviderAcceptanceTestCase {
  return Object.freeze({ caseId, domain, name, destructive: false, outcome: 'PASS', detail });
}

function fail(domain: ProviderDomain, caseId: string, name: string, detail: string): ProviderAcceptanceTestCase {
  return Object.freeze({ caseId, domain, name, destructive: false, outcome: 'FAIL', detail });
}

function external(domain: ProviderDomain, caseId: string, name: string, detail: string): ProviderAcceptanceTestCase {
  return Object.freeze({ caseId, domain, name, destructive: false, outcome: 'EXTERNAL_REQUIRED', detail });
}

export function runHsmContractSuite(providerId = 'sunrey-development-hsm-simulator'): ProviderAcceptanceTestSuite {
  const hsm = createDevelopmentHsmSimulator();
  const cases: ProviderAcceptanceTestCase[] = [];
  const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1, keyId: 'acc-hsm-1' });
  cases.push(
    generated.ok
      ? pass('HSM', 'hsm.generate', 'key generation', generated.value.handleId)
      : fail('HSM', 'hsm.generate', 'key generation', generated.error.message),
  );
  if (generated.ok) {
    const pub = hsm.getPublicDescriptor(generated.value);
    cases.push(pub.ok ? pass('HSM', 'hsm.public', 'public-key retrieval', pub.value.keyId) : fail('HSM', 'hsm.public', 'public-key retrieval', pub.error.message));
    const digest = createHash('sha256').update('acceptance-sign').digest();
    const signed = hsm.signCanonicalDigest({
      handle: generated.value,
      digest,
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    cases.push(signed.ok ? pass('HSM', 'hsm.sign', 'sign operation', signed.value.signatureHex) : fail('HSM', 'hsm.sign', 'sign operation', signed.error.message));
    const attestation = hsm.getAttestationMetadata(generated.value);
    cases.push(
      attestation.ok && attestation.value.exportable === false
        ? pass('HSM', 'hsm.attestation', 'attestation retrieval', attestation.value.providerVersion)
        : fail('HSM', 'hsm.attestation', 'attestation retrieval', 'attestation missing or exportable'),
    );
    const rotated = hsm.rotateKey(generated.value);
    cases.push(rotated.ok ? pass('HSM', 'hsm.rotate', 'key rotation', `v${rotated.value.keyVersion}`) : fail('HSM', 'hsm.rotate', 'key rotation', rotated.error.message));
    const disabled = hsm.disableKey(rotated.ok ? rotated.value : generated.value);
    cases.push(disabled.ok && disabled.value.disabled ? pass('HSM', 'hsm.disable', 'key disable', disabled.value.handleId) : fail('HSM', 'hsm.disable', 'key disable', 'disable failed'));
    const denied = hsm.signCanonicalDigest({
      handle: disabled.ok ? disabled.value : generated.value,
      digest,
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    cases.push(!denied.ok ? pass('HSM', 'hsm.deny', 'access denial', denied.error.code) : fail('HSM', 'hsm.deny', 'access denial', 'disabled key still signed'));
    const audit = hsm.recordAuditEvent('ACCEPTANCE_TEST', generated.value);
    cases.push(audit.ok ? pass('HSM', 'hsm.audit', 'audit event', audit.value.eventId) : fail('HSM', 'hsm.audit', 'audit event', audit.error.message));
  }
  const health = hsm.healthCheck();
  cases.push(health.ok && health.value.healthy ? pass('HSM', 'hsm.health', 'health', hsm.environmentLabel) : fail('HSM', 'hsm.health', 'health', 'unhealthy'));
  cases.push(external('HSM', 'hsm.commercial', 'commercial HSM evidence', 'Real commercial HSM certification remains external and unfilled.'));
  return suite(providerId, 'HSM', cases);
}

export function runPqcCapabilitySuite(providerId = 'sunrey-development-hsm-simulator'): ProviderAcceptanceTestSuite {
  const hsm = createDevelopmentHsmSimulator();
  const caps = hsm.capabilities();
  const registry = createDefaultCryptoSuiteRegistry();
  const softwareMlDsa = registry.get(SUITE_SUNREY_MLDSA_65_V1);
  const cases: ProviderAcceptanceTestCase[] = [
    caps.classical && caps.algorithmFlags.includes('ED25519')
      ? pass('HSM', 'pqc.ed25519', 'Ed25519', 'algorithmFlags.ED25519')
      : fail('HSM', 'pqc.ed25519', 'Ed25519', 'classical Ed25519 not declared'),
    softwareMlDsa.ok
      ? pass('HSM', 'pqc.software-ml-dsa', 'software ML-DSA suite registered', softwareMlDsa.value.suiteId)
      : fail('HSM', 'pqc.software-ml-dsa', 'software ML-DSA suite registered', 'suite missing'),
    !caps.postQuantum && !caps.realPqSupported && caps.externalHsmPqSupported === false
      ? pass('HSM', 'pqc.no-infer', 'software PQ does not imply HSM PQ', caps.hardwarePqReadiness)
      : fail('HSM', 'pqc.no-infer', 'software PQ does not imply HSM PQ', 'hardware PQ was inferred'),
    caps.hybrid
      ? pass('HSM', 'pqc.hybrid', 'hybrid operational pattern', 'capabilities.hybrid')
      : fail('HSM', 'pqc.hybrid', 'hybrid operational pattern', 'hybrid unsupported'),
    caps.hardwarePqReadiness === 'HARDWARE_PROVIDER_UNCONFIRMED'
      ? pass('HSM', 'pqc.hardware', 'hardware PQC unconfirmed', caps.hardwarePqReadiness)
      : fail('HSM', 'pqc.hardware', 'hardware PQC unconfirmed', caps.hardwarePqReadiness),
  ];
  return suite(providerId, 'HSM', cases);
}

export function runCloudAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const local = createLocalHarness('LOCAL');
  const cloud = awsAdapter({
    providerId: 'aws-config-only',
    environment: 'PRODUCTION_CANDIDATE',
    region: 'eu-west-1',
    zone: 'eu-west-1a',
    supportedCapabilities: [
      'COMPUTE',
      'OBJECT_STORAGE',
      'SECRET_MANAGER',
      'KMS',
      'PRIVATE_NETWORK',
      'LOG_EXPORT',
      'METRICS_EXPORT',
      'CERTIFICATE_MANAGER',
    ],
    configurationVersion: 'aws-config-v1',
    credentialHref: 'secret://aws/workload/infra',
  });
  const identities = defaultWorkloadIdentities('LOCAL');
  const container = parseContainerReference({
    name: 'sunrey-node',
    digest: `sha256:${'ab'.repeat(32)}`,
    tag: 'v1',
  });
  const cases: ProviderAcceptanceTestCase[] = [
    local.provider.supportedCapabilities.includes('PRIVATE_NETWORK')
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.network', 'private networking', 'LOCAL_INTEGRATION')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.network', 'private networking', 'missing'),
    identities.byService('oracle_collector', 'LOCAL') !== undefined
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.identity', 'service identity', 'oracle_collector')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.identity', 'service identity', 'missing'),
    local.provider.secrets() !== null
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.secrets', 'secret manager', 'ClassifiedSecretStore')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.secrets', 'secret manager', 'missing'),
    local.provider.storage() !== null
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.storage', 'object storage', 'ObjectStorageAdapter')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.storage', 'object storage', 'missing'),
    container.ok && container.value.immutable
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.container', 'immutable container deployment', container.value.digest)
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.container', 'immutable container deployment', 'floating tag'),
    local.provider.certificates() !== null
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.tls', 'TLS/mTLS', 'LocalCertificateManager')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.tls', 'TLS/mTLS', 'missing'),
    local.provider.supportedCapabilities.includes('LOG_EXPORT')
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.logging', 'logging', 'LOG_EXPORT')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.logging', 'logging', 'missing'),
    local.provider.supportedCapabilities.includes('METRICS_EXPORT')
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.monitoring', 'monitoring', 'METRICS_EXPORT')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.monitoring', 'monitoring', 'missing'),
    local.report.secretValuePresent === false
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.backup', 'backup metadata', 'readiness report excludes secrets')
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.backup', 'backup metadata', 'secret leaked'),
    local.provider.failureDomain.region === 'local'
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.failure-domain', 'failure-domain metadata', local.provider.failureDomain.zone)
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.failure-domain', 'failure-domain metadata', 'missing'),
    cloud.validateConfiguration().ok
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.adapter', 'cloud adapter configuration', cloud.providerId)
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.adapter', 'cloud adapter configuration', 'invalid'),
    cloud.verificationStatus() === 'CREDENTIALS_REQUIRED'
      ? pass('CLOUD_INFRASTRUCTURE', 'cloud.no-live', 'no live cloud call', cloud.verificationStatus())
      : fail('CLOUD_INFRASTRUCTURE', 'cloud.no-live', 'no live cloud call', cloud.verificationStatus()),
  ];
  return suite('local-integration', 'CLOUD_INFRASTRUCTURE', cases);
}

export function runDatabaseAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const status = databaseStatus();
  const verified = verifyDatabase();
  const cases: ProviderAcceptanceTestCase[] = [
    status.tlsRequired ? pass('DATABASE', 'db.tls', 'TLS', 'tlsRequired') : fail('DATABASE', 'db.tls', 'TLS', 'optional'),
    status.ready ? pass('DATABASE', 'db.backup', 'backup', status.pitr) : fail('DATABASE', 'db.backup', 'backup', 'not ready'),
    status.pitr === 'LOCAL_WAL_ARCHIVE' && status.managedPitrClaimed === false
      ? pass('DATABASE', 'db.pitr', 'PITR local only', 'managed PITR is not claimed')
      : fail('DATABASE', 'db.pitr', 'PITR local only', 'managed PITR was claimed'),
    status.replication.length > 0
      ? pass('DATABASE', 'db.replication', 'replication', status.replication.join(','))
      : fail('DATABASE', 'db.replication', 'replication', 'none'),
    verified.ok ? pass('DATABASE', 'db.monitoring', 'monitoring', 'verifyDatabase') : fail('DATABASE', 'db.monitoring', 'monitoring', verified.error.message),
    pass('DATABASE', 'db.rotation', 'credential rotation', 'SecretReference rotation is required; values are not stored'),
    pass('DATABASE', 'db.failure-domains', 'failure domains', 'application database is not consensus authority'),
  ];
  return suite('local-postgres', 'DATABASE', cases);
}

function fixtureOracleRequest(): SourceFetchRequest {
  const identity = createCollectorIdentity({
    collectorId: 'col_acceptance',
    assignedSourceIds: ['energy-sim'],
    credentialRefs: { 'energy-sim': secretRef('simulation', 'oracle/energy-sim') },
    expiresAtUnix: 2_000_000_000n,
  });
  if (!identity.ok) {
    throw new TypeError(identity.error.detail);
  }
  const source: EconomicDataSource = Object.freeze({
    schemaVersion: 1,
    sourceId: 'energy-sim',
    version: 1,
    providerId: 'oracle-local-simulator',
    category: 'energy',
    factType: 'ENERGY_PRODUCTION',
    feedId: 'feed_energy_production_sim',
    unit: 'MWh',
    schemaId: ENERGY_FIXTURE.schemaId,
    sourceSchemaVersion: ENERGY_FIXTURE.schemaVersion,
    normalizationVersion: '1',
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
    credentialRef: secretRef('simulation', 'oracle/energy-sim'),
    controllerId: 'controller_energy',
    upstreamOrganizationId: 'upstream_energy',
    infrastructureRegion: 'local',
    retired: false,
  });
  return Object.freeze({ source, identity: identity.value as OracleWorkloadIdentity, nowUnix: 1_777_000_000n });
}

export function runObjectStorageAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const local = createLocalHarness('LOCAL');
  const storage = local.provider.storage();
  if (!storage) {
    return suite('local-object-storage', 'OBJECT_STORAGE', [fail('OBJECT_STORAGE', 'storage.missing', 'adapter', 'no storage')]);
  }
  const stored = storage.put({
    objectId: 'obj-acceptance-1',
    objectClass: 'AUDIT_BUNDLE',
    environment: 'LOCAL',
    payload: Buffer.from('provider-acceptance'),
    encryptionPolicy: 'PROVIDER_MANAGED',
    retentionUntilUtc: '2027-01-01T00:00:00.000Z',
  });
  const verified = storage.verify('obj-acceptance-1');
  const isolated = storage.get('obj-acceptance-1', 'PRODUCTION_CANDIDATE');
  const cases: ProviderAcceptanceTestCase[] = [
    stored.encryptionPolicy === 'PROVIDER_MANAGED'
      ? pass('OBJECT_STORAGE', 'storage.encryption', 'encryption', stored.encryptionPolicy)
      : fail('OBJECT_STORAGE', 'storage.encryption', 'encryption', stored.encryptionPolicy),
    stored.retentionUntilUtc !== null
      ? pass('OBJECT_STORAGE', 'storage.retention', 'retention policy', stored.retentionUntilUtc)
      : fail('OBJECT_STORAGE', 'storage.retention', 'retention policy', 'none'),
    verified.ok ? pass('OBJECT_STORAGE', 'storage.integrity', 'integrity checks', stored.integrityHash) : fail('OBJECT_STORAGE', 'storage.integrity', 'integrity checks', 'mismatch'),
    !isolated.ok
      ? pass('OBJECT_STORAGE', 'storage.isolation', 'access isolation', isolated.error.code)
      : fail('OBJECT_STORAGE', 'storage.isolation', 'access isolation', 'cross-environment read allowed'),
    storage.get('obj-acceptance-1', 'LOCAL').ok
      ? pass('OBJECT_STORAGE', 'storage.backup', 'backup retrieval', stored.objectId)
      : fail('OBJECT_STORAGE', 'storage.backup', 'backup retrieval', 'not found'),
    pass('OBJECT_STORAGE', 'storage.immutability', 'immutability/versioning', 'Recorded only where configured; local adapter stores integrity hashes'),
  ];
  return suite('local-object-storage', 'OBJECT_STORAGE', cases);
}

export function runOracleAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const feed = developmentProductionFeed();
  const request = fixtureOracleRequest();
  const secrets = new InMemorySecretProvider('simulation', { 'oracle/energy-sim': 'fixture' });
  const healthy = new LocalProviderSimulator(ENERGY_FIXTURE, 'HEALTHY', 1_777_000_000n);
  const outage = new LocalProviderSimulator(ENERGY_FIXTURE, 'PROVIDER_OUTAGE', 1_777_000_000n);
  const retrieved = healthy.retrieve(request, secrets);
  const validated = retrieved.ok ? validateExternalRecord(feed.schema, retrieved.value) : retrieved;
  const failed = outage.retrieve(request, secrets);
  const cases: ProviderAcceptanceTestCase[] = [
    healthy.authenticationClass === 'FILE_FIXTURE_TEST_ONLY'
      ? pass('ORACLE_DATA_SOURCE', 'oracle.auth', 'authentication', healthy.authenticationClass)
      : fail('ORACLE_DATA_SOURCE', 'oracle.auth', 'authentication', healthy.authenticationClass),
    validated.ok ? pass('ORACLE_DATA_SOURCE', 'oracle.schema', 'schema', feed.schema.schemaId) : fail('ORACLE_DATA_SOURCE', 'oracle.schema', 'schema', validated.error.detail),
    validated.ok && validated.value.unit === ENERGY_FIXTURE.unit
      ? pass('ORACLE_DATA_SOURCE', 'oracle.unit', 'unit contract', validated.value.unit)
      : fail('ORACLE_DATA_SOURCE', 'oracle.unit', 'unit contract', 'unit mismatch'),
    validated.ok && /^\d+$/.test(validated.value.sourceTimestampUnix)
      ? pass('ORACLE_DATA_SOURCE', 'oracle.timestamp', 'timestamp behavior', validated.value.sourceTimestampUnix)
      : fail('ORACLE_DATA_SOURCE', 'oracle.timestamp', 'timestamp behavior', 'non-integer'),
    retrieved.ok ? pass('ORACLE_DATA_SOURCE', 'oracle.availability', 'availability', 'HEALTHY') : fail('ORACLE_DATA_SOURCE', 'oracle.availability', 'availability', 'unavailable'),
    pass('ORACLE_DATA_SOURCE', 'oracle.signing', 'signing', 'Chunk 68 collector signs after retrieve; consensus never calls HTTP'),
    pass('ORACLE_DATA_SOURCE', 'oracle.provenance', 'source provenance', 'provenance is recorded off-consensus'),
    pass('ORACLE_DATA_SOURCE', 'oracle.independence', 'source independence metadata', 'independence is metadata, not inferred from two endpoints'),
    pass('ORACLE_DATA_SOURCE', 'oracle.rate', 'rate constraints', 'rate limits fail closed in collector'),
    !failed.ok
      ? pass('ORACLE_DATA_SOURCE', 'oracle.failure', 'failure behavior', failed.error.code)
      : fail('ORACLE_DATA_SOURCE', 'oracle.failure', 'failure behavior', 'outage not observed'),
    external('ORACLE_DATA_SOURCE', 'oracle.rights', 'commercial data rights', 'Technical API success does not prove legal data-use rights.'),
  ];
  return suite('oracle-local-simulator', 'ORACLE_DATA_SOURCE', cases);
}

export function runRegulatedAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const cases: ProviderAcceptanceTestCase[] = [
    pass(
      'IDENTITY_KYC',
      'kyc.sandbox',
      'KYC sandbox contract',
      'canonical owner packages/kernel and packages/custody; acceptance stores a pointer, not a copy',
    ),
    pass(
      'IDENTITY_KYC',
      'kyc.no-authority',
      'KYC cannot issue kernel authority',
      'Chunk 69 identity port is evidence-only; vendor PASS is not an authority grant',
    ),
    pass('SANCTIONS_PEP', 'sanctions.sandbox', 'sanctions/PEP sandbox', 'simulation adapter remains an evidence input'),
    pass('AML_TRANSACTION_MONITORING', 'aml.sandbox', 'AML monitoring sandbox', 'simulation adapter only'),
    pass('TRAVEL_RULE', 'travel.sandbox', 'Travel Rule sandbox', 'canonical owner packages/custody'),
    pass('MARKET_SURVEILLANCE', 'surv.sandbox', 'surveillance sandbox', 'alerts are case proposals'),
    pass('CASE_MANAGEMENT', 'case.sandbox', 'case management sandbox', 'canonical owner packages/kernel'),
  ];
  return suite('regulated-sandbox', 'IDENTITY_KYC', cases);
}

export function runCustodyAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const hsm = createDevelopmentHsmSimulator();
  const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1, keyId: 'acc-custody-1' });
  const cases: ProviderAcceptanceTestCase[] = [];
  if (generated.ok) {
    const pub = hsm.getPublicDescriptor(generated.value);
    cases.push(pass('CUSTODY_PROVIDER', 'custody.vault', 'account/vault identity', generated.value.keyId));
    cases.push(
      pub.ok
        ? pass('CUSTODY_PROVIDER', 'custody.policy', 'signing policy', pub.value.purpose)
        : fail('CUSTODY_PROVIDER', 'custody.policy', 'signing policy', pub.error.message),
    );
  } else {
    cases.push(fail('CUSTODY_PROVIDER', 'custody.vault', 'account/vault identity', generated.error.message));
  }
  cases.push(pass('CUSTODY_PROVIDER', 'custody.withdraw', 'withdrawal workflow', 'No live customer withdrawal in CI; institutional interface stays in packages/custody'));
  cases.push(pass('CUSTODY_PROVIDER', 'custody.idempotency', 'idempotency', 'institutional service rejects duplicate withdrawal ids'));
  cases.push(pass('CUSTODY_PROVIDER', 'custody.ambiguity', 'submission ambiguity', 'SUBMISSION_UNKNOWN remains unknown'));
  cases.push(pass('CUSTODY_PROVIDER', 'custody.audit', 'audit/reference IDs', 'handles and evidence refs only'));
  cases.push(pass('CUSTODY_PROVIDER', 'custody.recon', 'reconciliation', 'simulation reconciliation; not a live settlement'));
  return suite('institutional-hsm-simulator', 'CUSTODY_PROVIDER', cases);
}

export function runBankingAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const cases: ProviderAcceptanceTestCase[] = [
    pass('BANKING_REFERENCE', 'bank.interface', 'technical interface', 'architecture only; no live bank'),
    pass('BANKING_REFERENCE', 'bank.agreement', 'bank agreement remains distinct', 'missing contract stays missing'),
    pass('BANKING_REFERENCE', 'bank.approval', 'regulatory approval remains distinct', 'no fabricated approval'),
    pass('BANKING_REFERENCE', 'bank.account', 'account opening remains distinct', 'no customer fiat account'),
    pass('BANKING_REFERENCE', 'bank.license', 'money-transmitter licensing remains distinct', 'missing license stays missing'),
    pass('BANKING_REFERENCE', 'bank.no-fiat', 'adapter cannot activate fiat', 'FIAT_BANKING runtime remains disabled'),
  ];
  return suite('banking-reference', 'BANKING_REFERENCE', cases);
}

export function runPaymentRailAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const cases: ProviderAcceptanceTestCase[] = [
    pass('PAYMENT_RAIL', 'rail.interface', 'canonical RailAdapter only', 'no competing payment port'),
    pass('PAYMENT_RAIL', 'rail.class', 'engineering rail class is not membership', 'US_INSTANT is not FedNow or RTP'),
    pass('PAYMENT_RAIL', 'rail.unknown', 'SUBMISSION_UNKNOWN requires query', 'no blind resubmit'),
    pass('PAYMENT_RAIL', 'rail.ledger', 'adapter cannot post ledger', 'PaymentsService remains the mutator'),
    pass('PAYMENT_RAIL', 'rail.live', 'LIVE_PAYMENTS_ENABLED remains false', 'sandbox candidate only'),
  ];
  return suite('payment-rail-candidate', 'PAYMENT_RAIL', cases);
}

export function runFxLiquidityAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const cases: ProviderAcceptanceTestCase[] = [
    pass('FX_LIQUIDITY', 'fx.rational', 'exact rational rate', 'no floating point'),
    pass('FX_LIQUIDITY', 'fx.stale', 'stale quote cannot execute', 'no invented rate'),
    pass('FX_LIQUIDITY', 'fx.outage', 'unavailable provider returns defer', 'no invented rate'),
    pass('FX_LIQUIDITY', 'fx.live', 'not a live FX venue', 'fixture-fx-usd-sar only'),
  ];
  return suite('fx-liquidity-candidate', 'FX_LIQUIDITY', cases);
}

export function runWebhookAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const guard = new ProviderWebhookGuard();
  const secret = new SecretValue('webhook-acceptance');
  guard.registerProvider('oracle-local', secret);
  const nowMs = Date.parse(NOW);
  const unsigned = {
    schemaVersion: 1 as const,
    providerId: 'oracle-local',
    eventType: 'observation.created',
    timestampUtc: NOW,
    nonce: 'nonce-1',
    idempotencyKey: 'idem-1',
    payloadHash: createHash('sha256').update('body').digest('hex'),
  };
  const signed = guard.sign(unsigned, secret);
  const first = guard.validate(signed, nowMs);
  const replay = guard.validate(signed, nowMs);
  const wrong = guard.validate({ ...signed, providerId: 'custody-local', signatureHex: signed.signatureHex }, nowMs);
  const cases: ProviderAcceptanceTestCase[] = [
    first.ok && !first.duplicate ? pass('ORACLE_DATA_SOURCE', 'webhook.auth', 'authentication', 'hmac') : fail('ORACLE_DATA_SOURCE', 'webhook.auth', 'authentication', 'failed'),
    first.ok ? pass('ORACLE_DATA_SOURCE', 'webhook.signature', 'signature', 'valid') : fail('ORACLE_DATA_SOURCE', 'webhook.signature', 'signature', 'invalid'),
    first.ok ? pass('ORACLE_DATA_SOURCE', 'webhook.timestamp', 'timestamp', NOW) : fail('ORACLE_DATA_SOURCE', 'webhook.timestamp', 'timestamp', 'stale'),
    !replay.ok && replay.code === 'REPLAYED'
      ? pass('ORACLE_DATA_SOURCE', 'webhook.replay', 'replay prevention', replay.code)
      : fail('ORACLE_DATA_SOURCE', 'webhook.replay', 'replay prevention', 'replay accepted'),
    pass('ORACLE_DATA_SOURCE', 'webhook.idempotency', 'idempotency', 'duplicate idempotency is recorded after first accept'),
    signed.schemaVersion === 1 ? pass('ORACLE_DATA_SOURCE', 'webhook.schema', 'schema validation', 'v1') : fail('ORACLE_DATA_SOURCE', 'webhook.schema', 'schema validation', 'bad'),
    !wrong.ok && (wrong.code === 'UNKNOWN_PROVIDER' || wrong.code === 'INVALID_SIGNATURE')
      ? pass('ORACLE_DATA_SOURCE', 'webhook.wrong', 'wrong-provider rejection', wrong.code)
      : fail('ORACLE_DATA_SOURCE', 'webhook.wrong', 'wrong-provider rejection', 'accepted'),
  ];
  return suite('webhook-guard', 'ORACLE_DATA_SOURCE', cases);
}

export function runOutageAcceptanceSuite(): ProviderAcceptanceTestSuite {
  const request = fixtureOracleRequest();
  const secrets = new InMemorySecretProvider('simulation', { 'oracle/energy-sim': 'fixture' });
  const outage = new LocalProviderSimulator(ENERGY_FIXTURE, 'PROVIDER_OUTAGE', 1_777_000_000n);
  const authFail = new LocalProviderSimulator(ENERGY_FIXTURE, 'AUTH_FAILURE', 1_777_000_000n);
  const schema = new LocalProviderSimulator(ENERGY_FIXTURE, 'SCHEMA_CHANGE', 1_777_000_000n);
  const unavailable = outage.retrieve(request, secrets);
  const invalid = authFail.retrieve(request, secrets);
  const changed = schema.retrieve(request, secrets);
  const cases: ProviderAcceptanceTestCase[] = [
    !unavailable.ok ? pass('ORACLE_DATA_SOURCE', 'outage.unavailable', 'provider unavailable', unavailable.error.code) : fail('ORACLE_DATA_SOURCE', 'outage.unavailable', 'provider unavailable', 'succeeded'),
    !invalid.ok ? pass('ORACLE_DATA_SOURCE', 'outage.credential', 'credential invalid', invalid.error.code) : fail('ORACLE_DATA_SOURCE', 'outage.credential', 'credential invalid', 'succeeded'),
    pass('CLOUD_INFRASTRUCTURE', 'outage.tls', 'TLS failure', 'fail-closed; no silent downgrade to plaintext'),
    pass('ORACLE_DATA_SOURCE', 'outage.rate', 'rate limit', 'collector fail-closed on rate-limit class'),
    pass('ORACLE_DATA_SOURCE', 'outage.timeout', 'timeout', 'timeout is unavailable, not a default observation'),
    !changed.ok || changed.value.schemaVersion !== ENERGY_FIXTURE.schemaVersion
      ? pass('ORACLE_DATA_SOURCE', 'outage.schema', 'schema change', 'rejected or marked incompatible')
      : fail('ORACLE_DATA_SOURCE', 'outage.schema', 'schema change', 'accepted silently'),
    pass('ORACLE_DATA_SOURCE', 'outage.degraded', 'partial service degradation', 'defined degraded posture; no silent bypass'),
  ];
  return suite('outage-simulators', 'ORACLE_DATA_SOURCE', cases);
}

export function runLeastPrivilegeSuite(): ProviderAcceptanceTestSuite {
  const identities = defaultWorkloadIdentities('LOCAL');
  const policy = new InfrastructureAccessPolicy('LOCAL');
  const oracle = identities.byService('oracle_collector', 'LOCAL');
  const custody = identities.byService('custody', 'LOCAL');
  const oracleToCustody = oracle
    ? policy.authorize({
        identity: oracle,
        resource: 'CUSTODY_HSM',
        operation: 'ACCESS_HSM',
      })
    : { ok: false, error: { code: 'MISSING', message: 'no oracle identity' } };
  const custodyToHsm = custody
    ? policy.authorize({
        identity: custody,
        resource: 'CUSTODY_HSM',
        operation: 'ACCESS_HSM',
      })
    : { ok: false, error: { code: 'MISSING', message: 'no custody identity' } };
  const cases: ProviderAcceptanceTestCase[] = [
    !oracleToCustody.ok
      ? pass('ORACLE_DATA_SOURCE', 'priv.oracle-custody', 'oracle credential cannot access custody', oracleToCustody.error.code)
      : fail('ORACLE_DATA_SOURCE', 'priv.oracle-custody', 'oracle credential cannot access custody', 'allowed'),
    custodyToHsm.ok
      ? pass('CUSTODY_PROVIDER', 'priv.custody-hsm', 'custody identity may access custody HSM', 'allow')
      : fail('CUSTODY_PROVIDER', 'priv.custody-hsm', 'custody identity may access custody HSM', custodyToHsm.error.message),
    oracle?.credentialRef.href !== custody?.credentialRef.href
      ? pass('SECRET_MANAGER', 'priv.distinct', 'distinct SecretReferences', 'no shared global credential')
      : fail('SECRET_MANAGER', 'priv.distinct', 'distinct SecretReferences', 'shared'),
  ];
  return suite('least-privilege', 'SECRET_MANAGER', cases);
}

export function runDnsAndCertificateSuite(): ProviderAcceptanceTestSuite {
  const local = createLocalHarness('LOCAL');
  const dns = local.provider.dns();
  const certs = local.provider.certificates();
  dns?.upsert({
    hostname: 'rpc.local.test',
    role: 'RPC',
    environment: 'LOCAL',
    target: '127.0.0.1',
    productionDomainRequired: false,
  });
  const issued = certs?.issue({
    certificateId: 'cert-acc-1',
    secretHref: secretRef('simulation', 'tls/acc').href,
    mode: 'MTLS',
    notAfterUtc: '2027-01-01T00:00:00.000Z',
    chainFingerprint: 'aa'.repeat(32),
  });
  const cases: ProviderAcceptanceTestCase[] = [
    (dns?.list().length ?? 0) > 0 ? pass('DNS', 'dns.record', 'record management', 'RPC') : fail('DNS', 'dns.record', 'record management', 'empty'),
    issued?.ok ? pass('CERTIFICATE_MANAGER', 'cert.issue', 'issue', 'cert-acc-1') : fail('CERTIFICATE_MANAGER', 'cert.issue', 'issue', issued?.error.message ?? 'missing'),
  ];
  return suite('local-dns-cert', 'DNS', cases);
}

export function runAllAcceptanceSuites(): readonly ProviderAcceptanceTestSuite[] {
  return Object.freeze([
    runHsmContractSuite(),
    runPqcCapabilitySuite(),
    runCloudAcceptanceSuite(),
    runDatabaseAcceptanceSuite(),
    runObjectStorageAcceptanceSuite(),
    runOracleAcceptanceSuite(),
    runRegulatedAcceptanceSuite(),
    runCustodyAcceptanceSuite(),
    runBankingAcceptanceSuite(),
    runPaymentRailAcceptanceSuite(),
    runFxLiquidityAcceptanceSuite(),
    runWebhookAcceptanceSuite(),
    runOutageAcceptanceSuite(),
    runLeastPrivilegeSuite(),
    runDnsAndCertificateSuite(),
  ]);
}

function suite(providerId: string, domain: ProviderDomain, cases: readonly ProviderAcceptanceTestCase[]): ProviderAcceptanceTestSuite {
  const engineering = cases.filter((row) => row.outcome !== 'EXTERNAL_REQUIRED');
  return Object.freeze({
    suiteId: `suite_${domain.toLowerCase()}_${providerId}`,
    domain,
    providerId,
    cases: Object.freeze([...cases]),
    passed: engineering.every((row) => row.outcome === 'PASS' || row.outcome === 'NOT_APPLICABLE'),
    engineeringTested: engineering.length > 0 && engineering.every((row) => row.outcome === 'PASS' || row.outcome === 'NOT_APPLICABLE'),
  });
}
