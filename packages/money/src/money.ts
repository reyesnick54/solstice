/**
 * Money — integer minor-unit primitive.
 *
 * Amounts are bigint counts of the currency's minor unit (USD cents, etc.).
 * Construction from number is rejected at runtime. There is no major-unit
 * parser that would introduce a floating-point conversion.
 *
 * Rounding rules (used only when a rational allocation is required, e.g.
 * interest or FX). Principal deposit, withdrawal, and transfer paths never
 * allocate and never round:
 *
 *   FLOOR     — toward -infinity
 *   CEILING   — toward +infinity
 *   HALF_EVEN — banker's rounding: ties go to the even quotient
 *
 * Remainder after integer division is resolved by the explicit mode. No
 * IEEE-754 intermediate is used.
 */

export const RoundingMode = {
  FLOOR: 'FLOOR',
  CEILING: 'CEILING',
  HALF_EVEN: 'HALF_EVEN',
} as const;

export type RoundingMode = (typeof RoundingMode)[keyof typeof RoundingMode];

/**
 * Application overflow bound. Fits PostgreSQL NUMERIC(38, 0) with headroom.
 * Not a business limit. Arithmetic that would exceed this fails closed.
 */
export const MAX_ABS_MINOR_UNITS = 10n ** 28n;

const INTEGER_STRING = /^-?\d+$/;
const ISO_4217_ALPHA = /^[A-Z]{3}$/;
const BOOK_CURRENCY = /^[A-Z]{3,16}$/;

export function assertSafeMinorUnits(minorUnits: bigint, label = 'money'): void {
  if (typeof minorUnits !== 'bigint') {
    throw new TypeError(`${label} admits only bigint minor units; floating-point is forbidden`);
  }
  const abs = minorUnits < 0n ? -minorUnits : minorUnits;
  if (abs > MAX_ABS_MINOR_UNITS) {
    throw new RangeError(`${label} overflow: absolute minor units exceed ${MAX_ABS_MINOR_UNITS}`);
  }
}

export function assertIsoCurrencyCode(currency: string): void {
  if (typeof currency !== 'string' || !ISO_4217_ALPHA.test(currency)) {
    throw new TypeError(
      'ISO 4217 alphabetic currency codes are exactly three A-Z letters',
    );
  }
}

export function assertCurrencyCode(currency: string): void {
  if (typeof currency !== 'string' || !BOOK_CURRENCY.test(currency)) {
    throw new TypeError(
      'Money requires an uppercase alphabetic currency code (ISO 4217 three-letter or a longer simulation book code)',
    );
  }
}

export class Money {
  readonly minorUnits: bigint;
  readonly currency: string;

  private constructor(minorUnits: bigint, currency: string) {
    assertSafeMinorUnits(minorUnits);
    assertCurrencyCode(currency);
    this.minorUnits = minorUnits;
    this.currency = currency;
    Object.freeze(this);
  }

  static fromMinorUnits(minorUnits: bigint, currency: string): Money {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError(
        'Money.fromMinorUnits requires bigint; number and float are forbidden',
      );
    }
    return new Money(minorUnits, currency);
  }

  /**
   * Parse a signed integer string of minor units. Rejects any decimal point,
   * exponent, or non-digit content so "100.00" cannot enter the system.
   */
  static fromMinorUnitsString(minorUnits: string, currency: string): Money {
    if (typeof minorUnits !== 'string' || !INTEGER_STRING.test(minorUnits)) {
      throw new TypeError(
        'Money string must be a signed integer in minor units; no decimal point',
      );
    }
    return new Money(BigInt(minorUnits), currency);
  }

  static zero(currency: string): Money {
    return new Money(0n, currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    const sum = this.minorUnits + other.minorUnits;
    assertSafeMinorUnits(sum, 'money addition');
    return new Money(sum, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    const difference = this.minorUnits - other.minorUnits;
    assertSafeMinorUnits(difference, 'money subtraction');
    return new Money(difference, this.currency);
  }

  negate(): Money {
    return new Money(-this.minorUnits, this.currency);
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  cmp(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  /**
   * Multiply by numerator/denominator and apply an explicit rounding mode.
   * Not used on principal deposit, withdrawal, or transfer paths.
   */
  allocate(numerator: bigint, denominator: bigint, mode: RoundingMode): Money {
    if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') {
      throw new TypeError('allocate factors must be bigint');
    }
    if (denominator === 0n) {
      throw new RangeError('allocate denominator must be non-zero');
    }
    const product = this.minorUnits * numerator;
    assertSafeMinorUnits(product, 'money allocate product');
    const rounded = roundQuotient(product, denominator, mode);
    assertSafeMinorUnits(rounded, 'money allocate result');
    return new Money(rounded, this.currency);
  }

  toJSON(): { minorUnits: string; currency: string } {
    return { minorUnits: this.minorUnits.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new TypeError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

export function roundQuotient(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode,
): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return quotient;
  }

  const towardNegInf =
    (numerator < 0n && denominator > 0n) || (numerator > 0n && denominator < 0n);

  if (mode === RoundingMode.FLOOR) {
    return towardNegInf ? quotient - 1n : quotient;
  }
  if (mode === RoundingMode.CEILING) {
    return towardNegInf ? quotient : quotient + 1n;
  }
  if (mode === RoundingMode.HALF_EVEN) {
    const absRem = remainder < 0n ? -remainder : remainder;
    const absDen = denominator < 0n ? -denominator : denominator;
    const twice = absRem * 2n;
    if (twice < absDen) {
      return quotient;
    }
    if (twice > absDen) {
      return towardNegInf ? quotient - 1n : quotient + 1n;
    }
    const away = towardNegInf ? quotient - 1n : quotient + 1n;
    return quotient % 2n === 0n ? quotient : away;
  }
  throw new TypeError(`Unknown rounding mode: ${String(mode)}`);
}

/** Rational FX rate. Both parts are bigint so conversion never uses floats. */
export type RationalRate = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

/**
 * Explicit currency conversion. Summing mixed currencies is illegal
 * unless a conversion carrying both rate and timestamp is supplied.
 */
export type FxConversion = {
  readonly from: string;
  readonly to: string;
  readonly rate: RationalRate;
  readonly timestamp: string;
};

export function applyFxConversion(amount: Money, conversion: FxConversion): Money {
  if (amount.currency !== conversion.from) {
    throw new TypeError(
      `Conversion is ${conversion.from}→${conversion.to}, not ${amount.currency}→${conversion.to}`,
    );
  }
  if (typeof conversion.rate.numerator !== 'bigint' || typeof conversion.rate.denominator !== 'bigint') {
    throw new TypeError('FX rate parts must be bigint');
  }
  if (conversion.rate.denominator === 0n) {
    throw new RangeError('FX rate denominator cannot be zero');
  }
  const product = amount.minorUnits * conversion.rate.numerator;
  assertSafeMinorUnits(product, 'FX conversion product');
  const converted = roundQuotient(
    product,
    conversion.rate.denominator,
    RoundingMode.HALF_EVEN,
  );
  assertSafeMinorUnits(converted, 'FX conversion result');
  return Money.fromMinorUnits(converted, conversion.to);
}
