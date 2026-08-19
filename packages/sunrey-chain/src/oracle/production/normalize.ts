import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { quantity } from '../units.ts';
import { measureSourceObservation } from '../../units/pipeline.ts';
import type { CanonicalProductiveMeasurement } from '../../units/measurement.ts';
import type { FactType } from '../types.ts';
import type { ProductiveCategory } from '../../productive/types.ts';
import type { FixedQuantity, ProductionOracleRejection, UnitCode } from './types.ts';
import { NORMALIZATION_VERSION } from './types.ts';

export type NormalizationVector = {
  readonly version: typeof NORMALIZATION_VERSION;
  readonly sourceValue: string;
  readonly sourceUnit: UnitCode;
  readonly targetUnit: UnitCode;
  readonly targetScale: number;
  readonly canonicalMantissa: bigint;
};

const ENERGY_TO_WH: Readonly<Record<string, bigint>> = Object.freeze({
  Wh: 1n,
  kWh: 1_000n,
  MWh: 1_000_000n,
});

export function normalizeExternalInteger(input: {
  readonly sourceValue: string;
  readonly sourceUnit: UnitCode;
  readonly targetUnit: UnitCode;
  readonly targetScale: number;
}): Result<FixedQuantity, ProductionOracleRejection> {
  if (input.sourceValue.includes('.') || /e/i.test(input.sourceValue)) {
    return err({ code: 'FLOAT_FORBIDDEN', detail: 'normalization refuses floating-point input' });
  }
  let mantissa: bigint;
  try {
    mantissa = BigInt(input.sourceValue);
  } catch {
    return err({ code: 'WRONG_NUMERIC_REPRESENTATION', detail: input.sourceValue });
  }
  if (mantissa < 0n) {
    return err({ code: 'WRONG_NUMERIC_REPRESENTATION', detail: 'negative quantities are refused' });
  }
  if (input.sourceUnit === input.targetUnit) {
    const scaled = mantissa * 10n ** BigInt(input.targetScale);
    const built = quantity(scaled, input.targetScale, input.targetUnit);
    if (!built.ok) {
      return err({ code: 'NORMALIZATION_FAILED', detail: built.error.detail });
    }
    return ok(built.value);
  }
  const from = ENERGY_TO_WH[input.sourceUnit];
  const to = ENERGY_TO_WH[input.targetUnit];
  if (from === undefined || to === undefined) {
    return err({
      code: 'NORMALIZATION_FAILED',
      detail: `no versioned transform from ${input.sourceUnit} to ${input.targetUnit}`,
    });
  }
  const base = mantissa * from;
  if (base % to !== 0n) {
    return err({
      code: 'NORMALIZATION_FAILED',
      detail: 'lossy unit conversion is refused; use an explicit new feed version',
    });
  }
  const converted = (base / to) * 10n ** BigInt(input.targetScale);
  const built = quantity(converted, input.targetScale, input.targetUnit);
  if (!built.ok) {
    return err({ code: 'NORMALIZATION_FAILED', detail: built.error.detail });
  }
  return ok(built.value);
}

export function normalizeAgainstCanonicalCatalog(input: {
  readonly sourceValue: string;
  readonly sourceUnit: UnitCode;
  readonly productiveCategory: ProductiveCategory;
  readonly factType: FactType;
  readonly measurementStart?: bigint;
  readonly measurementEnd?: bigint;
  readonly durationSeconds?: bigint;
}): Result<
  { readonly source: FixedQuantity; readonly measurement: CanonicalProductiveMeasurement },
  ProductionOracleRejection
> {
  if (input.sourceValue.includes('.') || /e/i.test(input.sourceValue)) {
    return err({ code: 'FLOAT_FORBIDDEN', detail: 'normalization refuses floating-point input' });
  }
  let mantissa: bigint;
  try {
    mantissa = BigInt(input.sourceValue);
  } catch {
    return err({ code: 'WRONG_NUMERIC_REPRESENTATION', detail: input.sourceValue });
  }
  const built = quantity(mantissa, 0, input.sourceUnit);
  if (!built.ok) {
    return err({ code: 'NORMALIZATION_FAILED', detail: built.error.detail });
  }
  const measured = measureSourceObservation({
    sourceUnit: input.sourceUnit,
    sourceMantissa: mantissa,
    sourceScale: 0,
    productiveCategory: input.productiveCategory,
    factType: input.factType,
    measurementStart: input.measurementStart,
    measurementEnd: input.measurementEnd,
    durationSeconds: input.durationSeconds,
  });
  if (!measured.ok) {
    return err({ code: 'NORMALIZATION_FAILED', detail: `${measured.error.code}: ${measured.error.detail}` });
  }
  return ok({ source: built.value, measurement: measured.value });
}

export function normalizationVector(input: {
  readonly sourceValue: string;
  readonly sourceUnit: UnitCode;
  readonly targetUnit: UnitCode;
  readonly targetScale: number;
  readonly canonical: FixedQuantity;
}): NormalizationVector {
  return Object.freeze({
    version: NORMALIZATION_VERSION,
    sourceValue: input.sourceValue,
    sourceUnit: input.sourceUnit,
    targetUnit: input.targetUnit,
    targetScale: input.targetScale,
    canonicalMantissa: input.canonical.mantissa,
  });
}
