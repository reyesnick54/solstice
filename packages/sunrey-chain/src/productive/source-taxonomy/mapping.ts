import type { FactType, UnitCode } from '../../oracle/types.ts';
import { FACT_SCHEMAS } from '../../oracle/schemas.ts';
import type { ClaimType, ProductiveCategory } from '../types.ts';
import {
  ECONOMIC_ASSET_CATEGORY_REFERENCE,
  ISSUANCE_BOUNDARY,
  SOURCE_TAXONOMY_MAPPING_VERSION,
  SOURCE_TAXONOMY_SCHEMA_VERSION,
  isAttributionRiskCategory,
  type DataSourceCategory,
  type EconomicEventClass,
  type MappingEconomicAssetCategory,
  type SourceProductiveMapping,
} from './types.ts';

type MappingDraft = {
  readonly source: DataSourceCategory;
  readonly fact: FactType;
  readonly productive: ProductiveCategory | null;
  readonly claims: readonly ClaimType[];
  readonly event: EconomicEventClass;
  readonly units?: readonly UnitCode[];
  readonly canClaim?: boolean;
  readonly canContribute?: boolean;
  readonly attribution?: boolean;
  readonly requiresObject?: boolean;
  readonly requiresRights?: boolean;
  readonly requiresPeriod?: boolean;
  readonly requiresGeography?: boolean;
};

function unitsFor(fact: FactType, override?: readonly UnitCode[]): readonly UnitCode[] {
  return override ?? FACT_SCHEMAS[fact].allowedUnits;
}

function economicAssetCategoryFor(
  productive: ProductiveCategory | null,
): MappingEconomicAssetCategory {
  return productive ?? ECONOMIC_ASSET_CATEGORY_REFERENCE;
}

function mappingId(source: DataSourceCategory, fact: FactType): string {
  return `map.src.${source}.${fact}.v${SOURCE_TAXONOMY_MAPPING_VERSION}`;
}

function defineMapping(draft: MappingDraft): SourceProductiveMapping {
  const canClaim = draft.canClaim ?? draft.productive !== null;
  const attribution =
    draft.attribution ?? (draft.productive !== null && isAttributionRiskCategory(draft.productive));
  return Object.freeze({
    mappingId: mappingId(draft.source, draft.fact),
    mappingVersion: SOURCE_TAXONOMY_MAPPING_VERSION,
    schemaVersion: SOURCE_TAXONOMY_SCHEMA_VERSION,
    dataSourceCategory: draft.source,
    factType: draft.fact,
    productiveCategory: draft.productive,
    economicAssetCategory: economicAssetCategoryFor(draft.productive),
    allowedSourceUnits: unitsFor(draft.fact, draft.units),
    allowedClaimTypes: [...draft.claims],
    economicEventClass: draft.event,
    requiresProductiveObject: draft.requiresObject ?? canClaim,
    requiresRights: draft.requiresRights ?? canClaim,
    requiresMeasurementPeriod: draft.requiresPeriod ?? canClaim,
    requiresGeography: draft.requiresGeography ?? canClaim,
    requiresVerifiedOracleFact: true,
    requiresIndependentSourceQuorum: true,
    canCreateProductiveClaim: canClaim,
    canBecomeProductiveContribution: draft.canContribute ?? canClaim,
    requiresAttributionPolicy: attribution,
    ...ISSUANCE_BOUNDARY,
    status: 'SIMULATION',
  });
}

function sourceFamily(
  sources: readonly DataSourceCategory[],
  rows: readonly Omit<MappingDraft, 'source'>[],
): readonly SourceProductiveMapping[] {
  return sources.flatMap((source) => rows.map((row) => defineMapping({ ...row, source })));
}

