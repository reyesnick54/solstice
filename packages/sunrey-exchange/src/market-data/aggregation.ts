/**
 * Multi-provider market-data selection. Incompatible prices are never
 * averaged blindly. Stale quotes stay labeled stale.
 */

import type {
  MarketDataProvider,
  MarketDataProviderResult,
  MarketDataSelectionPolicy,
  MarketPriceQuote,
} from './types.ts';

export const STALE_AFTER_MS = 60_000n;

export function labelFreshness(quote: MarketPriceQuote, nowUtc: string, maxAgeMs = STALE_AFTER_MS): MarketPriceQuote {
  const now = Date.parse(nowUtc);
  const ts = Date.parse(quote.timestampUtc);
  const age = BigInt(Math.max(0, now - ts));
  const stale = age > maxAgeMs || quote.quality === 'STALE';
  return Object.freeze({
    ...quote,
    freshnessMs: age,
    quality: stale ? 'STALE' : quote.quality === 'OUTLIER' || quote.quality === 'UNAVAILABLE' ? quote.quality : 'FRESH',
    staleMasqueradingAsCurrent: false,
  });
}

export function quotesCompatible(left: MarketPriceQuote, right: MarketPriceQuote): boolean {
  return (
    left.instrument.instrumentId === right.instrument.instrumentId &&
    left.currency === right.currency &&
    left.instrument.quoteScale === right.instrument.quoteScale
  );
}

export function selectMarketPrice(input: {
  readonly policy: MarketDataSelectionPolicy;
  readonly primary: MarketDataProviderResult<MarketPriceQuote>;
  readonly secondary: MarketDataProviderResult<MarketPriceQuote>;
  readonly nowUtc: string;
}): MarketDataProviderResult<MarketPriceQuote> {
  const primary = input.primary.ok ? labelFreshness(input.primary.value, input.nowUtc) : null;
  const secondary = input.secondary.ok ? labelFreshness(input.secondary.value, input.nowUtc) : null;

  if (input.policy === 'PRIMARY') {
    if (primary && primary.quality !== 'UNAVAILABLE') {
      return { ok: true, value: primary };
    }
    return input.primary.ok
      ? { ok: false, code: 'PRIMARY_UNUSABLE', message: 'primary market data unusable' }
      : input.primary;
  }

  if (input.policy === 'SECONDARY_FAILOVER') {
    if (primary && primary.quality === 'FRESH') {
      return { ok: true, value: primary };
    }
    if (secondary && secondary.quality !== 'UNAVAILABLE') {
      return { ok: true, value: secondary };
    }
    return { ok: false, code: 'FAILOVER_EXHAUSTED', message: 'primary and secondary market data unusable' };
  }

  if (input.policy === 'REJECT_INCOMPATIBLE') {
    if (!primary || !secondary) {
      return { ok: false, code: 'INCOMPLETE', message: 'both providers required' };
    }
    if (!quotesCompatible(primary, secondary)) {
      return { ok: false, code: 'INCOMPATIBLE_PRICES', message: 'refusing to average incompatible prices' };
    }
    return { ok: true, value: primary };
  }

  if (!primary || !secondary) {
    return { ok: false, code: 'CONSENSUS_INCOMPLETE', message: 'consensus requires two observations' };
  }
  if (!quotesCompatible(primary, secondary)) {
    return { ok: false, code: 'INCOMPATIBLE_PRICES', message: 'refusing to average incompatible prices' };
  }
  const delta = primary.priceUnits > secondary.priceUnits
    ? primary.priceUnits - secondary.priceUnits
    : secondary.priceUnits - primary.priceUnits;
  const max = primary.priceUnits > secondary.priceUnits ? primary.priceUnits : secondary.priceUnits;
  if (max > 0n && delta * 100n > max * 5n) {
    return {
      ok: false,
      code: 'OUTLIER_DIVERGENCE',
      message: 'provider prices diverge beyond consensus policy',
    };
  }
  const median = primary.priceUnits < secondary.priceUnits ? primary.priceUnits : secondary.priceUnits;
  return {
    ok: true,
    value: Object.freeze({
      ...primary,
      priceUnits: median,
      source: 'CONSENSUS_IF_COMPATIBLE',
      provider: `${primary.provider}+${secondary.provider}`,
      quality: primary.quality === 'FRESH' && secondary.quality === 'FRESH' ? 'FRESH' : 'STALE',
    }),
  };
}

export function quoteFromProvider(
  provider: MarketDataProvider,
  instrumentId: string,
  nowUtc: string,
): MarketDataProviderResult<MarketPriceQuote> {
  return provider.getSpotPrice(instrumentId, nowUtc);
}
