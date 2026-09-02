/**
 * Wave 4 — representative fixtures for normalization tests.
 */

import { RAW_SOURCE_RECORD_SCHEMA, type RawSourceRecord } from './source.ts';

const BASE_TIME = '2026-08-30T12:00:00.000Z';
const PERIOD_START = '2026-08-01T00:00:00.000Z';
const PERIOD_END = '2026-08-31T23:59:59.000Z';

function base(overrides: Partial<RawSourceRecord>): RawSourceRecord {
  return Object.freeze({
    schemaVersion: RAW_SOURCE_RECORD_SCHEMA,
    providerId: 'fixture-provider',
    sourceClass: 'SANDBOX_FIXTURE',
    sourceRecordId: 'rec-default',
    sourceDatasetId: 'dataset-default',
    providerSchemaId: 'energy.grid-generation.v1',
    providerSchemaVersion: '1',
    subjectOrResourceId: 'resource-default',
    economicDomain: 'ENERGY',
    category: 'generation',
    metric: 'energy_generated',
    value: 1_000n,
    unit: 'MWh',
    observedAt: BASE_TIME,
    receivedAt: BASE_TIME,
    aggregationHint: 'INSTANT',
    geography: Object.freeze({ country: 'GB', jurisdiction: 'GB', gridZone: 'UK-GB' }),
    license: 'SANDBOX_FIXTURE',
    rightsScope: 'PUBLIC_DERIVED',
    ...overrides,
  });
}

