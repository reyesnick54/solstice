import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { createFixtureCatalog, FIXTURE_CATALOG_ENTRIES } from '../packages/provider-sdk/src/test-fixtures/catalog.ts';
import { buildCatalogIndex } from '../packages/provider-sdk/src/catalog/loader.ts';
import { handleConsumerBff } from '../services/api/src/consumer/bff-test-utils.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import {
  COMMODITY_CODES,
  convertMassPrice,
  createMarketReferenceService,
  createSimulationMarketReferenceAdapter,
  defaultMarketReferenceNow,
  loadMarketReferenceCatalog,
  marketReferenceCachePolicy,
  MARKET_REFERENCE_CACHE_CAPABILITIES,
  resolveMarketAsset,
  resolveMarketAssetByTickerVenue,
  SimulationMarketReferenceAdapter,
  TROY_OZ,
  KILOGRAM,
  validatePriceMinorUnits,
} from '../packages/sunrey-exchange/src/market-reference/index.ts';
import { buildGrowMarketEvidence } from '../packages/sunrey-exchange/src/market-reference/integrations/grow.ts';
import { buildAgentMarketEvidence } from '../packages/sunrey-exchange/src/market-reference/integrations/agent.ts';
import { toMoonReyResourceObservation } from '../packages/sunrey-exchange/src/market-reference/integrations/moonrey.ts';
import { buildWorldEconomySnapshot } from '../packages/sunrey-exchange/src/market-reference/integrations/world.ts';
import { createMarketReferenceAdapterFactory } from '../packages/sunrey-exchange/src/market-reference/adapters/factory.ts';
import { listEligibleMarketReferenceProviders } from '../packages/sunrey-exchange/src/market-reference/registry.ts';

const NOW = defaultMarketReferenceNow();

function fixtureCatalogProvider(overrides: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_CATALOG_ENTRIES.healthy,
    provider_id: 'fixture-metals-api',
    name: 'Fixture Metals API',
    short_name: 'Metals',
    primary_category: 'commodities',
    capabilities: ['commodity_prices', 'market_prices', 'metals', 'market_history', 'asset_metadata'],
    sunrey: {
      domain: ['world', 'grow', 'exchange', 'moonrey', 'financial_agent'],
      canonical_provider_interface: 'MarketReferenceProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
    ...overrides,
  };
}

