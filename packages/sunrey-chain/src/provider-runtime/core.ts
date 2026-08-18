/**
 * Session, least privilege, egress, retries, circuit breakers,
 * webhook security, PQC probing, and secret-exclusion helpers.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { parseSecretReference, type SecretReference, type SecretProvider } from '../../../security/src/secrets.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import type { ProviderDomain } from '../providers/types.ts';
import {
  CONSENSUS_ARBITRARY_EGRESS_FORBIDDEN,
  evaluateNetworkPath,
  type NetworkPolicyDecision,
} from '../infra/network.ts';
import type { NetworkZone } from '../infra/types.ts';
import { PROVIDER_DOMAINS } from '../providers/types.ts';
import {
  CONSENSUS_HAS_NO_PROVIDER_EGRESS,
  PROVIDER_CIRCUIT_STATES,
  runtimeErr,
  runtimeOk,
  type FinancialSubmissionState,
  type PqcCapabilityProbe,
  type ProviderCircuitState,
  type ProviderCredentialBinding,
  type ProviderRuntimeMode,
  type ProviderRuntimeResult,
  type ProviderSession,
  type ProviderWebhookEnvelope,
  type ReportedRuntimeMode,
  type WorkloadIdentity,
} from './types.ts';

export const FORBIDDEN_SECRET_KEYS = Object.freeze([
  'secret',
  'password',
  'apiKey',
  'api_key',
  'token',
  'privateKey',
  'private_key',
  'credential',
  'plaintext',
]);

const WORKLOAD_ALLOWED_DOMAINS: Readonly<Record<WorkloadIdentity, readonly ProviderDomain[]>> = Object.freeze({
  oracle_collector: Object.freeze(['ORACLE_DATA_SOURCE']),
  explorer: Object.freeze(['OBJECT_STORAGE', 'DNS', 'CERTIFICATE_MANAGER']),
  rpc: Object.freeze(['OBJECT_STORAGE', 'DNS', 'CERTIFICATE_MANAGER', 'DATABASE']),
  case_management: Object.freeze(['CASE_MANAGEMENT', 'MARKET_SURVEILLANCE']),
  kyc_worker: Object.freeze(['IDENTITY_KYC']),
  screening_worker: Object.freeze(['SANCTIONS_PEP', 'AML_TRANSACTION_MONITORING']),
  travel_rule_worker: Object.freeze(['TRAVEL_RULE']),
  surveillance_worker: Object.freeze(['MARKET_SURVEILLANCE', 'CASE_MANAGEMENT']),
  custody_worker: Object.freeze(['CUSTODY_PROVIDER']),
  banking_worker: Object.freeze(['BANKING_REFERENCE']),
  infra_worker: Object.freeze([
    'CLOUD_INFRASTRUCTURE',
    'SECRET_MANAGER',
    'DATABASE',
    'OBJECT_STORAGE',
    'DNS',
    'CERTIFICATE_MANAGER',
    'OTHER_GOVERNED_EXTERNAL_PROVIDER',
  ]),
  kms_worker: Object.freeze(['KMS']),
  hsm_worker: Object.freeze(['HSM']),
  validator_signer: Object.freeze(['HSM']),
  consensus_execution: Object.freeze([]),
  governance_kms: Object.freeze(['KMS']),
});

const WORKLOAD_ZONE: Readonly<Record<WorkloadIdentity, NetworkZone>> = Object.freeze({
  oracle_collector: 'OPERATIONS_PRIVATE',
  explorer: 'PUBLIC_EDGE',
  rpc: 'PUBLIC_RPC',
  case_management: 'DATA_PRIVATE',
  kyc_worker: 'DATA_PRIVATE',
  screening_worker: 'DATA_PRIVATE',
  travel_rule_worker: 'DATA_PRIVATE',
  surveillance_worker: 'DATA_PRIVATE',
  custody_worker: 'CUSTODY_PRIVATE',
  banking_worker: 'DATA_PRIVATE',
  infra_worker: 'OPERATIONS_PRIVATE',
  kms_worker: 'SIGNER_PRIVATE',
  hsm_worker: 'SIGNER_PRIVATE',
  validator_signer: 'SIGNER_PRIVATE',
  consensus_execution: 'VALIDATOR_PRIVATE',
  governance_kms: 'SIGNER_PRIVATE',
});

export function digestJson(value: unknown): string {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, inner) => {
        if (typeof inner === 'bigint') {
          return inner.toString();
        }
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          const sorted: Record<string, unknown> = {};
          for (const key of Object.keys(inner as Record<string, unknown>).sort()) {
            sorted[key] = (inner as Record<string, unknown>)[key];
          }
          return sorted;
        }
        return inner;
      }),
    )
    .digest('hex');
}

export function assertNoSecretMaterial(value: unknown, path = 'root'): void {
  if (value instanceof SecretValue) {
    throw new TypeError(`SecretValue excluded from ${path}`);
  }
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    if (value.startsWith('secret://')) {
      return;
    }
    if (/^[A-Za-z0-9+/=]{40,}$/.test(value) && !/^[0-9a-f]{64}$/.test(value)) {
      throw new TypeError(`possible secret material excluded from ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretMaterial(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_SECRET_KEYS.includes(key)) {
        throw new TypeError(`secret key ${key} excluded from ${path}`);
      }
      assertNoSecretMaterial(inner, `${path}.${key}`);
    }
  }
}

export function allowedDomainsFor(workload: WorkloadIdentity): readonly ProviderDomain[] {
  return WORKLOAD_ALLOWED_DOMAINS[workload];
}

export function authorizeWorkload(
  workload: WorkloadIdentity,
  domain: ProviderDomain,
): ProviderRuntimeResult<true> {
  if (workload === 'consensus_execution' || CONSENSUS_HAS_NO_PROVIDER_EGRESS === false) {
    return runtimeErr('CONSENSUS_EGRESS_FORBIDDEN', 'consensus execution has no general provider egress');
  }
  const allowed = WORKLOAD_ALLOWED_DOMAINS[workload];
  if (!allowed.includes(domain)) {
    return runtimeErr(
      'WORKLOAD_PRIVILEGE_DENIED',
      `${workload} cannot use ${domain}`,
    );
  }
  return runtimeOk(true);
}

export function authorizeCredentialBinding(
  binding: ProviderCredentialBinding,
  requestedDomain: ProviderDomain,
  requestedWorkload: WorkloadIdentity,
): ProviderRuntimeResult<true> {
  if (binding.workloadIdentity !== requestedWorkload) {
    return runtimeErr('WRONG_WORKLOAD_CREDENTIAL', 'credential binding is not for this workload');
  }
  if (!binding.allowedDomains.includes(requestedDomain)) {
    return runtimeErr('WRONG_WORKLOAD_CREDENTIAL', 'credential binding does not cover this domain');
  }
  return authorizeWorkload(requestedWorkload, requestedDomain);
}

export function bindCredential(input: {
  readonly bindingId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly credentialHref: string;
  readonly workloadIdentity: WorkloadIdentity;
}): ProviderRuntimeResult<ProviderCredentialBinding> {
  const parsed = parseSecretReference(input.credentialHref);
  if (!parsed.ok) {
    return runtimeErr(parsed.error.code, parsed.error.message);
  }
  const allowed = allowedDomainsFor(input.workloadIdentity);
  if (!allowed.includes(input.domain)) {
    return runtimeErr('WORKLOAD_PRIVILEGE_DENIED', `${input.workloadIdentity} cannot bind ${input.domain}`);
  }
  return runtimeOk(
    Object.freeze({
      bindingId: input.bindingId,
      providerId: input.providerId,
      domain: input.domain,
      credentialRef: parsed.value,
      workloadIdentity: input.workloadIdentity,
      allowedDomains: allowed,
      leastPrivilege: true as const,
      rawCredentialPresent: false as const,
    }),
  );
}

export function openProviderSession(input: {
  readonly sessionId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly environment: ProviderRuntimeMode;
  readonly credentialRef: SecretReference | null;
  readonly workloadIdentity: WorkloadIdentity;
  readonly capabilities: readonly string[];
  readonly configuration: unknown;
}): ProviderRuntimeResult<ProviderSession> {
  const privilege = authorizeWorkload(input.workloadIdentity, input.domain);
  if (!privilege.ok) {
    return privilege;
  }
  const configurationHash = digestJson(input.configuration);
  const session: ProviderSession = Object.freeze({
    sessionId: input.sessionId,
    providerId: input.providerId,
    domain: input.domain,
    environment: input.environment,
    credentialRef: input.credentialRef,
    workloadIdentity: input.workloadIdentity,
    capabilities: Object.freeze([...input.capabilities]),
    configurationHash,
    networkRestrictions: Object.freeze([`zone:${WORKLOAD_ZONE[input.workloadIdentity]}`]),
    networkZone: WORKLOAD_ZONE[input.workloadIdentity],
    sessionMetadata: Object.freeze({ schema: '1' }),
    rawCredentialPresent: false as const,
  });
  assertNoSecretMaterial(session);
  return runtimeOk(session);
}

export function evaluateProviderEgress(
  workload: WorkloadIdentity,
  from: NetworkZone = WORKLOAD_ZONE[workload],
  to: NetworkZone = 'PUBLIC_EDGE',
): NetworkPolicyDecision {
  if (workload === 'consensus_execution' || CONSENSUS_ARBITRARY_EGRESS_FORBIDDEN) {
    if (workload === 'consensus_execution') {
      return Object.freeze({
        allowed: false,
        from,
        to,
        reason: 'consensus execution has no general provider egress',
      });
    }
  }
  const approvedOffChain: readonly WorkloadIdentity[] = [
    'oracle_collector',
    'kyc_worker',
    'screening_worker',
    'travel_rule_worker',
    'surveillance_worker',
    'case_management',
    'custody_worker',
    'banking_worker',
    'infra_worker',
  ];
  if (!approvedOffChain.includes(workload) && (from === 'VALIDATOR_PRIVATE' || from === 'SIGNER_PRIVATE')) {
    return Object.freeze({
      allowed: false,
      from,
      to,
      reason: `${workload} is not an approved off-chain provider workload`,
    });
  }
  return evaluateNetworkPath(from, to);
}

export type RetryDecision = {
  readonly retry: boolean;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly financialState: FinancialSubmissionState | null;
};

export function decideProviderRetry(input: {
  readonly attempt: number;
  readonly maxAttempts?: number;
  readonly financial: boolean;
  readonly lastState?: FinancialSubmissionState | null;
  readonly transient: boolean;
}): RetryDecision {
  const maxAttempts = input.maxAttempts ?? 3;
  if (input.financial) {
    if (input.lastState === 'SUBMITTED' || input.lastState === 'SUBMISSION_UNKNOWN') {
      return Object.freeze({
        retry: false,
        attempt: input.attempt,
        maxAttempts,
        financialState: 'SUBMISSION_UNKNOWN',
      });
    }
    if (input.lastState === 'CONFIRMED') {
      return Object.freeze({
        retry: false,
        attempt: input.attempt,
        maxAttempts,
        financialState: 'CONFIRMED',
      });
    }
  }
  return Object.freeze({
    retry: input.transient && input.attempt < maxAttempts,
    attempt: input.attempt,
    maxAttempts,
    financialState: input.financial ? (input.lastState ?? 'NOT_SUBMITTED') : null,
  });
}

export class ProviderCircuitBreaker {
  #failures = 0;
  #state: ProviderCircuitState = 'HEALTHY';
  readonly #openAfter: number;

  constructor(openAfter = 3) {
    this.#openAfter = openAfter;
  }

  record(state: ProviderCircuitState): ProviderCircuitState {
    if (!(PROVIDER_CIRCUIT_STATES as readonly string[]).includes(state)) {
      throw new TypeError(`unknown circuit state ${state}`);
    }
    if (state === 'HEALTHY') {
      this.#failures = 0;
      this.#state = 'HEALTHY';
      return this.#state;
    }
    this.#failures += 1;
    if (state === 'AUTH_FAILED' || state === 'SCHEMA_INCOMPATIBLE' || state === 'RATE_LIMITED') {
      this.#state = state;
      return this.#state;
    }
    this.#state = this.#failures >= this.#openAfter ? 'UNAVAILABLE' : state;
    return this.#state;
  }

  state(): ProviderCircuitState {
    return this.#state;
  }

  allowRequest(): boolean {
    return this.#state === 'HEALTHY' || this.#state === 'DEGRADED';
  }
}

export class WebhookReplayGuard {
  readonly #seen = new Map<string, string>();
  #rejections = 0;

  accept(envelope: ProviderWebhookEnvelope, expectedSecret: SecretValue, nowUtc: string): ProviderRuntimeResult<true> {
    if (!envelope.providerIdentity || envelope.providerIdentity !== envelope.providerId) {
      return runtimeErr('WEBHOOK_IDENTITY', 'provider identity mismatch');
    }
    const ageMs = Date.parse(nowUtc) - Date.parse(envelope.timestampUtc);
    if (!Number.isFinite(ageMs) || Math.abs(ageMs) > 300_000) {
      return runtimeErr('WEBHOOK_TIMESTAMP', 'webhook timestamp outside replay window');
    }
    const key = `${envelope.providerId}:${envelope.nonce}:${envelope.reference}`;
    if (this.#seen.has(key)) {
      this.#rejections += 1;
      return runtimeErr('WEBHOOK_REPLAY', 'replayed webhook rejected');
    }
    if (envelope.signature) {
      const expected = createHmac('sha256', expectedSecret.reveal())
        .update(`${envelope.providerId}|${envelope.timestampUtc}|${envelope.nonce}|${envelope.reference}|${envelope.payloadDigest}`)
        .digest('hex');
      const left = Buffer.from(envelope.signature, 'hex');
      const right = Buffer.from(expected, 'hex');
      if (left.length !== right.length || !timingSafeEqual(left, right)) {
        return runtimeErr('WEBHOOK_SIGNATURE', 'wrong provider signature rejected');
      }
    }
    if (envelope.schemaVersion !== 1) {
      return runtimeErr('WEBHOOK_SCHEMA', 'schema change detected');
    }
    this.#seen.set(key, envelope.payloadDigest);
    return runtimeOk(true);
  }

  replayRejections(): number {
    return this.#rejections;
  }
}

export function signWebhook(
  envelope: Omit<ProviderWebhookEnvelope, 'signature'>,
  secret: SecretValue,
): ProviderWebhookEnvelope {
  const signature = createHmac('sha256', secret.reveal())
    .update(`${envelope.providerId}|${envelope.timestampUtc}|${envelope.nonce}|${envelope.reference}|${envelope.payloadDigest}`)
    .digest('hex');
  return Object.freeze({ ...envelope, signature });
}

export function probePqcCapability(input: {
  readonly providerId: string;
  readonly classicalSupported: boolean;
  readonly mlDsaSupported: boolean;
  readonly hybridSupported: boolean;
  readonly hardwarePqEvidence: boolean;
}): PqcCapabilityProbe {
  return Object.freeze({
    providerId: input.providerId,
    classical: input.classicalSupported ? 'CLASSICAL_SUPPORTED' : null,
    mlDsa: input.mlDsaSupported ? 'ML_DSA_SUPPORTED' : null,
    hybrid: input.hybridSupported ? 'HYBRID_PATTERN_SUPPORTED' : null,
    hardwarePq: input.hardwarePqEvidence ? 'HARDWARE_PQ_SUPPORTED' : 'UNKNOWN',
    softwarePqCannotClaimHardware: true as const,
    inferredHardware: false as const,
  });
}

export function resolveRuntimeMode(input: {
  readonly requested?: ProviderRuntimeMode;
  readonly sandboxCredentialPresent: boolean;
  readonly externalEvidencePresent: boolean;
  readonly humanAuthorityPresent: boolean;
}): ProviderRuntimeResult<ProviderRuntimeMode> {
  const requested = input.requested ?? (input.sandboxCredentialPresent ? 'SANDBOX' : 'LOCAL_SIMULATION');
  if (requested === 'PRODUCTION_AUTHORIZED') {
    if (!input.externalEvidencePresent || !input.humanAuthorityPresent) {
      return runtimeErr(
        'PRODUCTION_NOT_AUTHORIZED',
        'PRODUCTION_AUTHORIZED requires configured evidence and human authority',
      );
    }
  }
  return runtimeOk(requested);
}

export function reportedModeFor(mode: ProviderRuntimeMode, sandboxCredentialPresent: boolean): ReportedRuntimeMode {
  if (mode === 'SANDBOX' && sandboxCredentialPresent) {
    return 'SANDBOX';
  }
  if (mode === 'INTEGRATION_TEST' && sandboxCredentialPresent) {
    return 'EXTERNAL_INTEGRATION_TEST';
  }
  return 'LOCAL_SIMULATION';
}

export function resolveAssignedSecret(
  secrets: SecretProvider,
  reference: SecretReference,
): ProviderRuntimeResult<SecretValue> {
  const resolved = secrets.resolve(reference);
  if (!resolved.ok) {
    return runtimeErr(resolved.error.code, resolved.error.message);
  }
  return runtimeOk(resolved.value);
}

export function knownProviderDomains(): readonly ProviderDomain[] {
  return PROVIDER_DOMAINS;
}
