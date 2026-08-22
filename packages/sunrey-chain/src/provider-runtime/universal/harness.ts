/**
 * Reusable provider contract test harness.
 * Future adapters must pass these standardized checks.
 */

import { SecretValue } from '../../../../security/src/redaction.ts';
import { ProviderTimeoutError } from './control.ts';
import { createUniversalProviderRuntime, type UniversalProviderRuntime } from './runtime.ts';
import type { ProviderCapabilityId, ProviderCategory, ProviderEnvironment } from './types.ts';

export type ContractCaseResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type AdapterContractSubject = {
  readonly providerId: string;
  readonly providerType: ProviderCategory;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly environment: ProviderEnvironment;
  readonly adapterId: string;
};

export function runProviderContractHarness(
  subject: AdapterContractSubject,
  runtime: UniversalProviderRuntime = createUniversalProviderRuntime({ nowMs: () => Date.parse('2026-08-21T00:00:00.000Z') }),
): readonly ContractCaseResult[] {
  const nowUtc = '2026-08-21T00:00:00.000Z';
  const results: ContractCaseResult[] = [];

  const registered = runtime.register({
    ...subject,
    displayName: subject.providerId,
    lifecycleState: 'DISABLED',
    enabledJurisdictions: ['US'],
    supportedCurrencies: ['USD'],
    supportedProducts: ['sandbox'],
    webhookConfiguration: {
      verificationAdapterId: `${subject.adapterId}-webhook`,
      replayWindowMs: 300_000,
      environment: subject.environment,
      persistRawEvidence: true,
    },
    nowUtc,
  });
  results.push(caseOf('configuration', registered.ok, registered.ok ? 'registered' : registered.error.message));
  if (!registered.ok) {
    return Object.freeze(results);
  }

  results.push(
    caseOf(
      'capability-declaration',
      subject.capabilities.every((capability) => runtime.canPerform(subject.providerId, capability) === false),
      'disabled providers cannot perform capabilities',
    ),
  );

  const simulated = runtime.transitionLifecycle({
    providerId: subject.providerId,
    to: 'SIMULATED',
    actorKind: 'SYSTEM',
    actorId: 'harness',
    nowUtc,
  });
  results.push(caseOf('lifecycle-simulated', simulated.ok, simulated.ok ? 'SIMULATED' : simulated.error.message));

  results.push(
    caseOf(
      'capability-negotiation',
      subject.capabilities.every((capability) => runtime.canPerform(subject.providerId, capability)),
      'simulated providers expose declared capabilities',
    ),
  );

  const timeout = runtime.executeWithTimeout(subject.providerId, () => {
    throw new ProviderTimeoutError();
  });
  results.push(caseOf('timeouts', !timeout.ok && timeout.error.code === 'PROVIDER_TIMEOUT', 'timeout is typed'));

  const normalized = runtime.normalizeFailure({
    providerId: subject.providerId,
    vendorCode: 'rate_limit',
    vendorMessage: 'super-secret vendor dump',
    providerReference: 'vendor-ref-1',
  });
  results.push(
    caseOf(
      'normalized-errors',
      !normalized.ok && normalized.error.code === 'PROVIDER_RATE_LIMITED' && normalized.error.safeToDisplay === false,
      'vendor messages are not customer-safe',
    ),
  );

  const unsafeRetry = runtime.decideRetry({
    retryClass: 'NON_IDEMPOTENT_MUTATION',
    attempt: 1,
    transient: true,
  });
  const safeRetry = runtime.decideRetry({
    retryClass: 'READ',
    attempt: 1,
    transient: true,
  });
  results.push(caseOf('idempotency-retry', !unsafeRetry.retry && safeRetry.retry, 'unsafe retry prevented'));

  runtime.observeHealth({ providerId: subject.providerId, success: true, latencyMs: 4, nowUtc });
  const health = runtime.healthOf(subject.providerId);
  results.push(caseOf('health', health?.state === 'HEALTHY', health?.state ?? 'missing'));

  const secret = new SecretValue('harness-webhook-secret');
  runtime.registerWebhookSecret(subject.providerId, secret);
  const envelope = runtime.webhookGuard().sign(
    {
      schemaVersion: 1,
      providerId: subject.providerId,
      eventType: 'status.updated',
      timestampUtc: nowUtc,
      nonce: 'nonce-1',
      idempotencyKey: 'idem-1',
      payloadHash: 'a'.repeat(64),
    },
    secret,
  );
  const webhook = runtime.dispatchWebhook({
    envelope,
    nowUtc,
    correlationId: 'corr-1',
  });
  results.push(
    caseOf(
      'webhook-verification',
      webhook.ok && webhook.value.event.domainAuthorityBypassed === false,
      webhook.ok ? 'verified' : webhook.error.message,
    ),
  );

  const production = runtime.transitionLifecycle({
    providerId: subject.providerId,
    to: 'PRODUCTION',
    actorKind: 'API',
    actorId: 'harness',
    nowUtc,
  });
  results.push(
    caseOf(
      'environment-isolation',
      !production.ok,
      'API cannot promote to production',
    ),
  );

  const view = runtime.operationsView(subject.providerId);
  results.push(caseOf('observability', view !== null && view.customerBffExposed === false, 'ops view is internal'));

  return Object.freeze(results);
}

function caseOf(name: string, passed: boolean, detail: string): ContractCaseResult {
  return Object.freeze({ name, passed, detail });
}

export function harnessPassed(results: readonly ContractCaseResult[]): boolean {
  return results.every((row) => row.passed);
}
