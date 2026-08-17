import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { quantity, type FixedQuantity } from '../units.ts';
import type { UnitCode } from '../types.ts';
import type { ProductionOracleRejection } from './types.ts';
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
    return quantity(scaled, input.targetScale, input.targetUnit).ok
      ? quantity(scaled, input.targetScale, input.targetUnit)
      : err({ code: 'NORMALIZATION_FAILED', detail: 'quantity construction failed' });
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
