import type { UtcInstant } from '../../../domain/src/time.ts';
import { freezeRate, type FxRate } from '../fx-rate.ts';
import type { FxReferenceRate } from './types.ts';

/** Convert reference observation to presentation FxRate without execution authority. */
export function fxReferenceRateToPresentationRate(rate: FxReferenceRate): FxRate {
  return freezeRate({
    kind: 'REFERENCE',
    base: rate.baseCurrency,
    quote: rate.quoteCurrency,
    numerator: rate.numerator,
    denominator: rate.denominator,
    timestamp: rate.effectiveAt,
    source: `FX_REF:${rate.providerId}:${rate.authorityClass}`,
  });
}

export function isReferencePresentationRate(rate: FxRate): boolean {
  return rate.kind === 'REFERENCE' && rate.source.startsWith('FX_REF:');
}

export function isExecutionRateSource(source: string): boolean {
  return source.includes('PROVIDER') || source.includes('CUSTOMER') || source.includes('SIMULATION');
}

export type IndicativeConversionEstimate = {
  readonly authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION';
  readonly referenceRate: FxReferenceRate;
  readonly presentationRate: FxRate;
  readonly asOf: UtcInstant;
};

export function indicativeConversionEstimate(rate: FxReferenceRate): IndicativeConversionEstimate {
  return Object.freeze({
    authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION',
    referenceRate: rate,
    presentationRate: fxReferenceRateToPresentationRate(rate),
    asOf: rate.retrievedAt,
  });
}
