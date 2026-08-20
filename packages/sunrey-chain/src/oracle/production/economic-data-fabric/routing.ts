/**
 * Multi-family routing. Each accepted source maps to exactly one family.
 * Providers cannot self-label an arbitrary productive category.
 */

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { FactType } from '../../types.ts';
import type { ProductiveCategory } from '../../../productive/types.ts';
import {
  isDataSourceCategory,
  resolveSourceCategory,
  type DataSourceCategory,
} from '../../../productive/source-taxonomy/types.ts';
import { activeMappings } from '../../source-taxonomy/registry.ts';
import { CANONICAL_FAMILY_REGISTRY, familySupportsSource } from './registry.ts';
import {
  fabricRejection,
  isProviderFamilyId,
  type CollectionCandidate,
  type EconomicDataProviderFamilyRecord,
  type FabricRejection,
  type ProviderFamilyId,
} from './types.ts';

const SOURCE_CATEGORY_FAMILY: Readonly<Record<DataSourceCategory, ProviderFamilyId>> = Object.freeze({
  energy: 'ENERGY',
  food_agriculture: 'AGRICULTURE_FOOD',
  water: 'WATER',
  compute: 'COMPUTE',
  ai_usage: 'AI_COMPUTE',
  manufacturing: 'MANUFACTURING',
  real_estate_use: 'REAL_ESTATE',
  storage: 'STORAGE',
  logistics: 'LOGISTICS',
  bandwidth: 'BANDWIDTH',
  resources: 'MINERALS_RESOURCES',
  service_delivery: 'SERVICES',
  reference_price: 'REFERENCE_DATA',
  minerals_resources: 'MINERALS_RESOURCES',
  ai_compute: 'AI_COMPUTE',
  infrastructure: 'INFRASTRUCTURE',
  goods: 'GOODS',
  services: 'SERVICES',
  automated_machine_output: 'AUTOMATED_MACHINE_OUTPUT',
});

const FACT_TYPE_FAMILY: Readonly<Partial<Record<FactType, ProviderFamilyId>>> = Object.freeze({
  ENERGY_PRODUCTION: 'ENERGY',
  ENERGY_CAPACITY: 'ENERGY',
  ENERGY_CONSUMPTION: 'ENERGY',
  FOOD_PRODUCTION: 'AGRICULTURE_FOOD',
  AGRICULTURAL_OUTPUT: 'AGRICULTURE_FOOD',
  WATER_PRODUCTION: 'WATER',
  WATER_AVAILABILITY: 'WATER',
  COMPUTE_CAPACITY: 'COMPUTE',
  COMPUTE_USAGE: 'COMPUTE',
  AI_INFERENCE_USAGE: 'AI_COMPUTE',
  AI_COMPUTE_CAPACITY: 'AI_COMPUTE',
  AI_TRAINING_USAGE: 'AI_COMPUTE',
  MANUFACTURING_CAPACITY: 'MANUFACTURING',
  MANUFACTURING_OUTPUT: 'MANUFACTURING',
  REAL_ESTATE_USE_CAPACITY: 'REAL_ESTATE',
  REAL_ESTATE_USAGE: 'REAL_ESTATE',
  STORAGE_CAPACITY: 'STORAGE',
  LOGISTICS_CAPACITY: 'LOGISTICS',
  DELIVERY_COMPLETION: 'LOGISTICS',
  BANDWIDTH_CAPACITY: 'BANDWIDTH',
  BANDWIDTH_USAGE: 'BANDWIDTH',
  RESOURCE_RESERVE: 'MINERALS_RESOURCES',
  RESOURCE_EXTRACTION: 'MINERALS_RESOURCES',
  SERVICE_DELIVERY: 'SERVICES',
  INFRASTRUCTURE_CAPACITY: 'INFRASTRUCTURE',
  INFRASTRUCTURE_USAGE: 'INFRASTRUCTURE',
  GOODS_OUTPUT: 'GOODS',
  GOODS_DELIVERY: 'GOODS',
  AUTOMATED_MACHINE_OUTPUT: 'AUTOMATED_MACHINE_OUTPUT',
  REFERENCE_PRICE: 'REFERENCE_DATA',
});

export function familyForSourceCategory(sourceCategory: DataSourceCategory): ProviderFamilyId {
  return SOURCE_CATEGORY_FAMILY[sourceCategory];
}

export function familyForFactType(factType: FactType): ProviderFamilyId | undefined {
  return FACT_TYPE_FAMILY[factType];
}

export function routeCollection(
  input: Pick<CollectionCandidate, 'sourceCategory' | 'factType' | 'claimedFamilyId' | 'claimedProductiveCategory'>,
): Result<{ readonly family: EconomicDataProviderFamilyRecord; readonly productiveCategory: ProductiveCategory | null }, FabricRejection> {
  if (!isDataSourceCategory(input.sourceCategory)) {
    return err(fabricRejection('INVALID_FAMILY_ROUTING', `unknown source category ${input.sourceCategory}`));
  }
  const byFact = familyForFactType(input.factType);
  if (!byFact) {
    return err(fabricRejection('INVALID_FAMILY_ROUTING', `fact type ${input.factType} has no deliberate family route`));
  }
  const bySource = familyForSourceCategory(input.sourceCategory);
  const familyId = input.factType === 'REFERENCE_PRICE' ? 'REFERENCE_DATA' : bySource;
  if (input.factType !== 'REFERENCE_PRICE' && byFact !== bySource) {
    return err(
      fabricRejection(
        'AMBIGUOUS_FAMILY_ROUTING',
        `${input.sourceCategory}/${input.factType} routes to both ${bySource} and ${byFact}`,
      ),
    );
  }
  if (input.claimedFamilyId && input.claimedFamilyId !== familyId) {
    return err(
      fabricRejection(
        'INVALID_FAMILY_ROUTING',
        `claimed family ${input.claimedFamilyId} does not match routed family ${familyId}`,
      ),
    );
  }
  const family = CANONICAL_FAMILY_REGISTRY.get(familyId);
  if (!family || !isProviderFamilyId(familyId)) {
    return err(fabricRejection('FAMILY_NOT_REGISTERED', `routed family ${familyId} is not registered`));
  }
  if (input.factType !== 'REFERENCE_PRICE' && !familySupportsSource(family, input.sourceCategory, input.factType)) {
    return err(
      fabricRejection(
        'INVALID_FAMILY_ROUTING',
        `family ${familyId} does not accept ${input.sourceCategory}/${input.factType}`,
      ),
    );
  }
  const mapping = activeMappings().find(
    (row) => row.sourceCategory === input.sourceCategory && row.factType === input.factType,
  );
  const productiveCategory = mapping?.productiveCategory ?? null;
  if (input.claimedProductiveCategory !== undefined && input.claimedProductiveCategory !== productiveCategory) {
    return err(
      fabricRejection(
        'SELF_LABELED_PRODUCTIVE_CATEGORY',
        `provider claimed ${input.claimedProductiveCategory} but taxonomy maps to ${productiveCategory ?? 'null'}`,
      ),
    );
  }
  if (familyId === 'REFERENCE_DATA') {
    return ok({ family, productiveCategory: null });
  }
  return ok({ family, productiveCategory });
}

export function everyActiveSourceCategoryHasRoute(): boolean {
  return (Object.keys(SOURCE_CATEGORY_FAMILY) as DataSourceCategory[]).every((category) => {
    const resolved = resolveSourceCategory(category);
    return familyForSourceCategory(resolved.input) !== undefined;
  });
}

export function everyProductiveFactTypeHasRoute(): boolean {
  return Object.keys(FACT_TYPE_FAMILY).length > 0;
}