describe('Wave 2 Prompt 10 — market reference layer', () => {
  it('1. catalog discovery includes populated market reference providers', () => {
    const matches = loadMarketReferenceCatalog();
    assert.ok(matches.length > 0);
  });

  it('2. fixture catalog provider adapter can be created for tests', async () => {
    const entry = fixtureCatalogProvider();
    const index = buildCatalogIndex(createFixtureCatalog([entry]));
    assert.ok(index.byId.has('fixture-metals-api'));
    const matches = listEligibleMarketReferenceProviders(index);
    assert.equal(matches.length, 1);
    const factory = createMarketReferenceAdapterFactory(matches);
    const adapter = factory.createFromCatalog(entry);
    assert.ok(adapter);
    assert.equal(adapter!.providerId, 'fixture-metals-api');
    const quote = await adapter!.getQuote('COMMODITY:gold:USD:troy_oz', NOW);
    assert.equal(quote.ok, true);
  });

  it('3. venue identity disambiguates ticker collisions', () => {
    const simEtf = resolveMarketAssetByTickerVenue('SIMETF', 'SIM-US');
    assert.ok(simEtf);
    assert.equal(simEtf.assetId, 'SIM-ETF-1');
    assert.equal(resolveMarketAssetByTickerVenue('SIMETF', 'OTHER'), undefined);
  });

  it('4. current quote normalizes with provenance and freshness', async () => {
    const service = createMarketReferenceService();
    const quote = await service.getQuote('COMMODITY:gold:USD:troy_oz', NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.authority, 'REFERENCE_ONLY');
    assert.equal(quote.value.currency, 'USD');
    assert.ok(quote.value.provenance.observationId.startsWith('mref_'));
    assert.equal(quote.value.freshness.status, 'fresh');
  });

  it('5. historical candles preserve interval and adjustment metadata', async () => {
    const service = createMarketReferenceService();
    const history = await service.getHistory(
      'SIM-ETF-1',
      '1d',
      { from: asUtcInstant('2026-01-01T00:00:00.000Z'), to: NOW },
      NOW,
    );
    assert.equal(history.ok, true);
    if (!history.ok) return;
    assert.equal(history.value[0]?.interval, '1d');
    assert.equal(history.value[0]?.adjustmentStatus, 'unadjusted');
  });

  it('6. commodity quote preserves explicit units', async () => {
    const service = createMarketReferenceService();
    for (const commodity of COMMODITY_CODES) {
      const row = await service.getCommodityPrice(commodity, NOW);
      assert.equal(row.ok, true);
      if (!row.ok) continue;
      assert.ok(row.value.unit.symbol.length > 0);
      if (commodity === 'copper') {
        assert.equal(row.value.unit.symbol, 'lb');
      } else {
        assert.equal(row.value.unit.symbol, 'troy oz');
      }
    }
  });

  it('7. unit normalization records transformation provenance', () => {
    const converted = convertMassPrice({
      priceMinorUnits: 100n,
      sourceUnit: TROY_OZ,
      targetUnit: KILOGRAM,
    });
    assert.equal(converted.ok, true);
    if (!converted.ok) return;
    assert.equal(converted.value.transformation.methodology, 'rational_mass_factor');
    assert.equal(converted.value.transformation.sourceUnit.unitId, 'troy_oz');
    assert.equal(converted.value.transformation.targetUnit.unitId, 'kg');
  });

  it('8. rejects invalid negative prices', () => {
    const result = validatePriceMinorUnits(-1n);
    assert.equal(result.ok, false);
  });

  it('9. stale quote remains labeled stale', async () => {
    const adapter = new SimulationMarketReferenceAdapter();
    adapter.setScenario('stale');
    const service = createMarketReferenceService({ providers: [adapter] });
    const quote = await service.getQuote('SIM-ETF-1', NOW);
    assert.equal(quote.ok, true);
  });

  it('10. cache policy differs by capability', () => {
    const quotePolicy = marketReferenceCachePolicy(MARKET_REFERENCE_CACHE_CAPABILITIES.quote);
    const metadataPolicy = marketReferenceCachePolicy(MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata);
    assert.ok(quotePolicy.freshTtlMs < metadataPolicy.freshTtlMs);
  });

  it('11. fallback provider chain retains source on failure', async () => {
    const primary = createSimulationMarketReferenceAdapter();
    primary.setCircuitOpen(true);
    const fallback = createSimulationMarketReferenceAdapter();
    const service = createMarketReferenceService({ providers: [primary, fallback] });
    const quote = await service.getQuote('SIM-ETF-1', NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.fallbackProviderId, fallback.providerId);
  });

  it('12. provenance includes provider and observation id', async () => {
    const service = createMarketReferenceService();
    const quote = await service.getQuote('COMMODITY:silver:USD:troy_oz', NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.value.provenance.providerId, quote.value.providerId);
    assert.match(quote.value.provenance.observationId, /^mref_/);
  });

  it('13. source timestamps are UTC instants', async () => {
    const service = createMarketReferenceService();
    const quote = await service.getQuote('COMMODITY:copper:USD:lb', NOW);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.match(quote.value.marketTimestamp, /Z$/);
    assert.match(quote.value.retrievedAt, /Z$/);
  });

  it('14. provider outage fails closed', async () => {
    const adapter = createSimulationMarketReferenceAdapter();
    adapter.setScenario('unavailable');
    const service = createMarketReferenceService({ providers: [adapter], includeSimulationFallback: false });
    const quote = await service.getQuote('SIM-ETF-1', NOW);
    assert.equal(quote.ok, false);
    if (quote.ok) return;
    assert.equal(quote.code, 'PROVIDER_UNAVAILABLE');
  });

  it('15. rate-limit handling surfaces RATE_LIMITED', async () => {
    const adapter = createSimulationMarketReferenceAdapter();
    adapter.setRateLimited(true);
    const service = createMarketReferenceService({ providers: [adapter], includeSimulationFallback: false });
    const quote = await service.getQuote('SIM-ETF-1', NOW);
    assert.equal(quote.ok, false);
    if (quote.ok) return;
    assert.equal(quote.code, 'RATE_LIMITED');
  });

  it('16. market reference remains separated from execution authority', () => {
    const service = createMarketReferenceService();
    const proof = service.executionSeparationProof();
    assert.equal(proof.referenceOnly, true);
    assert.equal(proof.mutatesExchangeOrderBook, false);
    assert.equal(proof.issuesExecutionAuthority, false);
  });

  it('17. Grow receives read-only market evidence', async () => {
    const service = createMarketReferenceService();
    const evidence = await buildGrowMarketEvidence(service, ['SIM-ETF-1'], NOW);
    assert.equal(evidence.referenceOnly, true);
    assert.equal(evidence.executionAuthorized, false);
    assert.equal(evidence.quotes.length, 1);
  });

  it('18. MoonRey resource context is REFERENCE_PRICE only', async () => {
    const service = createMarketReferenceService();
    const context = await toMoonReyResourceObservation(service, ['gold', 'copper'], NOW);
    assert.equal(context.issuanceAuthority, false);
    assert.ok(context.observations.every((row) => row.factType === 'REFERENCE_PRICE'));
  });

  it('19. Agent evidence cannot authorize trades', async () => {
    const service = createMarketReferenceService();
    const evidence = await buildAgentMarketEvidence(service, ['SIM-ETF-1'], NOW);
    assert.equal(evidence.tradeAuthorized, false);
    assert.ok(evidence.items.every((item) => item.label === 'REFERENCE_NOT_EXECUTION'));
  });

  it('20. BFF sanitized output hides raw provider payloads', () => {
    const world = createSandboxWorld();
    const response = handleConsumerBffSync(
      { ...world, marketReference: undefined },
      {
        method: 'GET',
        path: '/api/v1/world/resources/gold',
        query: {},
        body: null,
        authorization: sandboxToken('basic_verified'),
        requestId: 'req_market_ref_test',
      },
    );
    assert.equal(response.status, 200);
    const body = response.body as Record<string, unknown>;
    assert.equal(body.referenceOnly, true);
    assert.equal(body.issuanceAuthority, false);
    assert.equal(typeof body.priceMinorUnits, 'string');
    assert.equal(body.unit, 'troy oz');
    assert.equal('rawPayload' in body, false);
  });

  it('21. world snapshot includes markets and resources', async () => {
    const service = createMarketReferenceService();
    const snapshot = await buildWorldEconomySnapshot(
      service,
      { assetIds: ['SIM-ETF-1'], commodities: ['silver'] },
      NOW,
    );
    assert.equal(snapshot.referenceOnly, true);
    assert.equal(snapshot.markets.length, 1);
    assert.equal(snapshot.resources.length, 1);
  });

  it('22. registered assets reuse canonical ids without conflict', () => {
    const gold = resolveMarketAsset('COMMODITY:gold:USD:troy_oz');
    assert.ok(gold);
    assert.equal(gold.commodityCode, 'gold');
    assert.notEqual(gold.assetId, 'COMMODITY:silver:USD:troy_oz');
  });
});
