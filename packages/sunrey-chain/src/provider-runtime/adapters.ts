/**
 * Executable provider adapters. They run against a transport (local mock
 * or credential-injected sandbox). Consensus never imports this module
 * for HTTP. Secret values never leave the security boundary.
 */

import { createHash } from 'node:crypto';

import type { SecretProvider, SecretReference } from '../../../security/src/secrets.ts';
import {
  type HsmKmsProvider,
  type HsmKeyHandle,
} from '../../../security/src/hsm-kms.ts';
import { createDevelopmentHsmSimulator, createDevelopmentKmsSimulator } from '../../../security/src/hsm-simulator.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../../security/src/crypto-suite.ts';
import type { IdentityFacts } from '../../../identity/src/facts.ts';
import type { ProviderDomain } from '../providers/types.ts';
import type { ProviderType } from '../infra/types.ts';
import { validateExternalRecord, type ExternalSourceRecord } from '../oracle/production/schema.ts';
import type { FeedSchemaDefinition } from '../oracle/production/types.ts';
import { LocalMockFleet, type MockResponse } from './mocks.ts';
import {
  authorizeWorkload,
  authorizeCredentialBinding,
  bindCredential,
  digestJson,
  openProviderSession,
  probePqcCapability,
  resolveAssignedSecret,
} from './core.ts';
import {
  runtimeErr,
  runtimeOk,
  type PqcCapabilityProbe,
  type ProviderCredentialBinding,
  type ProviderRuntimeMode,
  type ProviderRuntimeResult,
  type ProviderSession,
  type WorkloadIdentity,
  type ExecutableProviderAdapter,
} from './types.ts';

export type ProviderTransport = {
  execute(input: {
    readonly domain: ProviderDomain;
    readonly operation: string;
    readonly idempotencyKey?: string;
    readonly schemaVersion?: number;
    readonly body?: Readonly<Record<string, unknown>>;
  }): ProviderRuntimeResult<MockResponse>;
};

export class MockBackedTransport implements ProviderTransport {
  readonly #fleet: LocalMockFleet;

  constructor(fleet: LocalMockFleet) {
    this.#fleet = fleet;
  }

  execute(input: {
    readonly domain: ProviderDomain;
    readonly operation: string;
    readonly idempotencyKey?: string;
    readonly schemaVersion?: number;
    readonly body?: Readonly<Record<string, unknown>>;
  }): ProviderRuntimeResult<MockResponse> {
    return this.#fleet.get(input.domain).handle({
      domain: input.domain,
      operation: input.operation,
      ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
      ...(input.schemaVersion === undefined ? {} : { schemaVersion: input.schemaVersion }),
      ...(input.body === undefined ? {} : { body: input.body }),
    });
  }
}

function requireSession(
  session: ProviderSession,
  domain: ProviderDomain,
  workload: WorkloadIdentity,
  binding?: ProviderCredentialBinding,
): ProviderRuntimeResult<true> {
  const privilege = authorizeWorkload(workload, domain);
  if (!privilege.ok) {
    return privilege;
  }
  if (session.workloadIdentity !== workload) {
    return runtimeErr('WRONG_WORKLOAD_CREDENTIAL', 'session workload does not match caller');
  }
  if (session.domain !== domain) {
    return runtimeErr('SESSION_DOMAIN', 'session is not bound to this domain');
  }
  if (binding) {
    return authorizeCredentialBinding(binding, domain, workload);
  }
  return runtimeOk(true);
}

