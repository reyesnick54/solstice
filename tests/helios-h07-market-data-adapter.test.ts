import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createFinnhubCapitalMarketAdapter } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createCapitalMarketService } from '../packages/sunrey-exchange/src/capital-market/service.ts';
import {
  createHeliosMarketDataRoute,
  heliosMarketDataNowUtc,
} from '../packages/sunrey-exchange/src/capital-market/integrations/helios.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

describe('HELIOS H07 market data adapter', () => {
  const original = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = original;
    }
  });

  it('exposes provider-independent route status', () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const route = createHeliosMarketDataRoute();
    const status = route.status(NOW);
    assert.equal(status.routeId, 'helios.capital-market.finnhub');
    assert.equal(status.providerId, 'finnhub');
    assert.equal(status.status, 'NOT_CONFIGURED');
  });

  it('does not fetch when route is not configured', async () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const route = createHeliosMarketDataRoute();
    const result = await route.fetchObservation('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'NOT_CONFIGURED');
      assert.equal(result.route.status, 'NOT_CONFIGURED');
    }
  });

  it('consumes normalized observations without vendor json', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 500.12, o: 498.0, h: 501.0, l: 497.5, pc: 499.0, t: 1_726_502_400 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosMarketDataRoute({
      provider,
      externalQualificationPassed: true,
    });
    const result = await route.fetchObservation('SECURITY:US:SPY:ARCX', NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.observation.schema, 'sunrey.capital-market.v1');
      assert.equal(result.observation.instrument.instrumentId, 'SECURITY:US:SPY:ARCX');
      assert.equal(result.observation.providerId, 'finnhub');
      assert.equal(result.observation.lastMinorUnits, 50012n);
      assert.equal('c' in (result.observation as unknown as Record<string, unknown>), false);
    }
  });

  it('marks degraded on rate limit without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: 'rate limit' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosMarketDataRoute({
      provider,
      externalQualificationPassed: true,
    });
    const result = await route.fetchObservation('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'RATE_LIMITED');
      assert.equal(result.route.status, 'DEGRADED');
    }
  });

  it('does not embed customer context into shared observation state', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 227.5, t: 1_726_502_400 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const route = createHeliosMarketDataRoute({
      provider,
      externalQualificationPassed: true,
    });
    const result = await route.fetchObservation('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      const keys = Object.keys(result.observation as unknown as Record<string, unknown>);
      assert.equal(keys.includes('customerId'), false);
      assert.equal(keys.includes('subjectId'), false);
      assert.equal('customerId' in (result.observation.instrument as unknown as Record<string, unknown>), false);
    }
  });

  it('qualification harness reports pending without credential', async () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const service = createCapitalMarketService();
    const result = await service.qualifyExternal(heliosMarketDataNowUtc());
    assert.equal(result.outcome, 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING');
    assert.equal(result.failureModeWorks, true);
    assert.equal(result.rateLimitBehaviorWorks, true);
  });
});
