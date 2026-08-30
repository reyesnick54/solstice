import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import {
  createFxReferenceService,
  fxReferenceRateToPresentationRate,
  type FxReferenceService,
} from '../../../../packages/payments/src/fx-reference/index.ts';

export type FxReferenceBffPort = {
  listReferenceProviders(): {
    readonly items: readonly {
      readonly providerId: string;
      readonly precedence: number;
      readonly blocked: boolean;
    }[];
    readonly authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION';
  };
  getReferenceRate(base: string, quote: string): unknown;
  getReferenceRates(base: string, quotes: readonly string[]): unknown;
  getReferenceHistory(base: string, quote: string, date: string): unknown;
  getReferenceCurrencies(): unknown;
};

export function createFxReferenceBffPort(service: FxReferenceService = createFxReferenceService()): FxReferenceBffPort {
  return {
    listReferenceProviders() {
      return Object.freeze({
        authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION',
        items: Object.freeze(
          service.listProviders().map((provider) =>
            Object.freeze({
              providerId: provider.providerId,
              precedence: provider.precedence,
              blocked: provider.blocked,
            }),
          ),
        ),
      });
    },
    getReferenceRate(base, quote) {
      const result = service.getRate(base, quote, { nowUtc: asUtcInstant(new Date().toISOString()) });
      if (!result.ok) {
        return Object.freeze({ ok: false, code: result.code, message: result.message });
      }
      const rate = result.value.rate;
      return Object.freeze({
        ok: true,
        authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION',
        executionAuthority: false,
        baseCurrency: rate.baseCurrency,
        quoteCurrency: rate.quoteCurrency,
        numerator: rate.numerator.toString(),
        denominator: rate.denominator.toString(),
        effectiveAt: rate.effectiveAt,
        sourceTimestamp: rate.sourceTimestamp,
        retrievedAt: rate.retrievedAt,
        rateType: rate.rateType,
        providerId: rate.providerId,
        authorityClass: rate.authorityClass,
        freshness: rate.freshness,
        observationId: rate.observationId,
        derivedFrom: rate.derivedFrom ?? null,
        cacheSource: result.value.cacheSource ?? null,
        presentationRate: fxReferenceRateToPresentationRate(rate),
      });
    },
    getReferenceRates(base, quotes) {
      const result = service.getRates(base, quotes, { nowUtc: asUtcInstant(new Date().toISOString()) });
      if (!result.ok) {
        return Object.freeze({ ok: false, code: result.code, message: result.message });
      }
      return Object.freeze({
        ok: true,
        authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION',
        items: Object.freeze(
          result.value.map((row) =>
            Object.freeze({
              baseCurrency: row.rate.baseCurrency,
              quoteCurrency: row.rate.quoteCurrency,
              numerator: row.rate.numerator.toString(),
              denominator: row.rate.denominator.toString(),
              providerId: row.rate.providerId,
              authorityClass: row.rate.authorityClass,
              observationId: row.rate.observationId,
            }),
          ),
        ),
      });
    },
    getReferenceHistory(base, quote, date) {
      const result = service.getHistoricalRate(base, quote, date, {
        nowUtc: asUtcInstant(new Date().toISOString()),
      });
      if (!result.ok) {
        return Object.freeze({ ok: false, code: result.code, message: result.message });
      }
      const rate = result.value.rate;
      return Object.freeze({
        ok: true,
        authority: 'FX_REFERENCE_ONLY_NOT_EXECUTION',
        date,
        rate: Object.freeze({
          baseCurrency: rate.baseCurrency,
          quoteCurrency: rate.quoteCurrency,
          numerator: rate.numerator.toString(),
          denominator: rate.denominator.toString(),
          providerId: rate.providerId,
          authorityClass: rate.authorityClass,
          observationId: rate.observationId,
        }),
      });
    },
    getReferenceCurrencies() {
      const result = service.getAvailableCurrencies({ nowUtc: asUtcInstant(new Date().toISOString()) });
      if (!result.ok) {
        return Object.freeze({ ok: false, code: result.code, message: result.message });
      }
      return Object.freeze({ ok: true, items: result.value });
    },
  };
}
