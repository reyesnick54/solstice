import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCatalogIndex } from '../packages/provider-sdk/src/catalog/loader.ts';
import { createFixtureCatalog } from '../packages/provider-sdk/src/test-fixtures/catalog.ts';
import {
  ENVIRONMENTAL_CATALOG_ENTRIES,
  ENVIRONMENTAL_CATALOG_PROVIDER_IDS,
  ENVIRONMENTAL_CACHE_CAPABILITIES,
  convertTemperature,
  convertWindSpeed,
  createEnvironmentalAdapter,
  createEnvironmentalOracleService,
  createAllEnvironmentalAdapters,
  defaultEnvironmentalNow,
  environmentalCachePolicy,
  environmentalSeparationProof,
  loadEnvironmentalCatalog,
  locationKey,
  normalizeEnvironmentalLocation,
  setAdapterScenario,
  buildEnvironmentalAgentEvidence,
  buildGrowEnvironmentalContext,
  buildMoonReyEnvironmentalContext,
  buildTravelEnvironmentalContext,
  buildRealEstateEnvironmentalContext,
  buildWorldEnvironmentalSnapshot,
  derivePhysicalRisks,
} from '../packages/sunrey-chain/src/environmental/index.ts';
import { loadEnvironmentalFixture, normalizeWeatherForecast } from '../packages/sunrey-chain/src/environmental/adapters/base.ts';
import { createEnvironmentalOracleBff } from '../services/api/src/consumer/environmental-adapter.ts';
import { dispatchEnvironmental } from '../services/api/src/consumer/environmental.ts';
import { handleConsumerBff } from '../services/api/src/consumer/bff-test-utils.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';

