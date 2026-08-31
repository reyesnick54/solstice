import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../packages/sunrey-exchange/src/ids.ts';
import {
  ALL_CRYPTO_MARKET_ADAPTERS,
  COINGECKO_ADAPTER,
  COINCAP_ADAPTER,
  COINLORE_ADAPTER,
  COINMARKETCAP_ADAPTER,
  COINPAPRIKA_ADAPTER,
  CRYPTO_MARKET_CATALOG_ENTRIES,
  CRYPTO_MARKET_CATALOG_PROVIDER_IDS,
  CRYPTOCOMPARE_ADAPTER,
  createCircuitOpenCryptoAdapter,
  createCryptoMarketReferenceService,
  createFailingCryptoAdapter,
  createRateLimitedCryptoAdapter,
  createStaleCryptoAdapter,
  cryptoMarketCachePolicy,
  CRYPTO_MARKET_CACHE_CAPABILITIES,
  defaultCryptoMarketNow,
  disambiguateSymbolCollision,
  integrations,
  isNativeSunReyAsset,
  listEligibleCryptoMarketProviders,
  parseDecimalToMinorUnits,
  providerNativeId,
  resolveCryptoAsset,
  validatePriceMinorUnits,
  validateQuote,
  validateTimestamp,
} from '../packages/sunrey-exchange/src/crypto-market/index.ts';
import { normalizeCoingeckoBtc } from '../packages/sunrey-exchange/src/crypto-market/adapters/normalize.ts';
import { buildCatalogIndex } from '../packages/provider-sdk/src/catalog/loader.ts';
import { createFixtureCatalog } from '../packages/provider-sdk/src/test-fixtures/catalog.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';

const NOW = defaultCryptoMarketNow();
const BTC_USD = 'CRYPTO:BTC:bitcoin:native:USD';
const ETH_USD = 'CRYPTO:ETH:ethereum:native:USD';
const USDT_USD = 'CRYPTO:USDT:ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7:USD';

