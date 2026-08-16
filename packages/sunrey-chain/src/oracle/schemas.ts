import type { FactType, UnitCode } from './types.ts';

export type FactSchema = {
  readonly schemaVersion: 1;
  readonly factType: FactType;
  readonly defaultUnit: UnitCode;
  readonly allowedUnits: readonly UnitCode[];
  readonly subjectSchema: string;
  readonly upgradePath: 'GOVERNED_SCHEMA_UPGRADE';
};

const energy: FactSchema = Object.freeze({
  schemaVersion: 1,
  factType: 'ENERGY_PRODUCTION',
  defaultUnit: 'MWh',
  allowedUnits: ['Wh', 'kWh', 'MWh'],
  subjectSchema: 'energy.resource.v1',
  upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
});

export const FACT_SCHEMAS: Readonly<Record<FactType, FactSchema>> = Object.freeze({
  ENERGY_PRODUCTION: energy,
  ENERGY_CAPACITY: { ...energy, factType: 'ENERGY_CAPACITY' },
  ENERGY_CONSUMPTION: { ...energy, factType: 'ENERGY_CONSUMPTION' },
  FOOD_PRODUCTION: Object.freeze({
    schemaVersion: 1,
    factType: 'FOOD_PRODUCTION',
    defaultUnit: 'tonne',
    allowedUnits: ['kg', 'tonne'],
    subjectSchema: 'food.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  AGRICULTURAL_OUTPUT: Object.freeze({
    schemaVersion: 1,
    factType: 'AGRICULTURAL_OUTPUT',
    defaultUnit: 'tonne',
    allowedUnits: ['kg', 'tonne'],
    subjectSchema: 'agriculture.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  WATER_PRODUCTION: Object.freeze({
    schemaVersion: 1,
    factType: 'WATER_PRODUCTION',
    defaultUnit: 'm3',
    allowedUnits: ['L', 'm3'],
    subjectSchema: 'water.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  WATER_AVAILABILITY: Object.freeze({
    schemaVersion: 1,
    factType: 'WATER_AVAILABILITY',
    defaultUnit: 'm3',
    allowedUnits: ['L', 'm3'],
    subjectSchema: 'water.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  COMPUTE_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'COMPUTE_CAPACITY',
    defaultUnit: 'gpu_s',
    allowedUnits: ['compute_s', 'gpu_s', 'machine_h'],
    subjectSchema: 'compute.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  COMPUTE_USAGE: Object.freeze({
    schemaVersion: 1,
    factType: 'COMPUTE_USAGE',
    defaultUnit: 'gpu_s',
    allowedUnits: ['compute_s', 'gpu_s', 'machine_h'],
    subjectSchema: 'compute.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  AI_INFERENCE_USAGE: Object.freeze({
    schemaVersion: 1,
    factType: 'AI_INFERENCE_USAGE',
    defaultUnit: 'token_inference',
    allowedUnits: ['token_inference'],
    subjectSchema: 'ai.inference.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  MANUFACTURING_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'MANUFACTURING_CAPACITY',
    defaultUnit: 'units_produced',
    allowedUnits: ['units_produced', 'machine_h'],
    subjectSchema: 'manufacturing.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  MANUFACTURING_OUTPUT: Object.freeze({
    schemaVersion: 1,
    factType: 'MANUFACTURING_OUTPUT',
    defaultUnit: 'units_produced',
    allowedUnits: ['units_produced', 'kg', 'tonne'],
    subjectSchema: 'manufacturing.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  REAL_ESTATE_USE_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'REAL_ESTATE_USE_CAPACITY',
    defaultUnit: 'm2',
    allowedUnits: ['m2'],
    subjectSchema: 'real_estate.use.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  STORAGE_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'STORAGE_CAPACITY',
    defaultUnit: 'TB',
    allowedUnits: ['GB', 'TB'],
    subjectSchema: 'storage.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  LOGISTICS_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'LOGISTICS_CAPACITY',
    defaultUnit: 'tonne_km',
    allowedUnits: ['tonne_km'],
    subjectSchema: 'logistics.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  DELIVERY_COMPLETION: Object.freeze({
    schemaVersion: 1,
    factType: 'DELIVERY_COMPLETION',
    defaultUnit: 'units_produced',
    allowedUnits: ['units_produced'],
    subjectSchema: 'delivery.completion.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  BANDWIDTH_CAPACITY: Object.freeze({
    schemaVersion: 1,
    factType: 'BANDWIDTH_CAPACITY',
    defaultUnit: 'GB_s',
    allowedUnits: ['GB_s'],
    subjectSchema: 'bandwidth.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  BANDWIDTH_USAGE: Object.freeze({
    schemaVersion: 1,
    factType: 'BANDWIDTH_USAGE',
    defaultUnit: 'GB_s',
    allowedUnits: ['GB_s'],
    subjectSchema: 'bandwidth.resource.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  RESOURCE_RESERVE: Object.freeze({
    schemaVersion: 1,
    factType: 'RESOURCE_RESERVE',
    defaultUnit: 'tonne',
    allowedUnits: ['kg', 'tonne'],
    subjectSchema: 'minerals.reserve.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  RESOURCE_EXTRACTION: Object.freeze({
    schemaVersion: 1,
    factType: 'RESOURCE_EXTRACTION',
    defaultUnit: 'tonne',
    allowedUnits: ['kg', 'tonne'],
    subjectSchema: 'minerals.extraction.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  SERVICE_DELIVERY: Object.freeze({
    schemaVersion: 1,
    factType: 'SERVICE_DELIVERY',
    defaultUnit: 'units_produced',
    allowedUnits: ['units_produced', 'machine_h'],
    subjectSchema: 'service.delivery.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
  REFERENCE_PRICE: Object.freeze({
    schemaVersion: 1,
    factType: 'REFERENCE_PRICE',
    defaultUnit: 'units_produced',
    allowedUnits: ['units_produced'],
    subjectSchema: 'reference.price.v1',
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  }),
});

export function schemaAllowsUnit(factType: FactType, unit: UnitCode): boolean {
  return FACT_SCHEMAS[factType].allowedUnits.includes(unit);
}

export function governedSchemaUpgradeOnly(): 'GOVERNED_SCHEMA_UPGRADE' {
  return 'GOVERNED_SCHEMA_UPGRADE';
}
