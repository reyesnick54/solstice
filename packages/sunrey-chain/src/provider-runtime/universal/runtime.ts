/**
 * Canonical Universal Provider Runtime facade.
 * Domain services call stable SunRey interfaces; this runtime selects
 * and governs the external implementation.
 */

import { ProviderWebhookGuard, type ProviderWebhookEnvelope } from '../../../../security/src/regulated/webhook.ts';
import { digestJson } from '../core.ts';
import { canPerform } from './capabilities.ts';
import {
  applyHealthObservation,
  decideUniversalRetry,
  runWithTimeout,
  UniversalCircuitBreaker,
  type UniversalRetryDecision,
} from './control.ts';
import { normalizeProviderFailure } from './errors.ts';
import { evaluateFailover } from './failover.ts';
import {
  createKillSwitch,
  createLimitedLiveRule,
  deactivateKillSwitch,
  evaluateLimitedLive,
  recordCertification,
} from './governance.ts';
import { lifecycleSufficientForSandbox, validateLifecycleTransition } from './lifecycle.ts';
import { routeProviders } from './routing.ts';
import { createCredentialRef, InMemoryUniversalProviderStore } from './store.ts';
import {
  universalErr,
  universalOk,
  type BffFeatureKey,
  type FailoverDecision,
  type FailoverInquiry,
  type FeatureAvailability,
  type KillSwitchScope,
  type LifecycleTransitionRequest,
  type OperationsProviderView,
  type ProviderCapabilityId,
  type ProviderCertificationRecord,
  type ProviderEnvironment,
  type ProviderEvidenceRecord,
  type ProviderHealthRecord,
  type ProviderRegistration,
  type RegisterProviderInput,
  type RetryClass,
  type RoutingInquiry,
  type UniversalProviderSnapshot,
  type UniversalResult,
} from './types.ts';
import { dispatchProviderWebhook } from './webhook.ts';

export type UniversalProviderRuntimeOptions = {
  readonly store?: InMemoryUniversalProviderStore;
  readonly nowMs?: () => number;
};

export class UniversalProviderRuntime {
  readonly #store: InMemoryUniversalProviderStore;
  readonly #circuits = new Map<string, UniversalCircuitBreaker>();
  readonly #webhookGuard = new ProviderWebhookGuard();
  readonly #nowMs: () => number;
  readonly productionActive = false as const;
  readonly liveConnectivityEnabled = false as const;
  readonly productionAuthorized = false as const;

  constructor(options: UniversalProviderRuntimeOptions = {}) {
    this.#store = options.store ?? new InMemoryUniversalProviderStore();
    this.#nowMs = options.nowMs ?? (() => Date.now());
  }

  register(input: RegisterProviderInput): UniversalResult<ProviderRegistration> {
    return this.#store.register(input);
  }

  get(providerId: string): ProviderRegistration | null {
    return this.#store.get(providerId);
  }

  list(): readonly ProviderRegistration[] {
    return this.#store.list();
  }

