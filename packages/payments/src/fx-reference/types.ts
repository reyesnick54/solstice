import type { UtcInstant } from '../../../domain/src/time.ts';

/** Reference-only rate taxonomy. Never used for settlement or execution. */
export const FX_REFERENCE_RATE_TYPES = ['SPOT', 'DAILY_REFERENCE', 'HISTORICAL'] as const;
export type FxReferenceRateType = (typeof FX_REFERENCE_RATE_TYPES)[number];

export const FX_REFERENCE_AUTHORITY_CLASSES = [
  'authoritative_official',
  'reference_data',
  'derived_data',
] as const;
export type FxReferenceAuthorityClass = (typeof FX_REFERENCE_AUTHORITY_CLASSES)[number];

export const FX_REFERENCE_FRESHNESS = ['FRESH', 'STALE_USABLE', 'EXPIRED'] as const;
export type FxReferenceFreshness = (typeof FX_REFERENCE_FRESHNESS)[number];

export type FxReferenceRateProvenance = {
  readonly observationId: string;
  readonly providerId: string;
  readonly rateType: FxReferenceRateType;
  readonly authorityClass: FxReferenceAuthorityClass;
  readonly derivedFrom?: readonly string[];
};

/**
 * Canonical external FX reference observation.
 * Rational bigint rate — never floating point.
 */
export type FxReferenceRate = {
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
  readonly freshness: FxReferenceFreshness;
  readonly observationId: string;
  readonly derivedFrom?: readonly string[];
};

/** Execution quote from regulated FX liquidity provider — not a free reference feed. */
export type FxExecutionQuote = {
  readonly kind: 'EXECUTION';
  readonly quoteId: string;
  readonly providerId: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly expiresAt: UtcInstant;
};

/** Settlement rate authority — banking/FX execution only. */
export type SettlementFxRate = {
  readonly kind: 'SETTLEMENT';
  readonly settlementRef: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly authoritative: true;
};

export type FxReferenceObservation = {
  readonly rate: FxReferenceRate;
  readonly cacheSource?: 'fresh' | 'stale' | 'provider' | 'derived';
};

export type FxReferenceHistoryPoint = {
  readonly date: string;
  readonly rate: FxReferenceRate;
};

export type FxReferenceServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function freezeFxReferenceRate(input: Omit<FxReferenceRate, 'derivedFrom'> & {
  readonly derivedFrom?: readonly string[];
}): FxReferenceRate {
  return Object.freeze({
    ...input,
    ...(input.derivedFrom ? { derivedFrom: Object.freeze([...input.derivedFrom]) } : {}),
  });
}
