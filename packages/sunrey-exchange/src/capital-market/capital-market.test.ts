import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { createFinnhubCapitalMarketAdapter, FINNHUB_CREDENTIAL_ENV_VAR } from './adapters/finnhub-adapter.ts';
import {
  decimalToMinorUnits,
  finnhubSourceTimestamp,
  validateFinnhubQuotePayload,
} from './adapters/parsers.ts';
import { entitlementBlocksRealtimePresentation, resolveCapitalMarketEntitlement } from './entitlement.ts';
import {
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
  resolveCapitalMarketInstrumentByTickerVenue,
} from './instrument-registry.ts';
import { CapitalMarketService, createCapitalMarketService } from './service.ts';
import { quarantineIfInvalid, validateCapitalMarketObservation } from './validation.ts';
import type { CapitalMarketObservation } from './types.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

function sampleObservation(overrides: Partial<CapitalMarketObservation> = {}): CapitalMarketObservation {
  const instrument = resolveCapitalMarketInstrument('SECURITY:US:AAPL:XNAS')!;
  return Object.freeze({
    schema: 'sunrey.capital-market.v1',
    authority: 'REFERENCE_ONLY',
    observationType: 'quote',
    instrument,
    bidMinorUnits: null,
    askMinorUnits: null,
    lastMinorUnits: 22750n,
    openMinorUnits: 22600n,
    highMinorUnits: 22900n,
    lowMinorUnits: 22500n,
    previousCloseMinorUnits: 22650n,
    volumeUnits: null,
    priceScale: 2,
    currency: 'USD',
    sessionStatus: 'UNKNOWN',
    providerId: 'finnhub',
    sourceTimestamp: NOW,
    arrivalTimestamp: NOW,
    availabilityTimestamp: NOW,
    entitlement: resolveCapitalMarketEntitlement({
      providerId: 'finnhub',
      providerDeclaredRealtime: true,
      feedTier: 'free_tier',
    }),
    sequenceNumber: null,
    provenance: Object.freeze({
      providerId: 'finnhub',
      authorityClass: 'reference_data',
      sourceUrl: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
      rawPayloadHash: 'a'.repeat(64),
      observationId: 'obs_test',
      capability: 'equity_quotes',
    }),
    ...overrides,
  });
}

describe('capital market instrument mapping', () => {
  it('resolves canonical instrument by id', () => {
    const row = resolveCapitalMarketInstrument('SECURITY:US:AAPL:XNAS');
    assert.ok(row);
    assert.equal(row.symbol, 'AAPL');
    assert.equal(row.venue.venueId, 'XNAS');
  });

  it('resolves by ticker and venue to prevent collisions', () => {
    const row = resolveCapitalMarketInstrumentByTickerVenue('AAPL', 'XNAS');
    assert.ok(row);
    assert.equal(row.instrumentId, 'SECURITY:US:AAPL:XNAS');
  });

  it('resolves provider symbol mapping', () => {
    const row = resolveCapitalMarketInstrumentByProviderSymbol('finnhub', 'SPY');
    assert.ok(row);
    assert.equal(row.instrumentId, 'SECURITY:US:SPY:ARCX');
  });
});

describe('capital market parsers', () => {
  it('validates finnhub payload', () => {
    assert.equal(validateFinnhubQuotePayload({ c: 227.5, t: 1_726_502_400 }), true);
    assert.equal(validateFinnhubQuotePayload({ c: Number.NaN }), false);
    assert.equal(validateFinnhubQuotePayload({}), false);
  });

  it('parses finnhub timestamps', () => {
    assert.equal(finnhubSourceTimestamp({ t: 1_726_502_400 }), '2024-09-16T16:00:00.000Z');
    assert.equal(finnhubSourceTimestamp({}), null);
  });

  it('converts decimal prices to minor units', () => {
    assert.equal(decimalToMinorUnits(227.5), 22750n);
    assert.equal(decimalToMinorUnits(Number.POSITIVE_INFINITY), null);
  });
});

describe('capital market entitlement', () => {
  it('captures sandbox entitlement in simulation', () => {
    const entitlement = resolveCapitalMarketEntitlement({
      providerId: 'finnhub',
      providerDeclaredRealtime: true,
      feedTier: 'free_tier',
    });
    assert.equal(entitlement.entitlementClass, 'sandbox');
    assert.equal(entitlement.feedTier, 'sandbox');
    assert.equal(entitlementBlocksRealtimePresentation(entitlement), true);
  });
});

describe('capital market validation', () => {
  it('rejects malformed timestamps', () => {
    const bad = sampleObservation({ sourceTimestamp: 'not-a-timestamp' as typeof NOW });
    const result = validateCapitalMarketObservation(bad);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INVALID_TIMESTAMP');
    }
  });

  it('rejects negative prices', () => {
    const bad = sampleObservation({ lastMinorUnits: -1n });
    const result = validateCapitalMarketObservation(bad);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'NEGATIVE_PRICE');
    }
  });

  it('quarantines invalid observations', () => {
    const bad = sampleObservation({ currency: 'US' });
    const result = quarantineIfInvalid(bad);
    assert.equal(result.ok, false);
  });
});

describe('finnhub adapter', () => {
  const original = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = original;
    }
  });

  it('reports not configured without credential', () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const adapter = createFinnhubCapitalMarketAdapter();
    assert.equal(adapter.credentialConfigured(), false);
    const health = adapter.health(NOW);
    assert.equal(health.credentialConfigured, false);
    assert.equal(health.status, 'unavailable');
  });

  it('parses finnhub response via injected fetch', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const adapter = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: 227.5, o: 226.0, h: 229.0, l: 225.0, pc: 226.5, t: 1_726_502_400 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.instrument.instrumentId, 'SECURITY:US:AAPL:XNAS');
      assert.equal(result.value.lastMinorUnits, 22750n);
      assert.equal(result.value.entitlement.entitlementClass, 'sandbox');
    }
  });

  it('maps authentication failure without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'bad-key';
    const adapter = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AUTHENTICATION_FAILED');
    }
  });

  it('maps rate limit without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const adapter = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: 'rate limit' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'RATE_LIMITED');
    }
    assert.equal(adapter.health(NOW).rateLimited, true);
  });

  it('maps timeout without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const adapter = createFinnhubCapitalMarketAdapter({
      fetchFn: async () => {
        throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      },
    });
    const result = await adapter.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
  });

  it('rejects malformed provider payload', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const adapter = createFinnhubCapitalMarketAdapter({
      fetchFn: async () =>
        new Response(JSON.stringify({ c: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const result = await adapter.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INVALID_PAYLOAD');
    }
  });
});

describe('capital market service', () => {
  const original = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = original;
    }
  });

  it('reports NOT_CONFIGURED without credential', () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const service = createCapitalMarketService();
    const diagnostics = service.diagnostics(NOW);
    assert.equal(diagnostics.routeStatus, 'NOT_CONFIGURED');
    assert.equal(diagnostics.externalQualificationStatus, 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING');
  });

  it('reports NOT_QUALIFIED when external qualification has not passed', () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const service = createCapitalMarketService({ externalQualificationPassed: false });
    const diagnostics = service.diagnostics(NOW);
    assert.equal(diagnostics.routeStatus, 'NOT_QUALIFIED');
  });

  it('qualification pending without credential', async () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const service = createCapitalMarketService();
    const result = await service.qualifyExternal(NOW);
    assert.equal(result.outcome, 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING');
    assert.equal(result.secretValuePresent, false);
    assert.equal(JSON.stringify(result).includes('test-key'), false);
  });
});
