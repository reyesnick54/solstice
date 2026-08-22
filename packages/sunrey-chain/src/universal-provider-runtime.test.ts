import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SecretValue } from '../../security/src/redaction.ts';
import {
  ENVIRONMENT,
  LIVE_PAYMENTS_ENABLED,
} from '../../config/src/flags.ts';
import {
  LIVE_CONNECTIVITY_ENABLED,
  PRODUCTION_ACTIVE,
  PRODUCTION_READY,
  ProviderTimeoutError,
  createUniversalProviderRuntime,
  createCredentialRef,
  evaluateFailover,
  harnessPassed,
  production_authorized,
  runProviderContractHarness,
  seedSimulationProviders,
} from './provider-runtime/universal/index.ts';

const NOW = '2026-08-21T16:00:00.000Z';

function runtime(nowMs = Date.parse(NOW)) {
  return createUniversalProviderRuntime({ nowMs: () => nowMs });
}

function registerSimulated(rt: ReturnType<typeof runtime>, providerId = 'sim-bank') {
  const credential = createCredentialRef({
    providerId,
    secretHref: `secret://simulation/${providerId}/key`,
    keyVersion: '1',
    environment: 'LOCAL',
  });
  assert.equal(credential.ok, true);
  if (!credential.ok) {
    throw new Error('credential');
  }
  const registered = rt.register({
    providerId,
    providerType: 'BANKING',
    displayName: 'Simulated bank',
    adapterId: `${providerId}-adapter`,
    capabilities: ['BANK.ACCOUNTS', 'BANK.BALANCES', 'BANK.TRANSFERS'],
    environment: 'LOCAL',
    enabledJurisdictions: ['US'],
    supportedCurrencies: ['USD'],
    supportedProducts: ['send'],
    credentialReference: credential.value,
    webhookConfiguration: {
      verificationAdapterId: `${providerId}-webhook`,
      replayWindowMs: 300_000,
      environment: 'LOCAL',
      persistRawEvidence: true,
    },
    routingPriority: 10,
    nowUtc: NOW,
  });
  assert.equal(registered.ok, true);
  const moved = rt.transitionLifecycle({
    providerId,
    to: 'SIMULATED',
    actorKind: 'SYSTEM',
    actorId: 'test',
    nowUtc: NOW,
  });
  assert.equal(moved.ok, true);
  return providerId;
}