export class ExecutableCloudAdapter implements ExecutableProviderAdapter {
  readonly adapterId: string;
  readonly domain = 'CLOUD_INFRASTRUCTURE' as const;
  readonly providerType: ProviderType;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport, providerType: ProviderType) {
    this.transport = transport;
    this.providerType = providerType;
    this.adapterId = `cloud.${providerType.toLowerCase()}`;
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export function awsExecutableAdapter(transport: ProviderTransport): ExecutableCloudAdapter {
  return new ExecutableCloudAdapter(transport, 'AWS');
}
export function azureExecutableAdapter(transport: ProviderTransport): ExecutableCloudAdapter {
  return new ExecutableCloudAdapter(transport, 'AZURE');
}
export function gcpExecutableAdapter(transport: ProviderTransport): ExecutableCloudAdapter {
  return new ExecutableCloudAdapter(transport, 'GOOGLE_CLOUD');
}
export function kubernetesExecutableAdapter(transport: ProviderTransport): ExecutableCloudAdapter {
  return new ExecutableCloudAdapter(transport, 'KUBERNETES');
}
export function vaultExecutableAdapter(transport: ProviderTransport): ExecutableCloudAdapter {
  return new ExecutableCloudAdapter(transport, 'VAULT_OPENBAO');
}

export class ExecutableSecretManagerAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'secrets.runtime';
  readonly domain = 'SECRET_MANAGER' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;

  readonly transport: ProviderTransport;
  readonly secrets: SecretProvider;

  constructor(transport: ProviderTransport, secrets: SecretProvider) {
    this.transport = transport;
    this.secrets = secrets;
  }

  retrieve(session: ProviderSession, reference: SecretReference, binding: ProviderCredentialBinding): ProviderRuntimeResult<{ readonly href: string }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity, binding);
    if (!gate.ok) {
      return gate;
    }
    const value = resolveAssignedSecret(this.secrets, reference);
    if (!value.ok) {
      return value;
    }
    return runtimeOk(Object.freeze({ href: reference.href }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableKmsAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'kms.runtime';
  readonly domain = 'KMS' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;
  readonly #kms: HsmKmsProvider;
  readonly #handles = new Map<string, HsmKeyHandle>();

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport, kms?: HsmKmsProvider) {
    this.transport = transport;
    this.#kms = kms ?? createDevelopmentKmsSimulator();
  }

  createKey(session: ProviderSession): ProviderRuntimeResult<HsmKeyHandle> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    if (session.workloadIdentity === 'rpc' || session.workloadIdentity === 'explorer') {
      return runtimeErr('WORKLOAD_PRIVILEGE_DENIED', 'RPC cannot use governance KMS');
    }
    const created = this.#kms.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    if (!created.ok) {
      return runtimeErr(created.error.code, created.error.message);
    }
    this.#handles.set(created.value.handleId, created.value);
    return runtimeOk(created.value);
  }

  publicDescriptor(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#kms.getPublicDescriptor(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  sign(handle: HsmKeyHandle, digest: Buffer): ProviderRuntimeResult<unknown> {
    const result = this.#kms.signCanonicalDigest({
      handle,
      digest,
      purpose: handle.purpose,
      suiteId: handle.suiteId,
    });
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  verify(_handle: HsmKeyHandle): ProviderRuntimeResult<true> {
    return runtimeOk(true);
  }

  encrypt(plaintext: Buffer): ProviderRuntimeResult<{ readonly ciphertextDigest: string }> {
    return runtimeOk(Object.freeze({ ciphertextDigest: createHash('sha256').update(plaintext).digest('hex') }));
  }

  decrypt(ciphertextDigest: string): ProviderRuntimeResult<{ readonly recovered: true; readonly plaintextPresent: false }> {
    if (ciphertextDigest.length !== 64) {
      return runtimeErr('KMS_DECRYPT', 'ciphertext reference invalid');
    }
    return runtimeOk(Object.freeze({ recovered: true as const, plaintextPresent: false as const }));
  }

  rotate(handle: HsmKeyHandle): ProviderRuntimeResult<HsmKeyHandle> {
    const result = this.#kms.rotateKey(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  disable(handle: HsmKeyHandle): ProviderRuntimeResult<HsmKeyHandle> {
    const result = this.#kms.disableKey(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    const check = this.#kms.healthCheck();
    if (!check.ok) {
      return runtimeErr(check.error.code, check.error.message);
    }
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }

  metadata(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#kms.getProviderKeyVersion(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  attestation(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#kms.getAttestationMetadata(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  exportPrivateKey(): ProviderRuntimeResult<never> {
    return runtimeErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'no generic private-key export');
  }
}

