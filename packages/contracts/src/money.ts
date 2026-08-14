/**
 * Money is the only numeric primitive used for amounts.
 * Amounts are integer minor units (bigint). Floating-point is forbidden.
 *
 * Allocation uses an explicit rational (numerator/denominator) and rounding
 * mode. That is a share of a known amount, not a percentage-return, APY,
 * blended yield, or growth rate. Those metrics do not exist in this type.
 */

export type CurrencyCode = string;

export const RoundingMode = {
  FLOOR: 'FLOOR',
  CEILING: 'CEILING',
  HALF_EVEN: 'HALF_EVEN',
} as const;

export type RoundingMode = (typeof RoundingMode)[keyof typeof RoundingMode];

/** Rational share of an amount (e.g. 75/100 of realized gains). Not a return. */
export type RationalShare = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

const INTEGER_STRING = /^-?\d+$/;

export class Money {
  readonly minorUnits: bigint;
  readonly currency: CurrencyCode;

  private constructor(minorUnits: bigint, currency: CurrencyCode) {
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

  static fromMinorUnits(minorUnits: bigint, currency: CurrencyCode): Money {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError(
        'Money.fromMinorUnits requires bigint; number and float are forbidden',
      );
    }
    return new Money(minorUnits, currency);
  }

  static fromMinorUnitsString(minorUnits: string, currency: CurrencyCode): Money {
    if (typeof minorUnits !== 'string' || !INTEGER_STRING.test(minorUnits)) {
      throw new TypeError(
        'Money string must be a signed integer in minor units; no decimal point',
      );
    }
    return new Money(BigInt(minorUnits), currency);
  }

  static zero(currency: CurrencyCode): Money {
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

  min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.minorUnits <= other.minorUnits ? this : other;
  }

  max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.minorUnits >= other.minorUnits ? this : other;
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
   * Take a rational share of this amount. Used for mandate allocation
   * (e.g. 75/100 of realized gains to reinvest). This is not a return metric.
   */
  share(rational: RationalShare, mode: RoundingMode = RoundingMode.FLOOR): Money {
    if (typeof rational.numerator !== 'bigint' || typeof rational.denominator !== 'bigint') {
      throw new TypeError('RationalShare factors must be bigint');
    }
    if (rational.denominator === 0n) {
      throw new RangeError('RationalShare denominator must be non-zero');
    }
    if (rational.numerator < 0n || rational.denominator < 0n) {
      throw new RangeError('RationalShare must be non-negative');
    }
    if (rational.numerator > rational.denominator) {
      throw new RangeError('RationalShare cannot exceed 1 (numerator > denominator)');
    }
    const rounded = roundQuotient(
      this.minorUnits * rational.numerator,
      rational.denominator,
      mode,
    );
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
  throw new Error(`Unknown rounding mode: ${String(mode)}`);
}

const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
};

export function minorUnitsScale(currency: CurrencyCode): bigint {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  let scale = 1n;
  for (let i = 0; i < decimals; i += 1) {
    scale *= 10n;
  }
  return scale;
}

/** Display helper — integer division only, never Number(amount). */
export function formatMoney(amount: Money): string {
  const scale = minorUnitsScale(amount.currency);
  const negative = amount.minorUnits < 0n;
  const abs = negative ? -amount.minorUnits : amount.minorUnits;
  const whole = abs / scale;
  const fraction = abs % scale;
  const decimals = scale === 1n ? 0 : scale.toString().length - 1;
  const sign = negative ? '-' : '';
  const wholeGrouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = amount.currency === 'USD' ? '$' : '';
  if (decimals === 0) {
    return `${sign}${prefix}${wholeGrouped} ${amount.currency}`;
  }
  return `${sign}${prefix}${wholeGrouped}.${fraction.toString().padStart(decimals, '0')} ${amount.currency}`;
}

export type ForbiddenReturnMetricKeys =
  | 'percentageReturn'
  | 'percentReturn'
  | 'yield'
  | 'apy'
  | 'apr'
  | 'growthRate'
  | 'returnRate'
  | 'blendedYield'
  | 'rateOfReturn'
  | 'annualizedReturn'
  | 'roi';

export type MoneyHasNoReturnMetrics =
  Extract<keyof Money, ForbiddenReturnMetricKeys> extends never ? true : false;
