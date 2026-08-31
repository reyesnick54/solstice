/**
 * Unit normalization for energy and resource observations.
 *
 * Preserves source value/unit alongside normalized value/unit.
 * Does not silently convert incompatible units.
 */

import type { UnitNormalization } from './types.ts';

export type UnitConversionResult =
  | { readonly ok: true; readonly normalization: UnitNormalization }
  | { readonly ok: false; readonly reason: string };

const ENERGY_TO_MWH: Readonly<Record<string, number>> = Object.freeze({
  Wh: 1e-6,
  kWh: 1e-3,
  MWh: 1,
  GWh: 1e3,
  TWh: 1e6,
});

const POWER_TO_MW: Readonly<Record<string, number>> = Object.freeze({
  W: 1e-6,
  kW: 1e-3,
  MW: 1,
  GW: 1e3,
});

const CARBON_TO_GCO2_PER_KWH: Readonly<Record<string, number>> = Object.freeze({
  'gCO2/kWh': 1,
  'kgCO2/MWh': 1,
  'tCO2/GWh': 1,
});

export function normalizeEnergyUnit(value: number, unit: string): UnitConversionResult {
  const factor = ENERGY_TO_MWH[unit];
  if (factor === undefined) {
    return { ok: false, reason: `incompatible energy unit: ${unit}` };
  }
  return {
    ok: true,
    normalization: Object.freeze({
      sourceValue: value,
      sourceUnit: unit,
      normalizedValue: value * factor,
      normalizedUnit: 'MWh',
      conversionMethod: 'energy_to_mwh',
      conversionVersion: 'sunrey.units.energy.v1',
    }),
  };
}

export function normalizePowerUnit(value: number, unit: string): UnitConversionResult {
  const factor = POWER_TO_MW[unit];
  if (factor === undefined) {
    return { ok: false, reason: `incompatible power unit: ${unit}` };
  }
  return {
    ok: true,
    normalization: Object.freeze({
      sourceValue: value,
      sourceUnit: unit,
      normalizedValue: value * factor,
      normalizedUnit: 'MW',
      conversionMethod: 'power_to_mw',
      conversionVersion: 'sunrey.units.power.v1',
    }),
  };
}

export function normalizeCarbonIntensity(value: number, unit: string): UnitConversionResult {
  const factor = CARBON_TO_GCO2_PER_KWH[unit];
  if (factor === undefined) {
    return { ok: false, reason: `incompatible carbon intensity unit: ${unit}` };
  }
  return {
    ok: true,
    normalization: Object.freeze({
      sourceValue: value,
      sourceUnit: unit,
      normalizedValue: value * factor,
      normalizedUnit: 'gCO2/kWh',
      conversionMethod: 'carbon_intensity_to_gco2_per_kwh',
      conversionVersion: 'sunrey.units.carbon.v1',
    }),
  };
}

export function identityUnitNormalization(value: number, unit: string): UnitNormalization {
  return Object.freeze({
    sourceValue: value,
    sourceUnit: unit,
    normalizedValue: value,
    normalizedUnit: unit,
    conversionMethod: 'identity',
    conversionVersion: 'sunrey.units.identity.v1',
  });
}

export function normalizePriceUnit(
  value: number,
  unit: string,
  currency: string,
): UnitNormalization {
  return Object.freeze({
    sourceValue: value,
    sourceUnit: unit,
    normalizedValue: value,
    normalizedUnit: `${currency}/${unit}`,
    conversionMethod: 'price_identity',
    conversionVersion: 'sunrey.units.price.v1',
  });
}
