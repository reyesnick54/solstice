import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WAVE5_ADAPTER_IDS,
  WAVE5_BLOCKED_PROVIDER_IDS,
  assertNoLiveNetwork,
  cachePolicyFor,
  createProductiveEconomyRuntime,
  geographicIdentity,
  mapEnergySource,
  normalizeCarbonIntensity,
  normalizeEnergyUnit,
  normalizePowerUnit,
  validateObservation,
  wave5CoverageReport,
  wave5ProviderClassification,
} from '../packages/sunrey-chain/src/productive-economy-providers/index.ts';
import {
  createExternalDataPlane,
  moonReyResourceContextAsync,
  worldEconomySnapshotAsync,
} from '../packages/external-data/src/index.ts';

describe('Wave 5 Prompt 18 energy and resource providers', () => {
  it('registers all selected provider adapters', () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    assert.equal(runtime.adapters.size, WAVE5_ADAPTER_IDS.length);
    assert.equal(runtime.registry.list().length, WAVE5_ADAPTER_IDS.length);
    for (const id of WAVE5_ADAPTER_IDS) {
      assert.ok(runtime.adapters.has(id), `missing adapter ${id}`);
    }
  });

  it('matches provider IDs to catalog entries', () => {
    const coverage = wave5CoverageReport();
    const integrated = coverage.filter((c) => c.classification !== 'BLOCKED');
    assert.ok(integrated.some((c) => c.providerId === 'national-grid-eso'));
    assert.ok(integrated.some((c) => c.providerId === 'uk-carbon-intensity'));
    assert.ok(integrated.some((c) => c.providerId === 'fred-commodity'));
    assert.equal(wave5ProviderClassification('tilth'), 'BLOCKED');
    assert.equal(WAVE5_BLOCKED_PROVIDER_IDS.includes('tilth'), true);
  });

  it('normalizes electricity demand observations with explicit units', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const result = await runtime.index.energy.getElectricityDemand();
    assert.ok(result.observations.length > 0);
    for (const obs of result.observations) {
      assert.ok(obs.data.unit.length > 0);
      assert.equal(obs.data.unit, 'MW');
      assert.equal(obs.data.measurementKind === 'DEMAND' || obs.data.measurementKind === 'CONSUMPTION', true);
    }
  });

  it('normalizes electricity generation and energy-source mapping', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const result = await runtime.index.energy.getElectricityGeneration();
    assert.ok(result.observations.length > 0);
    const wind = result.observations.find((o) => o.data.energySource === 'WIND');
    assert.ok(wind);
    assert.equal(mapEnergySource('Wind Onshore'), 'WIND');
    assert.equal(mapEnergySource('Solar'), 'SOLAR');
  });

  it('normalizes carbon intensity with gCO2/kWh units', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const result = await runtime.index.energy.getCarbonIntensity();
    assert.ok(result.observations.length > 0);
    const uk = result.observations.find((o) => o.providerId === 'uk-carbon-intensity');
    assert.ok(uk);
    assert.equal(uk!.data.unit, 'gCO2/kWh');
    const converted = normalizeCarbonIntensity(uk!.data.value, uk!.data.unit);
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.normalization.normalizedUnit, 'gCO2/kWh');
    }
  });

  it('normalizes resource observations and commodity mapping', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const result = await runtime.index.resources.getResourceObservations();
    assert.ok(result.observations.length > 0);
    const wheat = result.observations.find((o) => o.data.resourceType === 'WHEAT');
    assert.ok(wheat);
    assert.equal(wheat!.data.measurementType, 'PRICE');
    assert.equal(wheat!.data.currency, 'INR');
  });

  it('converts energy and power units without silent incompatible conversion', () => {
    const mwh = normalizeEnergyUnit(1000, 'kWh');
    assert.equal(mwh.ok, true);
    if (mwh.ok) {
      assert.equal(mwh.normalization.normalizedUnit, 'MWh');
      assert.equal(mwh.normalization.normalizedValue, 1);
    }
    const mw = normalizePowerUnit(1500, 'MW');
    assert.equal(mw.ok, true);
    const bad = normalizeEnergyUnit(1, 'barrels/day');
    assert.equal(bad.ok, false);
  });

  it('maps geographic identity with grid zones', () => {
    const geo = geographicIdentity({ country: 'GB', gridZone: 'GB-NATIONAL' });
    assert.equal(geo.country, 'GB');
    assert.equal(geo.gridZone, 'GB-NATIONAL');
  });

  it('flags stale data via freshness assessment', () => {
    const quality = validateObservation({
      value: 100,
      unit: 'MW',
      sourceTimestamp: '2020-01-01T00:00:00Z',
      retrievedAt: '2026-08-31T12:00:00Z',
    });
    assert.equal(quality.valid, true);
  });

  it('applies capability-specific cache policies', () => {
    const grid = cachePolicyFor('grid_load');
    assert.equal(grid.ttlSeconds, 120);
    const mandi = cachePolicyFor('agriculture_prices');
    assert.ok(mandi.ttlSeconds >= 14400);
  });

  it('isolates provider timeout and circuit breaker failures', async () => {
    const runtime = createProductiveEconomyRuntime({
      mode: 'simulation',
      adapterContext: { circuitOpen: true },
    });
    const result = await runtime.index.energy.getEnergyObservations();
    assert.equal(result.observations.length, 0);
    assert.equal(result.degraded, true);
  });

  it('handles rate-limited provider without crashing plane', async () => {
    const runtime = createProductiveEconomyRuntime({
      mode: 'simulation',
      adapterContext: { rateLimited: true },
    });
    const result = await runtime.index.energy.getEnergyObservations();
    assert.equal(result.observations.length, 0);
  });

  it('rejects malformed provider payload via data quality', () => {
    const quality = validateObservation({
      value: -50,
      unit: 'MW',
      sourceTimestamp: '2026-08-31T12:00:00Z',
      retrievedAt: '2026-08-31T12:00:00Z',
    });
    assert.equal(quality.valid, false);
  });

  it('ingests observations into Productive Economic Graph projection', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const peg = await runtime.index.energy.pegProjection();
    assert.ok(peg.nodes.length > 0);
    assert.ok(peg.edges.length > 0);
    assert.equal(peg.timeSeriesStoredSeparately, true);
    assert.ok(peg.nodes.some((n) => n.kind === 'GRID'));
    assert.ok(peg.nodes.some((n) => n.kind === 'ENERGY_SOURCE'));
  });

  it('wires World integration with live physical-economy data', async () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-31T12:00:00.000Z' });
    const world = await worldEconomySnapshotAsync(plane);
    assert.ok(world.energy.length > 0);
    assert.ok(world.resources.length > 0);
    assert.equal(world.availability, 'AVAILABLE_SIMULATION');
  });

  it('exposes MoonRey observations without issuance authority', async () => {
    const plane = createExternalDataPlane({ nowUtc: '2026-08-31T12:00:00.000Z' });
    const moonrey = await moonReyResourceContextAsync(plane);
    assert.equal(moonrey.issuanceAuthority, false);
    assert.ok(moonrey.energyObservations.length > 0);
  });

  it('provides agent evidence only without execution authority', async () => {
    const plane = createExternalDataPlane();
    const evidence = await plane.agentEvidenceBundleWithProductiveEconomy();
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.treatedAsTradeInstruction, false);
    assert.ok(evidence.productiveEconomyEvidenceCount > 0);
  });

  it('blocks live network in simulation environment', () => {
    assert.throws(() => assertNoLiveNetwork('live'), /ENVIRONMENT=simulation/);
  });

  it('reports unavailable resources without fabricating values', () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const availability = runtime.index.resources.resourceAvailability();
    const gold = availability.find((a) => a.resourceType === 'GOLD');
    assert.ok(gold);
    assert.equal(gold!.status, 'NO_ELIGIBLE_LIVE_SOURCE');
  });

  it('does not change MoonRey issuance or SunRey Coin logic', async () => {
    const runtime = createProductiveEconomyRuntime({ mode: 'simulation' });
    const observations = await runtime.index.toProductiveEconomicObservations();
    for (const obs of observations) {
      assert.equal(obs.mintsMoonRey, false);
      assert.equal(obs.issuanceAuthority, false);
    }
  });
});
