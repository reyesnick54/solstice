/**
 * In-memory provider control-plane store. Critical lifecycle state is
 * snapshotted for durable persistence; this module does not talk to disk.
 */

import { parseSecretReference } from '../../../../security/src/secrets.ts';
import { validateDeclaredCapabilities } from './capabilities.ts';
import { emptyHealth } from './control.ts';
import {
  DEFAULT_CIRCUIT_COOLDOWN_MS,
  DEFAULT_CIRCUIT_FAILURES,
  DEFAULT_TIMEOUT_MS,
  EMPTY_UNIVERSAL_SNAPSHOT,
  isProviderCategory,
  isProviderEnvironment,
  universalErr,
  universalOk,
  type KillSwitchRecord,
  type LimitedLiveRule,
  type ProviderCertificationRecord,
  type ProviderCredentialRef,
  type ProviderEnvironment,
  type ProviderEvidenceRecord,
  type ProviderHealthRecord,
  type ProviderRegistration,
  type RegisterProviderInput,
  type RoutingDecision,
  type UniversalProviderSnapshot,
  type UniversalResult,
} from './types.ts';

const FORBIDDEN_SECRET_KEYS = ['secret', 'password', 'apiKey', 'api_key', 'token', 'privateKey', 'pan', 'cvv'];

export function redactSecrets(value: unknown, path = 'root'): void {
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
    value.forEach((item, index) => redactSecrets(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_SECRET_KEYS.includes(key)) {
        throw new TypeError(`secret key ${key} excluded from ${path}`);
      }
      redactSecrets(inner, `${path}.${key}`);
    }
  }
}

export function createCredentialRef(input: {
  readonly providerId: string;
  readonly secretHref: string;
  readonly keyVersion: string;
  readonly environment: ProviderEnvironment;
}): UniversalResult<ProviderCredentialRef> {
  const parsed = parseSecretReference(input.secretHref);
  if (!parsed.ok) {
    return universalErr('PROVIDER_CONFIGURATION_ERROR', parsed.error.message, {
      providerId: input.providerId,
    });
  }
  return universalOk(
    Object.freeze({
      providerId: input.providerId,
      secretReference: parsed.value,
      keyVersion: input.keyVersion,
      environment: input.environment,
      rawCredentialPresent: false as const,
    }),
  );
}

export class InMemoryUniversalProviderStore {
  #registrations = new Map<string, ProviderRegistration>();
  #health = new Map<string, ProviderHealthRecord>();
  #certifications = new Map<string, ProviderCertificationRecord>();
  #killSwitches = new Map<string, KillSwitchRecord>();
  #limitedLive = new Map<string, LimitedLiveRule>();
  #evidence: ProviderEvidenceRecord[] = [];
  #routing: RoutingDecision[] = [];

