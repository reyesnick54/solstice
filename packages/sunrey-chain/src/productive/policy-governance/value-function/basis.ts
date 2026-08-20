/**
 * Governed base-value schedule.
 *
 * This is ECONOMIC POLICY: a versioned conversion from a canonical
 * physical measurement into a preliminary GovernedProductiveValueUnit
 * basis. It is not physical normalization and must never live in
 * packages/sunrey-chain/src/units.
 *
 * All entries are ENGINEERING_SIMULATION_PARAMETERS.
 * Production schedules remain UNCONFIGURED.
 *
 * These ratios are deliberately not 1 Wh = 1 GPUV, 1 liter = 1 GPUV,
 * 1 GPU-second = 1 GPUV, or 1 tonne-km = 1 GPUV.
 */

import { CLAIM_TYPES, PRODUCTIVE_CATEGORIES, type ClaimType, type ProductiveCategory } from '../../types.ts';
import { mulDiv } from '../../formula.ts';
import {
  PRODUCTIVE_VALUE_UNIT_ID,
  VALUE_FUNCTION_PARAMETER_CLASS,
  valueFunctionOk,
  valueFunctionRefuse,
  type ExactRational,
  type ProductiveValueFunctionPolicy,
  type RealizationState,
  type ValueFunctionResult,
} from './types.ts';

export const SIMULATION_BASE_VALUE_SCHEDULE_ID = 'moonrey.productive-base-value.simulation.v1' as const;
export const SIMULATION_BASE_VALUE_SCHEDULE_VERSION = 1 as const;
export const PRODUCTION_BASE_VALUE_SCHEDULE_STATUS = 'UNCONFIGURED' as const;
export const BASE_VALUE_SCHEDULE_PARAMETER_CLASS = VALUE_FUNCTION_PARAMETER_CLASS;

export type ProductiveBaseValueScheduleEntry = {
  readonly entryId: string;
  readonly category: ProductiveCategory;
  readonly canonicalMeasurementUnit: string;
  readonly measurementSemantic: string;
  readonly eligibleClaimTypes: readonly ClaimType[];
  readonly eligibleRealizationStates: readonly RealizationState[];
  readonly baseValueNumerator: bigint;
  readonly baseValueDenominator: bigint;
  readonly outputUnit: typeof PRODUCTIVE_VALUE_UNIT_ID;
  readonly parameterClass: typeof VALUE_FUNCTION_PARAMETER_CLASS;
  readonly notes: string;
};

export type ProductiveBaseValueSchedule = {
  readonly scheduleId: string;
  readonly scheduleVersion: number;
  readonly parameterClass: typeof VALUE_FUNCTION_PARAMETER_CLASS;
  readonly productionConfigured: false;
  readonly entries: readonly ProductiveBaseValueScheduleEntry[];
};

export type ProductionBaseValueSchedule = {
  readonly status: typeof PRODUCTION_BASE_VALUE_SCHEDULE_STATUS;
  readonly productionConfigured: false;
  readonly entries: readonly [];
};

const REALIZED: readonly RealizationState[] = ['ACTUAL_OUTPUT', 'VERIFIED_DELIVERY', 'COMPLETED_ECONOMIC_SERVICE'];
const SERVICE_REALIZED: readonly RealizationState[] = ['COMPLETED_ECONOMIC_SERVICE', 'VERIFIED_DELIVERY'];
const OUTPUT_CLAIMS: readonly ClaimType[] = ['OUTPUT', 'USAGE'];
const OUTPUT_DELIVERY: readonly ClaimType[] = ['OUTPUT', 'USAGE', 'DELIVERY'];

function entry(
  category: ProductiveCategory,
  unit: string,
  semantic: string,
  numerator: bigint,
  denominator: bigint,
  claims: readonly ClaimType[],
  realization: readonly RealizationState[],
  notes: string,
): ProductiveBaseValueScheduleEntry {
  return Object.freeze({
    entryId: `moonrey.base-value.${category}.${unit}.${semantic}.v${SIMULATION_BASE_VALUE_SCHEDULE_VERSION}`,
    category,
    canonicalMeasurementUnit: unit,
    measurementSemantic: semantic,
    eligibleClaimTypes: claims,
    eligibleRealizationStates: realization,
    baseValueNumerator: numerator,
    baseValueDenominator: denominator,
    outputUnit: PRODUCTIVE_VALUE_UNIT_ID,
    parameterClass: VALUE_FUNCTION_PARAMETER_CLASS,
    notes,
  });
}