export class ExecutableHsmAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'hsm.runtime';
  readonly domain = 'HSM' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;
  readonly #hsm: HsmKmsProvider;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport, hsm?: HsmKmsProvider) {
    this.transport = transport;
    this.#hsm = hsm ?? createDevelopmentHsmSimulator();
  }

  generateNonExportable(session: ProviderSession): ProviderRuntimeResult<HsmKeyHandle> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    if (session.workloadIdentity === 'oracle_collector') {
      return runtimeErr('WORKLOAD_PRIVILEGE_DENIED', 'oracle collector cannot use custody HSM');
    }
    const created = this.#hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    if (!created.ok) {
      return runtimeErr(created.error.code, created.error.message);
    }
    if (created.value.exportable !== false) {
      return runtimeErr('EXPORTABLE_KEY', 'HSM keys must be non-exportable');
    }
    return runtimeOk(created.value);
  }

  getPublicKey(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#hsm.getPublicDescriptor(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  sign(handle: HsmKeyHandle, digest: Buffer): ProviderRuntimeResult<unknown> {
    const result = this.#hsm.signCanonicalDigest({
      handle,
      digest,
      purpose: handle.purpose,
      suiteId: handle.suiteId,
    });
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  verify(): ProviderRuntimeResult<true> {
    return runtimeOk(true);
  }

  getAttestation(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#hsm.getAttestationMetadata(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  rotate(handle: HsmKeyHandle): ProviderRuntimeResult<HsmKeyHandle> {
    const result = this.#hsm.rotateKey(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  disable(handle: HsmKeyHandle): ProviderRuntimeResult<HsmKeyHandle> {
    const result = this.#hsm.disableKey(handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    const check = this.#hsm.healthCheck();
    if (!check.ok) {
      return runtimeErr(check.error.code, check.error.message);
    }
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }

  auditReference(handle: HsmKeyHandle): ProviderRuntimeResult<unknown> {
    const result = this.#hsm.recordAuditEvent('HSM_RUNTIME_OP', handle);
    return result.ok ? runtimeOk(result.value) : runtimeErr(result.error.code, result.error.message);
  }

  probePqc(): PqcCapabilityProbe {
    const caps = this.#hsm.capabilities();
    return probePqcCapability({
      providerId: this.#hsm.providerId,
      classicalSupported: caps.classical,
      mlDsaSupported: caps.algorithmFlags.includes('ML_DSA'),
      hybridSupported: caps.hybrid,
      hardwarePqEvidence: caps.hardwarePqReadiness === 'HARDWARE_PROVIDER_CONFIRMED',
    });
  }

  exportPrivateKey(): ProviderRuntimeResult<never> {
    return runtimeErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'no generic private-key export');
  }
}

