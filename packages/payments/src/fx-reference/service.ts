import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { FxReferenceFetchContext, FxReferenceProvider } from './provider.ts';
import { crossReferenceRate, invertReferenceRate, ratesDisagreeBeyondTolerance } from './rate-math.ts';
import { assertFxCurrencyPair, isValidFxCurrencyCode } from './currency.ts';
import type { FxReferenceHistoryPoint, FxReferenceObservation, FxReferenceRate, FxReferenceServiceResult } from './types.ts';
import { ALL_FX_REFERENCE_ADAPTERS } from './adapters/index.ts';

export type FxReferenceServiceOptions = {
  readonly providers?: readonly FxReferenceProvider[];
  readonly nowUtc?: () => string;
  readonly outlierToleranceBps?: bigint;
};

type CacheEntry = {
  readonly rate: FxReferenceRate;
  readonly cachedAtMs: number;
};

export class FxReferenceService {
  readonly #providers: readonly FxReferenceProvider[];
  readonly #nowUtc: () => string;
  readonly #outlierToleranceBps: bigint;
  readonly #memoryCache = new Map<string, CacheEntry>();

  constructor(options: FxReferenceServiceOptions = {}) {
    this.#providers = Object.freeze(
      [...(options.providers ?? ALL_FX_REFERENCE_ADAPTERS)].sort((a, b) => a.precedence - b.precedence),
    );
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
    this.#outlierToleranceBps = options.outlierToleranceBps ?? 500n;
  }

  listProviders(): readonly FxReferenceProvider[] {
    return this.#providers;
  }

  getRate(base: string, quote: string, context?: Partial<FxReferenceFetchContext>): FxReferenceServiceResult<FxReferenceObservation> {
    const pair = this.validatePair(base, quote);
    if (!pair.ok) {
      return pair;
    }
    const ctx = this.context(context);
    const cacheKey = `${pair.value.base}/${pair.value.quote}`;
    const cached = this.#memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAtMs < 30_000) {
      return Object.freeze({
        ok: true,
        value: Object.freeze({ rate: cached.rate, cacheSource: 'fresh' }),
      });
    }

    const direct = this.fetchDirect(pair.value.base, pair.value.quote, ctx);
    if (direct.ok) {
      this.#memoryCache.set(cacheKey, Object.freeze({ rate: direct.value.rate, cachedAtMs: Date.now() }));
      return direct;
    }

    const inverse = this.tryInverse(pair.value.base, pair.value.quote, ctx);
    if (inverse.ok) {
      this.#memoryCache.set(cacheKey, Object.freeze({ rate: inverse.value.rate, cachedAtMs: Date.now() }));
      return inverse;
    }

    const cross = this.tryCross(pair.value.base, pair.value.quote, ctx);
    if (cross.ok) {
      this.#memoryCache.set(cacheKey, Object.freeze({ rate: cross.value.rate, cachedAtMs: Date.now() }));
      return cross;
    }

    return direct;
  }

  getRates(
    base: string,
    quotes: readonly string[],
    context?: Partial<FxReferenceFetchContext>,
  ): FxReferenceServiceResult<readonly FxReferenceObservation[]> {
    const observations: FxReferenceObservation[] = [];
    for (const quote of quotes) {
      const result = this.getRate(base, quote, context);
      if (result.ok) {
        observations.push(result.value);
      }
    }
    if (observations.length === 0) {
      return Object.freeze({ ok: false, code: 'NO_RATES', message: `no reference rates for base ${base}` });
    }
    return Object.freeze({ ok: true, value: Object.freeze(observations) });
  }

  getHistoricalRate(
    base: string,
    quote: string,
    date: string,
    context?: Partial<FxReferenceFetchContext>,
  ): FxReferenceServiceResult<FxReferenceObservation> {
    const pair = this.validatePair(base, quote);
    if (!pair.ok) {
      return pair;
    }
    const ctx = this.context(context);
    for (const provider of this.#providers) {
      if (provider.blocked || !provider.getHistoricalRate) {
        continue;
      }
      const result = this.resolveProviderResult(provider.getHistoricalRate(pair.value.base, pair.value.quote, date, ctx));
      if (result.ok) {
        return Object.freeze({ ok: true, value: Object.freeze({ rate: result.value, cacheSource: 'provider' }) });
      }
    }
    const latest = this.getRate(pair.value.base, pair.value.quote, context);
    if (!latest.ok) {
      return latest;
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        rate: Object.freeze({
          ...latest.value.rate,
          rateType: 'HISTORICAL',
          effectiveAt: asUtcInstant(`${date}T00:00:00.000Z`),
        }),
        cacheSource: 'derived',
      }),
    });
  }

  getTimeSeries(
    base: string,
    quote: string,
    from: string,
    to: string,
    context?: Partial<FxReferenceFetchContext>,
  ): FxReferenceServiceResult<readonly FxReferenceHistoryPoint[]> {
    const pair = this.validatePair(base, quote);
    if (!pair.ok) {
      return pair;
    }
    const ctx = this.context(context);
    for (const provider of this.#providers) {
      if (provider.blocked || !provider.getTimeSeries) {
        continue;
      }
      const result = this.resolveProviderResult(provider.getTimeSeries(pair.value.base, pair.value.quote, from, to, ctx));
      if (result.ok) {
        return Object.freeze({ ok: true, value: result.value });
      }
    }
    const point = this.getHistoricalRate(pair.value.base, pair.value.quote, to, context);
    if (!point.ok) {
      return point;
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze([
        Object.freeze({
          date: to,
          rate: point.value.rate,
        }),
      ]),
    });
  }

  getAvailableCurrencies(context?: Partial<FxReferenceFetchContext>): FxReferenceServiceResult<readonly string[]> {
    const ctx = this.context(context);
    const merged = new Set<string>();
    for (const provider of this.#providers) {
      if (provider.blocked || !provider.getAvailableCurrencies) {
        continue;
      }
      const result = this.resolveProviderResult(provider.getAvailableCurrencies(ctx));
      if (result.ok) {
        for (const code of result.value) {
          merged.add(code);
        }
      }
    }
    return Object.freeze({ ok: true, value: Object.freeze([...merged].sort()) });
  }

  private resolveProviderResult<T>(value: Promise<FxReferenceServiceResult<T>> | FxReferenceServiceResult<T>): FxReferenceServiceResult<T> {
    if (typeof (value as Promise<FxReferenceServiceResult<T>>).then === 'function') {
      throw new TypeError('async provider results are not supported in synchronous FxReferenceService');
    }
    return value as FxReferenceServiceResult<T>;
  }

  private validatePair(base: string, quote: string): FxReferenceServiceResult<{ readonly base: string; readonly quote: string }> {
    if (!isValidFxCurrencyCode(base) || !isValidFxCurrencyCode(quote)) {
      return Object.freeze({ ok: false, code: 'INVALID_CURRENCY', message: 'malformed or unsupported currency code' });
    }
    try {
      return Object.freeze({ ok: true, value: assertFxCurrencyPair(base, quote) });
    } catch (error) {
      return Object.freeze({
        ok: false,
        code: 'INVALID_PAIR',
        message: error instanceof Error ? error.message : 'invalid currency pair',
      });
    }
  }

  private context(partial?: Partial<FxReferenceFetchContext>): FxReferenceFetchContext {
    const nowUtc = asUtcInstant(partial?.nowUtc ?? this.#nowUtc());
    return Object.freeze({
      requestId: partial?.requestId ?? `fxref_${nowUtc}`,
      correlationId: partial?.correlationId ?? `corr_${nowUtc}`,
      nowUtc,
    });
  }

  private fetchDirect(
    base: string,
    quote: string,
    ctx: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceObservation> {
    const observations: FxReferenceObservation[] = [];
    for (const provider of this.#providers) {
      if (provider.blocked) {
        continue;
      }
      const result = this.fetchFromProvider(provider, base, quote, ctx);
      if (!result.ok) {
        continue;
      }
      const outlier = this.detectOutlier(result.value.rate, observations.map((row) => row.rate));
      if (outlier) {
        continue;
      }
      observations.push(Object.freeze({ rate: result.value.rate, cacheSource: result.value.cacheSource }));
      return Object.freeze({ ok: true, value: observations[0]! });
    }
    return Object.freeze({ ok: false, code: 'NO_PROVIDER_RATE', message: `no provider supplied ${base}/${quote}` });
  }

  private fetchFromProvider(
    provider: FxReferenceProvider,
    base: string,
    quote: string,
    ctx: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceObservation> {
    const fetched = this.resolveProviderResult(provider.getRate(base, quote, ctx));
    if (!fetched.ok) {
      return fetched;
    }
    if (!this.isTimestampPlausible(fetched.value, ctx.nowUtc)) {
      return Object.freeze({ ok: false, code: 'INVALID_TIMESTAMP', message: 'provider timestamp is implausible' });
    }
    return Object.freeze({ ok: true, value: Object.freeze({ rate: fetched.value, cacheSource: 'provider' }) });
  }

  private tryInverse(
    base: string,
    quote: string,
    ctx: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceObservation> {
    const inverse = this.fetchDirect(quote, base, ctx);
    if (!inverse.ok) {
      return inverse;
    }
    const derived = invertReferenceRate(inverse.value.rate, ctx.nowUtc);
    return Object.freeze({ ok: true, value: Object.freeze({ rate: derived, cacheSource: 'derived' }) });
  }

  private tryCross(
    base: string,
    quote: string,
    ctx: FxReferenceFetchContext,
  ): FxReferenceServiceResult<FxReferenceObservation> {
    const bridges = ['USD', 'EUR'] as const;
    for (const bridge of bridges) {
      if (bridge === base || bridge === quote) {
        continue;
      }
      const legA = this.fetchDirect(base, bridge, ctx);
      const legB = this.fetchDirect(bridge, quote, ctx);
      if (!legA.ok || !legB.ok) {
        continue;
      }
      const derived = crossReferenceRate(legA.value.rate, legB.value.rate, base, quote, ctx.nowUtc);
      return Object.freeze({ ok: true, value: Object.freeze({ rate: derived, cacheSource: 'derived' }) });
    }
    return Object.freeze({ ok: false, code: 'NO_CROSS_RATE', message: `unable to derive cross rate for ${base}/${quote}` });
  }

  private detectOutlier(candidate: FxReferenceRate, existing: readonly FxReferenceRate[]): boolean {
    for (const rate of existing) {
      if (ratesDisagreeBeyondTolerance(candidate, rate, this.#outlierToleranceBps)) {
        return true;
      }
    }
    return false;
  }

  private isTimestampPlausible(rate: FxReferenceRate, nowUtc: UtcInstant): boolean {
    const sourceMs = Date.parse(asUtcInstant(rate.sourceTimestamp));
    const nowMs = Date.parse(asUtcInstant(nowUtc));
    if (!Number.isFinite(sourceMs) || !Number.isFinite(nowMs)) {
      return false;
    }
    const futureToleranceMs = 5 * 60_000;
    return sourceMs <= nowMs + futureToleranceMs;
  }
}

export function createFxReferenceService(options?: FxReferenceServiceOptions): FxReferenceService {
  return new FxReferenceService(options);
}
