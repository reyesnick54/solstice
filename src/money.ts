/**
 * Money is the only numeric primitive used for balances.
 * Amounts are integer minor units (bigint). Floating-point arithmetic
 * is forbidden anywhere money is computed.
 */
export type CurrencyCode = string;

export class Money {
  private constructor(
    readonly minorUnits: bigint,
    readonly currency: CurrencyCode,
  ) {
    Object.freeze(this);
  }

  static of(minorUnits: bigint, currency: CurrencyCode): Money {
    if (typeof minorUnits !== "bigint") {
      throw new TypeError(
        "Money requires bigint minor units; floating-point is forbidden",
      );
    }
    if (typeof currency !== "string" || currency.length === 0) {
      throw new TypeError("Money requires a non-empty currency code");
    }
    return new Money(minorUnits, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return Money.of(0n, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new TypeError(
        `Cannot add ${this.currency} to ${other.currency} without an explicit FX conversion (rate + timestamp)`,
      );
    }
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  get isZero(): boolean {
    return this.minorUnits === 0n;
  }
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
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly rate: RationalRate;
  readonly timestamp: Date;
};

export function roundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator === 0n) {
    throw new RangeError("Division by zero");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return quotient;
  }
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (absRemainder * 2n >= absDenominator) {
    const positive = (numerator > 0n) === (denominator > 0n);
    return quotient + (positive ? 1n : -1n);
  }
  return quotient;
}

export function applyFxConversion(
  amount: Money,
  conversion: FxConversion,
): Money {
  if (amount.currency !== conversion.from) {
    throw new TypeError(
      `Conversion is ${conversion.from}→${conversion.to}, not ${amount.currency}→${conversion.to}`,
    );
  }
  if (conversion.rate.denominator === 0n) {
    throw new RangeError("FX rate denominator cannot be zero");
  }
  const converted = roundHalfAwayFromZero(
    amount.minorUnits * conversion.rate.numerator,
    conversion.rate.denominator,
  );
  return Money.of(converted, conversion.to);
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
  const sign = negative ? "-" : "";
  if (decimals === 0) {
    return `${sign}${whole.toString()} ${amount.currency}`;
  }
  return `${sign}${whole.toString()}.${fraction.toString().padStart(decimals, "0")} ${amount.currency}`;
}
