import { asUtcInstant } from '../../../../domain/src/time.ts';
import { buildProviderReferenceRate, parseDecimalRateToRational } from '../rate-math.ts';
import { assertFxCurrencyPair } from '../currency.ts';
import type { FxReferenceAuthorityClass, FxReferenceRate, FxReferenceRateType } from '../types.ts';
import { biasedNumerator, fixturePayloadForBase } from '../fixtures.ts';

export type FxAdapterNormalizeInput = {
  readonly providerId: string;
  readonly base: string;
  readonly quote: string;
  readonly rateDecimal: string;
  readonly providerTimestamp: string;
  readonly retrievedAt: string;
  readonly rateType?: FxReferenceRateType;
  readonly authorityClass: FxReferenceAuthorityClass;
  readonly observationSuffix?: string;
};

export function normalizeFixtureRate(input: FxAdapterNormalizeInput): FxReferenceRate {
  const pair = assertFxCurrencyPair(input.base, input.quote);
  const rational = parseDecimalRateToRational(input.rateDecimal);
  const numerator = biasedNumerator(rational.numerator, input.providerId);
  const effectiveAt = asUtcInstant(input.providerTimestamp);
  const retrievedAt = asUtcInstant(input.retrievedAt);
  return buildProviderReferenceRate({
    baseCurrency: pair.base,
    quoteCurrency: pair.quote,
    numerator,
    denominator: rational.denominator,
    effectiveAt,
    sourceTimestamp: effectiveAt,
    retrievedAt,
    rateType: input.rateType ?? 'SPOT',
    providerId: input.providerId,
    authorityClass: input.authorityClass,
    freshness: 'FRESH',
    observationId: `${input.providerId}_${pair.base}_${pair.quote}_${input.observationSuffix ?? 'latest'}`,
  });
}

export function resolveFixtureRate(
  providerId: string,
  base: string,
  quote: string,
  retrievedAt: string,
  authorityClass: FxReferenceAuthorityClass,
): FxReferenceRate | undefined {
  const pair = assertFxCurrencyPair(base, quote);
  const payload = fixturePayloadForBase(pair.base);
  const quoteRate = payload?.rates[pair.quote];
  if (!payload || !quoteRate) {
    return undefined;
  }
  return normalizeFixtureRate({
    providerId,
    base: pair.base,
    quote: pair.quote,
    rateDecimal: quoteRate,
    providerTimestamp: payload.providerTimestamp,
    retrievedAt,
    authorityClass,
  });
}
