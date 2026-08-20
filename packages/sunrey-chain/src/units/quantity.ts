import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { ExactQuantity, NormalizationRefusal } from './types.ts';

export const MAX_QUANTITY_SCALE = 18;

export function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

export function reduceRational(numerator: bigint, denominator: bigint): { numerator: bigint; denominator: bigint } {
  if (denominator === 0n) {
    throw new Error('denominator must be non-zero');
  }
  let num = numerator;
  let den = denominator;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const divisor = gcd(num, den);
  return { numerator: num / divisor, denominator: den / divisor };
}

export function pow10(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_QUANTITY_SCALE) {
    throw new Error('quantity scale must be an integer 0..18');
  }
  return 10n ** BigInt(scale);
}

export function quantityRational(quantity: ExactQuantity): { numerator: bigint; denominator: bigint } {
  return reduceRational(quantity.mantissa * quantity.numerator, pow10(quantity.scale) * quantity.denominator);
}

export function exactQuantity(input: {
  readonly mantissa: bigint;
  readonly unitId: string;
  readonly scale?: number | undefined;
  readonly numerator?: bigint | undefined;
  readonly denominator?: bigint | undefined;
}): Result<ExactQuantity, NormalizationRefusal> {
  const scale = input.scale ?? 0;
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_QUANTITY_SCALE) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: 'quantity scale must be an integer 0..18',
    });
  }
  const numerator = input.numerator ?? 1n;
  const denominator = input.denominator ?? 1n;
  if (denominator === 0n) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: 'quantity denominator must be non-zero',
    });
  }
  if (input.mantissa < 0n || numerator < 0n) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: 'negative economic quantities are refused',
    });
  }
  return ok(canonicalizeQuantity({
    mantissa: input.mantissa,
    scale,
    numerator,
    denominator,
    unitId: input.unitId,
  }));
}

export function integerQuantity(unitId: string, mantissa: bigint): Result<ExactQuantity, NormalizationRefusal> {
  return exactQuantity({ mantissa, unitId });
}

export function canonicalizeQuantity(quantity: ExactQuantity): ExactQuantity {
  const combined = reduceRational(
    quantity.mantissa * quantity.numerator,
    pow10(quantity.scale) * quantity.denominator,
  );
  let scale = 0;
  let denominator = combined.denominator;
  while (denominator % 10n === 0n && scale < MAX_QUANTITY_SCALE) {
    denominator /= 10n;
    scale += 1;
  }
  return Object.freeze({
    mantissa: combined.numerator,
    scale,
    numerator: 1n,
    denominator,
    unitId: quantity.unitId,
  });
}

export function withUnit(quantity: ExactQuantity, unitId: string): ExactQuantity {
  return canonicalizeQuantity({ ...quantity, unitId });
}

export function quantitiesEqual(left: ExactQuantity, right: ExactQuantity): boolean {
  if (left.unitId !== right.unitId) {
    return false;
  }
  const a = quantityRational(left);
  const b = quantityRational(right);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function integerMantissaOf(quantity: ExactQuantity): Result<bigint, NormalizationRefusal> {
  const canonical = canonicalizeQuantity(quantity);
  if (canonical.scale !== 0 || canonical.denominator !== 1n) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: `refusing to truncate ${canonical.mantissa}/${canonical.denominator}×10^-${canonical.scale} ${canonical.unitId}`,
    });
  }
  return ok(canonical.mantissa);
}

export function scaleByRational(
  quantity: ExactQuantity,
  numerator: bigint,
  denominator: bigint,
  unitId: string,
): Result<ExactQuantity, NormalizationRefusal> {
  if (denominator === 0n) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: 'conversion denominator must be non-zero',
    });
  }
  const value = quantityRational(quantity);
  const next = reduceRational(value.numerator * numerator, value.denominator * denominator);
  return exactQuantity({
    mantissa: next.numerator,
    scale: 0,
    numerator: 1n,
    denominator: next.denominator,
    unitId,
  });
}
