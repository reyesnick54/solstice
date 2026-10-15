/**
 * HELIOS AAF08 — external equities / ETF observation plane.
 */

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { createAaf08CapitalMarketProviderPort } from '../packages/external-data/src/helios/aaf08-capital-market-port.ts';
import {
  createFinnhubCapitalMarketAdapter,
  FINNHUB_CREDENTIAL_ENV_VAR,
} from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createCapitalMarketService } from '../packages/sunrey-exchange/src/capital-market/service.ts';
import { createTemporalEntityGraphStore } from '../packages/platform/src/helios/feature-fabric/entity-resolution/graph-store.ts';
import { createHeliosFeatureFabricStore, HeliosFeatureFabric } from '../packages/platform/src/helios/feature-fabric/index.ts';
import { HeliosMarketObservationFabric } from '../packages/platform/src/helios/market-observation/ingest.ts';
import {
  AAF08_EQUITIES_ETF_UNIVERSE,
  HeliosExternalEquitiesObservationPlane,
  HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED,
  materializeAaf08LastPriceFeature,
  runAaf08Qualification,
  seedAaf08EquitiesEntityGraph,
} from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities/index.ts';
import { FINNHUB_PROVIDER_ID } from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf07/index.ts';
import { certifyAaf07Provider } from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf07/certification.ts';

const NOW = asUtcInstant('2026-09-16T15:30:00.000Z');
const RANGE = Object.freeze({
  from: asUtcInstant('2026-09-16T13:00:00.000Z'),
  to: asUtcInstant('2026-09-16T15:30:00.000Z'),
});

function harnessFetch(mode: 'success' | 'rate_limit' | 'timeout' | 'invalid' | 'stale' = 'success') {
  return async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/stock/candle')) {
      return new Response(
        JSON.stringify({
          s: 'ok',
          t: [1_789_563_600, 1_789_568_100, 1_789_572_600],
          o: [498, 499.5, 500],
          h: [499, 500.5, 501],
          l: [497.5, 498.5, 499.5],
          c: [498.5, 500, 500.12],
          v: [1000, 1100, 1200],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/stock/market-status')) {
      return new Response(
        JSON.stringify({ exchange: 'US', timezone: 'America/New_York', session: 'regular', isOpen: true, t: 1_789_572_600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/quote')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ c: null }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const symbol = new URL(url).searchParams.get('symbol') ?? 'SPY';
      const price = symbol === 'SPY' ? 500.12 : symbol === 'QQQ' ? 430.25 : 227.5;
      const t = mode === 'stale' ? 1_789_500_000 : 1_789_572_600;
      return new Response(
        JSON.stringify({ c: price, o: price - 1, h: price + 1, l: price - 2, pc: price - 0.5, t }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };
}

function createPlane(fetchFn: typeof fetch, nowUtc = NOW): HeliosExternalEquitiesObservationPlane {
  const graph = createTemporalEntityGraphStore();
  seedAaf08EquitiesEntityGraph(graph);
  const clock = new FrozenClock(nowUtc);
  const adapter = createFinnhubCapitalMarketAdapter({ fetchFn });
  const service = createCapitalMarketService({ provider: adapter, fetchFn, externalQualificationPassed: true });
  const provider = createAaf08CapitalMarketProviderPort(service);
  const vault = new EvidenceVault(clock);
  return new HeliosExternalEquitiesObservationPlane({
    clock,
    marketFabric: new HeliosMarketObservationFabric({ clock }),
    entityGraph: graph,
    provider,
    evidenceVault: vault,
    staleQuoteThresholdMs: 60_000,
  });
}

describe('HELIOS AAF08 external equities observation plane', () => {
  const original = process.env[FINNHUB_CREDENTIAL_ENV_VAR];
  afterEach(() => {
    if (original === undefined) delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    else process.env[FINNHUB_CREDENTIAL_ENV_VAR] = original;
  });

  it('AAF07 certifies finnhub profile from verified documentation metadata', () => {
    const verdict = certifyAaf07Provider(FINNHUB_PROVIDER_ID);
    assert.equal(verdict.certified, true);
    assert.equal(verdict.grantsExecutionAuthority, false);
  });

  it('resolves finnhub symbols through AAF03 without using vendor symbol as canonical id', () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const plane = createPlane(harnessFetch('success'));
    const binding = plane.resolveProviderSymbol('SPY', NOW, NOW);
    assert.equal(binding.resolutionState, 'RESOLVED');
    assert.equal(binding.canonicalInstrumentId, 'SECURITY:US:SPY:ARCX');
    assert.notEqual(binding.canonicalInstrumentId, 'SPY');
  });

  it('ingests SPY quote and 15m bars with provenance into M02 fabric', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const plane = createPlane(harnessFetch('success'));
    const quote = await plane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
    assert.equal(quote.ok, true);
    const bars = await plane.ingestHistoricalBars(AAF08_EQUITIES_ETF_UNIVERSE[0], '15m', RANGE);
    assert.equal(bars.ok, true);
    const api = plane.strategyApi();
    const stored = api.getBars({
      instrumentId: AAF08_EQUITIES_ETF_UNIVERSE[0],
      timeframe: '15m',
      knowableAt: NOW,
    });
    assert.ok(stored.length >= 1);
    assert.equal(stored[0]!.instrumentId, AAF08_EQUITIES_ETF_UNIVERSE[0]);
    assert.ok(stored[0]!.provenance.rawPayloadHash.length > 8);
  });

  it('surfaces provider failures without synthetic fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const plane = createPlane(harnessFetch('rate_limit'));
    const result = await plane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
    assert.equal(result.ok, false);
    assert.ok(result.evidenceRef);
  });

  it('rejects stale quotes and surfaces evidence', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const plane = createPlane(harnessFetch('stale'));
    const result = await plane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'STALE_QUOTE');
    assert.ok(result.evidenceRef);
  });

  it('bridges sealed quotes into AAF02 feature fabric', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const plane = createPlane(harnessFetch('success'));
    await plane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
    const quote = plane.strategyApi().getLatestQuote({
      instrumentId: AAF08_EQUITIES_ETF_UNIVERSE[0],
      knowableAt: NOW,
    });
    assert.ok(quote);
    const fabric = new HeliosFeatureFabric({
      clock: new FrozenClock(NOW),
      store: createHeliosFeatureFabricStore(),
    });
    materializeAaf08LastPriceFeature(fabric, quote!, NOW);
    assert.equal(fabric.store().listObservations().length, 1);
  });

  it('qualification marker HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const result = await runAaf08Qualification({
      nowUtc: NOW,
      createProviderPort: (fetchFn) => {
        const adapter = createFinnhubCapitalMarketAdapter({ fetchFn });
        const service = createCapitalMarketService({ provider: adapter, fetchFn, externalQualificationPassed: true });
        return createAaf08CapitalMarketProviderPort(service);
      },
    });
    assert.equal(result.marker, HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED);
  });
});
