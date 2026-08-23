/**
 * Productized unit / normalization facade over the canonical unit system.
 *
 * Energy uses kWh / MWh. Compute uses an approved compute unit.
 * Incompatible dimensions are refused. No fake universal unit.
 */

import type { ProductiveCategory } from '../types.ts';
import { defaultUnitRegistry } from '../units.ts';
import { lookupUnit } from '../../units/convert.ts';
import type { ProductiveEconomyCategory } from './types.ts';

export const PLATFORM_NORMALIZATION_VERSION = 'sunrey.productive.economy-data.normalize.v1' as const;

export const CATEGORY_UNIT_FAMILIES: Readonly<Record<ProductiveEconomyCategory, readonly string[]>> = Object.freeze({
  ENERGY: Object.freeze(['Wh', 'kWh', 'MWh']),
  COMPUTE: Object.freeze(['compute_s', 'gpu_s', 'GPU_HOUR', 'CPU_HOUR']),
  AI_COMPUTE: Object.freeze(['gpu_s', 'GPU_HOUR', 'token_inference']),
  MANUFACTURING: Object.freeze(['units_produced', 'UNIT', 'kg']),
  RESOURCES: Object.freeze(['kg', 'tonne']),
  AGRICULTURE_FOOD: Object.freeze(['kg', 'tonne']),
  REAL_ESTATE_INFRASTRUCTURE: Object.freeze(['m2', 'm2_hour', 'facility_hour']),
  LOGISTICS: Object.freeze(['tonne_km', 't_km']),
  TRANSPORTATION: Object.freeze(['tonne_km', 't_km']),
  BANDWIDTH: Object.freeze(['GB', 'TB', 'B_s', 'GB_s']),
  WATER: Object.freeze(['L', 'm3']),
  OTHER_GOVERNANCE_APPROVED: Object.freeze(['service_hour', 'units_produced']),
});

export type NormalizedEconomyQuantity = {
  readonly category: ProductiveEconomyCategory;
  readonly sourceUnit: string;
  readonly canonicalUnit: string;
  readonly sourceValue: bigint;
  readonly canonicalValue: bigint;
  readonly dimensionCompatible: true;
};

export type NormalizationRefusal = {
  readonly ok: false;
  readonly code: 'UNIT_INCOMPATIBLE' | 'UNIT_UNKNOWN' | 'FLOAT_FORBIDDEN';
  readonly message: string;
};

export function normalizeEconomyQuantity(input: {
  readonly category: ProductiveEconomyCategory;
  readonly unit: string;
  readonly value: bigint;
}): { readonly ok: true; readonly value: NormalizedEconomyQuantity } | NormalizationRefusal {
  if (typeof input.value !== 'bigint') {
    return { ok: false, code: 'FLOAT_FORBIDDEN', message: 'economic values must be bigint integer units' };
  }
  const family = CATEGORY_UNIT_FAMILIES[input.category];
  if (!family.includes(input.unit)) {
    return {
      ok: false,
      code: 'UNIT_INCOMPATIBLE',
      message: `unit ${input.unit} is not in the ${input.category} family`,
    };
  }
  const productiveCategory = mapCategory(input.category);
  const productiveUnit = aliasToProductiveUnit(input.unit);
  const productive = defaultUnitRegistry.normalize(productiveCategory, productiveUnit, input.value);
  if (productive) {
    return {
      ok: true,
      value: Object.freeze({
        category: input.category,
        sourceUnit: input.unit,
        canonicalUnit: productive.baseUnitId,
        sourceValue: input.value,
        canonicalValue: productive.normalizedQuantity,
        dimensionCompatible: true,
      }),
    };
  }
  const catalog = lookupUnit(input.unit);
  if (!catalog) {
    return { ok: false, code: 'UNIT_UNKNOWN', message: `unit ${input.unit} is not registered` };
  }
  const canonicalValue = (input.value * catalog.scaleNumerator) / catalog.scaleDenominator;
  return {
    ok: true,
    value: Object.freeze({
      category: input.category,
      sourceUnit: input.unit,
      canonicalUnit: catalog.canonicalBaseUnit,
      sourceValue: input.value,
      canonicalValue,
      dimensionCompatible: true,
    }),
  };
}

export function refuseIncompatibleMix(left: ProductiveEconomyCategory, right: ProductiveEconomyCategory): boolean {
  if (left === right) return false;
  const rightFamily = CATEGORY_UNIT_FAMILIES[right];
  return !CATEGORY_UNIT_FAMILIES[left].some((unit) => rightFamily.includes(unit));
}

function mapCategory(category: ProductiveEconomyCategory): ProductiveCategory {
  switch (category) {
    case 'RESOURCES':
      return 'MINERALS_RAW_MATERIALS';
    case 'AGRICULTURE_FOOD':
      return 'FOOD_AGRICULTURE';
    case 'REAL_ESTATE_INFRASTRUCTURE':
      return 'INFRASTRUCTURE';
    case 'LOGISTICS':
    case 'TRANSPORTATION':
      return 'LOGISTICS_TRANSPORTATION';
    case 'BANDWIDTH':
      return 'BANDWIDTH_COMMUNICATIONS';
    case 'OTHER_GOVERNANCE_APPROVED':
      return 'SERVICES';
    default:
      return category;
  }
}

function aliasToProductiveUnit(unit: string): string {
  if (unit === 'tonne_km') return 't_km';
  if (unit === 'units_produced') return 'UNIT';
  if (unit === 'compute_s' || unit === 'gpu_s') return 'GPU_HOUR';
  if (unit === 'token_inference') return 'TOKEN';
  return unit;
}
