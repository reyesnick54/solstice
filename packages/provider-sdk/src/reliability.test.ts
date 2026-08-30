/**
 * Provider Reliability Control Plane — simulation tests.
 * No public internet access required.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ProviderReliabilityControlPlane,
  SimulatedProviderTransport,
  successResponse,
  errorResponse,
  computeBackoffDelayMs,
  decideRetryDelay,
  ProviderBulkheadGuard,
  ProviderCircuitBreaker,
  ProviderRateLimiter,
  InMemoryProviderMetrics,
  mergePolicy,
  DEFAULT_PROVIDER_RELIABILITY_POLICY,
  DEFAULT_GLOBAL_SAFETY_LIMITS,
  staleCacheFallback,
  evaluateFallback,
  parseRetryAfterMs,
  shouldRetryOperation,
  normalizeTransportError,
  type ReliabilityClock,
} from './index.ts';

function createTestClock(startMs = 1_000): ReliabilityClock & { advance(ms: number): void } {
  let now = startMs;
  return {
    nowMs: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    advance(ms: number) {
      now += ms;
    },
  };
}

const fastPolicy = mergePolicy(DEFAULT_PROVIDER_RELIABILITY_POLICY, {
  timeoutMs: 500,
  maxRetries: 3,
  retryBaseDelayMs: 50,
  retryMaxDelayMs: 200,
  concurrencyLimit: 2,
  circuitBreakerThreshold: 3,
  circuitBreakerWindow: 5,
  circuitBreakerCooldown: 100,
  rateLimit: {
    requestsPerSecond: 100,
    requestsPerMinute: 1_000,
    requestsPerHour: null,
    requestsPerDay: null,
  },
});

describe('Provider Reliability Control Plane', () => {
  it('1. immediate success', async () => {
    const clock = createTestClock();
    const metrics = new InMemoryProviderMetrics();
    const plane = new ProviderReliabilityControlPlane({ clock, metrics, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('coingecko', [successResponse({ price: 42 })]);
    const result = await plane.execute(transport, { method: 'GET', path: '/price' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.attempts, 1);
      assert.equal((result.value as { body: { price: number } }).body.price, 42);
    }
    assert.equal(metrics.count('provider_requests_total'), 1);
    assert.equal(metrics.count('provider_retries_total'), 0);
  });

  it('2. transient 503 then success', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('opensky', [
      errorResponse(503),
      successResponse({ flights: [] }),
    ]);
    const result = await plane.execute(transport, { method: 'GET', path: '/states/all' });
    assert.equal(result.ok, true);
    assert.equal(transport.calls.length, 2);
    if (result.ok) {
      assert.equal(result.attempts, 2);
    }
  });

  it('3. repeated 503 opens circuit', async () => {
    const clock = createTestClock();
    const metrics = new InMemoryProviderMetrics();
    const plane = new ProviderReliabilityControlPlane({
      clock,
      metrics,
      policy: mergePolicy(fastPolicy, { maxRetries: 2, circuitBreakerThreshold: 2 }),
    });
    const transport = new SimulatedProviderTransport('failing', [
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
    ]);
    const first = await plane.execute(transport, { method: 'GET', path: '/data' });
    assert.equal(first.ok, false);
    const second = await plane.execute(transport, { method: 'GET', path: '/data' });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'CIRCUIT_OPEN');
      assert.equal(second.circuitState, 'OPEN');
    }
    assert.ok(metrics.count('provider_circuit_open_total') >= 1);
  });

  it('4. timeout', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({
      clock,
      policy: mergePolicy(fastPolicy, { maxRetries: 0, timeoutMs: 10 }),
    });
    const transport = new SimulatedProviderTransport('slow', [{ error: 'timeout' }], 50);
    const result = await plane.execute(transport, { method: 'GET', path: '/slow' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PROVIDER_TIMEOUT');
      assert.equal(result.error.classification, 'retryable');
    }
  });

  it('5. 429 with Retry-After', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('quota', [
      errorResponse(429, { 'retry-after': '1' }),
      successResponse({ ok: true }),
    ]);
    const result = await plane.execute(transport, { method: 'GET', path: '/api' });
    assert.equal(result.ok, true);
    assert.equal(transport.calls.length, 2);
    const parsed = parseRetryAfterMs({ 'retry-after': '1' }, clock.nowMs());
    assert.equal(parsed, 1_000);
  });

  it('6. 401 no retry', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('auth', [errorResponse(401)]);
    const result = await plane.execute(transport, { method: 'GET', path: '/secure' });
    assert.equal(result.ok, false);
    assert.equal(transport.calls.length, 1);
    if (!result.ok) {
      assert.equal(result.error.classification, 'authentication_failure');
      assert.equal(result.attempts, 1);
    }
  });

  it('7. 400 no retry', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('validate', [errorResponse(400)]);
    const result = await plane.execute(transport, { method: 'POST', path: '/submit', body: {} });
    assert.equal(result.ok, false);
    assert.equal(transport.calls.length, 1);
    if (!result.ok) {
      assert.equal(result.error.classification, 'invalid_payload');
    }
  });

  it('8. exponential backoff increases delay', () => {
    const policy = mergePolicy(DEFAULT_PROVIDER_RELIABILITY_POLICY, {
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 10_000,
    });
    const d0 = computeBackoffDelayMs(policy, 0, 0);
    const d1 = computeBackoffDelayMs(policy, 1, 0);
    const d2 = computeBackoffDelayMs(policy, 2, 0);
    assert.ok(d1 > d0);
    assert.ok(d2 > d1);
  });

  it('9. jitter adds variance', () => {
    const policy = DEFAULT_PROVIDER_RELIABILITY_POLICY;
    const samples = new Set<number>();
    for (let i = 0; i < 20; i++) {
      samples.add(computeBackoffDelayMs(policy, 1, 0.25, () => i / 20));
    }
    assert.ok(samples.size > 1, 'jitter should produce varying delays');
  });

  it('10. maximum retry enforcement', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({
      clock,
      policy: mergePolicy(fastPolicy, { maxRetries: 2 }),
      globalLimits: { ...DEFAULT_GLOBAL_SAFETY_LIMITS, maxRetries: 2 },
    });
    const transport = new SimulatedProviderTransport('always-503', [
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
    ]);
    const result = await plane.execute(transport, { method: 'GET', path: '/x' });
    assert.equal(result.ok, false);
    assert.equal(transport.calls.length, 3);
    if (!result.ok) {
      assert.equal(result.attempts, 3);
    }
  });

  it('11. concurrency enforcement', async () => {
    const clock = createTestClock();
    const bulkhead = new ProviderBulkheadGuard({
      concurrencyLimit: 1,
      globalLimits: DEFAULT_GLOBAL_SAFETY_LIMITS,
    });
    const plane = new ProviderReliabilityControlPlane({
      clock,
      policy: mergePolicy(fastPolicy, { concurrencyLimit: 1 }),
      bulkhead,
    });
    const transport = new SimulatedProviderTransport('limited', [successResponse()], 100);
    const first = plane.execute(transport, { method: 'GET', path: '/a' });
    const second = await plane.execute(transport, { method: 'GET', path: '/b' });
    await first;
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'BULKHEAD_REJECTED');
    }
  });

  it('12. provider isolation — one provider cannot block another', async () => {
    const clock = createTestClock();
    const bulkhead = new ProviderBulkheadGuard({
      concurrencyLimit: 1,
      globalLimits: { ...DEFAULT_GLOBAL_SAFETY_LIMITS, globalProviderConcurrencyCeiling: 10 },
    });
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy, bulkhead });
    const slowA = new SimulatedProviderTransport('provider-a', [successResponse()], 50);
    const fastB = new SimulatedProviderTransport('provider-b', [successResponse()]);
    const blocked = plane.execute(slowA, { method: 'GET', path: '/a' });
    const allowed = await plane.execute(fastB, { method: 'GET', path: '/b' });
    await blocked;
    assert.equal(allowed.ok, true);
    assert.equal(bulkhead.inflight('provider-a'), 0);
    assert.equal(bulkhead.inflight('provider-b'), 0);
  });

  it('13. circuit opens after threshold', () => {
    const clock = createTestClock();
    const breaker = new ProviderCircuitBreaker(
      { circuitBreakerThreshold: 2, circuitBreakerWindow: 5, circuitBreakerCooldown: 100 },
      clock,
    );
    breaker.recordFailure('p1');
    assert.equal(breaker.snapshot('p1').state, 'CLOSED');
    breaker.recordFailure('p1');
    assert.equal(breaker.snapshot('p1').state, 'OPEN');
  });

  it('14. half-open probe succeeds and closes circuit', () => {
    const clock = createTestClock();
    const breaker = new ProviderCircuitBreaker(
      { circuitBreakerThreshold: 1, circuitBreakerWindow: 3, circuitBreakerCooldown: 50 },
      clock,
    );
    breaker.recordFailure('p1');
    assert.equal(breaker.snapshot('p1').state, 'OPEN');
    clock.advance(60);
    assert.equal(breaker.allowRequest('p1'), true);
    assert.equal(breaker.snapshot('p1').state, 'HALF_OPEN');
    breaker.recordSuccess('p1');
    assert.equal(breaker.snapshot('p1').state, 'CLOSED');
  });

  it('15. circuit closes after successful half-open probe', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({
      clock,
      policy: mergePolicy(fastPolicy, { circuitBreakerThreshold: 1, circuitBreakerCooldown: 50, maxRetries: 0 }),
    });
    const transport = new SimulatedProviderTransport('recover', [errorResponse(503), successResponse()]);
    await plane.execute(transport, { method: 'GET', path: '/x' });
    clock.advance(60);
    const result = await plane.execute(transport, { method: 'GET', path: '/x' });
    assert.equal(result.ok, true);
    assert.equal(plane.circuitState('recover').state, 'CLOSED');
  });

  it('16. half-open probe fails and reopens circuit', () => {
    const clock = createTestClock();
    const breaker = new ProviderCircuitBreaker(
      { circuitBreakerThreshold: 1, circuitBreakerWindow: 3, circuitBreakerCooldown: 50 },
      clock,
    );
    breaker.recordFailure('p1');
    clock.advance(60);
    breaker.allowRequest('p1');
    breaker.recordFailure('p1');
    assert.equal(breaker.snapshot('p1').state, 'OPEN');
  });

  it('17. timeout budget exceeded before call', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('deadline', [successResponse()]);
    const result = await plane.execute(
      transport,
      { method: 'GET', path: '/x' },
      { deadline: { deadlineMs: clock.nowMs() - 1 } },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PROVIDER_TIMEOUT');
    }
    assert.equal(transport.calls.length, 0);
  });

  it('18. no retry on unsafe POST by default', async () => {
    const clock = createTestClock();
    const plane = new ProviderReliabilityControlPlane({ clock, policy: fastPolicy });
    const transport = new SimulatedProviderTransport('unsafe', [errorResponse(503)]);
    const result = await plane.execute(transport, {
      method: 'POST',
      path: '/submit',
      body: { amount: 100 },
      idempotent: false,
    });
    assert.equal(result.ok, false);
    assert.equal(transport.calls.length, 1);
    const error = normalizeTransportError({ providerId: 'x', response: { status: 503, headers: {}, body: {} } });
    assert.equal(
      shouldRetryOperation({ method: 'POST', idempotent: false, error }),
      false,
    );
  });

  it('rate limiter blocks quota exhaustion', () => {
    const clock = createTestClock();
    const limiter = new ProviderRateLimiter(
      { requestsPerSecond: 2, requestsPerMinute: null, requestsPerHour: null, requestsPerDay: null },
      clock,
    );
    assert.equal(limiter.acquire('p').allowed, true);
    assert.equal(limiter.acquire('p').allowed, true);
    const blocked = limiter.acquire('p');
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.cooldownUntilMs > clock.nowMs());
    }
  });

  it('fallback hook exposes stale cache eligibility', () => {
    const hook = staleCacheFallback();
    const decision = evaluateFallback(hook, {
      providerId: 'p',
      error: normalizeTransportError({ providerId: 'p', response: { status: 503, headers: {}, body: {} } }),
      attempts: 3,
      staleFallbackAllowed: true,
      circuitState: 'OPEN',
    });
    assert.equal(decision.action, 'use_stale_cache');
  });

  it('decideRetryDelay respects max retries', () => {
    const decision = decideRetryDelay({
      policy: mergePolicy(DEFAULT_PROVIDER_RELIABILITY_POLICY, { maxRetries: 2 }),
      attempt: 3,
    });
    assert.equal(decision.retry, false);
  });
});