const NOW = defaultEnvironmentalNow();
const SF = Object.freeze({ latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', country: 'US' });

describe('Wave 5 Prompt 19 — environmental oracle', () => {
  it('1. all selected provider adapters register from catalog', () => {
    const index = buildCatalogIndex(createFixtureCatalog([...ENVIRONMENTAL_CATALOG_ENTRIES] as never[]));
    const matches = loadEnvironmentalCatalog(index);
    assert.equal(matches.length, 13);
    assert.equal(ENVIRONMENTAL_CATALOG_PROVIDER_IDS.length, 13);
    const adapters = createAllEnvironmentalAdapters();
    assert.equal(adapters.length, 13);
  });

  it('2. current weather from multiple providers', async () => {
    const service = createEnvironmentalOracleService();
    const result = await service.getCurrentWeather(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length >= 5);
    assert.ok(result.value.every((o) => o.kind === 'observation'));
    assert.ok(result.value.every((o) => o.temperature?.unit === 'celsius'));
  });

  it('3. forecast distinct from observation', async () => {
    const service = createEnvironmentalOracleService();
    const weather = await service.getCurrentWeather(SF, NOW);
    const forecast = await service.getForecast(SF, { from: NOW, to: '2026-09-02T12:00:00.000Z', resolution: 'hourly' }, NOW);
    assert.equal(weather.ok, true);
    assert.equal(forecast.ok, true);
    if (!weather.ok || !forecast.ok) return;
    assert.ok(weather.value[0]?.kind === 'observation');
    assert.ok(forecast.value[0]?.kind === 'forecast');
    assert.notEqual(weather.value[0]?.schema, forecast.value[0]?.schema);
  });

  it('4. ensemble forecast retains model metadata', async () => {
    const service = createEnvironmentalOracleService();
    const forecast = await service.getForecast(SF, { from: NOW, to: '2026-09-02T12:00:00.000Z', resolution: 'hourly' }, NOW);
    assert.equal(forecast.ok, true);
    if (!forecast.ok) return;
    const ensemble = forecast.value.find((f) => f.providerId === 'open-meteo-ensemble');
    assert.ok(ensemble);
    const models = ensemble!.periods.map((p) => p.modelId).filter(Boolean);
    assert.ok(models.length >= 2);
    assert.ok(new Set(models).size >= 2);
  });

  it('5. Celsius/Fahrenheit conversion', () => {
    assert.equal(convertTemperature(0, 'celsius', 'fahrenheit'), 32);
    assert.equal(convertTemperature(32, 'fahrenheit', 'celsius'), 0);
  });

  it('6. wind unit handling', () => {
    const ms = 10;
    const kmh = convertWindSpeed(ms, 'm/s', 'km/h');
    assert.ok(Math.abs(kmh - 36) < 0.1);
    const mph = convertWindSpeed(ms, 'm/s', 'mph');
    assert.ok(Math.abs(mph - 22.37) < 0.1);
  });

  it('7. water observation normalized', async () => {
    const service = createEnvironmentalOracleService();
    const result = await service.getWaterState(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value[0]?.measurementType, 'streamflow');
    assert.equal(result.value[0]?.providerId, 'usgs-water');
    assert.ok(result.value[0]?.geographicScopeNote?.includes('United States'));
  });

  it('8. air-quality observation normalized', async () => {
    const service = createEnvironmentalOracleService();
    const result = await service.getAirQuality(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length >= 3);
    const epa = result.value.find((o) => o.providerId === 'epa');
    assert.ok(epa);
    const pm25 = epa!.metrics.find((m) => m.pollutant === 'PM2.5');
    assert.ok(pm25);
    assert.equal(pm25!.aqiStandard, 'US_EPA');
  });

  it('9. earthquake event normalized', async () => {
    const service = createEnvironmentalOracleService();
    const result = await service.getSeismicEvents(
      { latitude: 37.7749, longitude: -122.4194, radiusKm: 500 },
      { from: NOW, to: '2026-09-02T12:00:00.000Z' },
      NOW,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value[0]?.providerId, 'usgs-earthquake');
    assert.ok(result.value[0]!.magnitude >= 4);
  });

  it('10. wildfire event normalized', async () => {
    const service = createEnvironmentalOracleService();
    const result = await service.getWildfireEvents(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.status, 'active');
    assert.ok(result.value[0]?.eventId);
  });

  it('11. physical-risk evidence derived from observations', async () => {
    const service = createEnvironmentalOracleService();
    const snapshot = await service.getEnvironmentalSnapshot(SF, NOW);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) return;
    assert.ok(snapshot.value.physicalRisks.length > 0);
    assert.ok(snapshot.value.physicalRisks.every((r) => r.prediction === false));
    const earthquake = snapshot.value.physicalRisks.find((r) => r.riskType === 'EARTHQUAKE');
    assert.ok(earthquake);
  });

  it('12. geolocation normalization', () => {
    const loc = normalizeEnvironmentalLocation({ latitude: 37.7749, longitude: -122.4194, country: 'us' });
    assert.equal(loc.country, 'US');
    assert.throws(() => normalizeEnvironmentalLocation({ latitude: 91, longitude: 0 }));
    assert.equal(locationKey(loc), '37.7749,-122.4194');
  });

  it('13. stale forecast freshness', () => {
    const loc = normalizeEnvironmentalLocation(SF);
    const raw = loadEnvironmentalFixture('open-meteo-forecast.json') as Record<string, unknown>;
    const forecast = normalizeWeatherForecast(raw, loc, 'open-meteo', 'reference_data', NOW, 'hourly', 'stale_forecast');
    assert.equal(forecast.freshness.status, 'stale');
  });

  it('14. expired forecast marked expired', () => {
    const loc = normalizeEnvironmentalLocation(SF);
    const raw = {
      generated_at: '2026-08-20T06:00:00.000Z',
      valid_from: '2026-08-20T06:00:00.000Z',
      valid_to: '2026-08-21T06:00:00.000Z',
      horizon_hours: 24,
      hourly: [],
    };
    const forecast = normalizeWeatherForecast(raw, loc, 'open-meteo', 'reference_data', NOW, 'hourly', 'expired_forecast');
    assert.equal(forecast.expired, true);
  });

  it('15. cache returns cached weather', async () => {
    const service = createEnvironmentalOracleService();
    const first = await service.getCurrentWeather(SF, NOW);
    const second = await service.getCurrentWeather(SF, NOW);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.fromCache, true);
  });

  it('16. provider timeout handled', async () => {
    const adapters = createAllEnvironmentalAdapters();
    const openMeteo = adapters.find((a) => a.providerId === 'open-meteo')!;
    setAdapterScenario(openMeteo, 'timeout');
    const service = createEnvironmentalOracleService({ providers: adapters });
    const result = await service.getCurrentWeather(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(!result.value.some((o) => o.providerId === 'open-meteo'));
  });

  it('17. provider 429 handled', async () => {
    const adapter = createEnvironmentalAdapter('open-meteo');
    setAdapterScenario(adapter, 'rate_limited');
    const service = createEnvironmentalOracleService({ providers: [adapter, ...createAllEnvironmentalAdapters().filter((a) => a.providerId !== 'open-meteo')] });
    const result = await service.getCurrentWeather(SF, NOW);
    assert.equal(result.ok, true);
  });

  it('18. fallback to secondary providers', async () => {
    const adapters = createAllEnvironmentalAdapters();
    const primary = adapters.find((a) => a.providerId === 'open-meteo')!;
    setAdapterScenario(primary, 'unavailable');
    const service = createEnvironmentalOracleService({ providers: adapters });
    const result = await service.getCurrentWeather(SF, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length > 0);
    assert.ok(!result.value.some((o) => o.providerId === 'open-meteo'));
  });

  it('19. provider disagreement retained', async () => {
    const adapters = createAllEnvironmentalAdapters();
    const nws = adapters.find((a) => a.providerId === 'nws')!;
    setAdapterScenario(nws, 'disagreeing');
    const service = createEnvironmentalOracleService({ providers: adapters });
    await service.getCurrentWeather(SF, NOW);
    const disagreements = service.disagreementEvents();
    assert.ok(disagreements.length > 0);
    assert.equal(disagreements[0]?.capability, 'weather');
    assert.ok(disagreements[0]!.providers.length >= 2);
  });

  it('20. World integration snapshot', async () => {
    const service = createEnvironmentalOracleService();
    const world = await buildWorldEnvironmentalSnapshot(service, SF, NOW);
    assert.equal(world.schema, 'sunrey.world.environmental.v1');
    assert.equal(world.referenceOnly, true);
    assert.equal(world.issuanceAuthority, false);
    assert.ok(world.weather.length > 0);
  });

  it('21. Travel access', async () => {
    const service = createEnvironmentalOracleService();
    const travel = await buildTravelEnvironmentalContext(
      service,
      { latitude: 40.7128, longitude: -74.006, city: 'New York', country: 'US' },
      SF,
      NOW,
    );
    assert.equal(travel.schema, 'sunrey.travel.environmental-context.v1');
    assert.equal(travel.bookingAuthorized, false);
    assert.ok(travel.destination?.aviationWeatherAvailable);
  });

  it('22. Productive Economic Graph integration', async () => {
    const service = createEnvironmentalOracleService();
    const grow = await buildGrowEnvironmentalContext(service, SF, NOW);
    assert.equal(grow.schema, 'sunrey.grow.environmental-context.v1');
    assert.equal(grow.mintsMoonRey, false);
    assert.equal(grow.setsMarketPrice, false);
  });

  it('23. MoonRey issuance unchanged', async () => {
    const service = createEnvironmentalOracleService();
    const moonrey = await buildMoonReyEnvironmentalContext(service, SF, NOW);
    assert.equal(moonrey.issuanceAuthority, false);
    assert.equal(moonrey.minted, false);
    const proof = environmentalSeparationProof();
    assert.equal(proof.mutatesMoonReyIssuance, false);
    assert.equal(proof.mutatesSunReyIssuance, false);
  });

  it('24. Financial Agent remains evidence-only', async () => {
    const service = createEnvironmentalOracleService();
    const evidence = await buildEnvironmentalAgentEvidence(service, SF, NOW);
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.triggersAutonomousInvestment, false);
    assert.ok(evidence.items.every((i) => i.label === 'RESEARCH_EVIDENCE_NOT_EXECUTION'));
  });

  it('25. BFF environmental routes', async () => {
    const world = createSandboxWorld();
    const runtime = { bff: world.bff, sessions: world.sessions, environmental: world.environmental };
    const response = await handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/world/environmental',
      query: { lat: '37.7749', lon: '-122.4194' },
      body: null,
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
    });
    assert.equal(response.status, 200);
  });

  it('26. cache policies differ by capability', () => {
    const current = environmentalCachePolicy(ENVIRONMENTAL_CACHE_CAPABILITIES.currentWeather);
    const seismic = environmentalCachePolicy(ENVIRONMENTAL_CACHE_CAPABILITIES.seismicEvent);
    assert.notEqual(current.freshTtlMs, seismic.freshTtlMs);
    assert.ok(seismic.freshTtlMs > current.freshTtlMs);
  });

  it('27. real estate contextual evidence without valuation', async () => {
    const service = createEnvironmentalOracleService();
    const re = await buildRealEstateEnvironmentalContext(service, SF, NOW);
    assert.equal(re.automatedValuation, false);
    assert.equal(re.referenceOnly, true);
  });

  it('28. each adapter responds to health check', () => {
    for (const adapter of createAllEnvironmentalAdapters()) {
      const health = adapter.health(NOW);
      assert.equal(health.providerId, adapter.providerId);
      assert.ok(['healthy', 'degraded', 'unavailable'].includes(health.status));
    }
  });
});
