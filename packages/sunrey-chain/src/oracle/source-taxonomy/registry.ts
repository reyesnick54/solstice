import type { FactType, UnitCode } from '../types.ts';
import { DATA_SOURCE_CATEGORIES, type DataSourceCategory } from '../production/types.ts';
import type { ClaimType, ProductiveCategory } from '../../productive/types.ts';
import {
  SOURCE_TAXONOMY_ID,
  SOURCE_TAXONOMY_SCHEMA_VERSION,
  type MappingStatus,
  type SourceCategoryStatus,
  type SourceProductiveMapping,
  type SourceTaxonomyRegistry,
} from './types.ts';

const ENERGY_UNITS: readonly UnitCode[] = ['Wh', 'kWh', 'MWh'];
const MASS_UNITS: readonly UnitCode[] = ['kg', 'tonne'];
const VOLUME_UNITS: readonly UnitCode[] = ['L', 'm3'];
const COMPUTE_UNITS: readonly UnitCode[] = ['compute_s', 'gpu_s', 'machine_h'];
const STORAGE_UNITS: readonly UnitCode[] = ['GB', 'TB'];

function mapping(input: {
  readonly mappingId: string;
  readonly mappingVersion: number;
  readonly status?: MappingStatus;
  readonly supersededBy?: string | null;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly allowedSourceUnits: readonly UnitCode[];
  readonly productiveCategory: ProductiveCategory | null;
  readonly allowedClaimTypes: readonly ClaimType[];
  readonly referenceDataOnly?: boolean;
  readonly requiresAttributionPolicy?: boolean;
  readonly overlapRisk?: boolean;
  readonly requiresGeography?: boolean;
}): SourceProductiveMapping {
  const referenceDataOnly = input.referenceDataOnly === true;
  return Object.freeze({
    schemaVersion: SOURCE_TAXONOMY_SCHEMA_VERSION,
    taxonomyId: SOURCE_TAXONOMY_ID,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
    status: input.status ?? 'ACTIVE',
    supersededBy: input.supersededBy ?? null,
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    allowedSourceUnits: Object.freeze([...input.allowedSourceUnits]),
    productiveCategory: input.productiveCategory,
    allowedClaimTypes: Object.freeze([...input.allowedClaimTypes]),
    referenceDataOnly,
    requiresAttributionPolicy: input.requiresAttributionPolicy === true,
    overlapRisk: input.overlapRisk === true,
    requiresProductiveObject: !referenceDataOnly,
    requiresRights: !referenceDataOnly,
    requiresMeasurementPeriod: !referenceDataOnly,
    requiresGeography: input.requiresGeography === true,
    requiresVerifiedFact: !referenceDataOnly,
    requiresQuorum: !referenceDataOnly,
    canCreateProductiveClaim: !referenceDataOnly && input.productiveCategory !== null,
  });
}

const REAL_ESTATE_CAPACITY_MAPPING = 'spm.real_estate_use.REAL_ESTATE_USE_CAPACITY.REAL_ESTATE_USE';

export const HISTORICAL_REAL_ESTATE_CAPACITY_MAPPING = mapping({
  mappingId: REAL_ESTATE_CAPACITY_MAPPING,
  mappingVersion: 1,
  status: 'SUPERSEDED',
  supersededBy: `${REAL_ESTATE_CAPACITY_MAPPING}@2`,
  sourceCategory: 'real_estate_use',
  factType: 'REAL_ESTATE_USE_CAPACITY',
  allowedSourceUnits: ['m2'],
  productiveCategory: 'REAL_ESTATE_USE',
  allowedClaimTypes: ['CAPACITY', 'USAGE'],
  requiresGeography: true,
});

const ENERGY_PRODUCTION_V2 = 'spm.energy.ENERGY_PRODUCTION.ENERGY';

export const HISTORICAL_ENERGY_PRODUCTION_MAPPING = mapping({
  mappingId: ENERGY_PRODUCTION_V2,
  mappingVersion: 1,
  status: 'SUPERSEDED',
  supersededBy: `${ENERGY_PRODUCTION_V2}@2`,
  sourceCategory: 'energy',
  factType: 'ENERGY_PRODUCTION',
  allowedSourceUnits: ENERGY_UNITS,
  productiveCategory: 'ENERGY',
  allowedClaimTypes: ['OUTPUT'],
});