/**
 * Engineering-simulation schedule. Each ratio is a governed policy
 * choice, not a claim that the physical units are interchangeable.
 */
export const SIMULATION_BASE_VALUE_ENTRIES: readonly ProductiveBaseValueScheduleEntry[] = Object.freeze([
  entry('ENERGY', 'Wh', 'energy_output', 1n, 1_000n, OUTPUT_CLAIMS, REALIZED, '1 000 Wh of verified output → 1 GPUV. Not 1 Wh = 1 GPUV.'),
  entry('AI_COMPUTE', 'gpu_s', 'gpu_time', 1n, 3_600n, OUTPUT_CLAIMS, REALIZED, '3 600 GPU-seconds of verified compute → 1 GPUV. Not 1 GPU-second = 1 GPUV.'),
  entry('MANUFACTURING', 'UNIT', 'units_produced', 2n, 1n, OUTPUT_DELIVERY, REALIZED, '1 verified manufactured unit → 2 GPUV. Governed policy, not a physical identity.'),
  entry('LOGISTICS_TRANSPORTATION', 't_km', 'tonne_km', 1n, 10n, ['DELIVERY', 'OUTPUT', 'USAGE'], ['VERIFIED_DELIVERY', 'COMPLETED_ECONOMIC_SERVICE', 'ACTUAL_OUTPUT'], '10 tonne-km of verified delivery → 1 GPUV. Not 1 tonne-km = 1 GPUV.'),
  entry('WATER', 'L', 'water_output', 1n, 100n, OUTPUT_CLAIMS, REALIZED, '100 L of verified water output → 1 GPUV. Not 1 liter = 1 GPUV.'),
  entry('SERVICES', 'service_hour', 'completed_service', 1n, 2n, ['USAGE', 'OUTPUT'], SERVICE_REALIZED, '2 completed service hours → 1 GPUV. Not occupancy of a capacity basis.'),
  entry('FOOD_AGRICULTURE', 'g', 'harvest_output', 1n, 1_000n, OUTPUT_DELIVERY, REALIZED, '1 000 g harvested → 1 GPUV. Planted area is not output.'),
  entry('MINERALS_RAW_MATERIALS', 'g', 'extracted_output', 1n, 1_000_000n, OUTPUT_CLAIMS, REALIZED, '1 000 000 g extracted → 1 GPUV. Reserve mass is not output.'),
  entry('REAL_ESTATE_USE', 'm2_s', 'occupied_use', 1n, 3_600n, ['USAGE'], ['COMPLETED_ECONOMIC_SERVICE', 'ACTUAL_OUTPUT'], '3 600 m²·s occupied use → 1 GPUV. Installed floor area is not use.'),
  entry('COMPUTE', 'cpu_s', 'cpu_time', 1n, 3_600n, OUTPUT_CLAIMS, REALIZED, '3 600 CPU-seconds → 1 GPUV.'),
  entry('STORAGE', 'L_s', 'occupied_storage', 1n, 3_600n, ['USAGE'], ['ACTUAL_OUTPUT', 'COMPLETED_ECONOMIC_SERVICE'], '3 600 L·s occupied storage → 1 GPUV.'),
  entry('BANDWIDTH_COMMUNICATIONS', 'B', 'transferred_bytes', 1n, 1_000_000_000n, OUTPUT_CLAIMS, REALIZED, '1 000 000 000 B transferred → 1 GPUV.'),
  entry('INFRASTRUCTURE', 'facility_hour', 'facility_service', 1n, 24n, OUTPUT_DELIVERY, REALIZED, '24 facility-hours of verified service → 1 GPUV.'),
  entry('GOODS', 'UNIT', 'goods_identity', 3n, 2n, OUTPUT_DELIVERY, REALIZED, '2 verified goods units → 3 GPUV. Inventory is not goods identity.'),
  entry('AUTOMATED_MACHINE_OUTPUT', 'machine_s', 'machine_output', 1n, 3_600n, OUTPUT_DELIVERY, REALIZED, '3 600 machine-seconds of verified output → 1 GPUV.'),
]);