export class ExecutableObjectStorageAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'storage.runtime';
  readonly domain = 'OBJECT_STORAGE' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;
  readonly #objects = new Map<string, { readonly digest: string; readonly version: number; readonly retention: string }>();

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  put(key: string, payload: string): ProviderRuntimeResult<{ readonly digest: string; readonly version: number }> {
    const digest = createHash('sha256').update(payload).digest('hex');
    const previous = this.#objects.get(key);
    const version = (previous?.version ?? 0) + 1;
    this.#objects.set(key, { digest, version, retention: 'backup-class' });
    return runtimeOk(Object.freeze({ digest, version }));
  }

  get(key: string): ProviderRuntimeResult<{ readonly digest: string; readonly version: number }> {
    const found = this.#objects.get(key);
    if (!found) {
      return runtimeErr('NOT_FOUND', `object ${key} missing`);
    }
    return runtimeOk(Object.freeze({ digest: found.digest, version: found.version }));
  }

  version(key: string): ProviderRuntimeResult<number> {
    const found = this.#objects.get(key);
    return found ? runtimeOk(found.version) : runtimeErr('NOT_FOUND', `object ${key} missing`);
  }

  verifyIntegrity(key: string, expected: string): ProviderRuntimeResult<true> {
    const found = this.#objects.get(key);
    if (!found || found.digest !== expected) {
      return runtimeErr('INTEGRITY', 'object digest mismatch');
    }
    return runtimeOk(true);
  }

  retention(key: string): ProviderRuntimeResult<string> {
    const found = this.#objects.get(key);
    return found ? runtimeOk(found.retention) : runtimeErr('NOT_FOUND', `object ${key} missing`);
  }

  delete(key: string, policyAllows: boolean): ProviderRuntimeResult<true> {
    if (!policyAllows) {
      return runtimeErr('DELETE_FORBIDDEN', 'delete blocked by retention policy');
    }
    this.#objects.delete(key);
    return runtimeOk(true);
  }

  listMetadata(): ProviderRuntimeResult<readonly string[]> {
    return runtimeOk(Object.freeze([...this.#objects.keys()]));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableDatabaseAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'database.runtime';
  readonly domain = 'DATABASE' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  validate(input: {
    readonly tlsMode: string;
    readonly credentialRef: SecretReference | null;
    readonly primary: boolean;
    readonly replicas: number;
    readonly pitr: boolean;
    readonly backup: boolean;
    readonly failoverMetadata: boolean;
    readonly monitoring: boolean;
    readonly consensusAuthority: boolean;
  }): ProviderRuntimeResult<{ readonly consensusAuthority: false }> {
    if (input.tlsMode !== 'verify-full') {
      return runtimeErr('TLS_VERIFY', 'PostgreSQL requires TLS verify-full');
    }
    if (!input.credentialRef) {
      return runtimeErr('CREDENTIAL_REFERENCE', 'database credential reference required');
    }
    if (!input.primary || input.replicas < 0 || !input.pitr || !input.backup || !input.failoverMetadata || !input.monitoring) {
      return runtimeErr('DATABASE_CONFIG', 'primary, PITR, backup, failover, and monitoring are required');
    }
    if (input.consensusAuthority) {
      return runtimeErr('NON_CONSENSUS', 'application PostgreSQL remains non-consensus authority');
    }
    return runtimeOk(Object.freeze({ consensusAuthority: false as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableDnsCertificateAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'dns-cert.runtime';
  readonly domain = 'DNS' as const;
  readonly providerType = 'LOCAL_INTEGRATION' as const;
  readonly #records = new Map<string, string>();

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  upsertRecord(name: string, value: string): ProviderRuntimeResult<true> {
    this.#records.set(name, value);
    return runtimeOk(true);
  }

  requestCertificate(hostname: string): ProviderRuntimeResult<{ readonly status: 'PENDING'; readonly hostname: string; readonly privateKeyPresent: false }> {
    return runtimeOk(Object.freeze({ status: 'PENDING' as const, hostname, privateKeyPresent: false as const }));
  }

  certificateStatus(): ProviderRuntimeResult<'ISSUED_SIMULATION'> {
    return runtimeOk('ISSUED_SIMULATION');
  }

  renewalMetadata(): ProviderRuntimeResult<{ readonly nextRenewalUtc: string | null }> {
    return runtimeOk(Object.freeze({ nextRenewalUtc: null }));
  }

  validateTlsEndpoint(hostname: string): ProviderRuntimeResult<{ readonly hostname: string; readonly validated: true }> {
    return runtimeOk(Object.freeze({ hostname, validated: true as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: session.domain === 'CERTIFICATE_MANAGER' ? 'CERTIFICATE_MANAGER' : 'DNS', operation: 'health' });
  }
}

export class ExecutableOracleAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'oracle.runtime';
  readonly domain = 'ORACLE_DATA_SOURCE' as const;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  collect(
    session: ProviderSession,
    schema: FeedSchemaDefinition,
    record: ExternalSourceRecord,
    authOk: boolean,
  ): ProviderRuntimeResult<ExternalSourceRecord> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    if (session.workloadIdentity === 'consensus_execution') {
      return runtimeErr('CONSENSUS_EGRESS_FORBIDDEN', 'consensus never calls external provider APIs');
    }
    if (!authOk) {
      return runtimeErr('AUTH_FAILED', 'oracle source authentication failed');
    }
    const fetched = this.transport.execute({
      domain: this.domain,
      operation: 'collect',
      schemaVersion: record.schemaVersion,
      body: Object.freeze({ sourceIdentity: record.identifier }),
    });
    if (!fetched.ok) {
      return fetched;
    }
    const validated = validateExternalRecord(schema, record);
    if (!validated.ok) {
      return runtimeErr(validated.error.code, validated.error.detail);
    }
    if (!record.sourceTimestampUnix || !record.unit || !record.identifier) {
      return runtimeErr('ORACLE_SCHEMA', 'schema version, units, timestamp, and source identity are required');
    }
    return runtimeOk(validated.value);
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableKycAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'kyc.runtime';
  readonly domain = 'IDENTITY_KYC' as const;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  verify(
    session: ProviderSession,
    input: { readonly subjectRef: string; readonly actorId: string; readonly jurisdiction: string },
  ): ProviderRuntimeResult<{ readonly facts: IdentityFacts; readonly vendorCannotAuthorize: true }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    if (session.workloadIdentity === 'explorer') {
      return runtimeErr('WORKLOAD_PRIVILEGE_DENIED', 'Explorer cannot use KYC credential');
    }
    const fetched = this.transport.execute({ domain: this.domain, operation: 'verify' });
    if (!fetched.ok) {
      return fetched;
    }
    const facts: IdentityFacts = Object.freeze({
      identityExists: true,
      identityStatus: 'ACTIVE',
      subjectId: input.subjectRef,
      actorId: input.actorId,
      actorSubjectMatch: true,
      authenticated: true,
      sessionValid: true,
      authenticationAssurance: 'HIGH_ASSURANCE',
      kycState: 'VERIFIED',
      kycLevel: 'STANDARD',
      kycFresh: true,
      kycVersion: 1,
      customerId: null,
      authorizedCapabilities: Object.freeze([]),
    });
    return runtimeOk(Object.freeze({ facts, vendorCannotAuthorize: true as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableScreeningAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'screening.runtime';
  readonly domain: ProviderDomain;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport, domain: 'SANCTIONS_PEP' | 'AML_TRANSACTION_MONITORING' = 'SANCTIONS_PEP') {
    this.transport = transport;
    this.domain = domain;
  }

  screen(session: ProviderSession, subjectRef: string): ProviderRuntimeResult<{ readonly hit: false; readonly policyDecision: 'KERNEL'; readonly vendorDecisionIsNotGuilt: true }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    const fetched = this.transport.execute({ domain: this.domain, operation: 'screen', body: Object.freeze({ subjectRef }) });
    if (!fetched.ok) {
      return fetched;
    }
    return runtimeOk(Object.freeze({ hit: false as const, policyDecision: 'KERNEL' as const, vendorDecisionIsNotGuilt: true as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableTravelRuleAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'travel-rule.runtime';
  readonly domain = 'TRAVEL_RULE' as const;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  discover(session: ProviderSession, address: string): ProviderRuntimeResult<{ readonly discovered: boolean; readonly sensitivePayloadPresent: false }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    const fetched = this.transport.execute({ domain: this.domain, operation: 'discover', body: Object.freeze({ address }) });
    if (!fetched.ok) {
      return fetched;
    }
    return runtimeOk(Object.freeze({ discovered: true, sensitivePayloadPresent: false as const }));
  }

  createMessage(session: ProviderSession, idempotencyKey: string): ProviderRuntimeResult<{ readonly providerTransactionRef: string; readonly state: 'PENDING' }> {
    const fetched = this.transport.execute({
      domain: this.domain,
      operation: 'create',
      idempotencyKey,
    });
    if (!fetched.ok) {
      return fetched;
    }
    return runtimeOk(Object.freeze({
      providerTransactionRef: fetched.value.providerTransactionRef ?? 'tr_ref',
      state: 'PENDING' as const,
    }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableSurveillanceAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'surveillance.runtime';
  readonly domain = 'MARKET_SURVEILLANCE' as const;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  exportDetection(session: ProviderSession, detectionId: string): ProviderRuntimeResult<{ readonly exported: true; readonly legalGuilt: false }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    const fetched = this.transport.execute({ domain: this.domain, operation: 'export', body: Object.freeze({ detectionId }) });
    if (!fetched.ok) {
      return fetched;
    }
    return runtimeOk(Object.freeze({ exported: true as const, legalGuilt: false as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableCaseManagementAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'cases.runtime';
  readonly domain = 'CASE_MANAGEMENT' as const;
  readonly providerType = 'REGULATED' as const;
  readonly #cases = new Map<string, { readonly state: string; readonly assignee: string | null }>();

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  createCase(session: ProviderSession, caseId: string): ProviderRuntimeResult<{ readonly caseId: string }> {
    const gate = requireSession(session, this.domain, session.workloadIdentity);
    if (!gate.ok) {
      return gate;
    }
    if (session.workloadIdentity === 'validator_signer') {
      return runtimeErr('WORKLOAD_PRIVILEGE_DENIED', 'case-management worker cannot use validator signer');
    }
    this.#cases.set(caseId, { state: 'OPEN', assignee: null });
    return runtimeOk(Object.freeze({ caseId }));
  }

  attachEvidenceReference(caseId: string, evidenceRef: string, authorized: boolean): ProviderRuntimeResult<true> {
    if (!authorized) {
      return runtimeErr('EVIDENCE_SCOPE', 'do not expose raw restricted evidence to unauthorized services');
    }
    if (!this.#cases.has(caseId) || !evidenceRef.startsWith('ev_')) {
      return runtimeErr('EVIDENCE_REF', 'evidence reference required');
    }
    return runtimeOk(true);
  }

  assignReviewer(caseId: string, reviewer: string): ProviderRuntimeResult<true> {
    const current = this.#cases.get(caseId);
    if (!current) {
      return runtimeErr('NOT_FOUND', caseId);
    }
    this.#cases.set(caseId, { ...current, assignee: reviewer });
    return runtimeOk(true);
  }

  updateState(caseId: string, state: string): ProviderRuntimeResult<true> {
    const current = this.#cases.get(caseId);
    if (!current) {
      return runtimeErr('NOT_FOUND', caseId);
    }
    this.#cases.set(caseId, { ...current, state });
    return runtimeOk(true);
  }

  status(caseId: string): ProviderRuntimeResult<string> {
    const current = this.#cases.get(caseId);
    return current ? runtimeOk(current.state) : runtimeErr('NOT_FOUND', caseId);
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableCustodyAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'custody.runtime';
  readonly domain = 'CUSTODY_PROVIDER' as const;
  readonly providerType = 'REGULATED' as const;
  readonly #submitted = new Map<string, string>();

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  vaultReference(): ProviderRuntimeResult<{ readonly vaultRef: string; readonly nativeBalanceLedger: false }> {
    return runtimeOk(Object.freeze({ vaultRef: 'vault_sim_1', nativeBalanceLedger: false as const }));
  }

  depositReference(idempotencyKey: string): ProviderRuntimeResult<{ readonly providerTransactionRef: string }> {
    return this.#financial(idempotencyKey, 'deposit');
  }

  withdrawalInstruction(idempotencyKey: string): ProviderRuntimeResult<{ readonly providerTransactionRef: string; readonly state: 'SUBMITTED' | 'SUBMISSION_UNKNOWN' }> {
    return this.#financial(idempotencyKey, 'withdraw');
  }

  #financial(idempotencyKey: string, operation: string): ProviderRuntimeResult<{ readonly providerTransactionRef: string; readonly state: 'SUBMITTED' }> {
    const existing = this.#submitted.get(idempotencyKey);
    if (existing) {
      return runtimeOk(Object.freeze({ providerTransactionRef: existing, state: 'SUBMITTED' as const }));
    }
    const fetched = this.transport.execute({
      domain: this.domain,
      operation,
      idempotencyKey,
    });
    if (!fetched.ok) {
      return runtimeErr('SUBMISSION_UNKNOWN', 'financial instruction left SUBMISSION_UNKNOWN');
    }
    const ref = fetched.value.providerTransactionRef ?? `cust_${idempotencyKey}`;
    this.#submitted.set(idempotencyKey, ref);
    return runtimeOk(Object.freeze({ providerTransactionRef: ref, state: 'SUBMITTED' as const }));
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export class ExecutableBankingAdapter implements ExecutableProviderAdapter {
  readonly adapterId = 'banking.runtime';
  readonly domain = 'BANKING_REFERENCE' as const;
  readonly providerType = 'REGULATED' as const;

  readonly transport: ProviderTransport;

  constructor(transport: ProviderTransport) {
    this.transport = transport;
  }

  accountReference(): ProviderRuntimeResult<{ readonly accountRef: string }> {
    return runtimeOk(Object.freeze({ accountRef: 'bank_ref_sim' }));
  }

  paymentInstruction(idempotencyKey: string): ProviderRuntimeResult<{ readonly paymentRef: string }> {
    const fetched = this.transport.execute({ domain: this.domain, operation: 'pay', idempotencyKey });
    if (!fetched.ok) {
      return fetched;
    }
    return runtimeOk(Object.freeze({ paymentRef: fetched.value.providerTransactionRef ?? 'pay_ref' }));
  }

  createLedgerBalance(): ProviderRuntimeResult<never> {
    return runtimeErr('BANK_CANNOT_CREATE_LEDGER', 'bank adapter cannot create Ledger balance directly');
  }

  health(session: ProviderSession): ProviderRuntimeResult<MockResponse> {
    return this.transport.execute({ domain: this.domain, operation: 'health' });
  }
}

export function openBoundSession(input: {
  readonly sessionId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly environment: ProviderRuntimeMode;
  readonly workloadIdentity: WorkloadIdentity;
  readonly credentialHref?: string;
}): ProviderRuntimeResult<ProviderSession> {
  let credentialRef = null as SecretReference | null;
  if (input.credentialHref) {
    const binding = bindCredential({
      bindingId: `${input.sessionId}_bind`,
      providerId: input.providerId,
      domain: input.domain,
      credentialHref: input.credentialHref,
      workloadIdentity: input.workloadIdentity,
    });
    if (!binding.ok) {
      return binding;
    }
    credentialRef = binding.value.credentialRef;
  }
  return openProviderSession({
    sessionId: input.sessionId,
    providerId: input.providerId,
    domain: input.domain,
    environment: input.environment,
    credentialRef,
    workloadIdentity: input.workloadIdentity,
    capabilities: Object.freeze([input.domain]),
    configuration: Object.freeze({ providerId: input.providerId, domain: input.domain }),
  });
}
