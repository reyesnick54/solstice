/**
 * HELIOS Multi-Asset M05 — equity/index market data expansion.
 */

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  createFinnhubCapitalMarketAdapter,
  FINNHUB_CREDENTIAL_ENV_VAR,
} from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createCapitalMarketBarStore } from '../packages/sunrey-exchange/src/capital-market/bar-store.ts';
import { detectGaps } from '../packages/sunrey-exchange/src/capital-market/historical-ingestion.ts';
import {
  M05_EQUITY_INDEX_UNIVERSE,
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
} from '../packages/sunrey-exchange/src/capital-market/instrument-registry.ts';
import { createHeliosMarketDataRoute } from '../packages/sunrey-exchange/src/capital-market/integrations/helios.ts';
import {
  HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED,
  runM05EquityIndexQualification,
} from '../packages/sunrey-exchange/src/capital-market/qualification.ts';
import { createCapitalMarketService } from '../packages/sunrey-exchange/src/capital-market/service.ts';
import {
  loadHeliosMarketBarState,
  persistHeliosMarketBarState,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';

const NOW = asUtcInstant('2026-09-16T15:30:00.000Z');
const RANGE_15M = Object.freeze({
  from: asUtcInstant('2026-09-16T13:00:00.000Z'),
  to: asUtcInstant('2026-09-16T15:30:00.000Z'),
});

function candleResponse(): Response {
  return new Response(
    JSON.stringify({
      s: 'ok',
      t: [1_789_563_600, 1_789_568_100, 1_789_572_600],
      o: [498.0, 499.5, 500.0],
      h: [499.0, 500.5, 501.0],
      l: [497.5, 498.5, 499.5],
      c: [498.5, 500.0, 500.12],
      v: [1000, 1100, 1200],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function quoteResponse(price: number): Response {
  return new Response(JSON.stringify({ c: price, o: price - 1, h: price + 1, l: price - 2, pc: price - 0.5, t: 1_789_572_600 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function routingFetch(mode: 'success' | 'rate_limit' | 'timeout' | 'invalid' | 'no_data' = 'success') {
  return async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/stock/candle')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ s: 'ok', t: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (mode === 'no_data') {
        return new Response(JSON.stringify({ s: 'no_data' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return candleResponse();
    }
    if (url.includes('/stock/market-status')) {
      return new Response(JSON.stringify({ exchange: 'US', timezone: 'America/New_York', session: 'regular', isOpen: true, t: 1_789_572_600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/quote')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ c: null }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const symbol = new URL(url).searchParams.get('symbol') ?? 'AAPL';
      const price = symbol === 'SPY' ? 500.12 : symbol === 'QQQ' ? 430.25 : 227.5;
      return quoteResponse(price);
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
}

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describe('HELIOS M05 equity/index market data', () => {
  const original = process.env[FINNHUB_CREDENTIAL_ENV_VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    } else {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = original;
    }
  });

  it('registers M05 universe instruments with provider mapping', () => {
    assert.equal(M05_EQUITY_INDEX_UNIVERSE.length, 5);
    for (const instrumentId of M05_EQUITY_INDEX_UNIVERSE) {
      const row = resolveCapitalMarketInstrument(instrumentId);
      assert.ok(row, instrumentId);
      assert.ok(row.providerSymbols.finnhub);
    }
    assert.equal(resolveCapitalMarketInstrumentByProviderSymbol('finnhub', 'NVDA')?.instrumentId, 'SECURITY:US:NVDA:XNAS');
  });

  it('ingests SPY 15m bars with OHLCV and provenance', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true });
    const result = await service.ingestHistoricalBars({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      range: RANGE_15M,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.bars.length > 0);
      assert.equal(result.bars[0]?.instrument.instrumentId, 'SECURITY:US:SPY:ARCX');
      assert.equal(result.bars[0]?.timeframe, '15m');
      assert.ok(result.bars[0]?.openMinorUnits > 0n);
      assert.ok(result.bars[0]?.volumeUnits !== null);
      assert.equal(result.bars[0]?.provenance.capability, 'equity_intraday_bars');
      assert.equal('c' in (result.bars[0] as unknown as Record<string, unknown>), false);
    }
  });

  it('ingests QQQ 15m bars', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true });
    const result = await service.ingestHistoricalBars({
      instrumentId: 'SECURITY:US:QQQ:XNAS',
      timeframe: '15m',
      range: RANGE_15M,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.bars.length > 0);
      assert.equal(result.bars[0]?.instrument.symbol, 'QQQ');
    }
  });

  it('fetches normalized AAPL quote', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const route = createHeliosMarketDataRoute({
      provider: createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') }),
      externalQualificationPassed: true,
    });
    const result = await route.fetchObservation('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.observation.instrument.instrumentId, 'SECURITY:US:AAPL:XNAS');
      assert.equal(result.observation.lastMinorUnits, 22750n);
    }
  });

  it('detects duplicate bars on idempotent storage', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const store = createCapitalMarketBarStore();
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true, barStore: store });
    const first = await service.ingestHistoricalBars({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      range: RANGE_15M,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const duplicatePut = store.putMany(first.bars);
    assert.ok(duplicatePut.duplicates > 0);
    assert.equal(duplicatePut.stored, 0);
  });

  it('supports explicit range queries', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true });
    const result = await service.getHistoricalBars('SECURITY:US:SPY:ARCX', '15m', RANGE_15M, NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.value.length > 0);
      for (const bar of result.value) {
        assert.ok(Date.parse(bar.periodStart) >= Date.parse(RANGE_15M.from));
        assert.ok(Date.parse(bar.periodStart) <= Date.parse(RANGE_15M.to));
      }
    }
  });

  it('returns NOT_CONFIGURED without credential', async () => {
    delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
    const route = createHeliosMarketDataRoute();
    const result = await route.fetchObservation('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'NOT_CONFIGURED');
    }
  });

  it('maps rate limit without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('rate_limit') });
    const result = await provider.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'RATE_LIMITED');
    }
  });

  it('maps timeout without fixture fallback', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('timeout') });
    const result = await provider.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(result.ok, false);
  });

  it('rejects invalid payload', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('invalid') });
    const quote = await provider.getQuote('SECURITY:US:AAPL:XNAS', NOW);
    assert.equal(quote.ok, false);
    if (!quote.ok) {
      assert.equal(quote.code, 'INVALID_PAYLOAD');
    }
    const bars = await provider.getHistoricalBars('SECURITY:US:SPY:ARCX', '15m', RANGE_15M, NOW);
    assert.equal(bars.ok, false);
    if (!bars.ok) {
      assert.equal(bars.code, 'INVALID_PAYLOAD');
    }
  });

  it('returns truthful unavailable state for provider no_data', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('no_data') });
    const result = await provider.getHistoricalBars('SECURITY:US:SPY:ARCX', '1m', RANGE_15M, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PROVIDER_CAPABILITY_UNAVAILABLE');
    }
  });

  it('reports entitlement capability state', () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const capabilities = provider.getCapabilities(NOW);
    assert.ok(capabilities.some((row) => row.capability === 'equity_quotes' && row.status === 'available'));
    assert.ok(capabilities.some((row) => row.capability === 'equity_intraday_bars'));
  });

  it('generates market state from quote, session, and bars', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true });
    await service.ingestHistoricalBars({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      range: RANGE_15M,
      requestBudget: 2,
      nowUtc: NOW,
    });
    const marketState = await service.buildMarketState('SECURITY:US:SPY:ARCX', NOW, { barTimeframe: '15m' });
    assert.ok(marketState);
    assert.equal(marketState?.symbol, 'SPY');
    assert.equal(marketState?.sessionStatus, 'OPEN');
    assert.equal(marketState?.lastMinorUnits, 50012n);
    assert.equal(marketState?.latestBarTimeframe, '15m');
  });

  it('detects gaps in stored bar sequences', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
    const service = createCapitalMarketService({ provider, externalQualificationPassed: true });
    const ingest = await service.ingestHistoricalBars({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      timeframe: '15m',
      range: RANGE_15M,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(ingest.ok, true);
    if (!ingest.ok) return;
    const gaps = detectGaps(ingest.bars.slice(0, 1), RANGE_15M, '15m');
    assert.ok(gaps.gapsDetected > 0);
  });

  it('qualification marker HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED when checks pass', async () => {
    process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
    const result = await runM05EquityIndexQualification({ nowUtc: NOW });
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.secretValuePresent, false);
    assert.equal(JSON.stringify(result).includes('test-key'), false);
  });

  describePersistence('persists and restores bar store across restart', () => {
    it('round-trips bar snapshots through PostgreSQL', async () => {
      process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
      const env = await preparePersistence();
      const runtime = await createDurableRuntime(env);
      const pool = runtime.session.pools.customer;
      const provider = createFinnhubCapitalMarketAdapter({ fetchFn: routingFetch('success') });
      const store = createCapitalMarketBarStore();
      const service = createCapitalMarketService({ provider, externalQualificationPassed: true, barStore: store });
      const ingest = await service.ingestHistoricalBars({
        instrumentId: 'SECURITY:US:SPY:ARCX',
        timeframe: '15m',
        range: RANGE_15M,
        requestBudget: 2,
        nowUtc: NOW,
      });
      assert.equal(ingest.ok, true);
      await persistHeliosMarketBarState(pool, store.snapshot());
      const restored = await loadHeliosMarketBarState(pool);
      const restoredStore = createCapitalMarketBarStore();
      restoredStore.restore(restored);
      assert.equal(restoredStore.list().length, store.list().length);
    });
  });
});
