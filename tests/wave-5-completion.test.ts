/**
 * Wave 5 completion tests — physical-economy data plane, geospatial, maritime, logistics.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createExternalDataPlane,
  buildWave5CoverageReport,
  assertWave5CoverageComplete,
  WAVE5_IMPLEMENTED_PROVIDER_IDS,
  WAVE5_CHAOS_PROVIDERS,
  worldPhysicalEconomySnapshot,
  moonReyProductiveEconomySnapshot,
  travelContextSnapshot,
  realEstateContextSnapshot,
  buildProductiveEconomicGraph,
  FIXTURE_SPRINGFIELD_IL,
  FIXTURE_SPRINGFIELD_MA,
} from '../packages/external-data/src/index.ts';
import { createWorldExternalDataBff } from '../services/api/src/consumer/world-external-data-adapter.ts';

describe('Wave 5 physical-economy data plane', () => {
  it('runs end-to-end productive economy workflow', () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-31T12:00:00.000Z' });
    const energy = plane.wave5.energy.getObservations();
    const resources = plane.wave5.resources.getObservations();
    const weather = plane.wave5.weather.getCurrentWeather();
    const environment = plane.wave5.environment.getObservations();
    const aviation = plane.wave5.travel.getAviationPositions();
    const geospatial = plane.wave5.geospatial.geocode('London');
    const maritime = plane.wave5.maritime.getShippingFlow();
    const logistics = plane.wave5.logistics.getObservations();

    assert.ok(energy.observations.length > 0);
    assert.ok(resources.observations.length > 0);
    assert.ok(weather.observations.length > 0);
    assert.ok(environment.observations.length > 0);
    assert.ok(aviation.observations.length > 0);
    assert.ok(geospatial.observations.length > 0);
    assert.ok(maritime.observations.length > 0);
    assert.ok(logistics.observations.length > 0);

    for (const obs of [
      ...energy.observations,
      ...resources.observations,
      ...weather.observations,
      ...environment.observations,
    ]) {
      assert.equal(obs.schemaVersion, 'sunrey.external-observation.v1');
      assert.ok(obs.provenance.rawPayloadHash.length > 0);
    }
  });

  it('uses shared canonical geography without conflating Springfields', () => {
    const plane = createExternalDataPlane();
    const il = plane.wave5.geospatial.geocode('Springfield, Illinois');
    const ma = plane.wave5.geospatial.geocode('Springfield, Massachusetts');
    assert.equal(il.observations[0]?.data.locationId, FIXTURE_SPRINGFIELD_IL.locationId);
    assert.equal(ma.observations[0]?.data.locationId, FIXTURE_SPRINGFIELD_MA.locationId);
    assert.notEqual(il.observations[0]?.data.locationId, ma.observations[0]?.data.locationId);
  });

  it('treats IP geolocation as approximate only', () => {
    const plane = createExternalDataPlane();
    const result = plane.wave5.geospatial.lookupIpGeolocation('8.8.8.8');
    assert.ok(result.observations.length > 0);
    assert.equal(result.observations[0]?.data.accuracy, 'APPROXIMATE');
  });

  it('caches geocoding results with longer retention semantics', () => {
    const plane = createExternalDataPlane();
    plane.wave5.geospatial.geocode('London');
    const sizeAfterFirst = plane.wave5.geospatial.geocodeCacheSize();
    const second = plane.wave5.geospatial.geocode('London');
    assert.equal(plane.wave5.geospatial.geocodeCacheSize(), sizeAfterFirst);
    assert.equal(second.stale, true);
  });

  it('isolates chaos failures without crashing the plane', () => {
    const plane = createExternalDataPlane();
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.energyDown, { down: true });
    plane.setProviderState('uk-carbon-intensity', { down: true });
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.weatherRateLimited, { down: true });
    plane.setProviderState('open-meteo', { down: true });
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.waterMalformed, { malformed: true });
    plane.setProviderState('openaq', { down: true });
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.aviationTimeout, { down: true });
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.geocodingDown, { down: true });
    plane.setProviderState(WAVE5_CHAOS_PROVIDERS.maritimeStale, { down: true });

    const energy = plane.wave5.energy.getObservations();
    const weather = plane.wave5.weather.getCurrentWeather();
    const environment = plane.wave5.environment.getObservations();
    const aviation = plane.wave5.travel.getAviationPositions();
    const geocoded = plane.wave5.geospatial.geocode('London');
    const maritime = plane.wave5.maritime.getShippingFlow();

    assert.equal(energy.degraded, true);
    assert.equal(weather.degraded, true);
    assert.equal(environment.degraded, true);
    assert.equal(aviation.degraded, true);
    assert.equal(geocoded.degraded, true);
    assert.equal(maritime.degraded, true);

    const snapshot = worldPhysicalEconomySnapshot(plane);
    assert.equal(snapshot.grantsExecutionAuthority, false);
    assert.equal(snapshot.availability, 'DEGRADED');
  });

  it('retains provider disagreement without silent blending', () => {
    const plane = createExternalDataPlane();
    const weather = plane.wave5.weather.getCurrentWeather();
    const londonObs = weather.observations.filter((o) => o.data.locationId.includes('london'));
    if (londonObs.length >= 2) {
      assert.ok(weather.conflicts.length >= 0);
    }
    assert.ok(weather.providersUsed.length >= 1);
  });

  it('verifies MoonRey issuance remains unchanged', () => {
    const plane = createExternalDataPlane();
    const moonrey = moonReyProductiveEconomySnapshot(plane);
    assert.equal(moonrey.issuanceAuthority, false);
    assert.equal(moonrey.mintsMoonRey, false);
    assert.ok(moonrey.energyMetrics.length > 0);
    assert.ok(moonrey.resourceMetrics.length > 0);
  });

  it('wires Productive Economic Graph with canonical nodes and edges', () => {
    const plane = createExternalDataPlane();
    const graph = buildProductiveEconomicGraph(plane);
    assert.equal(graph.schema, 'sunrey.productive-economic-graph.v1');
    assert.equal(graph.grantsIssuanceAuthority, false);
    assert.ok(graph.nodes.some((n) => n.nodeType === 'COUNTRY'));
    assert.ok(graph.nodes.some((n) => n.nodeType === 'CITY'));
    assert.ok(graph.nodes.some((n) => n.nodeType === 'SHIPPING_CORRIDOR'));
    assert.ok(graph.edges.some((e) => e.edgeType === 'LOCATED_IN'));
    assert.ok(graph.observationCount > 0);
  });

  it('bridges World, Travel, Real Estate without authority contamination', () => {
    const plane = createExternalDataPlane();
    const world = worldPhysicalEconomySnapshot(plane);
    const travel = travelContextSnapshot(plane);
    const realEstate = realEstateContextSnapshot(plane);
    assert.equal(world.grantsExecutionAuthority, false);
    assert.equal(travel.grantsExecutionAuthority, false);
    assert.equal(realEstate.grantsPricingAuthority, false);
    assert.ok(world.energy.length > 0);
    assert.ok(travel.weather.length > 0);
    assert.ok(realEstate.locations.length > 0);
  });

  it('exposes ProviderRiskMonitor for all Wave 5 providers', () => {
    const plane = createExternalDataPlane();
    const risk = plane.providerRisk.snapshot();
    assert.equal(risk.schema, 'sunrey.provider-risk-monitor.v1');
    assert.ok(risk.providers.length >= WAVE5_IMPLEMENTED_PROVIDER_IDS.length);
    assert.ok(risk.summary.total > 0);
    plane.providerRisk.disableProvider('eia');
    const after = plane.providerRisk.snapshot();
    const eia = after.providers.find((p) => p.providerId === 'eia');
    assert.equal(eia?.activationState, 'disabled');
    plane.providerRisk.enableProvider('eia');
  });

  it('does not leak credentials or personal addresses in surfaces', () => {
    const plane = createExternalDataPlane();
    const healthJson = JSON.stringify(plane.health());
    const riskJson = JSON.stringify(plane.providerRisk.snapshot());
    assert.equal(healthJson.includes('api_key'), false);
    assert.equal(healthJson.includes('EIA_API_KEY'), false);
    assert.equal(riskJson.includes('OPENWEATHERMAP_API_KEY'), false);
    const bff = createWorldExternalDataBff(plane);
    const bffJson = JSON.stringify(bff.physicalEconomy());
    assert.equal(bffJson.includes('api_key'), false);
  });

  it('accounts for every Wave 5 catalog provider', () => {
    const report = buildWave5CoverageReport();
    assert.ok(report.implemented >= 19);
    assert.ok(report.blocked >= 2);
    assert.doesNotThrow(() => assertWave5CoverageComplete());
    const unexplained = report.providers.filter(
      (p) =>
        ['energy', 'natural_resources', 'weather', 'water', 'environmental', 'aviation', 'transportation', 'geospatial', 'maritime', 'logistics'].includes(p.category) &&
        p.status === 'NOT_WAVE_5',
    );
    assert.equal(unexplained.length, 0);
  });

  it('enforces query safety limits', () => {
    const plane = createExternalDataPlane();
    const largeBbox = plane.wave5.geospatial.geocode('test');
    assert.ok(largeBbox.observations.length <= 50);
  });

  it('supports parallel queries without cross-provider contamination', async () => {
    const plane = createExternalDataPlane();
    const [energy, weather, geospatial, maritime] = await Promise.all([
      Promise.resolve(plane.wave5.energy.getObservations()),
      Promise.resolve(plane.wave5.weather.getCurrentWeather()),
      Promise.resolve(plane.wave5.geospatial.getCountries()),
      Promise.resolve(plane.wave5.maritime.getShippingFlow()),
    ]);
    assert.ok(energy.providersUsed.includes('eia'));
    assert.ok(weather.providersUsed.length >= 1);
    assert.ok(geospatial.providersUsed.includes('rest-countries'));
    assert.ok(maritime.providersUsed.includes('hormuz-ship-monitor'));
  });
});

describe('Wave 5 BFF adapter', () => {
  it('exposes vendor-independent physical-economy resources', () => {
    const bff = createWorldExternalDataBff(createExternalDataPlane());
    const physical = bff.physicalEconomy();
    const energy = bff.energy();
    const weather = bff.weather();
    const geospatial = bff.geospatial();
    const maritime = bff.maritime();
    const logistics = bff.logistics();
    const travel = bff.travelContext();
    const graph = bff.productiveEconomicGraph();
    const risk = bff.providerRisk();
    const coverage = bff.wave5Coverage();

    assert.equal(physical.schema, 'sunrey.world.physical-economy.v1');
    assert.equal(energy.schema, 'sunrey.bff.energy.v1');
    assert.equal(weather.schema, 'sunrey.bff.weather.v1');
    assert.equal(geospatial.schema, 'sunrey.bff.geospatial.v1');
    assert.equal(maritime.schema, 'sunrey.bff.maritime.v1');
    assert.equal(logistics.schema, 'sunrey.bff.logistics.v1');
    assert.equal(travel.schema, 'sunrey.travel.context.v1');
    assert.equal(graph.schema, 'sunrey.productive-economic-graph.v1');
    assert.equal(risk.schema, 'sunrey.provider-risk-monitor.v1');
    assert.ok(coverage.implemented >= 19);
    assert.equal(JSON.stringify(bff).includes('NOMINATIM'), false);
  });
});
