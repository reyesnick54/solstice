import { asCurrencyCode, minorUnitsScale, type CurrencyCode } from './currency.ts';
import {
  applyRational,
  asRational,
  type Rational,
} from './rational.ts';
import type { UtcInstant } from './time.ts';

/**
 * Money is the only numeric primitive used for amounts, fees, and balances.
 * Amounts are integer minor units (bigint). Floating-point is forbidden.
 */
export class Money {
  readonly minorUnits: bigint;
  readonly currency: CurrencyCode;

  private constructor(minorUnits: bigint, currency: CurrencyCode) {
    this.minorUnits = minorUnits;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(minorUnits: bigint, currency: CurrencyCode | string): Money {
    if (typeof minorUnits !== 'bigint') {
      throw new TypeError('Money requires bigint minor units; floating-point is forbidden');
    }
    const code = typeof currency === 'string' ? asCurrencyCode(currency) : currency;
    return new Money(minorUnits, code);
  }

  static zero(currency: CurrencyCode | string): Money {
    return Money.of(0n, currency);
  }

  /**
   * Parse a decimal string such as "5000.00" into minor units.
   * Rejects scientific notation, floats, and extra fraction digits.
   */
  static fromDecimalString(text: string, currency: CurrencyCode | string): Money {
    const code = typeof currency === 'string' ? asCurrencyCode(currency) : currency;
    if (typeof text !== 'string' || text.length === 0) {
      throw new TypeError('Money.fromDecimalString requires a non-empty decimal string');
    }
    if (/[eE.]/.test(text) && /[eE]/.test(text)) {
      throw new TypeError('Scientific notation is forbidden for Money');
    }
    const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) {
      throw new TypeError(`Invalid decimal money string: ${text}`);
    }
    const negative = match[1] === '-';
    const whole = match[2] ?? '0';
    const fraction = match[3] ?? '';
    const scale = minorUnitsScale(code);
    const decimals = scale === 1n ? 0 : scale.toString().length - 1;
    if (fraction.length > decimals) {
      throw new TypeError(
        `Too many fractional digits for ${code}: ${text} (max ${decimals})`,
      );
    }
    const padded = fraction.padEnd(decimals, '0');
    const minor = BigInt(whole) * scale + (decimals === 0 ? 0n : BigInt(padded || '0'));
    return Money.of(negative ? -minor : minor, code);
  }

  get isZero(): boolean {
    return this.minorUnits === 0n;
  }

  get isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  get isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  abs(): Money {
    return this.minorUnits < 0n ? Money.of(-this.minorUnits, this.currency) : this;
  }

  negate(): Money {
    return Money.of(-this.minorUnits, this.currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, 'add');
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other, 'subtract');
    return Money.of(this.minorUnits - other.minorUnits, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  private assertSameCurrency(other: Money, op: string): void {
    if (this.currency !== other.currency) {
      throw new TypeError(
        `Cannot ${op} ${this.currency} and ${other.currency} without an explicit FX conversion (rate + timestamp)`,
      );
    }
  }
}

export type FxRateQuote = {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly rate: Rational;
  readonly timestamp: UtcInstant;
};

export function applyFxRate(amount: Money, quote: FxRateQuote): Money {
  if (amount.currency !== quote.from) {
    throw new TypeError(
      `Conversion is ${quote.from}→${quote.to}, not ${amount.currency}→${quote.to}`,
    );
  }
  const converted = applyRational(amount.minorUnits, quote.rate);
  return Money.of(converted, quote.to);
}

export function invertFxRate(quote: FxRateQuote): FxRateQuote {
  return Object.freeze({
    from: quote.to,
    to: quote.from,
    rate: asRational(quote.rate.denominator, quote.rate.numerator),
    timestamp: quote.timestamp,
  });
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
  if (decimals === 0) {
    return `${sign}${whole.toString()} ${amount.currency}`;
  }
  return `${sign}${whole.toString()}.${fraction.toString().padStart(decimals, '0')} ${amount.currency}`;
}