describe('Wave 3 Prompt 12 — crypto market reference layer', () => {
  it('1. every selected provider adapter registers', () => {
    assert.equal(ALL_CRYPTO_MARKET_ADAPTERS.length, 5);
    for (const providerId of CRYPTO_MARKET_CATALOG_PROVIDER_IDS) {
      if (providerId === 'coinmarketcap') continue;
      const adapter = ALL_CRYPTO_MARKET_ADAPTERS.find((row) => row.providerId === providerId);
      assert.ok(adapter, `missing adapter for ${providerId}`);
    }
  });

  it('2. catalog identity matches adapter', () => {
    for (const entry of CRYPTO_MARKET_CATALOG_ENTRIES) {
      const adapter = ALL_CRYPTO_MARKET_ADAPTERS.find((row) => row.providerId === entry.provider_id);
      if (entry.provider_id === 'coinmarketcap') {
        assert.equal(COINMARKETCAP_ADAPTER.blocked, true);
        continue;
      }
      assert.ok(adapter);
      assert.equal(adapter!.providerId, entry.provider_id);
    }
  });

  it('3. BTC normalization', async () => {
    const asset = resolveCryptoAsset(BTC_USD)!;
    const quote = normalizeCoingeckoBtc(asset, NOW);
    assert.equal(quote.symbol, 'BTC');
    assert.equal(quote.quoteCurrency, 'USD');
    assert.ok(quote.priceMinorUnits > 0n);
    assert.equal(quote.provenance.priceSourceType, 'GLOBAL_AGGREGATE');
  });

  it('4. ETH normalization', async () => {
    const service = createCryptoMarketReferenceService();
    const quote = await service.getQuote(ETH_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.symbol, 'ETH');
    assert.equal(quote.value.asset.network, 'ethereum');
  });

  it('5. symbol collision handling via network identity', () => {
    const usdt = disambiguateSymbolCollision('USDT');
    assert.ok(usdt.length >= 1);
    const ethNetwork = usdt.find((row) => row.network === 'ethereum');
    assert.ok(ethNetwork);
    assert.ok(ethNetwork!.contractAddress);
  });

  it('6. contract/network identity for stablecoins', () => {
    const usdt = resolveCryptoAsset(USDT_USD);
    assert.ok(usdt);
    assert.equal(usdt!.assetType, 'stablecoin');
    assert.equal(usdt!.contractAddress, '0xdac17f958d2ee523a2206206994597c13d831ec7');
    assert.equal(providerNativeId(usdt!, 'coingecko'), 'tether');
  });

  it('7. global vs venue-specific quote classification', async () => {
    const global = await COINGECKO_ADAPTER.getQuote(BTC_USD, NOW);
    const venue = await CRYPTOCOMPARE_ADAPTER.getQuote(BTC_USD, NOW);
    assert.equal(global.ok, true);
    assert.equal(venue.ok, true);
    if (!global.ok || !venue.ok) return;
    assert.equal(global.value.provenance.priceSourceType, 'GLOBAL_AGGREGATE');
    assert.equal(venue.value.provenance.priceSourceType, 'EXCHANGE_SPECIFIC');
  });

  it('8. decimal precision via minor units', () => {
    const minor = parseDecimalToMinorUnits('67234.56', 2);
    assert.equal(minor, 6723456n);
  });

  it('9. market cap normalization', async () => {
    const quote = await COINGECKO_ADAPTER.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.ok(quote.value.marketCapMinorUnits !== null);
    assert.ok(quote.value.marketCapMinorUnits! > 0n);
  });

  it('10. supply normalization', async () => {
    const quote = await COINGECKO_ADAPTER.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.ok(quote.value.circulatingSupplyMinorUnits !== null);
    assert.ok(quote.value.totalSupplyMinorUnits !== null);
  });

  it('11. historical data', async () => {
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

  it('12. invalid timestamp rejected', () => {
    const result = validateTimestamp('not-a-date');
    assert.equal(result.ok, false);
  });

  it('13. negative price rejected', () => {
    const result = validatePriceMinorUnits(-1n);
    assert.equal(result.ok, false);
  });

  it('14. stale data labeled stale', async () => {
    const stale = createStaleCryptoAdapter('coingecko');
    const quote = await stale.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.freshness.status, 'stale');
  });

  it('15. cache policy differs by capability', () => {
    const spot = cryptoMarketCachePolicy(CRYPTO_MARKET_CACHE_CAPABILITIES.spotQuote);
    const metadata = cryptoMarketCachePolicy(CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata);
    assert.ok(spot.freshTtlMs < metadata.freshTtlMs);
  });

  it('16. provider timeout', async () => {
    const failing = createFailingCryptoAdapter('coincap');
    const service = createCryptoMarketReferenceService({ providers: [failing, COINGECKO_ADAPTER] });
    const quote = await service.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
  });

  it('17. 429 rate limit', async () => {
    const limited = createRateLimitedCryptoAdapter('coincap');
    const result = await limited.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'RATE_LIMITED');
  });

  it('18. fallback to secondary provider', async () => {
    const failing = createFailingCryptoAdapter('coingecko');
    const service = createCryptoMarketReferenceService({ providers: [failing, COINCAP_ADAPTER] });
    const quote = await service.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.providerId, 'coincap');
  });

  it('19. circuit open', async () => {
    const open = createCircuitOpenCryptoAdapter('coingecko');
    const result = await open.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'CIRCUIT_OPEN');
  });

  it('20. provenance attached', async () => {
    const quote = await COINGECKO_ADAPTER.getQuote(BTC_USD, NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.ok(quote.value.provenance.observationId.startsWith('cmref_'));
    assert.ok(quote.value.provenance.rawPayloadHash);
  });

  it('21. exchange reference-vs-order-book separation', () => {
    const proof = integrations.exchangeSeparationProof();
    assert.equal(proof.externalDataPopulatesOrderBook, false);
    assert.equal(proof.externalDataExecutesTrades, false);
  });

  it('22. portfolio estimated valuation separation', async () => {
    const service = createCryptoMarketReferenceService();
    const valuation = await integrations.estimatePortfolioValuation(service, BTC_USD, 100_000_000n, NOW);
    assert.ok(valuation);
    assert.equal(valuation!.valuationType, 'REFERENCE_ESTIMATE');
    assert.equal(valuation!.custodialBalance, false);
    assert.equal(valuation!.settledValue, false);
  });

  it('23. agent cannot execute from observation', async () => {
    const service = createCryptoMarketReferenceService();
    const evidence = await integrations.buildAgentCryptoEvidence(service, [BTC_USD], NOW);
    assert.equal(evidence.tradeAuthorized, false);
    assert.equal(evidence.executionAuthority, false);
    assert.equal(evidence.items[0]?.label, 'REFERENCE_NOT_EXECUTION');
  });

  it('24. SunRey Coin identity unchanged', () => {
    assert.equal(isNativeSunReyAsset(SUNREY_COIN_NATIVE_ASSET_ID), true);
    assert.equal(resolveCryptoAsset(SUNREY_COIN_NATIVE_ASSET_ID), undefined);
  });

  it('25. MoonRey Coin identity unchanged', () => {
    assert.equal(isNativeSunReyAsset(MOONREY_COIN_NATIVE_ASSET_ID), true);
    assert.equal(resolveCryptoAsset(MOONREY_COIN_NATIVE_ASSET_ID), undefined);
  });

  it('26. no credentials exposed through BFF', () => {
    const world = createSandboxWorld();
    const response = handleConsumerBff(
      { ...world },
      {
        method: 'GET',
        path: '/api/v1/markets/crypto',
        query: {},
        body: null,
        authorization: sandboxToken('basic_verified'),
        requestId: 'req_crypto_test',
      },
    );
    assert.equal(response.status, 200);
    const body = JSON.stringify(response.body);
    assert.equal(body.includes('API_KEY'), false);
    assert.equal(body.includes('secret'), false);
    assert.equal(body.includes('api.coingecko.com'), false);
  });

  it('catalog discovery includes crypto providers after merge', () => {
    const index = buildCatalogIndex(
      createFixtureCatalog(
        CRYPTO_MARKET_CATALOG_ENTRIES.map((entry) => entry as never),
      ),
    );
    const matches = listEligibleCryptoMarketProviders(index);
    assert.equal(matches.length, CRYPTO_MARKET_CATALOG_ENTRIES.length);
  });

  it('fixture catalog quote validates', () => {
    const asset = resolveCryptoAsset(BTC_USD)!;
    const quote = normalizeCoingeckoBtc(asset, NOW);
    assert.equal(validateQuote(quote).ok, true);
  });

  it('blocked coinmarketcap adapter remains disabled', async () => {
    const result = await COINMARKETCAP_ADAPTER.getQuote(BTC_USD, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'PROVIDER_BLOCKED');
  });

  it('BFF crypto asset route returns reference quote', () => {
    const world = createSandboxWorld();
    const response = handleConsumerBff(
      { ...world },
      {
        method: 'GET',
        path: `/api/v1/markets/crypto/${encodeURIComponent(BTC_USD)}`,
        query: {},
        body: null,
        authorization: sandboxToken('basic_verified'),
        requestId: 'req_crypto_asset_test',
      },
    );
    assert.equal(response.status, 200);
    const body = response.body as { referenceOnly: boolean; symbol: string };
    assert.equal(body.referenceOnly, true);
    assert.equal(body.symbol, 'BTC');
  });

  it('world integration exposes aggregate crypto context', async () => {
    const service = createCryptoMarketReferenceService();
    const snapshot = await integrations.buildWorldCryptoMarketSnapshot(service, NOW);
    assert.equal(snapshot.officialEconomicStatistic, false);
    assert.equal(snapshot.authorityClass, 'reference_data');
    assert.ok(snapshot.btcPriceMinorUnits);
  });
});
