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

const INTEGER_STRING = /^-?\d+$/;

export class Money {
  readonly minorUnits: bigint;
  readonly currency: string;

  private constructor(minorUnits: bigint, currency: string) {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError(
        'Money admits only bigint minor units; floating-point is forbidden',
      );
    }
    if (typeof currency !== 'string' || currency.length === 0) {
      throw new TypeError('Money requires a non-empty currency code');
    }
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
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
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
    const rounded = roundQuotient(product, denominator, mode);
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
  const converted = roundQuotient(
    amount.minorUnits * conversion.rate.numerator,
    conversion.rate.denominator,
    RoundingMode.HALF_EVEN,
  );
  return Money.fromMinorUnits(converted, conversion.to);
}