export function simulationBaseValueSchedule(): ProductiveBaseValueSchedule {
  return Object.freeze({
    scheduleId: SIMULATION_BASE_VALUE_SCHEDULE_ID,
    scheduleVersion: SIMULATION_BASE_VALUE_SCHEDULE_VERSION,
    parameterClass: VALUE_FUNCTION_PARAMETER_CLASS,
    productionConfigured: false,
    entries: SIMULATION_BASE_VALUE_ENTRIES,
  });
}

export function productionBaseValueScheduleUnconfigured(): ProductionBaseValueSchedule {
  return Object.freeze({
    status: PRODUCTION_BASE_VALUE_SCHEDULE_STATUS,
    productionConfigured: false,
    entries: [] as const,
  });
}

export function resolveBaseValueEntry(
  schedule: ProductiveBaseValueSchedule,
  input: {
    readonly category: ProductiveCategory;
    readonly canonicalMeasurementUnit: string;
    readonly measurementSemantic: string;
    readonly claimType: ClaimType;
    readonly realizationState: RealizationState;
  },
): ValueFunctionResult<ProductiveBaseValueScheduleEntry> {
  if (schedule.productionConfigured) {
    return valueFunctionRefuse('PRODUCTION_SCHEDULE_UNCONFIGURED', 'production base-value schedules remain unconfigured');
  }
  const matches = schedule.entries.filter(
    (item) =>
      item.category === input.category &&
      item.canonicalMeasurementUnit === input.canonicalMeasurementUnit &&
      item.measurementSemantic === input.measurementSemantic &&
      item.eligibleClaimTypes.includes(input.claimType) &&
      item.eligibleRealizationStates.includes(input.realizationState),
  );
  if (matches.length === 0) {
    return valueFunctionRefuse(
      'BASE_SCHEDULE_NOT_FOUND',
      `no governed base-value entry for ${input.category}/${input.canonicalMeasurementUnit}/${input.measurementSemantic}`,
    );
  }
  if (matches.length > 1) {
    return valueFunctionRefuse('POLICY_STATE_INVALID', 'base-value schedule entries must be unique for a category/unit/semantic');
  }
  return valueFunctionOk(matches[0]!);
}

export function applyBaseValueSchedule(
  canonicalQuantity: bigint,
  entry: ProductiveBaseValueScheduleEntry,
  rounding: ProductiveValueFunctionPolicy['roundingPolicy'],
): ValueFunctionResult<bigint> {
  if (typeof canonicalQuantity !== 'bigint' || typeof entry.baseValueNumerator !== 'bigint' || typeof entry.baseValueDenominator !== 'bigint') {
    return valueFunctionRefuse('FLOAT_MATH_FORBIDDEN', 'base-value schedule arithmetic must be bigint');
  }
  if (canonicalQuantity < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'canonical measurement quantity cannot be negative');
  }
  if (entry.baseValueDenominator <= 0n) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', 'base-value denominator must be positive');
  }
  if (entry.baseValueNumerator < 0n) {
    return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', 'base-value numerator must be non-negative');
  }
  if (entry.outputUnit !== PRODUCTIVE_VALUE_UNIT_ID) {
    return valueFunctionRefuse('UNSUPPORTED_CATEGORY', 'base-value schedule must output GPUV');
  }
  return valueFunctionOk(mulDiv(canonicalQuantity, entry.baseValueNumerator, entry.baseValueDenominator, rounding));
}

export function baseValueAsRational(entry: ProductiveBaseValueScheduleEntry): ExactRational {
  return Object.freeze({
    numerator: entry.baseValueNumerator,
    denominator: entry.baseValueDenominator,
  });
}

export function everyCategoryHasBaseValueEntry(schedule: ProductiveBaseValueSchedule = simulationBaseValueSchedule()): boolean {
  return PRODUCTIVE_CATEGORIES.every((category) => schedule.entries.some((item) => item.category === category));
}

export function scheduleUsesFakeUniversalPhysicalUnit(schedule: ProductiveBaseValueSchedule = simulationBaseValueSchedule()): boolean {
  return schedule.entries.some(
    (item) => item.baseValueNumerator === 1n && item.baseValueDenominator === 1n && CLAIM_TYPES.includes(item.eligibleClaimTypes[0]!),
  );
}
