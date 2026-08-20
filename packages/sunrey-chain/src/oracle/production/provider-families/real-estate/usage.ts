import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { RealEstateRefusal } from './types.ts';

const INTEGER_RE = /^-?\d+$/;

export function parseIntegerMantissa(numericValue: string, code: RealEstateRefusal['code'] = 'FLOAT_QUANTITY_FORBIDDEN'): Result<bigint, RealEstateRefusal> {
  if (numericValue.includes('.') || numericValue.toLowerCase().includes('e')) {
    return err({ code, detail: 'floating-point real-estate quantities are refused' });
  }
  if (!INTEGER_RE.test(numericValue)) {
    return err({ code, detail: 'real-estate quantities must be integer strings' });
  }
  if (numericValue.startsWith('-')) {
    return err({ code: 'FLOAT_QUANTITY_FORBIDDEN', detail: 'negative real-estate quantities are refused' });
  }
  return ok(BigInt(numericValue));
}

export function deriveAreaTime(input: {
  readonly areaMantissa: bigint;
  readonly durationSeconds: bigint;
}): Result<ExactQuantity, RealEstateRefusal> {
  if (input.durationSeconds <= 0n) {
    return err({
      code: 'M2_WITHOUT_DURATION',
      detail: '100 m2 available is not 100 m2-hours used; duration is required',
    });
  }
  const source = exactQuantity({ mantissa: input.areaMantissa, unitId: 'm2' });
  if (!source.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: source.error.detail });
  }
  const receipt = convertExact({
    source: source.value,
    targetUnitId: 'm2_hour',
    context: {
      durationSeconds: input.durationSeconds,
      productiveCategory: 'REAL_ESTATE_USE',
    },
  });
  if (!receipt.ok) {
    return err({
      code: receipt.error.outcome === 'REQUIRE_CONTEXT' ? 'M2_WITHOUT_DURATION' : 'AREA_TIME_DERIVATION_INEXACT',
      detail: receipt.error.detail,
    });
  }
  return ok(receipt.value.targetQuantity);
}

export function refuseM2AsUsageWithoutDuration(): Result<never, RealEstateRefusal> {
  return err({
    code: 'M2_WITHOUT_DURATION',
    detail: 'area without duration cannot become a REAL_ESTATE_USAGE quantity',
  });
}