  bindCredential(input: {
    readonly providerId: string;
    readonly secretHref: string;
    readonly keyVersion: string;
    readonly environment: ProviderEnvironment;
  }): UniversalResult<ProviderRegistration> {
    const existing = this.#store.get(input.providerId);
    if (!existing) {
      return universalErr('PROVIDER_NOT_REGISTERED', 'provider is not registered', {
        providerId: input.providerId,
      });
    }
    const credential = createCredentialRef(input);
    if (!credential.ok) {
      return credential;
    }
    return universalOk(
      this.#store.replace(
        Object.freeze({
          ...existing,
          credentialReference: credential.value,
          updatedAt: existing.updatedAt,
          revision: existing.revision + 1,
        }),
      ),
    );
  }

  transitionLifecycle(request: LifecycleTransitionRequest): UniversalResult<ProviderRegistration> {
    const existing = this.#store.get(request.providerId);
    if (!existing) {
      return universalErr('PROVIDER_NOT_REGISTERED', 'provider is not registered', {
        providerId: request.providerId,
      });
    }
    const allowed = validateLifecycleTransition(existing.lifecycleState, request);
    if (!allowed.ok) {
      return allowed;
    }
    return universalOk(
      this.#store.replace(
        Object.freeze({
          ...existing,
          lifecycleState: allowed.value,
          updatedAt: request.nowUtc,
          revision: existing.revision + 1,
        }),
      ),
    );
  }

  canPerform(providerId: string, capability: ProviderCapabilityId): boolean {
    return canPerform(this.#store.get(providerId), capability);
  }

  route(inquiry: RoutingInquiry) {
    const health = new Map(
      this.#store.list().map((row) => [row.providerId, this.#store.healthOf(row.providerId)!] as const),
    );
    const decision = routeProviders(this.#store.list(), health, this.#store.killSwitches(), inquiry);
    if (decision.ok) {
      this.#store.appendRouting(decision.value);
    }
    return decision;
  }

  failover(inquiry: FailoverInquiry): FailoverDecision {
    return evaluateFailover(inquiry);
  }

  observeHealth(input: {
    readonly providerId: string;
    readonly success: boolean;
    readonly latencyMs: number | null;
    readonly rateLimited?: boolean;
    readonly maintenance?: boolean;
    readonly nowUtc: string;
  }): UniversalResult<ProviderHealthRecord> {
    const current = this.#store.healthOf(input.providerId);
    const registration = this.#store.get(input.providerId);
    if (!current || !registration) {
      return universalErr('PROVIDER_NOT_REGISTERED', 'provider is not registered', {
        providerId: input.providerId,
      });
    }
    const breaker = this.#circuit(registration);
    const circuitState = input.success
      ? breaker.recordSuccess()
      : breaker.recordFailure(this.#nowMs());
    return universalOk(
      this.#store.putHealth(
        applyHealthObservation(current, {
          success: input.success,
          latencyMs: input.latencyMs,
          rateLimited: input.rateLimited,
          maintenance: input.maintenance,
          circuitState,
          nowUtc: input.nowUtc,
        }),
      ),
    );
  }

  healthOf(providerId: string): ProviderHealthRecord | null {
    return this.#store.healthOf(providerId);
  }

  decideRetry(input: {
    readonly retryClass: RetryClass;
    readonly attempt: number;
    readonly transient: boolean;
    readonly providerSupportsIdempotency?: boolean;
    readonly sunreyIdempotencyKey?: string;
    readonly operationReference?: string;
    readonly lastState?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNKNOWN' | 'CONFIRMED';
  }): UniversalRetryDecision {
    return decideUniversalRetry(input);
  }

  executeWithTimeout<T>(
    providerId: string,
    operation: (deadlineMs: number) => T,
  ): UniversalResult<T> {
    const registration = this.#store.get(providerId);
    if (!registration) {
      return universalErr('PROVIDER_NOT_REGISTERED', 'provider is not registered', { providerId });
    }
    const breaker = this.#circuit(registration);
    if (!breaker.allowRequest(this.#nowMs())) {
      return universalErr('PROVIDER_UNAVAILABLE', 'circuit breaker is open', { providerId });
    }
    return runWithTimeout(operation, registration.healthPolicy.timeoutMs, this.#nowMs);
  }

  normalizeFailure(input: {
    readonly providerId: string;
    readonly vendorCode?: string;
    readonly vendorMessage?: string;
    readonly providerReference?: string;
  }): UniversalResult<never> {
    return normalizeProviderFailure(input);
  }

  applyKillSwitch(input: {
    readonly switchId: string;
    readonly providerId: string;
    readonly scope: KillSwitchScope;
    readonly target: string;
    readonly actorId: string;
    readonly reason: string;
    readonly nowUtc: string;
    readonly allowReadOnlyReconciliation?: boolean;
  }): UniversalResult<ReturnType<typeof createKillSwitch>> {
    if (!this.#store.get(input.providerId)) {
      return universalErr('PROVIDER_NOT_REGISTERED', 'provider is not registered', {
        providerId: input.providerId,
      });
    }
    return universalOk(this.#store.putKillSwitch(createKillSwitch(input)));
  }

  releaseKillSwitch(switchId: string, actorId: string, nowUtc: string): UniversalResult<true> {
    const existing = this.#store.killSwitches().find((row) => row.switchId === switchId);
    if (!existing) {
      return universalErr('PROVIDER_CONFIGURATION_ERROR', 'kill switch is not registered');
    }
    this.#store.putKillSwitch(deactivateKillSwitch(existing, actorId, nowUtc));
    return universalOk(true);
  }

  defineLimitedLiveRule(input: Parameters<typeof createLimitedLiveRule>[0]): ReturnType<typeof createLimitedLiveRule> {
    return this.#store.putLimitedLive(createLimitedLiveRule(input));
  }

  evaluateLimitedLive(
    ruleId: string,
    inquiry: Parameters<typeof evaluateLimitedLive>[1],
  ): ReturnType<typeof evaluateLimitedLive> {
    const rule = this.#store.limitedLiveRules().find((row) => row.ruleId === ruleId);
    if (!rule) {
      return universalErr('PROVIDER_CONFIGURATION_ERROR', 'limited-live rule is not registered');
    }
    return evaluateLimitedLive(rule, inquiry);
  }

  certify(input: Parameters<typeof recordCertification>[0]): UniversalResult<ProviderCertificationRecord> {
    const recorded = recordCertification(input);
    if (!recorded.ok) {
      return recorded;
    }
    return universalOk(this.#store.putCertification(recorded.value));
  }

  registerWebhookSecret(providerId: string, secret: import('../../../../security/src/redaction.ts').SecretValue): void {
    this.#webhookGuard.registerProvider(providerId, secret);
  }

  webhookGuard(): ProviderWebhookGuard {
    return this.#webhookGuard;
  }

  dispatchWebhook(input: {
    readonly envelope: ProviderWebhookEnvelope;
    readonly nowUtc: string;
    readonly correlationId: string;
  }): ReturnType<typeof dispatchProviderWebhook> {
    return dispatchProviderWebhook({
      registrations: this.#store.list(),
      guard: this.#webhookGuard,
      envelope: input.envelope,
      nowUtc: input.nowUtc,
      nowMs: this.#nowMs(),
      correlationId: input.correlationId,
    });
  }

  recordEvidence(input: Omit<ProviderEvidenceRecord, 'secretPresent' | 'panPresent' | 'privateKeyPresent' | 'prohibitedKycPresent'>): ProviderEvidenceRecord {
    return this.#store.appendEvidence(
      Object.freeze({
        ...input,
        secretPresent: false as const,
        panPresent: false as const,
        privateKeyPresent: false as const,
        prohibitedKycPresent: false as const,
      }),
    );
  }

  operationsView(providerId: string): OperationsProviderView | null {
    const registration = this.#store.get(providerId);
    const health = this.#store.healthOf(providerId);
    if (!registration || !health) {
      return null;
    }
    return Object.freeze({
      providerId: registration.providerId,
      providerType: registration.providerType,
      lifecycle: registration.lifecycleState,
      health: health.state,
      capabilities: registration.capabilities,
      lastRequestAt: health.lastSuccessAt ?? health.lastFailureAt,
      errorRate: health.errorRate,
      circuitState: health.circuitState,
      certification: registration.certificationState,
      environment: registration.environment,
      customerBffExposed: false as const,
    });
  }

  listOperationsViews(): readonly OperationsProviderView[] {
    return Object.freeze(this.#store.list().map((row) => this.operationsView(row.providerId)!));
  }

  featureAvailability(feature: BffFeatureKey): FeatureAvailability {
    const capability =
      feature === 'payments' ? 'PAYMENT.ACH' : feature === 'fx' ? 'FX.QUOTE' : 'CARD.VIRTUAL_ISSUING';
    const matches = this.#store.list().filter((row) => row.capabilities.includes(capability));
    const configured = matches.length > 0;
    const lifecycleOk = matches.some((row) => lifecycleSufficientForSandbox(row.lifecycleState));
    const healthy = matches.some((row) => {
      const health = this.#store.healthOf(row.providerId);
      return health ? health.state === 'HEALTHY' || health.state === 'DEGRADED' || health.state === 'UNKNOWN' : false;
    });
    const sandbox = matches.every((row) => row.environment !== 'PRODUCTION');
    const enabled = configured && lifecycleOk && healthy;
    return Object.freeze({
      feature,
      enabled,
      sandbox,
      providerConfigured: configured,
      lifecycleSufficient: lifecycleOk,
      healthy,
      reason: enabled
        ? sandbox
          ? 'sandbox provider is configured, lifecycle-sufficient, and healthy'
          : 'provider is available'
        : !configured
          ? 'no provider is configured for this feature'
          : !lifecycleOk
            ? 'provider lifecycle is not sufficient'
            : 'provider is not healthy',
    });
  }

  snapshot(): UniversalProviderSnapshot {
    return this.#store.snapshot();
  }

  restore(snapshot: UniversalProviderSnapshot): void {
    this.#store.restore(snapshot);
    this.#circuits.clear();
    for (const health of snapshot.health) {
      const registration = this.#store.get(health.providerId);
      if (!registration) {
        continue;
      }
      const breaker = this.#circuit(registration);
      breaker.restore(
        health.circuitState,
        health.consecutiveFailures,
        health.circuitState === 'CLOSED' ? 0 : this.#nowMs(),
      );
    }
  }

  evidenceHash(value: unknown): string {
    return digestJson(value);
  }

  #circuit(registration: ProviderRegistration): UniversalCircuitBreaker {
    const existing = this.#circuits.get(registration.providerId);
    if (existing) {
      return existing;
    }
    const created = new UniversalCircuitBreaker(
      registration.healthPolicy.openAfterFailures,
      registration.healthPolicy.cooldownMs,
    );
    this.#circuits.set(registration.providerId, created);
    return created;
  }
}

export function createUniversalProviderRuntime(
  options?: UniversalProviderRuntimeOptions,
): UniversalProviderRuntime {
  return new UniversalProviderRuntime(options);
}
