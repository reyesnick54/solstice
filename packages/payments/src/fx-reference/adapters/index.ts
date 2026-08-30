import type { FxReferenceFetchContext, FxReferenceProvider } from '../provider.ts';
import type { FxReferenceRate, FxReferenceServiceResult } from '../types.ts';
import { resolveFixtureRate } from './normalize.ts';

type AdapterConfig = {
  readonly providerId: string;
  readonly precedence: number;
  readonly authorityClass: 'authoritative_official' | 'reference_data';
  readonly blocked?: boolean;
  readonly simulateTimeout?: boolean;
  readonly simulateRateLimit?: boolean;
};

function ok<T>(value: T): FxReferenceServiceResult<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: string, message: string): FxReferenceServiceResult<never> {
  return Object.freeze({ ok: false, code, message });
}

export function createFixtureFxReferenceAdapter(config: AdapterConfig): FxReferenceProvider {
  return Object.freeze({
    providerId: config.providerId,
    precedence: config.precedence,
    blocked: config.blocked ?? false,
    getRate(base, quote, context): FxReferenceServiceResult<FxReferenceRate> {
      if (config.blocked) {
        return fail('PROVIDER_BLOCKED', `provider ${config.providerId} is blocked`);
      }
      if (config.simulateTimeout) {
        return fail('PROVIDER_TIMEOUT', `provider ${config.providerId} timed out`);
      }
      if (config.simulateRateLimit) {
        return fail('RATE_LIMITED', `provider ${config.providerId} rate limited`);
      }
      const rate = resolveFixtureRate(config.providerId, base, quote, context.nowUtc, config.authorityClass);
      if (!rate) {
        return fail('PAIR_NOT_AVAILABLE', `no fixture rate for ${base}/${quote}`);
      }
      return ok(rate);
    },
    getRates(base, quotes, context) {
      const rates: FxReferenceRate[] = [];
      for (const quote of quotes) {
        const result = this.getRate(base, quote, context);
        if (result.ok) {
          rates.push(result.value);
        }
      }
      if (rates.length === 0) {
        return fail('PAIR_NOT_AVAILABLE', `no fixture rates for base ${base}`);
      }
      return ok(Object.freeze(rates));
    },
    getAvailableCurrencies(_context: FxReferenceFetchContext) {
      return ok(Object.freeze(['USD', 'EUR', 'GBP', 'SAR', 'AED', 'JPY', 'CHF']));
    },
  });
}

export const FRANKFURTER_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'frankfurter',
  precedence: 30,
  authorityClass: 'reference_data',
});

export const CURRENCY_API_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'currency-api',
  precedence: 40,
  authorityClass: 'reference_data',
});

export const EXCHANGERATE_DEV_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'exchangerate-dev',
  precedence: 50,
  authorityClass: 'reference_data',
});

export const EXCHANGERATE_HOST_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'exchangerate-host',
  precedence: 60,
  authorityClass: 'reference_data',
});

export const ECONOMIA_AWESOME_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'economia-awesome',
  precedence: 70,
  authorityClass: 'reference_data',
});

export const BANK_OF_RUSSIA_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'bank-of-russia',
  precedence: 10,
  authorityClass: 'authoritative_official',
});

export const NATIONAL_BANK_POLAND_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'national-bank-poland',
  precedence: 20,
  authorityClass: 'authoritative_official',
});

export const BLOCKED_CURRENCYAPI_ADAPTER = createFixtureFxReferenceAdapter({
  providerId: 'currencyapi-com',
  precedence: 99,
  authorityClass: 'reference_data',
  blocked: true,
});

export const ALL_FX_REFERENCE_ADAPTERS: readonly FxReferenceProvider[] = Object.freeze([
  BANK_OF_RUSSIA_ADAPTER,
  NATIONAL_BANK_POLAND_ADAPTER,
  FRANKFURTER_ADAPTER,
  CURRENCY_API_ADAPTER,
  EXCHANGERATE_DEV_ADAPTER,
  EXCHANGERATE_HOST_ADAPTER,
  ECONOMIA_AWESOME_ADAPTER,
]);

export function createFailingFxReferenceAdapter(providerId: string): FxReferenceProvider {
  return createFixtureFxReferenceAdapter({
    providerId,
    precedence: 90,
    authorityClass: 'reference_data',
    simulateTimeout: true,
  });
}

export function createRateLimitedFxReferenceAdapter(providerId: string): FxReferenceProvider {
  return createFixtureFxReferenceAdapter({
    providerId,
    precedence: 91,
    authorityClass: 'reference_data',
    simulateRateLimit: true,
  });
}