describe('Phase D universal provider runtime', () => {
  it('registers a provider and isolates invalid configuration', () => {
    const rt = runtime();
    const invalidId = rt.register({
      providerId: 'BAD',
      providerType: 'PAYMENTS',
      displayName: 'bad',
      adapterId: 'bad',
      capabilities: ['PAYMENT.ACH'],
      environment: 'LOCAL',
      nowUtc: NOW,
    });
    assert.equal(invalidId.ok, false);
    const crossed = rt.register({
      providerId: 'cross-category',
      providerType: 'PAYMENTS',
      displayName: 'cross',
      adapterId: 'cross',
      capabilities: ['FX.QUOTE'],
      environment: 'LOCAL',
      nowUtc: NOW,
    });
    assert.equal(crossed.ok, false);
    registerSimulated(rt);
    assert.equal(rt.get('sim-bank')?.lifecycleState, 'SIMULATED');
    assert.equal(rt.get('sim-bank')?.rawCredentialPresent, false);
  });

  it('refuses sandbox credentials for production selection', () => {
    const rt = runtime();
    registerSimulated(rt, 'sandbox-only');
    const routed = rt.route({
      capability: 'BANK.TRANSFERS',
      environment: 'PRODUCTION',
      nowUtc: NOW,
    });
    assert.equal(routed.ok, false);
    if (!routed.ok) {
      assert.equal(routed.error.code, 'PROVIDER_ROUTE_UNAVAILABLE');
    }
  });

  it('negotiates capabilities and blocks disabled providers', () => {
    const rt = runtime();
    const registered = rt.register({
      providerId: 'cap-bank',
      providerType: 'BANKING',
      displayName: 'cap',
      adapterId: 'cap',
      capabilities: ['BANK.ACCOUNTS'],
      environment: 'LOCAL',
      nowUtc: NOW,
    });
    assert.equal(registered.ok, true);
    assert.equal(rt.canPerform('cap-bank', 'BANK.ACCOUNTS'), false);
    rt.transitionLifecycle({
      providerId: 'cap-bank',
      to: 'SIMULATED',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
    });
    assert.equal(rt.canPerform('cap-bank', 'BANK.ACCOUNTS'), true);
    assert.equal(rt.canPerform('cap-bank', 'BANK.TRANSFERS'), false);
  });

  it('validates lifecycle transitions and forbids production promotion', () => {
    const rt = runtime();
    registerSimulated(rt, 'life-1');
    const sandbox = rt.transitionLifecycle({
      providerId: 'life-1',
      to: 'SANDBOX',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
    });
    assert.equal(sandbox.ok, false);
    const configured = rt.transitionLifecycle({
      providerId: 'life-1',
      to: 'SANDBOX',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
      configurationComplete: true,
    });
    assert.equal(configured.ok, true);
    const cert = rt.transitionLifecycle({
      providerId: 'life-1',
      to: 'CERTIFICATION',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
      testSuiteReady: true,
    });
    assert.equal(cert.ok, true);
    const pre = rt.transitionLifecycle({
      providerId: 'life-1',
      to: 'PREPRODUCTION',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
      certificationEvidenceRefs: ['ev_cert_1'],
    });
    assert.equal(pre.ok, true);
    for (const actorKind of ['API', 'AGENT', 'FRONTEND', 'ENVIRONMENT_VARIABLE'] as const) {
      const refused = rt.transitionLifecycle({
        providerId: 'life-1',
        to: 'LIMITED_LIVE',
        actorKind,
        actorId: 'casual',
        nowUtc: NOW,
        humanAuthorizationId: 'auth-1',
        externalGateRefs: ['gate-1'],
      });
      assert.equal(refused.ok, false);
    }
    const human = rt.transitionLifecycle({
      providerId: 'life-1',
      to: 'LIMITED_LIVE',
      actorKind: 'HUMAN_OPERATOR',
      actorId: 'operator',
      nowUtc: NOW,
      humanAuthorizationId: 'auth-1',
      externalGateRefs: ['gate-1'],
    });
    assert.equal(human.ok, false);
    if (!human.ok) {
      assert.equal(human.error.code, 'PROVIDER_LIFECYCLE_FORBIDDEN');
    }
    assert.equal(rt.get('life-1')?.lifecycleState, 'PREPRODUCTION');
  });

  it('tracks health, timeout, safe retry, and unsafe retry', () => {
    const rt = runtime();
    registerSimulated(rt, 'ops-1');
    const healthy = rt.observeHealth({
      providerId: 'ops-1',
      success: true,
      latencyMs: 12,
      nowUtc: NOW,
    });
    assert.equal(healthy.ok, true);
    if (healthy.ok) {
      assert.equal(healthy.value.state, 'HEALTHY');
    }
    const timeout = rt.executeWithTimeout('ops-1', () => {
      throw new ProviderTimeoutError();
    });
    assert.equal(timeout.ok, false);
    if (!timeout.ok) {
      assert.equal(timeout.error.code, 'PROVIDER_TIMEOUT');
    }
    const safe = rt.decideRetry({ retryClass: 'READ', attempt: 1, transient: true });
    const unsafe = rt.decideRetry({
      retryClass: 'NON_IDEMPOTENT_MUTATION',
      attempt: 1,
      transient: true,
    });
    const idempotent = rt.decideRetry({
      retryClass: 'IDEMPOTENT_MUTATION',
      attempt: 1,
      transient: true,
      lastState: 'UNKNOWN',
      providerSupportsIdempotency: true,
      sunreyIdempotencyKey: 'idem-1',
      operationReference: 'op-1',
    });
    assert.equal(safe.retry, true);
    assert.equal(unsafe.retry, false);
    assert.equal(idempotent.retry, false);
  });

  it('opens the circuit after repeated failures', () => {
    let now = Date.parse(NOW);
    const rt = createUniversalProviderRuntime({ nowMs: () => now });
    registerSimulated(rt, 'circuit-1');
    for (let i = 0; i < 3; i += 1) {
      rt.observeHealth({
        providerId: 'circuit-1',
        success: false,
        latencyMs: 40,
        nowUtc: NOW,
      });
    }
    const health = rt.healthOf('circuit-1');
    assert.equal(health?.circuitState, 'OPEN');
    const blocked = rt.executeWithTimeout('circuit-1', () => 'ok');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.error.code, 'PROVIDER_UNAVAILABLE');
    }
    now += 6_000;
    const half = rt.executeWithTimeout('circuit-1', () => 'probe');
    assert.equal(half.ok, true);
  });

  it('routes deterministically and records an auditable decision', () => {
    const rt = runtime();
    registerSimulated(rt, 'route-b');
    const second = rt.register({
      providerId: 'route-a',
      providerType: 'BANKING',
      displayName: 'A',
      adapterId: 'a',
      capabilities: ['BANK.TRANSFERS'],
      environment: 'LOCAL',
      enabledJurisdictions: ['US'],
      supportedCurrencies: ['USD'],
      supportedProducts: ['send'],
      routingPriority: 10,
      nowUtc: NOW,
    });
    assert.equal(second.ok, true);
    rt.transitionLifecycle({
      providerId: 'route-a',
      to: 'SIMULATED',
      actorKind: 'SYSTEM',
      actorId: 'test',
      nowUtc: NOW,
    });
    const decision = rt.route({
      capability: 'BANK.TRANSFERS',
      jurisdiction: 'US',
      currency: 'USD',
      product: 'send',
      environment: 'LOCAL',
      nowUtc: NOW,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.selectedProviderId, 'route-a');
      assert.equal(decision.value.aiChoseFreely, false);
      assert.equal(decision.value.deterministic, true);
    }
  });

  it('models safe and unsafe failover', () => {
    const safe = evaluateFailover({
      operation: 'MARKET_DATA_READ',
      submissionState: 'NOT_SUBMITTED',
    });
    const quote = evaluateFailover({
      operation: 'FX_QUOTE_BEFORE_ACCEPT',
      submissionState: 'NOT_SUBMITTED',
    });
    const submitted = evaluateFailover({
      operation: 'BANK_PAYMENT_SUBMIT',
      submissionState: 'SUBMITTED',
    });
    const unknown = evaluateFailover({
      operation: 'BANK_PAYMENT_SUBMIT',
      submissionState: 'UNKNOWN',
    });
    assert.equal(safe.safety, 'SAFE_TO_FAILOVER');
    assert.equal(quote.safety, 'SAFE_TO_FAILOVER');
    assert.equal(submitted.safety, 'NOT_SAFE_TO_FAILOVER');
    assert.equal(unknown.safety, 'REQUIRES_RECONCILIATION');
  });

  it('applies an auditable kill switch and keeps limited-live inactive', () => {
    const rt = runtime();
    registerSimulated(rt, 'kill-1');
    const applied = rt.applyKillSwitch({
      switchId: 'ks-1',
      providerId: 'kill-1',
      scope: 'PROVIDER',
      target: 'kill-1',
      actorId: 'ops',
      reason: 'incident',
      nowUtc: NOW,
      allowReadOnlyReconciliation: true,
    });
    assert.equal(applied.ok, true);
    if (applied.ok) {
      assert.equal(applied.value.frontendExposed, false);
    }
    const routed = rt.route({
      capability: 'BANK.TRANSFERS',
      environment: 'LOCAL',
      nowUtc: NOW,
    });
    assert.equal(routed.ok, false);
    const rule = rt.defineLimitedLiveRule({
      ruleId: 'll-1',
      providerId: 'kill-1',
      allowlistedCustomers: ['cust_1'],
      maxTransactionMinor: 100n,
    });
    assert.equal(rule.activated, false);
    const live = rt.evaluateLimitedLive('ll-1', {
      customerId: 'cust_1',
      jurisdiction: 'US',
      currency: 'USD',
      product: 'send',
      amountMinor: 10n,
      dailyAggregateMinor: 10n,
    });
    assert.equal(live.ok, false);
  });

  it('dispatches verified webhooks without bypassing domain authority', () => {
    const rt = runtime();
    registerSimulated(rt, 'wh-1');
    const secret = new SecretValue('webhook-secret-value');
    rt.registerWebhookSecret('wh-1', secret);
    const envelope = rt.webhookGuard().sign(
      {
        schemaVersion: 1,
        providerId: 'wh-1',
        eventType: 'payment.updated',
        timestampUtc: NOW,
        nonce: 'n1',
        idempotencyKey: 'idem-wh-1',
        payloadHash: 'b'.repeat(64),
      },
      secret,
    );
    const first = rt.dispatchWebhook({ envelope, nowUtc: NOW, correlationId: 'c1' });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.value.event.domainAuthorityBypassed, false);
      assert.equal(first.value.event.duplicate, false);
    }
    const replay = rt.dispatchWebhook({ envelope, nowUtc: NOW, correlationId: 'c2' });
    assert.equal(replay.ok, false);
  });

  it('redacts credentials and distinguishes certification kinds', () => {
    const rt = runtime();
    registerSimulated(rt, 'cert-1');
    assert.throws(() => {
      rt.recordEvidence({
        evidenceId: 'bad',
        providerId: 'cert-1',
        operation: 'submit',
        requestRef: 'r',
        responseRef: 's',
        timestamps: { startedAt: NOW, endedAt: NOW },
        environment: 'LOCAL',
        routingDecision: null,
        result: 'ok',
        correlationId: 'c',
        providerTransactionId: null,
        apiKey: 'super-secret',
      } as never);
    });
    const internal = rt.certify({
      certificationId: 'cert-internal',
      providerId: 'cert-1',
      adapterVersion: '1.0.0',
      environment: 'LOCAL',
      testSuiteVersion: 'suite-1',
      testDateUtc: NOW,
      result: 'PASS',
      distinction: 'INTERNAL_ADAPTER_TESTED',
    });
    assert.equal(internal.ok, true);
    const external = rt.certify({
      certificationId: 'cert-external',
      providerId: 'cert-1',
      adapterVersion: '1.0.0',
      environment: 'LOCAL',
      testSuiteVersion: 'suite-1',
      testDateUtc: NOW,
      result: 'PASS',
      distinction: 'EXTERNAL_PROVIDER_CERTIFIED',
    });
    assert.equal(external.ok, false);
    assert.equal(rt.get('cert-1')?.certificationState, 'INTERNAL_ADAPTER_TESTED');
  });

  it('restores persisted control-plane state after restart', () => {
    const first = runtime();
    registerSimulated(first, 'persist-1');
    first.observeHealth({ providerId: 'persist-1', success: true, latencyMs: 3, nowUtc: NOW });
    for (let i = 0; i < 3; i += 1) {
      first.observeHealth({
        providerId: 'persist-1',
        success: false,
        latencyMs: 40,
        nowUtc: NOW,
      });
    }
    const snapshot = first.snapshot();
    const second = runtime();
    second.restore(snapshot);
    assert.equal(second.get('persist-1')?.lifecycleState, 'SIMULATED');
    assert.equal(second.healthOf('persist-1')?.state, 'UNAVAILABLE');
    assert.equal(second.healthOf('persist-1')?.circuitState, 'OPEN');
    const blocked = second.executeWithTimeout('persist-1', () => 'ok');
    assert.equal(blocked.ok, false);
    assert.equal(snapshot.productionActive, false);
    assert.equal(snapshot.liveConnectivityEnabled, false);
  });

  it('exposes internal ops views and sandbox BFF feature availability', () => {
    const rt = runtime();
    seedSimulationProviders(rt, NOW);
    const ops = rt.listOperationsViews();
    assert.equal(ops.every((row) => row.customerBffExposed === false), true);
    const payments = rt.featureAvailability('payments');
    assert.equal(payments.enabled, true);
    assert.equal(payments.sandbox, true);
    assert.equal(payments.providerConfigured, true);
  });

  it('runs the reusable adapter contract harness', () => {
    const results = runProviderContractHarness({
      providerId: 'harness-pay',
      providerType: 'PAYMENTS',
      capabilities: ['PAYMENT.ACH'],
      environment: 'LOCAL',
      adapterId: 'harness-pay-adapter',
    });
    assert.equal(harnessPassed(results), true, JSON.stringify(results.filter((row) => !row.passed)));
  });

  it('keeps production flags closed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(PRODUCTION_READY, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(production_authorized, false);
    const rt = runtime();
    assert.equal(rt.productionActive, false);
    assert.equal(rt.liveConnectivityEnabled, false);
    assert.equal(rt.productionAuthorized, false);
  });
});
