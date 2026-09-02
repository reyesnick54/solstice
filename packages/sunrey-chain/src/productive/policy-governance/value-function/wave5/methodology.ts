/**
 * Wave 5 — Cross-domain productive valuation methodology versioning.
 *
 * Domain-specific inputs (energy, compute, manufacturing, water,
 * logistics, agriculture, etc.) flow into a standardized productive-value
 * representation through versioned methodology interfaces. Incomplete
 * production economics remain simulation-only.
 */

import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../../types.ts';
import type { ProductiveValueFunctionPolicy } from '../types.ts';
import { DEVELOPMENT_VALUE_FUNCTION_POLICY_ID } from '../policy.ts';

export const PRODUCTIVE_VALUATION_METHODOLOGY_SCHEMA_VERSION = 'sunrey.productive-valuation-methodology.v1' as const;

export type DomainMethodologyBinding = {
  readonly category: ProductiveCategory;
  readonly measurementSemantic: string;
  readonly canonicalUnitId: string;
  readonly baseValueScheduleEntryId: string;
  readonly requiredReferenceFactTypes: readonly string[];
  readonly simulationOnly: true;
};

export type ProductiveValuationMethodology = {
  readonly methodologyId: string;
  readonly methodologyVersion: number;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly policyContentHash: string;
  readonly schemaVersion: typeof PRODUCTIVE_VALUATION_METHODOLOGY_SCHEMA_VERSION;
  readonly domainBindings: readonly DomainMethodologyBinding[];
  readonly simulationOnly: true;
  readonly productionActivated: false;
};

export type MethodologyReference = {
  readonly methodologyId: string;
  readonly methodologyVersion: number;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly policyContentHash: string;
};

const DOMAIN_SEMANTICS: Record<ProductiveCategory, { semantic: string; unit: string; scheduleEntry: string }> = {
  ENERGY: { semantic: 'energy_output', unit: 'Wh', scheduleEntry: 'energy.wh.v1' },
  AI_COMPUTE: { semantic: 'gpu_time', unit: 'gpu_s', scheduleEntry: 'compute.gpu_s.v1' },
  MANUFACTURING: { semantic: 'units_produced', unit: 'UNIT', scheduleEntry: 'manufacturing.unit.v1' },
  LOGISTICS_TRANSPORTATION: { semantic: 'tonne_km', unit: 't_km', scheduleEntry: 'logistics.t_km.v1' },
  WATER: { semantic: 'water_output', unit: 'L', scheduleEntry: 'water.l.v1' },
  SERVICES: { semantic: 'completed_service', unit: 'service_hour', scheduleEntry: 'services.hour.v1' },
  FOOD_AGRICULTURE: { semantic: 'harvest_output', unit: 'g', scheduleEntry: 'agriculture.g.v1' },
  MINERALS_RAW_MATERIALS: { semantic: 'extracted_output', unit: 'g', scheduleEntry: 'resources.g.v1' },
  REAL_ESTATE_USE: { semantic: 'occupied_use', unit: 'm2_s', scheduleEntry: 'real_estate.m2_s.v1' },
  COMPUTE: { semantic: 'cpu_time', unit: 'cpu_s', scheduleEntry: 'compute.cpu_s.v1' },
  STORAGE: { semantic: 'occupied_storage', unit: 'L_s', scheduleEntry: 'storage.l_s.v1' },
  BANDWIDTH_COMMUNICATIONS: { semantic: 'transferred_bytes', unit: 'B', scheduleEntry: 'bandwidth.b.v1' },
  INFRASTRUCTURE: { semantic: 'facility_service', unit: 'facility_hour', scheduleEntry: 'infrastructure.facility_hour.v1' },
  GOODS: { semantic: 'goods_identity', unit: 'UNIT', scheduleEntry: 'goods.unit.v1' },
  AUTOMATED_MACHINE_OUTPUT: { semantic: 'machine_output', unit: 'machine_s', scheduleEntry: 'machine.machine_s.v1' },
};

export function methodologyFromPolicy(policy: ProductiveValueFunctionPolicy): ProductiveValuationMethodology {
  const domainBindings = PRODUCTIVE_CATEGORIES.map((category): DomainMethodologyBinding => {
    const spec = DOMAIN_SEMANTICS[category];
    const rule = policy.perCategoryRules.find((item) => item.category === category);
    return Object.freeze({
      category,
      measurementSemantic: spec.semantic,
      canonicalUnitId: spec.unit,
      baseValueScheduleEntryId: spec.scheduleEntry,
      requiredReferenceFactTypes: rule?.requiredReferenceFactTypes.map(String) ?? [],
      simulationOnly: true,
    });
  });
  return Object.freeze({
    methodologyId: policy.policyId,
    methodologyVersion: policy.policyVersion,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    policyContentHash: policy.contentHash,
    schemaVersion: PRODUCTIVE_VALUATION_METHODOLOGY_SCHEMA_VERSION,
    domainBindings,
    simulationOnly: true,
    productionActivated: false,
  });
}

export function methodologyReferenceFromPolicy(policy: ProductiveValueFunctionPolicy): MethodologyReference {
  return Object.freeze({
    methodologyId: policy.policyId,
    methodologyVersion: policy.policyVersion,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    policyContentHash: policy.contentHash,
  });
}

export const SIMULATION_METHODOLOGY_ID = DEVELOPMENT_VALUE_FUNCTION_POLICY_ID;

export function domainBindingForCategory(
  methodology: ProductiveValuationMethodology,
  category: ProductiveCategory,
): DomainMethodologyBinding | undefined {
  return methodology.domainBindings.find((item) => item.category === category);
}