export const FIXTURES = Object.freeze({
  energy: base({
    sourceRecordId: 'rec-energy-001',
    providerId: 'uk-grid-sandbox',
    providerSchemaId: 'energy.grid-generation.v1',
    economicDomain: 'ENERGY',
    metric: 'energy_generated',
    value: 2_500n,
    unit: 'MWh',
    extensionFields: Object.freeze({
      generationType: 'WIND',
      fuelType: null,
      gridInterconnection: 'UK-GB',
    }),
    rawPayload: '{"generation_mwh":2500,"fuel":"wind"}',
  }),

  energyPeriod: base({
    sourceRecordId: 'rec-energy-period-001',
    providerId: 'uk-grid-sandbox',
    observedAt: null,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    aggregationHint: 'PERIOD',
    metric: 'monthly_generation',
    value: 75_000n,
    unit: 'MWh',
  }),

  compute: base({
    sourceRecordId: 'rec-compute-001',
    providerId: 'gpu-cloud-sandbox',
    providerSchemaId: 'compute.gpu-utilization.v1',
    economicDomain: 'COMPUTE',
    category: 'gpu_utilization',
    metric: 'gpu_hours',
    value: 48n,
    unit: 'GPU_HOUR',
    extensionFields: Object.freeze({
      acceleratorType: 'H100',
      workloadClass: 'INFERENCE',
    }),
  }),

  manufacturing: base({
    sourceRecordId: 'rec-mfg-001',
    providerId: 'factory-sandbox',
    providerSchemaId: 'manufacturing.output.v1',
    economicDomain: 'MANUFACTURING',
    category: 'production',
    metric: 'units_produced',
    value: 10_000n,
    unit: 'units_produced',
    extensionFields: Object.freeze({
      productSku: 'SKU-4421',
      productionLine: 'LINE-A',
    }),
  }),

  agriculture: base({
    sourceRecordId: 'rec-agri-001',
    providerId: 'usda-sandbox',
    providerSchemaId: 'agriculture.yield.v1',
    economicDomain: 'AGRICULTURE',
    category: 'yield',
    metric: 'harvest_mass',
    value: 5_000n,
    unit: 'tonne',
    geography: Object.freeze({ country: 'US', region: 'IA', jurisdiction: 'US-IA' }),
    extensionFields: Object.freeze({
      cropType: 'CORN',
      harvestSeason: '2026-FALL',
    }),
  }),

  research: base({
    sourceRecordId: 'rec-research-001',
    providerId: 'openalex-sandbox',
    providerSchemaId: 'research.publication-metrics.v1',
    economicDomain: 'RESEARCH',
    category: 'publication',
    metric: 'citation_count',
    value: 142n,
    unit: 'UNIT',
    extensionFields: Object.freeze({
      publicationId: 'W2741809807',
      doi: '10.1038/s41586-020-2649-2',
      peerReviewed: true,
    }),
  }),

  workforce: base({
    sourceRecordId: 'rec-workforce-001',
    providerId: 'bls-sandbox',
    providerSchemaId: 'workforce.employment.v1',
    economicDomain: 'WORKFORCE',
    category: 'employment',
    metric: 'headcount',
    value: 1_250_000n,
    unit: 'UNIT',
    geography: Object.freeze({ country: 'US', region: 'CA', jurisdiction: 'US-CA', precision: 'REGION' }),
    extensionFields: Object.freeze({
      occupationCode: '15-1252',
      employmentType: 'FULL_TIME',
    }),
  }),

  healthPublic: base({
    sourceRecordId: 'rec-health-001',
    providerId: 'cdc-sandbox',
    providerSchemaId: 'health.public-surveillance.v1',
    economicDomain: 'HEALTH_PUBLIC',
    category: 'surveillance',
    metric: 'incidence_rate',
    value: 12n,
    unit: 'UNIT',
    geography: Object.freeze({ country: 'US', jurisdiction: 'US', precision: 'COUNTRY' }),
    extensionFields: Object.freeze({
      conditionCode: 'ICD10-J06',
      surveillanceSystem: 'NREVSS',
    }),
  }),

  geospatial: base({
    sourceRecordId: 'rec-geo-001',
    providerId: 'osm-sandbox',
    providerSchemaId: 'geospatial.reference.v1',
    economicDomain: 'GEOSPATIAL',
    category: 'land_use',
    metric: 'area',
    value: 50_000n,
    unit: 'm2',
    geography: Object.freeze({
      country: 'DE',
      jurisdiction: 'DE',
      facilityRef: 'facility:berlin-solar-park',
      precision: 'FACILITY',
    }),
    extensionFields: Object.freeze({
      featureType: 'SOLAR_FARM',
      crs: 'EPSG:4326',
    }),
  }),

  unlabeledNumeric: base({
    sourceRecordId: 'rec-unlabeled-001',
    metric: '',
    unit: 'MWh',
    value: 100n,
  }),

  missingUnit: base({
    sourceRecordId: 'rec-no-unit-001',
    metric: 'energy_generated',
    unit: '',
    value: 100n,
  }),

  badUnit: base({
    sourceRecordId: 'rec-bad-unit-001',
    metric: 'power_output',
    unit: 'MW',
    value: 500n,
    providerSchemaId: 'energy.grid-generation.v1',
  }),

  powerEnergyMix: base({
    sourceRecordId: 'rec-dimension-mix-001',
    metric: 'instantaneous_power',
    unit: 'MW',
    value: 100n,
  }),

  unsupportedSchema: base({
    sourceRecordId: 'rec-schema-001',
    providerSchemaId: 'unknown.schema.v99',
    providerSchemaVersion: '99',
  }),

  missingTime: base({
    sourceRecordId: 'rec-no-time-001',
    observedAt: null,
    periodStart: null,
    periodEnd: null,
    receivedAt: '',
  }),

  humanEconomyPrecise: base({
    sourceRecordId: 'rec-human-001',
    providerSchemaId: 'workforce.employment.v1',
    economicDomain: 'HUMAN_ECONOMY',
    metric: 'contribution_hours',
    value: 8n,
    unit: 'service_hour',
    geography: Object.freeze({
      coordinates: Object.freeze({ lat: 51.5074, lon: -0.1278 }),
      publicDisclosureAllowed: false,
      jurisdiction: 'GB',
    }),
  }),
});

export const ALL_VALID_FIXTURES = Object.freeze([
  FIXTURES.energy,
  FIXTURES.energyPeriod,
  FIXTURES.compute,
  FIXTURES.manufacturing,
  FIXTURES.agriculture,
  FIXTURES.research,
  FIXTURES.workforce,
  FIXTURES.healthPublic,
  FIXTURES.geospatial,
]);