const ACTIVE_MAPPINGS: readonly SourceProductiveMapping[] = Object.freeze([
  mapping({
    mappingId: ENERGY_PRODUCTION_V2,
    mappingVersion: 2,
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    allowedSourceUnits: ENERGY_UNITS,
    productiveCategory: 'ENERGY',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.energy.ENERGY_CAPACITY.ENERGY',
    mappingVersion: 1,
    sourceCategory: 'energy',
    factType: 'ENERGY_CAPACITY',
    allowedSourceUnits: ENERGY_UNITS,
    productiveCategory: 'ENERGY',
    allowedClaimTypes: ['CAPACITY'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.energy.ENERGY_CONSUMPTION.ENERGY',
    mappingVersion: 1,
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    allowedSourceUnits: ENERGY_UNITS,
    productiveCategory: 'ENERGY',
    allowedClaimTypes: ['USAGE'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.food_agriculture.FOOD_PRODUCTION.FOOD_AGRICULTURE',
    mappingVersion: 1,
    sourceCategory: 'food_agriculture',
    factType: 'FOOD_PRODUCTION',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'FOOD_AGRICULTURE',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.food_agriculture.AGRICULTURAL_OUTPUT.FOOD_AGRICULTURE',
    mappingVersion: 1,
    sourceCategory: 'food_agriculture',
    factType: 'AGRICULTURAL_OUTPUT',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'FOOD_AGRICULTURE',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.water.WATER_PRODUCTION.WATER',
    mappingVersion: 1,
    sourceCategory: 'water',
    factType: 'WATER_PRODUCTION',
    allowedSourceUnits: VOLUME_UNITS,
    productiveCategory: 'WATER',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.water.WATER_AVAILABILITY.WATER',
    mappingVersion: 1,
    sourceCategory: 'water',
    factType: 'WATER_AVAILABILITY',
    allowedSourceUnits: VOLUME_UNITS,
    productiveCategory: 'WATER',
    allowedClaimTypes: ['CAPACITY', 'RESERVE'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.compute.COMPUTE_CAPACITY.COMPUTE',
    mappingVersion: 1,
    sourceCategory: 'compute',
    factType: 'COMPUTE_CAPACITY',
    allowedSourceUnits: COMPUTE_UNITS,
    productiveCategory: 'COMPUTE',
    allowedClaimTypes: ['CAPACITY'],
  }),
  mapping({
    mappingId: 'spm.compute.COMPUTE_USAGE.COMPUTE',
    mappingVersion: 1,
    sourceCategory: 'compute',
    factType: 'COMPUTE_USAGE',
    allowedSourceUnits: COMPUTE_UNITS,
    productiveCategory: 'COMPUTE',
    allowedClaimTypes: ['USAGE'],
  }),
  mapping({
    mappingId: 'spm.ai_usage.AI_INFERENCE_USAGE.AI_COMPUTE',
    mappingVersion: 1,
    sourceCategory: 'ai_usage',
    factType: 'AI_INFERENCE_USAGE',
    allowedSourceUnits: ['token_inference'],
    productiveCategory: 'AI_COMPUTE',
    allowedClaimTypes: ['USAGE'],
  }),
  mapping({
    mappingId: 'spm.manufacturing.MANUFACTURING_CAPACITY.MANUFACTURING',
    mappingVersion: 1,
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_CAPACITY',
    allowedSourceUnits: ['units_produced', 'machine_h'],
    productiveCategory: 'MANUFACTURING',
    allowedClaimTypes: ['CAPACITY'],
  }),
  mapping({
    mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.MANUFACTURING',
    mappingVersion: 1,
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_OUTPUT',
    allowedSourceUnits: ['units_produced', 'kg', 'tonne'],
    productiveCategory: 'MANUFACTURING',
    allowedClaimTypes: ['OUTPUT'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
  }),
  mapping({
    mappingId: 'spm.manufacturing.MANUFACTURING_CAPACITY.INFRASTRUCTURE',
    mappingVersion: 1,
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_CAPACITY',
    allowedSourceUnits: ['units_produced', 'machine_h'],
    productiveCategory: 'INFRASTRUCTURE',
    allowedClaimTypes: ['CAPACITY'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.GOODS',
    mappingVersion: 1,
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_OUTPUT',
    allowedSourceUnits: ['units_produced', 'kg', 'tonne'],
    productiveCategory: 'GOODS',
    allowedClaimTypes: ['OUTPUT'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
  }),
  mapping({
    mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.AUTOMATED_MACHINE_OUTPUT',
    mappingVersion: 1,
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_OUTPUT',
    allowedSourceUnits: ['units_produced', 'kg', 'tonne'],
    productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
    allowedClaimTypes: ['OUTPUT'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
  }),
  mapping({
    mappingId: 'spm.real_estate_use.REAL_ESTATE_USE_CAPACITY.REAL_ESTATE_USE',
    mappingVersion: 2,
    sourceCategory: 'real_estate_use',
    factType: 'REAL_ESTATE_USE_CAPACITY',
    allowedSourceUnits: ['m2'],
    productiveCategory: 'REAL_ESTATE_USE',
    allowedClaimTypes: ['CAPACITY'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.real_estate_use.REAL_ESTATE_USAGE.REAL_ESTATE_USE',
    mappingVersion: 1,
    sourceCategory: 'real_estate_use',
    factType: 'REAL_ESTATE_USAGE',
    allowedSourceUnits: ['m2_hour'],
    productiveCategory: 'REAL_ESTATE_USE',
    allowedClaimTypes: ['USAGE'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.infrastructure.INFRASTRUCTURE_CAPACITY.INFRASTRUCTURE',
    mappingVersion: 1,
    sourceCategory: 'infrastructure',
    factType: 'INFRASTRUCTURE_CAPACITY',
    allowedSourceUnits: ['machine_h', 'facility_hour'],
    productiveCategory: 'INFRASTRUCTURE',
    allowedClaimTypes: ['CAPACITY'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.infrastructure.INFRASTRUCTURE_USAGE.INFRASTRUCTURE',
    mappingVersion: 1,
    sourceCategory: 'infrastructure',
    factType: 'INFRASTRUCTURE_USAGE',
    allowedSourceUnits: ['machine_h', 'facility_hour'],
    productiveCategory: 'INFRASTRUCTURE',
    allowedClaimTypes: ['USAGE'],
    requiresAttributionPolicy: true,
    overlapRisk: true,
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.storage.STORAGE_CAPACITY.STORAGE',
    mappingVersion: 1,
    sourceCategory: 'storage',
    factType: 'STORAGE_CAPACITY',
    allowedSourceUnits: STORAGE_UNITS,
    productiveCategory: 'STORAGE',
    allowedClaimTypes: ['CAPACITY'],
  }),
  mapping({
    mappingId: 'spm.logistics.LOGISTICS_CAPACITY.LOGISTICS_TRANSPORTATION',
    mappingVersion: 1,
    sourceCategory: 'logistics',
    factType: 'LOGISTICS_CAPACITY',
    allowedSourceUnits: ['tonne_km'],
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    allowedClaimTypes: ['CAPACITY'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.logistics.DELIVERY_COMPLETION.LOGISTICS_TRANSPORTATION',
    mappingVersion: 1,
    sourceCategory: 'logistics',
    factType: 'DELIVERY_COMPLETION',
    allowedSourceUnits: ['units_produced'],
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    allowedClaimTypes: ['DELIVERY'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.bandwidth.BANDWIDTH_CAPACITY.BANDWIDTH_COMMUNICATIONS',
    mappingVersion: 1,
    sourceCategory: 'bandwidth',
    factType: 'BANDWIDTH_CAPACITY',
    allowedSourceUnits: ['GB_s', 'B_s'],
    productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
    allowedClaimTypes: ['CAPACITY'],
  }),
  mapping({
    mappingId: 'spm.bandwidth.BANDWIDTH_USAGE.BANDWIDTH_COMMUNICATIONS',
    mappingVersion: 1,
    sourceCategory: 'bandwidth',
    factType: 'BANDWIDTH_USAGE',
    allowedSourceUnits: ['GB_s', 'GB', 'TB'],
    productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
    allowedClaimTypes: ['USAGE'],
  }),
  mapping({
    mappingId: 'spm.resources.RESOURCE_RESERVE.MINERALS_RAW_MATERIALS',
    mappingVersion: 1,
    sourceCategory: 'resources',
    factType: 'RESOURCE_RESERVE',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    allowedClaimTypes: ['RESERVE'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.resources.RESOURCE_EXTRACTION.MINERALS_RAW_MATERIALS',
    mappingVersion: 1,
    sourceCategory: 'resources',
    factType: 'RESOURCE_EXTRACTION',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.minerals_resources.RESOURCE_RESERVE.MINERALS_RAW_MATERIALS',
    mappingVersion: 1,
    sourceCategory: 'minerals_resources',
    factType: 'RESOURCE_RESERVE',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    allowedClaimTypes: ['RESERVE'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.minerals_resources.RESOURCE_EXTRACTION.MINERALS_RAW_MATERIALS',
    mappingVersion: 1,
    sourceCategory: 'minerals_resources',
    factType: 'RESOURCE_EXTRACTION',
    allowedSourceUnits: MASS_UNITS,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    allowedClaimTypes: ['OUTPUT'],
    requiresGeography: true,
  }),
  mapping({
    mappingId: 'spm.service_delivery.SERVICE_DELIVERY.SERVICES',
    mappingVersion: 1,
    sourceCategory: 'service_delivery',
    factType: 'SERVICE_DELIVERY',
    allowedSourceUnits: ['units_produced', 'machine_h'],
    productiveCategory: 'SERVICES',
    allowedClaimTypes: ['DELIVERY'],
  }),
  mapping({
    mappingId: 'spm.reference_price.REFERENCE_PRICE.REFERENCE',
    mappingVersion: 1,
    sourceCategory: 'reference_price',
    factType: 'REFERENCE_PRICE',
    allowedSourceUnits: ['units_produced'],
    productiveCategory: null,
    allowedClaimTypes: [],
    referenceDataOnly: true,
  }),
]);

const SOURCE_CATEGORY_STATUS: Readonly<Record<DataSourceCategory, SourceCategoryStatus>> = Object.freeze(
  Object.fromEntries(DATA_SOURCE_CATEGORIES.map((category) => [category, 'ACTIVE'])) as Record<
    DataSourceCategory,
    SourceCategoryStatus
  >,
);

export const CANONICAL_SOURCE_TAXONOMY: SourceTaxonomyRegistry = Object.freeze({
  taxonomyId: SOURCE_TAXONOMY_ID,
  schemaVersion: SOURCE_TAXONOMY_SCHEMA_VERSION,
  mappings: Object.freeze([
    ...ACTIVE_MAPPINGS,
    HISTORICAL_ENERGY_PRODUCTION_MAPPING,
    HISTORICAL_REAL_ESTATE_CAPACITY_MAPPING,
  ]),
  sourceCategoryStatus: SOURCE_CATEGORY_STATUS,
});

export function activeMappings(
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): readonly SourceProductiveMapping[] {
  return registry.mappings.filter((row) => row.status === 'ACTIVE');
}

export function mappingById(
  mappingId: string,
  mappingVersion?: number | null,
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): SourceProductiveMapping | undefined {
  const rows = registry.mappings.filter((row) => row.mappingId === mappingId);
  if (mappingVersion !== undefined && mappingVersion !== null) {
    return rows.find((row) => row.mappingVersion === mappingVersion);
  }
  const active = rows.find((row) => row.status === 'ACTIVE');
  return active ?? rows[rows.length - 1];
}

export function registryWithRetiredCategory(
  category: DataSourceCategory,
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): SourceTaxonomyRegistry {
  return Object.freeze({
    ...registry,
    sourceCategoryStatus: Object.freeze({
      ...registry.sourceCategoryStatus,
      [category]: 'RETIRED',
    }),
  });
}
