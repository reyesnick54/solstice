import type { FactType, UnitCode } from './types.ts';

export type FactSchema = {
  readonly schemaVersion: 1;
  readonly factType: FactType;
  readonly defaultUnit: UnitCode;
  readonly allowedUnits: readonly UnitCode[];
  readonly subjectSchema: string;
  readonly upgradePath: 'GOVERNED_SCHEMA_UPGRADE';
};

function schema(
  factType: FactType,
  defaultUnit: UnitCode,
  allowedUnits: readonly UnitCode[],
  subjectSchema: string,
): FactSchema {
  return Object.freeze({
    schemaVersion: 1,
    factType,
    defaultUnit,
    allowedUnits,
    subjectSchema,
    upgradePath: 'GOVERNED_SCHEMA_UPGRADE',
  });
}

const ENERGY_UNITS: readonly UnitCode[] = ['Wh', 'kWh', 'MWh'];
const MASS_UNITS: readonly UnitCode[] = ['kg', 'tonne'];
const VOLUME_UNITS: readonly UnitCode[] = ['L', 'm3'];
const COMPUTE_UNITS: readonly UnitCode[] = ['compute_s', 'gpu_s', 'machine_h'];
const STORAGE_UNITS: readonly UnitCode[] = ['GB', 'TB'];

export const FACT_SCHEMAS: Readonly<Record<FactType, FactSchema>> = Object.freeze({
  ENERGY_PRODUCTION: schema('ENERGY_PRODUCTION', 'MWh', ENERGY_UNITS, 'energy.resource.v1'),
  ENERGY_CAPACITY: schema('ENERGY_CAPACITY', 'MWh', ENERGY_UNITS, 'energy.resource.v1'),
  ENERGY_CONSUMPTION: schema('ENERGY_CONSUMPTION', 'MWh', ENERGY_UNITS, 'energy.resource.v1'),
  FOOD_PRODUCTION: schema('FOOD_PRODUCTION', 'tonne', MASS_UNITS, 'food.resource.v1'),
  AGRICULTURAL_OUTPUT: schema('AGRICULTURAL_OUTPUT', 'tonne', MASS_UNITS, 'agriculture.resource.v1'),
  WATER_PRODUCTION: schema('WATER_PRODUCTION', 'm3', VOLUME_UNITS, 'water.resource.v1'),
  WATER_AVAILABILITY: schema('WATER_AVAILABILITY', 'm3', VOLUME_UNITS, 'water.resource.v1'),
  COMPUTE_CAPACITY: schema('COMPUTE_CAPACITY', 'gpu_s', COMPUTE_UNITS, 'compute.resource.v1'),
  COMPUTE_USAGE: schema('COMPUTE_USAGE', 'gpu_s', COMPUTE_UNITS, 'compute.resource.v1'),
  AI_INFERENCE_USAGE: schema('AI_INFERENCE_USAGE', 'token_inference', ['token_inference'], 'ai.inference.v1'),
  AI_COMPUTE_CAPACITY: schema('AI_COMPUTE_CAPACITY', 'gpu_s', COMPUTE_UNITS, 'ai.compute.capacity.v1'),
  AI_TRAINING_USAGE: schema('AI_TRAINING_USAGE', 'token_inference', ['token_inference', 'gpu_s'], 'ai.training.v1'),
  MANUFACTURING_CAPACITY: schema(
    'MANUFACTURING_CAPACITY',
    'units_produced',
    ['units_produced', 'machine_h'],
    'manufacturing.resource.v1',
  ),
  MANUFACTURING_OUTPUT: schema(
    'MANUFACTURING_OUTPUT',
    'units_produced',
    ['units_produced', 'kg', 'tonne'],
    'manufacturing.resource.v1',
  ),
  REAL_ESTATE_USE_CAPACITY: schema('REAL_ESTATE_USE_CAPACITY', 'm2', ['m2'], 'real_estate.use.v1'),
  REAL_ESTATE_USAGE: schema('REAL_ESTATE_USAGE', 'm2_hour', ['m2_hour'], 'real_estate.usage.v1'),
  STORAGE_CAPACITY: schema('STORAGE_CAPACITY', 'TB', STORAGE_UNITS, 'storage.resource.v1'),
  LOGISTICS_CAPACITY: schema('LOGISTICS_CAPACITY', 'tonne_km', ['tonne_km'], 'logistics.resource.v1'),
  DELIVERY_COMPLETION: schema('DELIVERY_COMPLETION', 'units_produced', ['units_produced'], 'delivery.completion.v1'),
  BANDWIDTH_CAPACITY: schema('BANDWIDTH_CAPACITY', 'GB_s', ['GB_s', 'B_s'], 'bandwidth.capacity.v1'),
  BANDWIDTH_USAGE: schema('BANDWIDTH_USAGE', 'GB_s', ['GB_s', 'GB', 'TB'], 'bandwidth.usage.v1'),
  RESOURCE_RESERVE: schema('RESOURCE_RESERVE', 'tonne', MASS_UNITS, 'minerals.reserve.v1'),
  RESOURCE_EXTRACTION: schema('RESOURCE_EXTRACTION', 'tonne', MASS_UNITS, 'minerals.extraction.v1'),
  SERVICE_DELIVERY: schema(
    'SERVICE_DELIVERY',
    'units_produced',
    ['units_produced', 'machine_h'],
    'service.delivery.v1',
  ),
  INFRASTRUCTURE_CAPACITY: schema(
    'INFRASTRUCTURE_CAPACITY',
    'machine_h',
    ['machine_h', 'facility_hour'],
    'infrastructure.capacity.v1',
  ),
  INFRASTRUCTURE_USAGE: schema(
    'INFRASTRUCTURE_USAGE',
    'machine_h',
    ['machine_h', 'facility_hour'],
    'infrastructure.usage.v1',
  ),
  GOODS_OUTPUT: schema('GOODS_OUTPUT', 'units_produced', ['units_produced', 'kg', 'tonne'], 'goods.output.v1'),
  GOODS_DELIVERY: schema('GOODS_DELIVERY', 'units_produced', ['units_produced'], 'goods.delivery.v1'),
  AUTOMATED_MACHINE_OUTPUT: schema(
    'AUTOMATED_MACHINE_OUTPUT',
    'units_produced',
    ['units_produced', 'machine_h'],
    'automated.machine.output.v1',
  ),
  REFERENCE_PRICE: schema('REFERENCE_PRICE', 'units_produced', ['units_produced'], 'reference.price.v1'),
});