const ENERGY_ROWS = [
  { fact: 'ENERGY_PRODUCTION', productive: 'ENERGY', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'ENERGY_CAPACITY', productive: 'ENERGY', claims: ['CAPACITY'], event: 'CAPACITY' },
  { fact: 'ENERGY_CONSUMPTION', productive: 'ENERGY', claims: ['USAGE'], event: 'CONSUMPTION' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const FOOD_ROWS = [
  { fact: 'FOOD_PRODUCTION', productive: 'FOOD_AGRICULTURE', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'AGRICULTURAL_OUTPUT', productive: 'FOOD_AGRICULTURE', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const WATER_ROWS = [
  { fact: 'WATER_PRODUCTION', productive: 'WATER', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'WATER_AVAILABILITY', productive: 'WATER', claims: ['CAPACITY'], event: 'CAPACITY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const MINERAL_ROWS = [
  { fact: 'RESOURCE_EXTRACTION', productive: 'MINERALS_RAW_MATERIALS', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'RESOURCE_RESERVE', productive: 'MINERALS_RAW_MATERIALS', claims: ['RESERVE'], event: 'RESERVE' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const COMPUTE_ROWS = [
  { fact: 'COMPUTE_USAGE', productive: 'COMPUTE', claims: ['USAGE'], event: 'USAGE' },
  { fact: 'COMPUTE_CAPACITY', productive: 'COMPUTE', claims: ['CAPACITY'], event: 'CAPACITY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const AI_COMPUTE_ROWS = [
  { fact: 'AI_INFERENCE_USAGE', productive: 'AI_COMPUTE', claims: ['USAGE'], event: 'USAGE' },
  { fact: 'AI_TRAINING_USAGE', productive: 'AI_COMPUTE', claims: ['USAGE'], event: 'USAGE' },
  { fact: 'AI_COMPUTE_CAPACITY', productive: 'AI_COMPUTE', claims: ['CAPACITY'], event: 'CAPACITY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const MANUFACTURING_ROWS = [
  { fact: 'MANUFACTURING_OUTPUT', productive: 'MANUFACTURING', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'MANUFACTURING_CAPACITY', productive: 'MANUFACTURING', claims: ['CAPACITY'], event: 'CAPACITY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const REAL_ESTATE_ROWS = [
  {
    fact: 'REAL_ESTATE_USE_CAPACITY',
    productive: 'REAL_ESTATE_USE',
    claims: ['CAPACITY'],
    event: 'CAPACITY',
  },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const STORAGE_ROWS = [
  { fact: 'STORAGE_CAPACITY', productive: 'STORAGE', claims: ['CAPACITY'], event: 'CAPACITY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const LOGISTICS_ROWS = [
  { fact: 'LOGISTICS_CAPACITY', productive: 'LOGISTICS_TRANSPORTATION', claims: ['CAPACITY'], event: 'CAPACITY' },
  { fact: 'DELIVERY_COMPLETION', productive: 'LOGISTICS_TRANSPORTATION', claims: ['DELIVERY'], event: 'DELIVERY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const BANDWIDTH_ROWS = [
  { fact: 'BANDWIDTH_CAPACITY', productive: 'BANDWIDTH_COMMUNICATIONS', claims: ['CAPACITY'], event: 'CAPACITY' },
  { fact: 'BANDWIDTH_USAGE', productive: 'BANDWIDTH_COMMUNICATIONS', claims: ['USAGE'], event: 'USAGE' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const INFRASTRUCTURE_ROWS = [
  { fact: 'INFRASTRUCTURE_CAPACITY', productive: 'INFRASTRUCTURE', claims: ['CAPACITY'], event: 'CAPACITY' },
  { fact: 'INFRASTRUCTURE_USAGE', productive: 'INFRASTRUCTURE', claims: ['USAGE'], event: 'USAGE' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const GOODS_ROWS = [
  { fact: 'GOODS_OUTPUT', productive: 'GOODS', claims: ['OUTPUT'], event: 'PRODUCTION_OUTPUT' },
  { fact: 'GOODS_DELIVERY', productive: 'GOODS', claims: ['DELIVERY'], event: 'DELIVERY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const SERVICE_ROWS = [
  { fact: 'SERVICE_DELIVERY', productive: 'SERVICES', claims: ['DELIVERY'], event: 'DELIVERY' },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const AUTOMATED_ROWS = [
  {
    fact: 'AUTOMATED_MACHINE_OUTPUT',
    productive: 'AUTOMATED_MACHINE_OUTPUT',
    claims: ['OUTPUT'],
    event: 'PRODUCTION_OUTPUT',
  },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

const REFERENCE_ROWS = [
  {
    fact: 'REFERENCE_PRICE',
    productive: null,
    claims: [],
    event: 'REFERENCE',
    canClaim: false,
    canContribute: false,
    attribution: false,
    requiresObject: false,
    requiresRights: false,
    requiresPeriod: false,
    requiresGeography: false,
  },
] as const satisfies readonly Omit<MappingDraft, 'source'>[];

export const SOURCE_PRODUCTIVE_MAPPINGS: readonly SourceProductiveMapping[] = Object.freeze([
  ...sourceFamily(['energy'], ENERGY_ROWS),
  ...sourceFamily(['food_agriculture'], FOOD_ROWS),
  ...sourceFamily(['water'], WATER_ROWS),
  ...sourceFamily(['minerals_resources', 'resources'], MINERAL_ROWS),
  ...sourceFamily(['compute'], COMPUTE_ROWS),
  ...sourceFamily(['ai_compute', 'ai_usage'], AI_COMPUTE_ROWS),
  ...sourceFamily(['manufacturing'], MANUFACTURING_ROWS),
  ...sourceFamily(['real_estate_use'], REAL_ESTATE_ROWS),
  ...sourceFamily(['storage'], STORAGE_ROWS),
  ...sourceFamily(['logistics'], LOGISTICS_ROWS),
  ...sourceFamily(['bandwidth'], BANDWIDTH_ROWS),
  ...sourceFamily(['infrastructure'], INFRASTRUCTURE_ROWS),
  ...sourceFamily(['goods'], GOODS_ROWS),
  ...sourceFamily(['services', 'service_delivery'], SERVICE_ROWS),
  ...sourceFamily(['automated_machine_output'], AUTOMATED_ROWS),
  ...sourceFamily(['reference_price'], REFERENCE_ROWS),
]);