  register(input: RegisterProviderInput): UniversalResult<ProviderRegistration> {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.providerId)) {
      return universalErr('PROVIDER_CONFIGURATION_ERROR', 'providerId is invalid');
    }
    if (!isProviderCategory(input.providerType) || !isProviderEnvironment(input.environment)) {
      return universalErr('PROVIDER_CONFIGURATION_ERROR', 'category or environment is invalid', {
        providerId: input.providerId,
      });
    }
    if (this.#registrations.has(input.providerId)) {
      return universalErr('PROVIDER_CONFIGURATION_ERROR', 'providerId is already registered', {
        providerId: input.providerId,
      });
    }
    const capabilities = validateDeclaredCapabilities(input.providerType, input.capabilities);
    if (!capabilities) {
      return universalErr(
        'PROVIDER_CONFIGURATION_ERROR',
        'capabilities must be declared and belong to the provider category',
        { providerId: input.providerId },
      );
    }
    if (input.credentialReference && input.credentialReference.rawCredentialPresent !== false) {
      return universalErr('PROVIDER_CREDENTIAL_REDACTED', 'plaintext credentials are forbidden', {
        providerId: input.providerId,
      });
    }
    if (input.credentialReference && input.credentialReference.environment !== input.environment) {
      return universalErr(
        'PROVIDER_ENVIRONMENT_MISMATCH',
        'credential environment must match provider environment',
        { providerId: input.providerId },
      );
    }
    const registration: ProviderRegistration = Object.freeze({
      providerId: input.providerId,
      providerType: input.providerType,
      displayName: input.displayName,
      adapterId: input.adapterId,
      capabilities,
      environment: input.environment,
      lifecycleState: input.lifecycleState ?? 'DISABLED',
      enabledJurisdictions: Object.freeze([...(input.enabledJurisdictions ?? [])]),
      supportedCurrencies: Object.freeze([...(input.supportedCurrencies ?? [])]),
      supportedProducts: Object.freeze([...(input.supportedProducts ?? [])]),
      credentialReference: input.credentialReference ?? null,
      webhookConfiguration: input.webhookConfiguration
        ? Object.freeze({ ...input.webhookConfiguration })
        : null,
      healthPolicy: Object.freeze({
        timeoutMs: input.healthPolicy?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        openAfterFailures: input.healthPolicy?.openAfterFailures ?? DEFAULT_CIRCUIT_FAILURES,
        cooldownMs: input.healthPolicy?.cooldownMs ?? DEFAULT_CIRCUIT_COOLDOWN_MS,
        rateLimitPerMinute: input.healthPolicy?.rateLimitPerMinute ?? null,
      }),
      routingPriority: input.routingPriority ?? 100,
      certificationState: 'UNTESTED',
      createdAt: input.nowUtc,
      updatedAt: input.nowUtc,
      revision: 1,
      rawCredentialPresent: false as const,
    });
    redactSecrets(registration);
    this.#registrations.set(registration.providerId, registration);
    this.#health.set(registration.providerId, emptyHealth(registration.providerId, input.nowUtc));
    return universalOk(registration);
  }

  get(providerId: string): ProviderRegistration | null {
    return this.#registrations.get(providerId) ?? null;
  }

  list(): readonly ProviderRegistration[] {
    return Object.freeze([...this.#registrations.values()]);
  }

  replace(registration: ProviderRegistration): ProviderRegistration {
    redactSecrets(registration);
    this.#registrations.set(registration.providerId, registration);
    return registration;
  }

  healthOf(providerId: string): ProviderHealthRecord | null {
    return this.#health.get(providerId) ?? null;
  }

  putHealth(record: ProviderHealthRecord): ProviderHealthRecord {
    this.#health.set(record.providerId, record);
    return record;
  }

  putCertification(record: ProviderCertificationRecord): ProviderCertificationRecord {
    this.#certifications.set(record.certificationId, record);
    const provider = this.#registrations.get(record.providerId);
    if (provider) {
      this.#registrations.set(record.providerId, Object.freeze({
        ...provider,
        certificationState: record.distinction,
        updatedAt: record.testDateUtc,
        revision: provider.revision + 1,
      }));
    }
    return record;
  }

  certificationsFor(providerId: string): readonly ProviderCertificationRecord[] {
    return Object.freeze([...this.#certifications.values()].filter((row) => row.providerId === providerId));
  }

  putKillSwitch(record: KillSwitchRecord): KillSwitchRecord {
    this.#killSwitches.set(record.switchId, record);
    return record;
  }

  killSwitches(): readonly KillSwitchRecord[] {
    return Object.freeze([...this.#killSwitches.values()]);
  }

  putLimitedLive(rule: LimitedLiveRule): LimitedLiveRule {
    this.#limitedLive.set(rule.ruleId, rule);
    return rule;
  }

  limitedLiveRules(): readonly LimitedLiveRule[] {
    return Object.freeze([...this.#limitedLive.values()]);
  }

  appendEvidence(record: ProviderEvidenceRecord): ProviderEvidenceRecord {
    redactSecrets(record);
    this.#evidence.push(record);
    return record;
  }

  evidence(): readonly ProviderEvidenceRecord[] {
    return Object.freeze([...this.#evidence]);
  }

  appendRouting(decision: RoutingDecision): RoutingDecision {
    this.#routing.push(decision);
    return decision;
  }

  snapshot(): UniversalProviderSnapshot {
    return Object.freeze({
      ...EMPTY_UNIVERSAL_SNAPSHOT,
      registrations: this.list(),
      health: Object.freeze([...this.#health.values()]),
      certifications: Object.freeze([...this.#certifications.values()]),
      killSwitches: this.killSwitches(),
      limitedLiveRules: this.limitedLiveRules(),
      evidence: this.evidence(),
      routingDecisions: Object.freeze([...this.#routing]),
    });
  }

  restore(snapshot: UniversalProviderSnapshot): void {
    if (snapshot.secretsForbidden !== true || snapshot.productionActive !== false) {
      throw new TypeError('universal provider snapshot is invalid');
    }
    redactSecrets(snapshot);
    this.#registrations = new Map(snapshot.registrations.map((row) => [row.providerId, row]));
    this.#health = new Map(snapshot.health.map((row) => [row.providerId, row]));
    this.#certifications = new Map(snapshot.certifications.map((row) => [row.certificationId, row]));
    this.#killSwitches = new Map(snapshot.killSwitches.map((row) => [row.switchId, row]));
    this.#limitedLive = new Map(snapshot.limitedLiveRules.map((row) => [row.ruleId, row]));
    this.#evidence = [...snapshot.evidence];
    this.#routing = [...snapshot.routingDecisions];
  }
}