export function schemaAllowsUnit(factType: FactType, unit: UnitCode): boolean {
  return FACT_SCHEMAS[factType].allowedUnits.includes(unit);
}

/**
 * Historical BANDWIDTH_USAGE contract. Observations already admitted
 * under GB_s remain valid. Volume semantics live on V2.
 */
export const BANDWIDTH_USAGE_SCHEMA_V1 = Object.freeze({
  schemaVersion: 1 as const,
  factType: 'BANDWIDTH_USAGE' as const,
  defaultUnit: 'GB_s' as const,
  allowedUnits: Object.freeze(['GB_s'] as const),
  subjectSchema: 'bandwidth.resource.v1',
  quantityKind: 'DATA_RATE' as const,
  upgradePath: 'GOVERNED_SCHEMA_UPGRADE' as const,
});

/**
 * Governed volume contract. Transferred/used network service uses
 * DATA_VOLUME units. GB/s is not GB.
 */
export const BANDWIDTH_USAGE_SCHEMA_V2 = Object.freeze({
  schemaVersion: 2 as const,
  factType: 'BANDWIDTH_USAGE' as const,
  defaultUnit: 'GB' as const,
  allowedUnits: Object.freeze(['GB', 'TB'] as const),
  subjectSchema: 'bandwidth.usage.v2',
  quantityKind: 'DATA_VOLUME' as const,
  upgradePath: 'GOVERNED_SCHEMA_UPGRADE' as const,
});

export function governedSchemaUpgradeOnly(): 'GOVERNED_SCHEMA_UPGRADE' {
  return 'GOVERNED_SCHEMA_UPGRADE';
}
