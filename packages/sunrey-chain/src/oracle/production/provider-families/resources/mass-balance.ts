import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity, integerMantissaOf, scaleByRational } from '../../../../units/quantity.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import {
  type GovernedDensityEvidence,
  type NormalizedResourceObservation,
  type ResourceMeasurementSemantics,
  type ResourceRefusal,
} from './types.ts';

const GRAMS_PER_KG = 1_000n;
const GRAMS_PER_TONNE = 1_000_000n;
const LITERS_PER_M3 = 1_000n;

/**
 * Canonical mass path: kg and tonne through exact unit normalization.
 * Volume is never treated as mass without governed density evidence.
 */
export function normalizeMassQuantity(input: {
  readonly mantissa: bigint;
  readonly unit: string;
  readonly density: GovernedDensityEvidence | null;
  readonly targetUnit?: 'kg' | 'tonne';
}): Result<{ readonly source: ExactQuantity; readonly canonical: ExactQuantity; readonly unit: 'kg' | 'tonne' }, ResourceRefusal> {
  const target = input.targetUnit ?? (input.unit === 'kg' ? 'kg' : 'tonne');
  if (input.unit === 'm3' || input.unit === 'L') {
    return convertVolumeToMass(input.mantissa, input.unit, input.density, target);
  }
  if (input.unit !== 'kg' && input.unit !== 'tonne' && input.unit !== 'g') {
    return err({
      code: 'INCOMPATIBLE_UNIT',
      detail: `resource mass facts accept kg/tonne (and governed volume); received ${input.unit}`,
    });
  }
  const source = exactQuantity({ mantissa: input.mantissa, unitId: input.unit });
  if (!source.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: source.error.detail });
  }
  const converted = convertExact({
    source: source.value,
    targetUnitId: target,
    context: { factType: 'RESOURCE_EXTRACTION', productiveCategory: 'MINERALS_RAW_MATERIALS' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!converted.ok) {
    return err({
      code: input.unit === 'kg' || input.unit === 'tonne' ? 'KG_TONNE_MISMATCH' : 'INCOMPATIBLE_UNIT',
      detail: converted.error.detail,
    });
  }
  return ok(
    Object.freeze({
      source: source.value,
      canonical: converted.value.targetQuantity,
      unit: target,
    }),
  );
}

export function convertVolumeToMass(
  mantissa: bigint,
  unit: string,
  density: GovernedDensityEvidence | null,
  targetUnit: 'kg' | 'tonne',
): Result<{ readonly source: ExactQuantity; readonly canonical: ExactQuantity; readonly unit: 'kg' | 'tonne' }, ResourceRefusal> {
  if (density === null || density.densityKgPerM3 <= 0n) {
    return err({
      code: 'VOLUME_WITHOUT_DENSITY',
      detail: 'cubic volume cannot become mass without governed density evidence',
    });
  }
  const volume = exactQuantity({ mantissa, unitId: unit });
  if (!volume.ok) {
    return err({ code: 'DENSITY_EVIDENCE_INVALID', detail: volume.error.detail });
  }
  const volumeLiters =
    unit === 'm3'
      ? scaleByRational(volume.value, LITERS_PER_M3, 1n, 'L')
      : exactQuantity({ mantissa, unitId: 'L' });
  if (!volumeLiters.ok) {
    return err({ code: 'DENSITY_EVIDENCE_INVALID', detail: volumeLiters.error.detail });
  }
  const massGrams = scaleByRational(volumeLiters.value, density.densityKgPerM3, 1n, 'g');
  if (!massGrams.ok) {
    return err({ code: 'DENSITY_EVIDENCE_INVALID', detail: massGrams.error.detail });
  }
  const toTarget = convertExact({
    source: massGrams.value,
    targetUnitId: targetUnit,
    context: { factType: 'RESOURCE_EXTRACTION', productiveCategory: 'MINERALS_RAW_MATERIALS' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!toTarget.ok) {
    return err({ code: 'DENSITY_EVIDENCE_INVALID', detail: toTarget.error.detail });
  }
  return ok(
    Object.freeze({
      source: volume.value,
      canonical: toTarget.value.targetQuantity,
      unit: targetUnit,
    }),
  );
}

export function quantityToGrams(quantity: ExactQuantity): Result<bigint, ResourceRefusal> {
  const grams = convertExact({
    source: quantity,
    targetUnitId: 'g',
    context: { factType: 'RESOURCE_EXTRACTION', productiveCategory: 'MINERALS_RAW_MATERIALS' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!grams.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: grams.error.detail });
  }
  const mantissa = integerMantissaOf(grams.value.targetQuantity);
  if (!mantissa.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: mantissa.error.detail });
  }
  return ok(mantissa.value);
}

/**
 * 1,000 tonnes ore extracted → processing → 100 tonnes concentrate
 * is not 1,100 tonnes of the same resource output.
 */
export function refuseBlindMassSum(
  left: NormalizedResourceObservation,
  right: NormalizedResourceObservation,
): Result<true, ResourceRefusal> {
  const pair = new Set<ResourceMeasurementSemantics>([left.measurementSemantics, right.measurementSemantics]);
  if (pair.has('PROCESSED_CONCENTRATE') && (pair.has('GROSS_EXTRACTED_MASS') || pair.has('NET_SALEABLE_MASS'))) {
    return err({
      code: 'ORE_CONCENTRATE_CANNOT_BE_SUMMED',
      detail: 'extracted ore mass and processed concentrate mass are distinct lineage stages',
    });
  }
  if (left.measurementSemantics !== right.measurementSemantics) {
    return err({
      code: 'MEASUREMENT_SEMANTICS_MISMATCH',
      detail: `cannot silently substitute ${left.measurementSemantics} for ${right.measurementSemantics}`,
    });
  }
  return ok(true);
}

export function gramsPerKilogram(): bigint {
  return GRAMS_PER_KG;
}

export function gramsPerTonne(): bigint {
  return GRAMS_PER_TONNE;
}
