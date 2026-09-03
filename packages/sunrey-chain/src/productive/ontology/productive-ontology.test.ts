/**
 * Wave 5 — MoonRey Productive Economy ontology tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PRODUCTIVE_ONTOLOGY_INVARIANTS,
  PRODUCTIVE_CATEGORY_ONTOLOGY,
  categoryOntology,
  listEntityClasses,
  listEventTypes,
  validateProductiveEventMaterial,
  refuseCapacityAsProduction,
  refuseStockAsFlow,
  refuseTelemetryAsEvent,
  refuseMarketPriceAsProduction,
  observationIsNotEvent,
  eventIsNotClaim,
  claimIsNotGpuv,
  claimIsNotMoonRey,
  gpuvIsNotMoonRey,
  buildProductiveEconomicClaimBundle,
  productiveClaimLacksSupplyAuthority,
  projectProductiveEventToGraph,
  classifyMetric,
  isDerivedMetric,
  refuseDuplicateStockMonetization,
  resetStockMonetizationRegistryForTests,
  WAVE5_DOMAIN_FIXTURES,
  SOLAR_GENERATION_EVENT,
  GRID_DELIVERY_EVENT,
  GPU_COMPUTE_EVENT,
  FACTORY_PRODUCTION_EVENT,
  AGRICULTURAL_OUTPUT_EVENT,
  RESOURCE_EXTRACTION_EVENT,
  LOGISTICS_MOVEMENT_EVENT,
  WATER_DELIVERY_EVENT,
  CAPACITY_NOT_PRODUCTION_OBSERVATION,
  STOCK_NOT_FLOW_OBSERVATION,
  TELEMETRY_NOT_EVENT_OBSERVATION,
  MARKET_PRICE_NOT_PRODUCTION_OBSERVATION,
} from './index.ts';

describe('Wave 5 productive ontology invariants', () => {
  it('preserves non-monetary authority boundaries', () => {
    assert.equal(PRODUCTIVE_ONTOLOGY_INVARIANTS.OBSERVATION_CANNOT_MINT, true);
    assert.equal(PRODUCTIVE_ONTOLOGY_INVARIANTS.GPUV_IS_NOT_MOONREY, true);
    assert.equal(PRODUCTIVE_ONTOLOGY_INVARIANTS.ORACLE_CANNOT_MINT, true);
  });
});

describe('Wave 5 productive category ontology', () => {
  it('defines all twelve governance categories', () => {
    assert.equal(Object.keys(PRODUCTIVE_CATEGORY_ONTOLOGY).length, 12);
    const energy = categoryOntology('ENERGY');
    assert.ok(energy.entityClasses.includes('PowerPlant'));
    assert.ok(energy.eventTypes.includes('EnergyGenerated'));
    assert.ok(energy.canonicalUnits.includes('MWh'));
  });

  it('maps entity classes to categories', () => {
    const computeEntities = listEntityClasses('COMPUTE');
    assert.ok(computeEntities.some((row) => row.entityClass === 'ComputeCluster'));
    const events = listEventTypes('WATER');
    assert.ok(events.some((row) => row.eventType === 'WaterDelivered'));
  });
});

describe('Wave 5 capacity vs production controls', () => {
  it('rejects installed capacity masquerading as generation', () => {
    const result = refuseCapacityAsProduction('INSTALLED_MW', 'SolarInstallation');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'CAPACITY_MASQUERADING_AS_PRODUCTION');
    }
    const observation = observationIsNotEvent(CAPACITY_NOT_PRODUCTION_OBSERVATION);
    assert.equal(observation.ok, false);
  });

  it('accepts bounded flow production events', () => {
    for (const event of WAVE5_DOMAIN_FIXTURES) {
      const validated = validateProductiveEventMaterial(event);
      assert.equal(validated.ok, true, `expected ${event.eventType} to validate`);
    }
  });
});

describe('Wave 5 stock vs flow controls', () => {
  it('rejects reservoir stock as flow delivery', () => {
    const result = refuseStockAsFlow('reservoir_level_ml', 'Reservoir');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'STOCK_MASQUERADING_AS_FLOW');
    }
    const observation = observationIsNotEvent(STOCK_NOT_FLOW_OBSERVATION);
    assert.equal(observation.ok, false);
  });

  it('prevents duplicate stock monetization', () => {
    resetStockMonetizationRegistryForTests();
    const first = refuseDuplicateStockMonetization('stock:reservoir:metro');
    assert.equal(first.ok, true);
    const second = refuseDuplicateStockMonetization('stock:reservoir:metro');
    assert.equal(second.ok, false);
  });
});

describe('Wave 5 observation vs event vs claim separation', () => {
  it('rejects telemetry as productive event', () => {
    const telemetry = refuseTelemetryAsEvent('CPU_TEMPERATURE');
    assert.equal(telemetry.ok, false);
    const observation = observationIsNotEvent(TELEMETRY_NOT_EVENT_OBSERVATION);
    assert.equal(observation.ok, false);
  });

  it('rejects market price as production', () => {
    const market = refuseMarketPriceAsProduction('MARKET_PRICE_REFERENCE');
    assert.equal(market.ok, false);
    const observation = observationIsNotEvent(MARKET_PRICE_NOT_PRODUCTION_OBSERVATION);
    assert.equal(observation.ok, false);
  });

  it('builds productive claim without supply authority', () => {
    const built = buildProductiveEconomicClaimBundle({
      economicClaimId: 'cec_wave5_solar',
      canonicalEntityId: 'entity:solar:north-ridge',
      canonicalEventId: 'event:solar:2026-09-02T12',
      event: SOLAR_GENERATION_EVENT,
      supportingFactIds: ['vef_solar_001'],
      evidenceRefs: ['evd_solar_001'],
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.bundle.claim.economicDomain, 'PRODUCTIVE_ECONOMIC');
      assert.equal(built.bundle.extension.productiveEventType, 'EnergyGenerated');
      assert.equal(productiveClaimLacksSupplyAuthority(built.bundle), true);
      const mismatch = eventIsNotClaim(
        { ...SOLAR_GENERATION_EVENT, eventId: 'event:solar:other' },
        'event:solar:2026-09-02T12',
      );
      assert.equal(mismatch.ok, false);
    }
  });
});

describe('Wave 5 claim vs GPUV vs MoonRey separation', () => {
  it('keeps GPUV and MoonRey distinct from claim', () => {
    const claimId = 'cec_wave5_factory';
    const gpuv = { gpuvId: 'gpuv_factory_001', claimId, methodologyId: 'pvm.manufacturing.sim' };
    const issuance = { issuanceId: 'issuance_factory_001', claimId, gpuvId: 'gpuv_factory_001' };
    assert.equal(claimIsNotGpuv(claimId, gpuv).ok, true);
    assert.equal(claimIsNotMoonRey(claimId, issuance).ok, true);
    assert.equal(gpuvIsNotMoonRey(gpuv, issuance).ok, true);
    const wrongGpuv = gpuvIsNotMoonRey(gpuv, { issuanceId: 'x', gpuvId: 'other' });
    assert.equal(wrongGpuv.ok, false);
  });
});

describe('Wave 5 domain fixtures', () => {
  const cases = [
    ['solar generation', SOLAR_GENERATION_EVENT],
    ['grid energy delivery', GRID_DELIVERY_EVENT],
    ['GPU compute execution', GPU_COMPUTE_EVENT],
    ['factory production', FACTORY_PRODUCTION_EVENT],
    ['agricultural output', AGRICULTURAL_OUTPUT_EVENT],
    ['resource extraction', RESOURCE_EXTRACTION_EVENT],
    ['logistics movement', LOGISTICS_MOVEMENT_EVENT],
    ['water delivery', WATER_DELIVERY_EVENT],
  ] as const;

  for (const [label, event] of cases) {
    it(`validates ${label} fixture`, () => {
      const result = validateProductiveEventMaterial(event);
      assert.equal(result.ok, true, label);
    });
  }
});

describe('Wave 5 productive graph projection', () => {
  it('projects entity→event→source→evidence→claim relationships', () => {
    const projection = projectProductiveEventToGraph({
      event: SOLAR_GENERATION_EVENT,
      entityLabel: 'North Ridge Solar',
      eventLabel: 'Solar Generation 2026-09-02',
      sourceRefs: ['provider:grid-a', 'provider:grid-b'],
      claimId: 'cec_wave5_solar_graph',
      createdAt: '2026-09-02T12:00:00.000Z' as import('../../../../domain/src/time.ts').UtcInstant,
    });
    assert.equal(projection.entityNode.domain, 'PRODUCTIVE_ECONOMY');
    assert.equal(projection.assetToEventEdge.kind, 'GENERATES');
    assert.equal(projection.observationEdges.length, 2);
    assert.equal(projection.observationEdges[0]?.kind, 'OBSERVED_BY');
    assert.ok(projection.evidenceEdges.some((edge) => edge.kind === 'SUPPORTED_BY'));
    assert.equal(projection.claimEdge?.kind, 'RESOLVES_TO');
  });
});

describe('Wave 5 metric derivation classification', () => {
  it('distinguishes derived metrics from direct measurements', () => {
    const satellite = classifyMetric('SATELLITE_ESTIMATED_GENERATION');
    assert.ok(satellite);
    assert.equal(satellite.derivationClass, 'SATELLITE_DERIVED');
    assert.equal(isDerivedMetric(satellite.derivationClass), true);
    const direct = classifyMetric('ENERGY_GENERATED');
    assert.ok(direct);
    assert.equal(isDerivedMetric(direct.derivationClass), false);
  });
});
