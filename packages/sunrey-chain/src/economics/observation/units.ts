/**
 * Wave 4 — controlled unit normalization for economic observations.
 *
 * Uses exact bigint arithmetic. Rejects dimensional errors such as
 * mixing MW (power) with MWh (energy). No floating point.
 */

import { lookupUnit } from '../../units/convert.ts';
import type { MeasurementDimension } from '../../units/constitution.ts';
import type { EconomicDomain, NormalizationRejectionCode, NormalizedQuantity } from './types.ts';

export const UNIT_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;

/** Canonical unit families per economic domain. */
export const DOMAIN_UNIT_FAMILIES: Readonly<Record<EconomicDomain, readonly string[]>> = Object.freeze({
  ENERGY: Object.freeze(['Wh', 'kWh', 'MWh', 'GWh', 'J']),
  COMPUTE: Object.freeze(['compute_s', 'gpu_s', 'GPU_HOUR', 'CPU_HOUR', 'token_inference']),
  MANUFACTURING: Object.freeze(['units_produced', 'UNIT', 'kg', 'tonne']),
  AGRICULTURE: Object.freeze(['kg', 'tonne', 'bushel', 'hectare']),
  RESOURCES: Object.freeze(['kg', 'tonne', 'oz', 'barrel']),
  LOGISTICS: Object.freeze(['tonne_km', 't_km', 'TEU']),
  BANDWIDTH: Object.freeze(['B_s', 'GB_s', 'GB', 'TB', 'Mbps', 'Gbps']),
  WATER: Object.freeze(['L', 'm3', 'gal']),
  REAL_ESTATE: Object.freeze(['m2', 'm2_hour', 'facility_hour']),
  RESEARCH: Object.freeze(['UNIT', 'citation_count', 'publication_count']),
  WORKFORCE: Object.freeze(['UNIT', 'headcount', 'FTE']),
  HEALTH_PUBLIC: Object.freeze(['UNIT', 'case_count', 'incidence_rate']),
  GEOSPATIAL: Object.freeze(['m2', 'km2', 'coordinate_pair']),
  REFERENCE: Object.freeze(['index_point', 'ratio', 'percent']),
  HUMAN_ECONOMY: Object.freeze(['service_hour', 'UNIT', 'contribution_unit']),
  OTHER: Object.freeze(['unit']),
});

/** Units that must never be mixed across dimensions. */
const POWER_UNITS = new Set(['W', 'kW', 'MW', 'GW']);
const ENERGY_UNITS = new Set(['Wh', 'kWh', 'MWh', 'GWh', 'J']);

export type UnitNormalizationInput = {
  readonly economicDomain: EconomicDomain;
  readonly metric: string;
  readonly value: bigint;
  readonly unit: string;
};

export type UnitNormalizationResult =
  | { readonly ok: true; readonly value: NormalizedQuantity; readonly canonicalUnit: string }
  | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string };

export function normalizeObservationUnit(input: UnitNormalizationInput): UnitNormalizationResult {
  if (typeof input.value !== 'bigint') {
    return { ok: false, code: 'FLOAT_FORBIDDEN', message: 'economic values must be bigint' };
  }
  if (!input.metric || input.metric.trim().length === 0) {
    return { ok: false, code: 'MISSING_METRIC', message: 'metric is required' };
  }
  if (!input.unit || input.unit.trim().length === 0) {
    return { ok: false, code: 'MISSING_UNIT', message: 'unit is required — unlabeled numeric is not economic truth' };
  }

  const unit = input.unit.trim();
  const family = DOMAIN_UNIT_FAMILIES[input.economicDomain];
  if (!family.includes(unit)) {
    return {
      ok: false,
      code: 'UNIT_INCOMPATIBLE',
      message: `unit ${unit} is not in the ${input.economicDomain} family`,
    };
  }

  const catalog = lookupUnit(unit);
  if (!catalog) {
    return { ok: false, code: 'UNIT_UNKNOWN', message: `unit ${unit} is not registered in the canonical catalog` };
  }

  const dimension = catalog.dimension as MeasurementDimension;
  const canonicalValue = (input.value * catalog.scaleNumerator) / catalog.scaleDenominator;

  return {
    ok: true,
    value: Object.freeze({
      mantissa: input.value,
      scale: 0,
      unit,
      dimension,
    }),
    canonicalUnit: catalog.canonicalBaseUnit,
  };
}

export function buildCanonicalQuantity(
  source: NormalizedQuantity,
  canonicalUnit: string,
): NormalizedQuantity | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string } {
  const catalog = lookupUnit(source.unit);
  if (!catalog) {
    return { ok: false, code: 'UNIT_UNKNOWN', message: `unknown unit ${source.unit}` };
  }
  const canonicalValue = (source.mantissa * catalog.scaleNumerator) / catalog.scaleDenominator;
  return Object.freeze({
    mantissa: canonicalValue,
    scale: 0,
    unit: canonicalUnit,
    dimension: source.dimension,
  });
}

export function refuseDimensionalMix(leftUnit: string, rightUnit: string): boolean {
  const leftPower = POWER_UNITS.has(leftUnit);
  const rightPower = POWER_UNITS.has(rightUnit);
  const leftEnergy = ENERGY_UNITS.has(leftUnit);
  const rightEnergy = ENERGY_UNITS.has(rightUnit);
  if ((leftPower && rightEnergy) || (leftEnergy && rightPower)) return true;
  const left = lookupUnit(leftUnit);
  const right = lookupUnit(rightUnit);
  if (!left || !right) return false;
  return left.dimension !== right.dimension;
}

export function canonicalizeQuantity(
  input: UnitNormalizationInput,
): UnitNormalizationResult & { readonly canonicalValue?: NormalizedQuantity } {
  const normalized = normalizeObservationUnit(input);
  if (!normalized.ok) return normalized;

  const canonical = buildCanonicalQuantity(normalized.value, normalized.canonicalUnit);
  if ('ok' in canonical && canonical.ok === false) {
    return canonical;
  }

  return {
    ok: true,
    value: normalized.value,
    canonicalUnit: normalized.canonicalUnit,
    canonicalValue: canonical as NormalizedQuantity,
  };
}
