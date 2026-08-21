import { applyFxConversion, Money, RoundingMode, type RationalRate } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

/**
 * Canonical rate taxonomy. REFERENCE is the market/reference observation.
 * PROVIDER is the liquidity-provider mid/offer. CUSTOMER is the
 * server-priced rate after spread. Frontend cannot choose a rate.
 */
export const FX_RATE_KINDS = ['REFERENCE', 'PROVIDER', 'CUSTOMER'] as const;
export type FxRateKind = (typeof FX_RATE_KINDS)[number];

export type FxRate = {
  readonly kind?: FxRateKind;
  readonly base: string;
  readonly quote: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly timestamp: UtcInstant;
  readonly source: string;
};

export type PricedFxRates = {
  readonly reference: FxRate;
  readonly market: FxRate;
  readonly provider: FxRate;
  readonly customer: FxRate;
};

export function freezeRate(rate: Omit<FxRate, 'kind'> & { readonly kind?: FxRateKind }): FxRate {
  return Object.freeze({
    kind: rate.kind ?? inferKind(rate.source),
    base: rate.base,
    quote: rate.quote,
    numerator: rate.numerator,
    denominator: rate.denominator,
    timestamp: rate.timestamp,
    source: rate.source,
  });
}

function inferKind(source: string): FxRateKind {
  if (source.includes('CUSTOMER')) {
    return 'CUSTOMER';
  }
  if (source.includes('PROVIDER')) {
    return 'PROVIDER';
  }
  return 'REFERENCE';
}

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
  return freezeRate({
    kind: rate.kind,
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
