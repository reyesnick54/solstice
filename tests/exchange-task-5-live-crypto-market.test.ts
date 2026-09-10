import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../packages/sunrey-exchange/src/ids.ts';
import {
  clearCryptoMarketHttpCache,
  createCryptoMarketAdapter,
  createCryptoMarketReferenceService,
  createFailingCryptoAdapter,
  createLiveCoingeckoAdapter,
  createRateLimitedCryptoAdapter,
  defaultCryptoMarketNow,
  isNativeSunReyAsset,
  loadCryptoFixture,
  normalizeProviderQuote,
} from '../packages/sunrey-exchange/src/crypto-market/index.ts';
import { validateCoingeckoPayload } from '../packages/sunrey-exchange/src/crypto-market/adapters/parsers.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';

const NOW = defaultCryptoMarketNow();
const BTC_USD = 'CRYPTO:BTC:bitcoin:native:USD';
const ETH_USD = 'CRYPTO:ETH:ethereum:native:USD';

describe('Exchange Task 5 — live crypto market reference data', () => {
  beforeEach(() => clearCryptoMarketHttpCache());

  it('simulation mode uses fixtures without live network', async () => {
    const adapter = createLiveCoingeckoAdapter({ mode: 'simulation' });
    const quote = await adapter.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.providerId, 'coingecko');
    assert.equal(adapter.liveProviderConnected, false);
  });

  it('live HTTP success via injected fetch', async () => {
    const fixture = loadCryptoFixture('coingecko-btc.json');
    const adapter = createLiveCoingeckoAdapter({
      mode: 'live',
      environment: 'test',
      fetchFn: async () =>
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const quote = await adapter.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.symbol, 'BTC');
    assert.equal(adapter.liveProviderConnected, true);
  });

  it('classifies HTTP 429', async () => {
    const adapter = createLiveCoingeckoAdapter({
      mode: 'live',
      environment: 'test',
      fetchFn: async () => new Response('rate limited', { status: 429 }),
    });
    const result = await adapter.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'RATE_LIMITED');
  });

  it('classifies timeout via failing fixture adapter', async () => {
    const failing = createFailingCryptoAdapter('coingecko');
    const result = await failing.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'PROVIDER_TIMEOUT');
  });

  it('rejects malformed payload', async () => {
    const adapter = createLiveCoingeckoAdapter({
      mode: 'live',
      environment: 'test',
      fetchFn: async () => new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    });
    const result = await adapter.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'INVALID_PAYLOAD');
  });

  it('provider normalization from raw payload', () => {
    const raw = loadCryptoFixture('coingecko-btc.json');
    assert.equal(validateCoingeckoPayload(raw), true);
    const normalized = normalizeProviderQuote('coingecko', raw, BTC_USD, NOW);
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.ok(normalized.quote.provenance.rawPayloadHash);
    assert.equal(normalized.quote.provenance.priceSourceType, 'GLOBAL_AGGREGATE');
  });

  it('fallback to secondary provider on primary failure', async () => {
    const failing = createFailingCryptoAdapter('coingecko');
    const coincap = createCryptoMarketAdapter('coincap', { mode: 'simulation' });
    const service = createCryptoMarketReferenceService({ providers: [failing, coincap] });
    const quote = await service.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.providerId, 'coincap');
  });

  it('stale data labeled via fixture adapter', async () => {
    const { createStaleCryptoAdapter } = await import('../packages/sunrey-exchange/src/crypto-market/index.ts');
    const stale = createStaleCryptoAdapter('coingecko');
    const quote = await stale.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.freshness.status, 'stale');
  });

  it('rejects SRC native asset for external provider', async () => {
    const adapter = createLiveCoingeckoAdapter({ mode: 'simulation' });
    const result = await adapter.getQuote(SUNREY_COIN_NATIVE_ASSET_ID, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'UNKNOWN_ASSET');
  });

  it('rejects MRC native asset for external provider', async () => {
    const adapter = createLiveCoingeckoAdapter({ mode: 'simulation' });
    const result = await adapter.getQuote(MOONREY_COIN_NATIVE_ASSET_ID, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'UNKNOWN_ASSET');
  });

  it('native asset separation unchanged', () => {
    assert.equal(isNativeSunReyAsset(SUNREY_COIN_NATIVE_ASSET_ID), true);
    assert.equal(isNativeSunReyAsset(MOONREY_COIN_NATIVE_ASSET_ID), true);
  });

  it('missing cryptocompare credential returns error in live mode', async () => {
    const original = process.env.CRYPTOCOMPARE_API_KEY;
    delete process.env.CRYPTOCOMPARE_API_KEY;
    const adapter = createCryptoMarketAdapter('cryptocompare', { mode: 'live', environment: 'test' });
    const result = await adapter.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'MISSING_CREDENTIAL');
    if (original !== undefined) {
      process.env.CRYPTOCOMPARE_API_KEY = original;
    }
  });

  it('BFF crypto asset route returns reference quote', async () => {
    const world = createSandboxWorld();
    const response = await handleConsumerBff(
      { ...world },
      {
        method: 'GET',
        path: `/api/v1/markets/crypto/${encodeURIComponent(BTC_USD)}`,
        query: {},
        body: null,
        authorization: sandboxToken('basic_verified'),
        requestId: 'req_crypto_asset_live_test',
      },
    );
    assert.equal(response.status, 200);
    const body = response.body as { referenceOnly: boolean; symbol: string };
    assert.equal(body.referenceOnly, true);
    assert.equal(body.symbol, 'BTC');
  });

  it('BFF does not expose credentials or provider URLs', async () => {
    const world = createSandboxWorld();
    const response = await handleConsumerBff(
      { ...world },
      {
        method: 'GET',
        path: '/api/v1/markets/crypto',
        query: {},
        body: null,
        authorization: sandboxToken('basic_verified'),
        requestId: 'req_crypto_markets_live_test',
      },
    );
    assert.equal(response.status, 200);
    const body = JSON.stringify(response.body);
    assert.equal(body.includes('API_KEY'), false);
    assert.equal(body.includes('api.coingecko.com'), false);
  });

  it('ETH normalization through service', async () => {
    const service = createCryptoMarketReferenceService();
    const quote = await service.getQuote(ETH_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.symbol, 'ETH');
  });

  it('historical candles available', async () => {
    const service = createCryptoMarketReferenceService();
    const history = await service.getHistory(
      BTC_USD,
      '1d',
      { from: asUtcInstant('2026-01-01T00:00:00.000Z'), to: NOW },
      NOW,
    );
    assert.equal(history.ok, true);
    if (!history.ok) return;
    assert.equal(history.value[0]?.interval, '1d');
  });

  it('429 rate limit on fixture adapter', async () => {
    const limited = createRateLimitedCryptoAdapter('coincap');
    const result = await limited.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'RATE_LIMITED');
  });
});
