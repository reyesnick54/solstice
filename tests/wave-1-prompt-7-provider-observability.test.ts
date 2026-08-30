/**
 * Wave 1 Prompt 7 — provider observability, health, and operations control plane.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  catalogTotal,
  combineDomainDegradation,
  computeProviderDegradation,
  createProviderObservabilityPlane,
  defaultActivationConfig,
  isProviderActivated,
  mapRuntimeHealthToCanonical,
  PROVIDER_METRIC_NAMES,
  ProviderCacheTracker,
  ProviderLogEmitter,
  ProviderMetricsCollector,
  ProviderSchedulerTracker,
  readActivationFromEnv,
  rollupDependencyStatus,
  withTierActivation,
  type ProviderStatusRecord,
} from '../packages/sunrey-chain/src/provider-runtime/universal/observability/index.ts';
import {
  createCredentialRef,
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../packages/sunrey-chain/src/provider-runtime/universal/index.ts';
import { createInternalProviderOpsRoutes } from '../services/api/src/internal-provider-ops.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = '2026-08-30T08:00:00.000Z';

function buildPlane(env: Record<string, string | undefined> = {}) {
  const runtime = createUniversalProviderRuntime({ nowMs: () => Date.parse(NOW) });
  seedSimulationProviders(runtime, NOW);
  return createProviderObservabilityPlane(runtime, {
    activation: readActivationFromEnv(env),
    deploymentTier: 'preview',
    catalogTotal: catalogTotal(),
    nowUtc: () => NOW,
  });
}

describe('Wave 1 Prompt 7 — provider observability', () => {
  it('documents operations and incident runbooks', () => {
    assert.equal(existsSync(join(ROOT, 'docs/providers/PROVIDER_OPERATIONS.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/EXTERNAL_PROVIDER_INCIDENT.md')), true);
  });

  it('1. reports healthy provider state', () => {
    const plane = buildPlane();
    const status = plane.status.statusOf('sim-payments');
    assert.ok(status);
    assert.equal(status.health, 'healthy');
    assert.equal(status.enabled, true);
    assert.equal(status.circuitState, 'CLOSED');
  });

  it('2. reports degraded state after failures', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    runtime.observeHealth({ providerId: 'sim-fx', success: false, latencyMs: 900, nowUtc: NOW });
    const status = plane.status.statusOf('sim-fx');
    assert.ok(status);
    assert.equal(status.health, 'degraded');
  });

  it('3. reports unhealthy state after sustained failures', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    for (let i = 0; i < 3; i += 1) {
      runtime.observeHealth({ providerId: 'sim-cards', success: false, latencyMs: null, nowUtc: NOW });
    }
    const status = plane.status.statusOf('sim-cards');
    assert.ok(status);
    assert.equal(status.health, 'unhealthy');
  });

  it('4. reports disabled state when lifecycle is disabled', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    runtime.transitionLifecycle({
      providerId: 'sim-investments',
      to: 'DISABLED',
      actorKind: 'HUMAN_OPERATOR',
      actorId: 'ops-1',
      nowUtc: NOW,
    });
    const status = plane.status.statusOf('sim-investments');
    assert.ok(status);
    assert.equal(status.health, 'disabled');
    assert.equal(status.enabled, false);
  });

  it('5. reports blocked state from kill switch', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    runtime.applyKillSwitch({
      switchId: 'ks-sim-payments',
      providerId: 'sim-payments',
      scope: 'PROVIDER',
      target: 'sim-payments',
      actorId: 'ops-1',
      reason: 'incident',
      nowUtc: NOW,
    });
    const status = plane.status.statusOf('sim-payments');
    assert.ok(status);
    assert.equal(status.health, 'blocked');
  });

  it('6. reflects missing credentials in configuration health', () => {
    const runtime = createUniversalProviderRuntime();
    runtime.register({
      providerId: 'kyc-missing-cred',
      providerType: 'KYC',
      displayName: 'KYC missing credential',
      adapterId: 'kyc-v1',
      capabilities: ['KYC.IDENTITY_VERIFICATION'],
      environment: 'SANDBOX',
      lifecycleState: 'SANDBOX',
      nowUtc: NOW,
    });
    const plane = createProviderObservabilityPlane(runtime, { nowUtc: () => NOW });
    const status = plane.status.statusOf('kyc-missing-cred');
    assert.ok(status);
    assert.equal(status.credential.credentialRequired, true);
    assert.equal(status.credential.credentialConfigured, false);
    const configCheck = status.checks.find((row) => row.kind === 'configuration');
    assert.equal(configCheck?.result, 'fail');
  });

  it('7. reflects circuit-open in health', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    for (let i = 0; i < 4; i += 1) {
      runtime.observeHealth({ providerId: 'sim-fx', success: false, latencyMs: null, nowUtc: NOW });
    }
    const status = plane.status.statusOf('sim-fx');
    assert.ok(status);
    assert.equal(status.circuitState, 'OPEN');
    const runtimeCheck = status.checks.find((row) => row.kind === 'runtime');
    assert.equal(runtimeCheck?.result, 'fail');
  });

  it('8. reflects stale data in freshness health', () => {
    const plane = buildPlane();
    const staleAt = new Date(Date.parse(NOW) - 200_000).toISOString();
    plane.cache.put({
      providerId: 'sim-payments',
      key: 'default',
      valueDigest: 'abc',
      refreshedAtUtc: staleAt,
      staleAfterMs: 60_000,
    });
    const status = plane.status.statusOf('sim-payments');
    assert.ok(status);
    assert.equal(status.cacheFreshness.isStale, true);
    const freshness = status.checks.find((row) => row.kind === 'data_freshness');
    assert.equal(freshness?.result, 'fail');
  });

  it('9. emits provider metrics', () => {
    const metrics = new ProviderMetricsCollector();
    metrics.recordRequest({
      labels: { provider_id: 'sim-payments', category: 'PAYMENTS', capability: 'PAYMENT.ACH' },
      durationMs: 42,
      result: 'success',
    });
    metrics.recordCacheHit({ provider_id: 'sim-payments', category: 'PAYMENTS' });
    const samples = metrics.registry().snapshot();
    assert.ok(samples.some((row) => row.name === 'provider_requests_total'));
    assert.ok(samples.some((row) => row.name === 'provider_cache_hits_total'));
    for (const name of PROVIDER_METRIC_NAMES) {
      assert.ok(name.startsWith('provider_'));
    }
  });

  it('10. keeps secrets absent from metrics and logs', () => {
    const metrics = new ProviderMetricsCollector();
    const logs = new ProviderLogEmitter();
    assert.throws(() => {
      metrics.recordRequest({
        labels: {
          provider_id: 'sim-payments',
          category: 'PAYMENTS',
          capability: 'PAYMENT.ACH',
          error_class: 'Bearer sk_live_deadbeef',
        },
        durationMs: 1,
        result: 'failure',
        errorClass: 'Bearer sk_live_deadbeef',
      });
    });
    assert.throws(() => {
      logs.emit({
        providerId: 'sim-payments',
        capability: 'api_key=supersecret',
        requestId: 'req-1',
        statusCode: 200,
        durationMs: 1,
        retryCount: 0,
        circuitState: 'CLOSED',
        cacheState: 'hit',
        result: 'success',
        traceId: 'trace-1',
      });
    });
    const safe = logs.emit({
      providerId: 'sim-payments',
      capability: 'PAYMENT.ACH',
      requestId: 'req-1',
      statusCode: 200,
      durationMs: 1,
      retryCount: 0,
      circuitState: 'CLOSED',
      cacheState: 'hit',
      result: 'success',
      traceId: 'trace-1',
    });
    assert.equal(safe.secretMaterialPresent, false);
    const encoded = JSON.stringify(metrics.registry().snapshot());
    assert.equal(encoded.includes('sk_live'), false);
    assert.equal(encoded.includes('api_key'), false);
  });

  it('11. honors per-provider kill switch', () => {
    const activation = readActivationFromEnv({ PROVIDER_SIM_FX_ENABLED: 'false' });
    const decision = isProviderActivated({
      config: activation,
      providerId: 'sim-fx',
      category: 'FX',
      deploymentTier: 'preview',
    });
    assert.equal(decision.enabled, false);
  });

  it('12. honors category kill switch', () => {
    const activation = readActivationFromEnv({ FX_PROVIDERS_ENABLED: 'false' });
    const decision = isProviderActivated({
      config: activation,
      providerId: 'sim-fx',
      category: 'FX',
      deploymentTier: 'preview',
    });
    assert.equal(decision.enabled, false);
    assert.equal(decision.blocked, true);
  });

  it('13. honors global kill switch', () => {
    const activation = readActivationFromEnv({ PROVIDERS_ENABLED: 'false' });
    const decision = isProviderActivated({
      config: activation,
      providerId: 'sim-payments',
      category: 'PAYMENTS',
      deploymentTier: 'preview',
    });
    assert.equal(decision.enabled, false);
    assert.equal(decision.blocked, true);
  });

  it('14. supports preview enabled and production blocked tiers', () => {
    let activation = defaultActivationConfig();
    activation = withTierActivation(activation, 'preview', 'coingecko', 'enabled');
    activation = withTierActivation(activation, 'production', 'coingecko', 'blocked');
    const preview = isProviderActivated({
      config: activation,
      providerId: 'coingecko',
      category: 'MARKET_DATA',
      deploymentTier: 'preview',
    });
    const production = isProviderActivated({
      config: activation,
      providerId: 'coingecko',
      category: 'MARKET_DATA',
      deploymentTier: 'production',
    });
    assert.equal(preview.enabled, true);
    assert.equal(production.enabled, false);
    assert.equal(production.blocked, true);
  });

  it('15. isolates provider failures from unrelated providers', () => {
    const plane = buildPlane();
    const runtime = plane.runtime();
    for (let i = 0; i < 4; i += 1) {
      runtime.observeHealth({ providerId: 'sim-fx', success: false, latencyMs: null, nowUtc: NOW });
    }
    const fx = plane.status.statusOf('sim-fx');
    const payments = plane.status.statusOf('sim-payments');
    assert.ok(fx && payments);
    assert.equal(fx.health, 'unhealthy');
    assert.equal(payments.health, 'healthy');
  });

  it('16. sanitizes internal status responses', () => {
    const plane = buildPlane();
    const status = plane.status.statusOf('sim-payments');
    assert.ok(status);
    const sanitized = plane.status.sanitizeForInternalResponse(status);
    assert.equal(sanitized.secretValuesPresent, false);
    const encoded = JSON.stringify(sanitized);
    assert.equal(encoded.includes('secret://'), false);
  });
});

describe('Wave 1 Prompt 7 — degradation and dependencies', () => {
  it('combines domain degradation without always returning 500', () => {
    const level = combineDomainDegradation(['DEGRADED', 'NORMAL', 'STALE_DATA']);
    assert.equal(level, 'STALE_DATA');
    const unavailable = combineDomainDegradation(['UNAVAILABLE', 'NORMAL']);
    assert.equal(unavailable, 'DEGRADED');
    const allDown = combineDomainDegradation(['UNAVAILABLE', 'UNAVAILABLE']);
    assert.equal(allDown, 'UNAVAILABLE');
    const staleOnly = computeProviderDegradation({
      health: 'degraded',
      cacheFreshness: {
        lastRefreshedAt: NOW,
        staleAfterMs: 60_000,
        isStale: true,
        cacheState: 'stale_served',
      },
      required: false,
    });
    assert.equal(staleOnly, 'STALE_DATA');
  });

  it('rolls up domain dependency status', () => {
    const plane = buildPlane();
    const deps = plane.dependencyStatus();
    assert.ok(deps.length > 0);
    assert.match(deps[0]!.label, /providers/i);
  });
});

describe('Wave 1 Prompt 7 — internal health endpoints', () => {
  it('exposes aggregate health internally and restricts details', async () => {
    const plane = buildPlane();
    const routes = createInternalProviderOpsRoutes({ operatorToken: 'test-token', plane });
    const healthRoute = routes.find((row) => row.path === '/internal/v1/providers/health');
    assert.ok(healthRoute);
    const statusRoute = routes.find((row) => row.path === '/internal/v1/providers/status');
    assert.ok(statusRoute);

    const health = await healthRoute.handler({
      headers: {
        'x-sunrey-operator-role': 'GOVERNANCE_OPERATOR',
        'x-sunrey-internal-token': 'test-token',
      },
      query: {},
      body: {},
    } as never);
    assert.equal((health.body as { externalProviders: { total: number } }).externalProviders.total, 126);

    const detail = await statusRoute.handler({
      headers: {
        'x-sunrey-operator-role': 'GOVERNANCE_OPERATOR',
        'x-sunrey-internal-token': 'test-token',
      },
      query: { providerId: 'sim-payments' },
      body: {},
    } as never);
    const provider = (detail.body as { provider: ProviderStatusRecord }).provider;
    assert.equal(provider.providerId, 'sim-payments');
    assert.equal(provider.secretValuesPresent, false);
  });
});

describe('Wave 1 regression — provider infrastructure scenarios', () => {
  it('simulates healthy, missing credential, slow, rate-limited, malformed, offline, and stale cached providers', () => {
    const runtime = createUniversalProviderRuntime({ nowMs: () => Date.parse(NOW) });
    const cred = createCredentialRef({
      providerId: 'healthy-vendor',
      secretHref: 'secret://sim/healthy-vendor/api',
      keyVersion: '1',
      environment: 'SANDBOX',
    });
    runtime.register({
      providerId: 'healthy-vendor',
      providerType: 'MARKET_DATA',
      displayName: 'Healthy vendor',
      adapterId: 'healthy-v1',
      capabilities: ['MARKET_DATA.QUOTE'],
      environment: 'SANDBOX',
      lifecycleState: 'SANDBOX',
      credentialReference: cred.ok ? cred.value : null,
      nowUtc: NOW,
    });
    runtime.register({
      providerId: 'missing-cred-vendor',
      providerType: 'KYC',
      displayName: 'Missing credential',
      adapterId: 'kyc-v1',
      capabilities: ['KYC.IDENTITY_VERIFICATION'],
      environment: 'SANDBOX',
      lifecycleState: 'SANDBOX',
      nowUtc: NOW,
    });
    const plane = createProviderObservabilityPlane(runtime, { nowUtc: () => NOW, catalogTotal: 126 });

    runtime.observeHealth({ providerId: 'healthy-vendor', success: true, latencyMs: 12, nowUtc: NOW });
    plane.recordProviderCall({
      providerId: 'healthy-vendor',
      category: 'MARKET_DATA',
      capability: 'MARKET_DATA.QUOTE',
      requestId: 'r1',
      traceId: 't1',
      durationMs: 12,
      statusCode: 200,
      retryCount: 0,
      result: 'success',
      domain: 'exchange',
    });

    runtime.observeHealth({ providerId: 'healthy-vendor', success: true, latencyMs: 4_500, nowUtc: NOW });
    plane.recordProviderCall({
      providerId: 'healthy-vendor',
      category: 'MARKET_DATA',
      capability: 'MARKET_DATA.QUOTE',
      requestId: 'r2',
      traceId: 't2',
      durationMs: 4_500,
      statusCode: 200,
      retryCount: 0,
      result: 'success',
    });

    runtime.observeHealth({
      providerId: 'healthy-vendor',
      success: false,
      latencyMs: 100,
      rateLimited: true,
      nowUtc: NOW,
    });
    plane.recordProviderCall({
      providerId: 'healthy-vendor',
      category: 'MARKET_DATA',
      capability: 'MARKET_DATA.QUOTE',
      requestId: 'r3',
      traceId: 't3',
      durationMs: 100,
      statusCode: 429,
      retryCount: 1,
      result: 'rate_limited',
    });
    plane.metrics.recordDataInvalid({ provider_id: 'healthy-vendor', category: 'MARKET_DATA' });

    for (let i = 0; i < 4; i += 1) {
      runtime.observeHealth({ providerId: 'healthy-vendor', success: false, latencyMs: null, nowUtc: NOW });
    }
    plane.recordProviderCall({
      providerId: 'healthy-vendor',
      category: 'MARKET_DATA',
      capability: 'MARKET_DATA.QUOTE',
      requestId: 'r4',
      traceId: 't4',
      durationMs: 30_000,
      statusCode: null,
      retryCount: 0,
      result: 'timeout',
    });

    const staleAt = new Date(Date.parse(NOW) - 500_000).toISOString();
    plane.cache.put({
      providerId: 'healthy-vendor',
      key: 'default',
      valueDigest: 'stale',
      refreshedAtUtc: staleAt,
      staleAfterMs: 60_000,
    });
    plane.scheduler.register({
      providerId: 'healthy-vendor',
      scheduleId: 'refresh-healthy-vendor',
      intervalMs: 60_000,
    });
    plane.scheduler.recordAttempt('refresh-healthy-vendor', NOW, false);

    const healthy = plane.status.statusOf('healthy-vendor');
    const missing = plane.status.statusOf('missing-cred-vendor');
    assert.ok(healthy && missing);
    assert.equal(missing.credential.credentialConfigured, false);
    assert.equal(healthy.circuitState, 'OPEN');
    assert.equal(healthy.cacheFreshness.isStale, true);
    assert.equal(plane.traces.collector().spans().length >= 5, true);

    const alerts = plane.evaluateAlerts('healthy-vendor');
    assert.ok(alerts.length > 0);
    assert.equal(mapRuntimeHealthToCanonical({
      lifecycleDisabled: false,
      killSwitchBlocked: false,
      runtimeState: 'RATE_LIMITED',
    }), 'degraded');
  });
});

describe('Wave 1 Prompt 7 — cache and scheduler trackers', () => {
  it('tracks cache and scheduler refresh state', () => {
    const cache = new ProviderCacheTracker(60_000);
    cache.put({
      providerId: 'sim-payments',
      key: 'quotes',
      valueDigest: 'd1',
      refreshedAtUtc: NOW,
    });
    assert.equal(cache.get('sim-payments', 'quotes', NOW).cacheState, 'hit');
    cache.invalidate('sim-payments');
    assert.equal(cache.get('sim-payments', 'quotes', NOW).cacheState, 'none');

    const scheduler = new ProviderSchedulerTracker();
    scheduler.register({ providerId: 'sim-payments', scheduleId: 'sched-1', intervalMs: 60_000 });
    scheduler.recordAttempt('sched-1', NOW, false);
    scheduler.recordAttempt('sched-1', NOW, false);
    assert.equal(scheduler.isFailing('sched-1'), false);
    scheduler.recordAttempt('sched-1', NOW, false);
    assert.equal(scheduler.isFailing('sched-1'), true);
  });
});
