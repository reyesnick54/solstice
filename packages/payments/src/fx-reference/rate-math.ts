import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { freezeFxReferenceRate, type FxReferenceAuthorityClass, type FxReferenceRate, type FxReferenceRateType } from './types.ts';

const MAX_DENOMINATOR_DIGITS = 18;

export function parseDecimalRateToRational(value: string): { readonly numerator: bigint; readonly denominator: bigint } {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TypeError(`invalid decimal rate: ${value}`);
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  let numerator = BigInt(whole + fraction);
  if (negative) {
    numerator = -numerator;
  }
  if (numerator <= 0n) {
    throw new TypeError('rate must be positive');
  }
  return reduceRational(numerator, denominator);
}

export function reduceRational(numerator: bigint, denominator: bigint): { readonly numerator: bigint; readonly denominator: bigint } {
  if (denominator <= 0n) {
    throw new TypeError('denominator must be positive');
  }
  const gcd = bigintGcd(numerator < 0n ? -numerator : numerator, denominator);
  return Object.freeze({
    numerator: numerator / gcd,
    denominator: denominator / gcd,
  });
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x === 0n ? 1n : x;
}

export function validateRateRational(numerator: bigint, denominator: bigint): void {
  if (denominator <= 0n) {
    throw new TypeError('rate denominator must be positive');
  }
  if (numerator <= 0n) {
    throw new TypeError('rate must be positive');
  }
  const denomStr = denominator.toString();
  if (denomStr.length > MAX_DENOMINATOR_DIGITS) {
    throw new TypeError('rate denominator exceeds precision limit');
  }
}

export function invertReferenceRate(rate: FxReferenceRate, retrievedAt: UtcInstant): FxReferenceRate {
  validateRateRational(rate.numerator, rate.denominator);
  return freezeFxReferenceRate({
    baseCurrency: rate.quoteCurrency,
    quoteCurrency: rate.baseCurrency,
    numerator: rate.denominator,
    denominator: rate.numerator,
    effectiveAt: rate.effectiveAt,
    sourceTimestamp: rate.sourceTimestamp,
    retrievedAt,
    rateType: rate.rateType,
    providerId: rate.providerId,
    authorityClass: 'derived_data',
    freshness: rate.freshness,
    observationId: `derived_inv_${rate.observationId}`,
    derivedFrom: Object.freeze([rate.observationId]),
  });
}

export function crossReferenceRate(
  legA: FxReferenceRate,
  legB: FxReferenceRate,
  targetBase: string,
  targetQuote: string,
  retrievedAt: UtcInstant,
): FxReferenceRate {
  if (legA.quoteCurrency !== legB.baseCurrency) {
    throw new TypeError('cross-rate legs do not share bridge currency');
  }
  validateRateRational(legA.numerator, legA.denominator);
  validateRateRational(legB.numerator, legB.denominator);
  const numerator = legA.numerator * legB.numerator;
  const denominator = legA.denominator * legB.denominator;
  const reduced = reduceRational(numerator, denominator);
  validateRateRational(reduced.numerator, reduced.denominator);
  return freezeFxReferenceRate({
    baseCurrency: targetBase,
    quoteCurrency: targetQuote,
    numerator: reduced.numerator,
    denominator: reduced.denominator,
    effectiveAt: laterInstant(legA.effectiveAt, legB.effectiveAt),
    sourceTimestamp: laterInstant(legA.sourceTimestamp, legB.sourceTimestamp),
    retrievedAt,
    rateType: legA.rateType,
    providerId: 'sunrey-fx-derived',
    authorityClass: 'derived_data',
    freshness: worseFreshness(legA.freshness, legB.freshness),
    observationId: `derived_x_${legA.observationId}_${legB.observationId}`,
    derivedFrom: Object.freeze([legA.observationId, legB.observationId]),
  });
}

export function buildProviderReferenceRate(input: {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly effectiveAt: UtcInstant;
  readonly sourceTimestamp: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly rateType: FxReferenceRateType;
  readonly providerId: string;
  readonly authorityClass: FxReferenceAuthorityClass;
  readonly freshness: FxReferenceRate['freshness'];
  readonly observationId: string;
}): FxReferenceRate {
  validateRateRational(input.numerator, input.denominator);
  return freezeFxReferenceRate(input);
}

function laterInstant(a: UtcInstant, b: UtcInstant): UtcInstant {
  return Date.parse(asUtcInstant(a)) >= Date.parse(asUtcInstant(b)) ? a : b;
}

function worseFreshness(
  a: FxReferenceRate['freshness'],
  b: FxReferenceRate['freshness'],
): FxReferenceRate['freshness'] {
  const order = { FRESH: 0, STALE_USABLE: 1, EXPIRED: 2 } as const;
  return order[a] >= order[b] ? a : b;
}

export function ratesDisagreeBeyondTolerance(
  left: FxReferenceRate,
  right: FxReferenceRate,
  toleranceBps: bigint,
): boolean {
  const leftScaled = left.numerator * right.denominator;
  const rightScaled = right.numerator * left.denominator;
  const delta = leftScaled > rightScaled ? leftScaled - rightScaled : rightScaled - leftScaled;
  const base = leftScaled > rightScaled ? leftScaled : rightScaled;
  if (base === 0n) {
    return true;
  }
  return (delta * 10_000n) / base > toleranceBps;
}
