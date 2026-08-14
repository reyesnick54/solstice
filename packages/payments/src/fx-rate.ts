import { applyFxConversion, Money, RoundingMode, type RationalRate } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

export type FxRate = {
  readonly base: string;
  readonly quote: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly timestamp: UtcInstant;
  readonly source: string;
};

export type PricedFxRates = {
  readonly market: FxRate;
  readonly provider: FxRate;
  readonly customer: FxRate;
};

export function asRationalRate(rate: FxRate): RationalRate {
  return { numerator: rate.numerator, denominator: rate.denominator };
}

export function convertExact(
  amount: Money,
  rate: FxRate,
  rounding: RoundingMode = RoundingMode.HALF_EVEN,
): Money {
  if (amount.currency !== rate.base) {
    throw new TypeError(`amount currency ${amount.currency} does not match rate base ${rate.base}`);
  }
  if (rounding !== RoundingMode.HALF_EVEN) {
    const converted = amount.allocate(rate.numerator, rate.denominator, rounding);
    return Money.fromMinorUnits(converted.minorUnits, rate.quote);
  }
  return applyFxConversion(amount, {
    from: rate.base,
    to: rate.quote,
    rate: asRationalRate(rate),
    timestamp: rate.timestamp,
  });
}

export function invertRate(rate: FxRate): FxRate {
  return Object.freeze({
    base: rate.quote,
    quote: rate.base,
    numerator: rate.denominator,
    denominator: rate.numerator,
    timestamp: rate.timestamp,
    source: rate.source,
  });
}

export function rateLabel(rate: FxRate): string {
  return `${rate.numerator.toString()}/${rate.denominator.toString()}`;
}
