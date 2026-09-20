/**
 * HELIOS Multi-Asset M06 — BTC/ETH spot market intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { createCapitalMarketBarStore } from '../packages/sunrey-exchange/src/capital-market/bar-store.ts';
import { sortBarsByPeriodStart } from '../packages/sunrey-exchange/src/capital-market/bar-store.ts';
import {
  buildHeliosCryptoSpotMarketState,
  createCoingeckoCryptoSpotAdapter,
  createCryptoSpotMarketService,
  createHeliosCryptoMarketRoute,
  HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED,
  M06_CRYPTO_SPOT_UNIVERSE,
  resolveCryptoSpotByProviderSymbol,
  resolveCryptoSpotInstrument,
  runM06CryptoMarketQualification,
} from '../packages/sunrey-exchange/src/crypto-market/spot/index.ts';
import { buildHeliosCryptoSpotM04MarketState } from '../packages/platform/src/helios/multi-asset/index.ts';
import { toCryptoSpotM04BridgeInput } from './helpers/crypto-spot-m04-mapper.ts';
import {
  loadHeliosMarketBarState,
  persistHeliosMarketBarState,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';

const NOW = asUtcInstant('2026-09-20T12:00:00.000Z');
const RANGE = Object.freeze({
  from: asUtcInstant('2026-09-20T08:00:00.000Z'),
  to: asUtcInstant('2026-09-20T12:00:00.000Z'),
});
const T08 = 1_789_891_200_000;
const T09 = 1_789_894_800_000;
const T10 = 1_789_898_400_000;

function harnessFetch(mode: 'success' | 'rate_limit' | 'timeout' = 'success') {
  return async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ status: { error_code: 429 } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/simple/price')) {
      const ids = new URL(url).searchParams.get('ids');
      const body =
        ids === 'ethereum'
          ? { ethereum: { usd: 3456.78, usd_24h_vol: 12_000_000_000, last_updated_at: 1_789_891_200 } }
          : { bitcoin: { usd: 65432.1, usd_24h_vol: 28_000_000_000, last_updated_at: 1_789_891_200 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/ohlc')) {
      return new Response(
        JSON.stringify([
          [T08, 65000, 66000, 64500, 65432.1],
          [T09, 65432.1, 66000, 65000, 65800],
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/market_chart')) {
      return new Response(
        JSON.stringify({
          prices: [
            [T08, 65000],
            [T09, 65432.1],
          ],
          total_volumes: [
            [T08, 1_000_000_000],
            [T09, 1_100_000_000],
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
}

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describe('HELIOS M06 crypto spot market data', () => {
  it('maps BTC/USD and ETH/USD through M01 instrument domain', () => {
    assert.equal(M06_CRYPTO_SPOT_UNIVERSE.length, 2);
    assert.equal(resolveCryptoSpotByProviderSymbol('coingecko', 'bitcoin')?.instrumentId, 'CRYPTO:GLOBAL:BTC:USD:SIM');
    assert.equal(resolveCryptoSpotByProviderSymbol('coingecko', 'ethereum')?.instrumentId, 'CRYPTO:GLOBAL:ETH:USD:SIM');
    for (const id of M06_CRYPTO_SPOT_UNIVERSE) {
      assert.ok(resolveCryptoSpotInstrument(id)?.providerSymbols.coingecko);
    }
  });

  it('ingests BTC 1h and 4h bars with OHLCV provenance', async () => {
    const service = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
    });
    const h1 = await service.ingestHistoricalBars({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '1h',
      range: RANGE,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(h1.ok, true);
    if (h1.ok) {
      assert.ok(h1.bars.length > 0);
      assert.equal(h1.bars[0]?.instrument.instrumentId, 'CRYPTO:GLOBAL:BTC:USD:SIM');
      assert.ok(h1.bars[0]?.provenance.rawPayloadHash);
    }

    const h4 = await service.ingestHistoricalBars({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '4h',
      range: RANGE,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(h4.ok, true);
    if (h4.ok) {
      assert.ok(h4.bars.length > 0);
      assert.equal(h4.bars[0]?.timeframe, '4h');
    }
  });

  it('supports 24/7 weekend operation without implying execution', async () => {
    const route = createHeliosCryptoMarketRoute({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
    });
    const weekend = asUtcInstant('2026-09-19T18:00:00.000Z');
    const venue = await route.fetchVenueStatus('CRYPTO_GLOBAL', weekend);
    assert.equal(venue.ok, true);
    if (venue.ok) {
      assert.equal(venue.session.isOpen, true);
      assert.equal(venue.session.sessionStatus, 'OPEN');
    }
  });

  it('handles provider maintenance and stale feed without fixture fallback', async () => {
    const maintenance = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch(), maintenanceActive: true }),
      externalQualificationPassed: true,
    });
    const blocked = await maintenance.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', NOW);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, 'PROVIDER_MAINTENANCE');
    }

    const service = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
    });
    const quote = await service.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', NOW);
    assert.equal(quote.ok, true);
    const staleExchange = buildHeliosCryptoSpotMarketState({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      quote: quote.ok ? quote.value : null,
      session: null,
      latestBar: null,
      barTimeframe: '1h',
      evaluatedAt: NOW,
      staleQuote: true,
    });
    assert.equal(staleExchange?.dataFreshness, 'STALE');
    const staleBridge = buildHeliosCryptoSpotM04MarketState(
      toCryptoSpotM04BridgeInput({
        instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
        quote: quote.ok ? quote.value : null,
        session: null,
        latestBar: null,
        timeframe: '1h',
        evaluatedAt: NOW,
        staleQuote: true,
      })!,
    );
    assert.ok(
      staleBridge?.tradability?.reasonCodes.includes('QUOTE_STALE') || staleBridge?.marketState?.freshness === 'STALE',
    );
  });

  it('preserves quote-notional volume semantics separately from trade count', async () => {
    const service = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
    });
    const ingest = await service.ingestHistoricalBars({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '1h',
      range: RANGE,
      requestBudget: 2,
      nowUtc: NOW,
    });
    assert.equal(ingest.ok, true);
    if (ingest.ok) {
      const withVolume = ingest.bars.find((bar) => bar.volumeUnits !== null);
      assert.ok(withVolume);
      assert.equal(withVolume?.provenance.capability, 'crypto_spot_ohlcv');
    }
  });

  it('rate limits and provider failures degrade without fixture fallback', async () => {
    const rateRoute = createHeliosCryptoMarketRoute({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch('rate_limit') }),
      externalQualificationPassed: true,
    });
    const rate = await rateRoute.fetchObservation('CRYPTO:GLOBAL:ETH:USD:SIM', NOW);
    assert.equal(rate.ok, false);
    if (!rate.ok) {
      assert.equal(rate.code, 'RATE_LIMITED');
      assert.equal(rate.route.status, 'DEGRADED');
    }

    const failRoute = createHeliosCryptoMarketRoute({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch('timeout') }),
      externalQualificationPassed: true,
    });
    const fail = await failRoute.fetchObservation('CRYPTO:GLOBAL:ETH:USD:SIM', NOW);
    assert.equal(fail.ok, false);
    if (!fail.ok) {
      assert.ok(['TIMEOUT', 'NETWORK_ERROR', 'UNAVAILABLE'].includes(fail.code) || fail.route.status === 'UNAVAILABLE');
    }
  });

  it('generates M04 MarketState with research-only execution posture', async () => {
    const barStore = createCapitalMarketBarStore();
    const service = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
      barStore,
    });
    const quote = await service.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', NOW);
    const venue = await service.getVenueStatus('CRYPTO_GLOBAL', NOW);
    await service.ingestHistoricalBars({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '1h',
      range: RANGE,
      requestBudget: 2,
      nowUtc: NOW,
    });
    const bars = sortBarsByPeriodStart(barStore.listByInstrumentTimeframe('CRYPTO:GLOBAL:BTC:USD:SIM', '1h'));
    const exchangeState = buildHeliosCryptoSpotMarketState({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      quote: quote.ok ? quote.value : null,
      session: venue.ok ? venue.value : null,
      latestBar: bars.at(-1) ?? null,
      barTimeframe: '1h',
      evaluatedAt: NOW,
    });
    assert.equal(exchangeState?.executionEnabled, false);
    assert.equal(exchangeState?.researchOnly, true);

    const m04State = buildHeliosCryptoSpotM04MarketState(
      toCryptoSpotM04BridgeInput({
        instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
        quote: quote.ok ? quote.value : null,
        session: venue.ok ? venue.value : null,
        latestBar: bars.at(-1) ?? null,
        timeframe: '1h',
        evaluatedAt: NOW,
      })!,
    );
    assert.ok(m04State?.marketState);
    assert.equal(m04State?.executionEnabled, false);
    assert.equal(m04State?.researchOnly, true);
    assert.equal(m04State?.tradability?.tradability, 'RESEARCH_ONLY');
    assert.equal(m04State?.tradability?.capabilities.executable, false);
    assert.equal(m04State?.tradability?.capabilities.researchable, true);
  });

  it('supports chronological Strategy Lab replay from persisted bars', async () => {
    const barStore = createCapitalMarketBarStore();
    const service = createCryptoSpotMarketService({
      provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
      externalQualificationPassed: true,
      barStore,
    });
    await service.ingestHistoricalBars({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      timeframe: '1h',
      range: RANGE,
      requestBudget: 2,
      nowUtc: NOW,
    });
    const chronological = sortBarsByPeriodStart(barStore.listByInstrument('CRYPTO:GLOBAL:BTC:USD:SIM'));
    for (let i = 1; i < chronological.length; i += 1) {
      assert.ok(Date.parse(chronological[i]!.periodStart) >= Date.parse(chronological[i - 1]!.periodStart));
    }
  });

  describePersistence('persists BTC and ETH bars across restart', () => {
    it('round-trips bar store snapshot through PostgreSQL', async () => {
      const env = await preparePersistence();
      const durable = await createDurableRuntime(env);
      const pool = durable.session.pools.customer;
      const barStore = createCapitalMarketBarStore();
      const service = createCryptoSpotMarketService({
        provider: createCoingeckoCryptoSpotAdapter({ fetchFn: harnessFetch() }),
        externalQualificationPassed: true,
        barStore,
      });
      await service.ingestHistoricalBars({
        instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
        timeframe: '1h',
        range: RANGE,
        requestBudget: 2,
        nowUtc: NOW,
      });
      await service.ingestHistoricalBars({
        instrumentId: 'CRYPTO:GLOBAL:ETH:USD:SIM',
        timeframe: '1h',
        range: RANGE,
        requestBudget: 2,
        nowUtc: NOW,
      });
      const snapshot = barStore.snapshot();
      await persistHeliosMarketBarState(pool, snapshot);

      const restored = createCapitalMarketBarStore();
      restored.restore((await loadHeliosMarketBarState(pool)) as ReturnType<typeof barStore.snapshot>);
      assert.equal(restored.listByInstrument('CRYPTO:GLOBAL:BTC:USD:SIM').length, snapshot.bars.filter((b) => b.instrument.instrumentId === 'CRYPTO:GLOBAL:BTC:USD:SIM').length);
      assert.equal(restored.listByInstrument('CRYPTO:GLOBAL:ETH:USD:SIM').length, snapshot.bars.filter((b) => b.instrument.instrumentId === 'CRYPTO:GLOBAL:ETH:USD:SIM').length);
    });
  });

  it('HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED when all checks pass', async () => {
    const result = await runM06CryptoMarketQualification({ nowUtc: NOW });
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED, result.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.message}`).join('; '));
    assert.equal(result.qualified, true);
    assert.equal(result.secretValuePresent, false);
  });
});
