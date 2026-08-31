/**
 * Nutrition serving basis normalization.
 * Preserves source basis; never silently mixes per-serving with per-100g values.
 */

import type { NutritionUnit, NutritionValue, ServingBasis } from './types.ts';

export type BasisConversionResult =
  | { readonly ok: true; readonly normalized: NutritionValue }
  | { readonly ok: false; readonly reason: string };

const VALID_UNITS = new Set<NutritionUnit>(['kcal', 'g', 'mg', 'mcg', 'iu']);

export function isValidNutritionUnit(unit: string): unit is NutritionUnit {
  return VALID_UNITS.has(unit as NutritionUnit);
}

/** Convert per-100g to per-serving when serving size in grams is known. */
export function normalizeToServing(
  nutrient: string,
  value: number,
  unit: NutritionUnit,
  sourceBasis: ServingBasis,
  servingSizeGrams: number,
): BasisConversionResult {
  if (sourceBasis === 'per_serving') {
    return {
      ok: true,
      normalized: Object.freeze({
        nutrient,
        value,
        unit,
        basis: 'per_serving',
        sourceValue: value,
        sourceBasis,
      }),
    };
  }

  if (sourceBasis === 'per_100g' && servingSizeGrams > 0) {
    const factor = servingSizeGrams / 100;
    const normalizedValue = value * factor;
    return {
      ok: true,
      normalized: Object.freeze({
        nutrient,
        value: normalizedValue,
        unit,
        basis: 'per_serving',
        sourceValue: value,
        sourceBasis,
        normalizedValue,
        normalizedBasis: 'per_serving',
        conversionMethod: `per_100g * (${servingSizeGrams}g / 100)`,
      }),
    };
  }

  return {
    ok: false,
    reason: `cannot convert ${sourceBasis} to per_serving without compatible serving size`,
  };
}

/** Reject incompatible basis comparison. */
export function assertCompatibleBasis(a: ServingBasis, b: ServingBasis): boolean {
  return a === b;
}

export function identityNutritionValue(
  nutrient: string,
  value: number,
  unit: NutritionUnit,
  basis: ServingBasis,
): NutritionValue {
  return Object.freeze({
    nutrient,
    value,
    unit,
    basis,
    sourceValue: value,
    sourceBasis: basis,
  });
}
