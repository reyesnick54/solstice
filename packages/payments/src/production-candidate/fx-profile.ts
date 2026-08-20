import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { isExpired } from '../../../config/src/clock.ts';
import { Money } from '../../../money/src/money.ts';
import type { FxRate } from '../fx-rate.ts';
import { freezeCandidate } from './provider-profile.ts';
import type {
  CandidateFxPair,
  CredentialDescriptorRef,
  EndpointProfileRef,
  EvidenceRef,
  ExactRational,
  FxLiquidityClass,
  FxPriceSourceClass,
  FxUnavailableReason,
  ProviderAcceptanceRef,
  ProviderCandidateState,
} from './types.ts';

export type FxLiquidityProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly supportedCurrencyPairs: readonly CandidateFxPair[];
  readonly quoteTtlMs: bigint;
  readonly precision: {
    readonly maxDecimalPlaces: number;
    readonly representation: 'EXACT_RATIONAL';
  };
  readonly credentialDescriptorRef: CredentialDescriptorRef;
  readonly endpointProfileRef: EndpointProfileRef;
  readonly priceSourceClass: FxPriceSourceClass;
  readonly liquidityClass: FxLiquidityClass;
  readonly providerAcceptanceRef: ProviderAcceptanceRef;
  readonly externalEvidenceRefs: readonly EvidenceRef[];
  readonly state: ProviderCandidateState;
  readonly productionAuthorized: false;
};

export type CandidateFxQuote = {
  readonly providerQuoteId: string;
  readonly sourceTimestamp: UtcInstant;
  readonly receivedTimestamp: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly pair: CandidateFxPair;
  readonly rate: ExactRational;
  readonly fee: Money | null;
  readonly spread: ExactRational | null;
  readonly rateSource: string;
};

export type CandidateFxQuoteResult =
  | { readonly ok: true; readonly quote: CandidateFxQuote }
  | { readonly ok: false; readonly reason: FxUnavailableReason; readonly inventRate: false };

export function freezeFxLiquidityProviderCandidateProfile(
  input: FxLiquidityProviderCandidateProfile,
): FxLiquidityProviderCandidateProfile {
  if (input.providerAcceptanceRef.domain !== 'FX_LIQUIDITY') {
    throw new TypeError('FX profile must bind FX_LIQUIDITY');
  }
  if (input.productionAuthorized !== false) {
    throw new TypeError('FX productionAuthorized must remain false');
  }
  if (input.precision.representation !== 'EXACT_RATIONAL') {
    throw new TypeError('FX precision must be exact rational');
  }
  return freezeCandidate({
    ...input,
    supportedCurrencyPairs: Object.freeze(input.supportedCurrencyPairs.map((pair) => Object.freeze({ ...pair }))),
    precision: Object.freeze({ ...input.precision }),
    credentialDescriptorRef: Object.freeze({ ...input.credentialDescriptorRef, plaintextCredential: false }),
    externalEvidenceRefs: Object.freeze([...input.externalEvidenceRefs]),
    productionAuthorized: false,
  });
}

export function parseExactProviderRate(input: unknown): { readonly ok: true; readonly rate: ExactRational } | { readonly ok: false; readonly reason: FxUnavailableReason } {
  if (typeof input === 'number') {
    return { ok: false, reason: 'FLOAT_REJECTED' };
  }
  if (input && typeof input === 'object') {
    const record = input as { readonly numerator?: unknown; readonly denominator?: unknown };
    if (record.numerator !== undefined && record.denominator !== undefined) {
      try {
        const numerator = asBigInt(record.numerator);
        const denominator = asBigInt(record.denominator);
        if (denominator === 0n) {
          return { ok: false, reason: 'UNREPRESENTABLE_RATE' };
        }
        return { ok: true, rate: Object.freeze({ numerator, denominator }) };
      } catch {
        return { ok: false, reason: 'UNREPRESENTABLE_RATE' };
      }
    }
  }
  if (typeof input !== 'string') {
    return { ok: false, reason: 'UNREPRESENTABLE_RATE' };
  }
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, reason: 'UNREPRESENTABLE_RATE' };
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');
  const numerator = BigInt(`${negative ? '-' : ''}${whole}${fraction}`);
  const denominator = 10n ** BigInt(fraction.length);
  return { ok: true, rate: Object.freeze({ numerator, denominator }) };
}

export function candidateQuoteIsExpired(quote: CandidateFxQuote, now: UtcInstant): boolean {
  return isExpired(quote.expiresAt, now);
}

export function quoteFromCandidateProvider(input: {
  readonly profile: FxLiquidityProviderCandidateProfile;
  readonly pair: CandidateFxPair;
  readonly now: UtcInstant;
  readonly sourceTimestamp: UtcInstant;
  readonly receivedTimestamp: UtcInstant;
  readonly rateInput: unknown;
  readonly providerQuoteId: string;
  readonly fee?: Money | null;
  readonly stale?: boolean;
  readonly failure?: FxUnavailableReason | null;
}): CandidateFxQuoteResult {
  if (input.failure) {
    return { ok: false, reason: input.failure, inventRate: false };
  }
  if (!input.profile.supportedCurrencyPairs.some((pair) => pair.base === input.pair.base && pair.quote === input.pair.quote)) {
    return { ok: false, reason: 'CURRENCY_MISMATCH', inventRate: false };
  }
  const parsed = parseExactProviderRate(input.rateInput);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason, inventRate: false };
  }
  const expiresAt = addTtl(input.receivedTimestamp, input.profile.quoteTtlMs);
  const quote: CandidateFxQuote = Object.freeze({
    providerQuoteId: input.providerQuoteId,
    sourceTimestamp: input.sourceTimestamp,
    receivedTimestamp: input.receivedTimestamp,
    expiresAt,
    pair: input.pair,
    rate: parsed.rate,
    fee: input.fee ?? null,
    spread: null,
    rateSource: input.profile.priceSourceClass,
  });
  if (input.stale || candidateQuoteIsExpired(quote, input.now)) {
    return { ok: false, reason: 'STALE_QUOTE', inventRate: false };
  }
  return { ok: true, quote };
}

function addTtl(timestamp: UtcInstant, ttlMs: bigint): UtcInstant {
  return new Date(Date.parse(timestamp) + Number(ttlMs)).toISOString() as UtcInstant;
}

export function asFxRate(quote: CandidateFxQuote): FxRate {
  return Object.freeze({
    base: quote.pair.base,
    quote: quote.pair.quote,
    numerator: quote.rate.numerator,
    denominator: quote.rate.denominator,
    timestamp: quote.sourceTimestamp,
    source: quote.rateSource,
  });
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    throw new TypeError('float');
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new TypeError('unrepresentable');
}
