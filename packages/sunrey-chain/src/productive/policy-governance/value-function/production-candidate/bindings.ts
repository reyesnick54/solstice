/**
 * Canonical unit / semantic bindings for production-candidate GPUV
 * schedules. Physical normalization remains in packages/sunrey-chain/src/units.
 *
 * These bindings answer which measurement a future schedule may attach to.
 * They do not invent GPUV values.
 */

import type { ProductiveCategory } from '../../../types.ts';
import { EXCLUSIVE_ATTRIBUTION_GROUPS } from './types.ts';

export type CategoryUnitBinding = {
  readonly category: ProductiveCategory;
  readonly canonicalUnit: string;
  readonly semanticQualifier: string;
  readonly dimension: string;
  readonly acceptedUnitAliases: readonly string[];
};

export const CATEGORY_UNIT_BINDINGS: Readonly<Record<ProductiveCategory, CategoryUnitBinding>> = Object.freeze({
  ENERGY: Object.freeze({
    category: 'ENERGY',
    canonicalUnit: 'Wh',
    semanticQualifier: 'energy_output',
    dimension: 'ENERGY',
    acceptedUnitAliases: Object.freeze(['Wh', 'kWh']),
  }),
  FOOD_AGRICULTURE: Object.freeze({
    category: 'FOOD_AGRICULTURE',
    canonicalUnit: 'g',
    semanticQualifier: 'harvest_output',
    dimension: 'MASS',
    acceptedUnitAliases: Object.freeze(['g', 'kg']),
  }),
  WATER: Object.freeze({
    category: 'WATER',
    canonicalUnit: 'L',
    semanticQualifier: 'water_output',
    dimension: 'VOLUME',
    acceptedUnitAliases: Object.freeze(['L', 'm3']),
  }),
  MINERALS_RAW_MATERIALS: Object.freeze({
    category: 'MINERALS_RAW_MATERIALS',
    canonicalUnit: 'g',
    semanticQualifier: 'extracted_output',
    dimension: 'MASS',
    acceptedUnitAliases: Object.freeze(['g', 'kg', 't']),
  }),
  REAL_ESTATE_USE: Object.freeze({
    category: 'REAL_ESTATE_USE',
    canonicalUnit: 'm2_s',
    semanticQualifier: 'occupied_use',
    dimension: 'AREA_TIME',
    acceptedUnitAliases: Object.freeze(['m2_s', 'm2_hour']),
  }),
  COMPUTE: Object.freeze({
    category: 'COMPUTE',
    canonicalUnit: 'cpu_s',
    semanticQualifier: 'cpu_time',
    dimension: 'CPU_TIME',
    acceptedUnitAliases: Object.freeze(['cpu_s', 'CPU_HOUR']),
  }),
  AI_COMPUTE: Object.freeze({
    category: 'AI_COMPUTE',
    canonicalUnit: 'gpu_s',
    semanticQualifier: 'gpu_time',
    dimension: 'GPU_TIME',
    acceptedUnitAliases: Object.freeze(['gpu_s', 'GPU_HOUR']),
  }),
  MANUFACTURING: Object.freeze({
    category: 'MANUFACTURING',
    canonicalUnit: 'UNIT',
    semanticQualifier: 'units_produced',
    dimension: 'ITEM_COUNT',
    acceptedUnitAliases: Object.freeze(['UNIT', 'units_produced']),
  }),
  LOGISTICS_TRANSPORTATION: Object.freeze({
    category: 'LOGISTICS_TRANSPORTATION',
    canonicalUnit: 't_km',
    semanticQualifier: 'tonne_km',
    dimension: 'MASS_DISTANCE',
    acceptedUnitAliases: Object.freeze(['t_km', 'tonne_km']),
  }),
  STORAGE: Object.freeze({
    category: 'STORAGE',
    canonicalUnit: 'L_s',
    semanticQualifier: 'occupied_storage',
    dimension: 'VOLUME_TIME',
    acceptedUnitAliases: Object.freeze(['L_s', 'm3_s']),
  }),
  BANDWIDTH_COMMUNICATIONS: Object.freeze({
    category: 'BANDWIDTH_COMMUNICATIONS',
    canonicalUnit: 'B',
    semanticQualifier: 'transferred_bytes',
    dimension: 'DATA_VOLUME',
    acceptedUnitAliases: Object.freeze(['B', 'MB', 'GB', 'TB']),
  }),
  INFRASTRUCTURE: Object.freeze({
    category: 'INFRASTRUCTURE',
    canonicalUnit: 'facility_hour',
    semanticQualifier: 'facility_service',
    dimension: 'FACILITY_TIME',
    acceptedUnitAliases: Object.freeze(['facility_hour']),
  }),
  GOODS: Object.freeze({
    category: 'GOODS',
    canonicalUnit: 'UNIT',
    semanticQualifier: 'goods_identity',
    dimension: 'ITEM_COUNT',
    acceptedUnitAliases: Object.freeze(['UNIT', 'units_produced']),
  }),
  SERVICES: Object.freeze({
    category: 'SERVICES',
    canonicalUnit: 'service_hour',
    semanticQualifier: 'completed_service',
    dimension: 'SERVICE_TIME',
    acceptedUnitAliases: Object.freeze(['service_hour']),
  }),
  AUTOMATED_MACHINE_OUTPUT: Object.freeze({
    category: 'AUTOMATED_MACHINE_OUTPUT',
    canonicalUnit: 'machine_s',
    semanticQualifier: 'machine_output',
    dimension: 'MACHINE_TIME',
    acceptedUnitAliases: Object.freeze(['machine_s']),
  }),
});

export function categoryUnitBinding(category: ProductiveCategory): CategoryUnitBinding {
  return CATEGORY_UNIT_BINDINGS[category];
}

export function unitCompatibleWithCategory(category: ProductiveCategory, unit: string): boolean {
  return CATEGORY_UNIT_BINDINGS[category].acceptedUnitAliases.includes(unit);
}

export function semanticMatchesCategory(category: ProductiveCategory, semantic: string): boolean {
  return CATEGORY_UNIT_BINDINGS[category].semanticQualifier === semantic;
}

export function exclusiveGroupsFor(category: ProductiveCategory): readonly (readonly ProductiveCategory[])[] {
  return EXCLUSIVE_ATTRIBUTION_GROUPS.filter((group) => group.includes(category));
}

export function exclusivePartnerCategories(category: ProductiveCategory): readonly ProductiveCategory[] {
  const partners = new Set<ProductiveCategory>();
  for (const group of exclusiveGroupsFor(category)) {
    for (const member of group) {
      if (member !== category) {
        partners.add(member);
      }
    }
  }
  return Object.freeze([...partners]);
}
