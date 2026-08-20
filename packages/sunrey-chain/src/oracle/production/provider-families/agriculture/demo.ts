/**
 * Chunk 134 demo — agriculture, food, and water economic data fabric.
 *
 * FIELD / FARM: harvest telemetry + weigh scale + farm system → one harvest event
 * WATER: treatment meter → verified water-production observation
 * then water → irrigation input → crop harvest lineage
 *
 * No real providers. No production activation. No MoonRey mint.
 */

import { FakeExternalHttpTransport } from '../../transport.ts';
import {
  identifyHarvestEvents,
  ingestAgricultureRecords,
} from './adapter.ts';
import { certifyAgricultureSandbox, agricultureCertificationCannotAuthorizeMoonRey } from './certification.ts';
import {
  farmSystemRecord,
  grainScaleRecord,
  harvestTelemetryRecord,
  simulationAgriculturePolicy,
} from './fixtures.ts';
import { linkIrrigationToHarvest } from './lineage.ts';
import {
  FORECAST_YIELD_EQUALS_OUTPUT,
  PLANTED_AREA_EQUALS_OUTPUT,
  AGRICULTURE_PRODUCTION_ACTIVE,
  AGRICULTURE_REAL_PROVIDER_CONTACTED,
  agricultureFactCannotAutoMint,
} from './types.ts';
import {
  ingestWaterRecord,
  irrigationConsumptionRecord,
  linkWaterProductionToIrrigation,
  simulationWaterPolicy,
  treatmentMeterRecord,
  WATER_AVAILABILITY_EQUALS_PRODUCTION,
  IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION,
  WATER_PRODUCTION_ACTIVE,
  WATER_REAL_PROVIDER_CONTACTED,
  waterFactCannotAutoMint,
  certifyWaterSandbox,
} from '../water/index.ts';

const NOW = 1_700_000_000n;

export function runAgricultureWaterDataFabricDemo(): {
  readonly harvestEventCount: number;
  readonly waterProductionObserved: boolean;
  readonly irrigationLinked: boolean;
  readonly flags: Readonly<Record<string, boolean>>;
} {
  const transport = new FakeExternalHttpTransport();
  if (transport.contactsPublicInternet !== false) {
    throw new Error('agriculture/water demo must use the injected fake transport');
  }

  const policy = simulationAgriculturePolicy();
  const ingested = ingestAgricultureRecords(
    [harvestTelemetryRecord(NOW), grainScaleRecord(NOW), farmSystemRecord(NOW)],
    NOW,
    policy,
  );
  if (!ingested.ok) {
    throw new Error(`${ingested.error.code}: ${ingested.error.detail}`);
  }
  const harvestObs = ingested.value.filter((row) => row.observation.createsHarvestEvent).map((row) => row.observation);
  const events = identifyHarvestEvents(harvestObs, NOW, NOW + 3_600n);
  if (!events.ok) {
    throw new Error(`${events.error.code}: ${events.error.detail}`);
  }

  const water = ingestWaterRecord(treatmentMeterRecord(NOW), NOW, simulationWaterPolicy());
  if (!water.ok) {
    throw new Error(`${water.error.code}: ${water.error.detail}`);
  }
  const irrigation = ingestWaterRecord(irrigationConsumptionRecord(NOW), NOW, simulationWaterPolicy());
  if (!irrigation.ok) {
    throw new Error(`${irrigation.error.code}: ${irrigation.error.detail}`);
  }
  const waterToIrrigation = linkWaterProductionToIrrigation({
    production: water.value.observation,
    irrigation: irrigation.value.observation,
  });
  if (!waterToIrrigation.ok) {
    throw new Error(`${waterToIrrigation.error.code}: ${waterToIrrigation.error.detail}`);
  }
  const irrigationToHarvest = linkIrrigationToHarvest({
    irrigationObservationId: irrigation.value.observation.observationId,
    harvest: harvestObs[0]!,
  });
  if (!irrigationToHarvest.ok) {
    throw new Error(`${irrigationToHarvest.error.code}: ${irrigationToHarvest.error.detail}`);
  }

  const certifiedAg = certifyAgricultureSandbox('valid_harvest_mass', NOW);
  const certifiedWater = certifyWaterSandbox('valid_treatment_production', NOW);

  console.log('CHUNK-134 agriculture / food / water economic data fabric');
  console.log(`harvest_sensors=${harvestObs.length}`);
  console.log(`underlying_harvest_events=${events.value.length}`);
  console.log(`water_production_observed=${water.value.observation.createsWaterProductionEvent}`);
  console.log(`irrigation_lineage=${waterToIrrigation.value.relation}->${irrigationToHarvest.value.relation}`);
  console.log(`sandbox_agriculture_status=${certifiedAg.record.status}`);
  console.log(`sandbox_water_status=${certifiedWater.record.status}`);
  console.log(`PLANTED_AREA_EQUALS_OUTPUT=${PLANTED_AREA_EQUALS_OUTPUT}`);
  console.log(`FORECAST_YIELD_EQUALS_OUTPUT=${FORECAST_YIELD_EQUALS_OUTPUT}`);
  console.log(`WATER_AVAILABILITY_EQUALS_PRODUCTION=${WATER_AVAILABILITY_EQUALS_PRODUCTION}`);
  console.log(`IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION=${IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION}`);
  console.log(`REAL_PROVIDER_CONTACTED=${AGRICULTURE_REAL_PROVIDER_CONTACTED || WATER_REAL_PROVIDER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${AGRICULTURE_PRODUCTION_ACTIVE || WATER_PRODUCTION_ACTIVE}`);
  console.log(`AGRICULTURE_FACT_AUTO_MINT=${agricultureFactCannotAutoMint()}`);
  console.log(`WATER_FACT_AUTO_MINT=${waterFactCannotAutoMint()}`);
  console.log(`CERTIFICATION_AUTHORIZES_MOONREY=${agricultureCertificationCannotAuthorizeMoonRey()}`);
  return Object.freeze({
    harvestEventCount: events.value.length,
    waterProductionObserved: water.value.observation.createsWaterProductionEvent,
    irrigationLinked: irrigationToHarvest.value.relation === 'INPUT_TO',
    flags: Object.freeze({
      PLANTED_AREA_EQUALS_OUTPUT,
      FORECAST_YIELD_EQUALS_OUTPUT,
      WATER_AVAILABILITY_EQUALS_PRODUCTION,
      IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION,
      REAL_PROVIDER_CONTACTED: AGRICULTURE_REAL_PROVIDER_CONTACTED || WATER_REAL_PROVIDER_CONTACTED,
      PRODUCTION_ACTIVE: AGRICULTURE_PRODUCTION_ACTIVE || WATER_PRODUCTION_ACTIVE,
    }),
  });
}

const invokedDirectly = (process.argv[1] ?? '').includes('provider-families/agriculture/demo');
if (invokedDirectly) {
  runAgricultureWaterDataFabricDemo();
}
