/**
 * M07 — Gold market intelligence service.
 *
 * Routes ETF/reference/futures identities to appropriate feeds.
 * Does not fabricate futures data from GLD prices.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { MarketReferenceService } from '../../market-reference/service.ts';
import { resolveCapitalMarketInstrument } from '../instrument-registry.ts';
import type { CapitalMarketObservation } from '../types.ts';
import { CapitalMarketService, type CapitalMarketServiceOptions } from '../service.ts';
import { buildGoldFuturesRollSnapshot, resolveFuturesMetadata } from '../futures/contract-registry.ts';
import { isContinuousResearchSeries, isExecutableFuturesIdentity } from '../futures/types.ts';
import { assertOrderedBars, buildDeterministicGoldBars, filterKnowableBars } from './bar-history.ts';
import { GOLD_ETF_GLD_ID, GOLD_REFERENCE_ID, resolveGoldIdentity } from './identities.ts';
import type {
  GoldBarHistoryResult,
  GoldBarInterval,
  GoldCanonicalIdentity,
  GoldFeedQualificationStatus,
  GoldMarketResult,
  GoldMarketState,
} from './types.ts';
import { GOLD_4H_TREND_MIN_BARS, GOLD_MARKET_SCHEMA, GOLD_MARKET_STATE_RELATIONSHIPS } from './types.ts';

export type GoldMarketIntelligenceOptions = {
  readonly capitalMarket?: CapitalMarketServiceOptions;
  readonly includeSimulationReference?: boolean;
};

export class GoldMarketIntelligenceService {
  readonly #capitalMarket: CapitalMarketService;
  readonly #reference: MarketReferenceService;
  readonly #barCache = new Map<string, { readonly value: readonly import('./types.ts').GoldBarCandle[]; readonly expiresAtMs: number }>();

  constructor(options: GoldMarketIntelligenceOptions = {}) {
    this.#capitalMarket = new CapitalMarketService(options.capitalMarket);
    this.#reference = new MarketReferenceService(
      options.includeSimulationReference === false ? { includeSimulationFallback: false } : undefined,
    );
  }

  resolveIdentity(identityId: string): GoldCanonicalIdentity | undefined {
    return resolveGoldIdentity(identityId);
  }

  feedQualification(identityId: string): GoldFeedQualificationStatus {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return 'UNAVAILABLE';
    }
    return identity.feedQualification;
  }

  async getQuote(identityId: string, nowUtc: UtcInstant): Promise<GoldMarketResult<CapitalMarketObservation>> {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return Object.freeze({ ok: false, code: 'UNKNOWN_IDENTITY', message: `unknown gold identity ${identityId}` });
    }

    if (identity.kind === 'etf_proxy') {
      return this.#capitalMarket.getObservation(identityId, nowUtc);
    }

    if (identity.kind === 'reference_commodity') {
      const ref = await this.#reference.getCommodityPrice('gold', nowUtc);
      if (!ref.ok) {
        return Object.freeze({ ok: false, code: ref.code, message: ref.message });
      }
      const observation = commodityToCapitalMarketObservation(ref.value, identityId, nowUtc);
      return Object.freeze({ ok: true, value: observation, fromCache: ref.fromCache });
    }

    if (identity.feedQualification === 'EXTERNAL_PROVIDER_REQUIRED') {
      return Object.freeze({
        ok: false,
        code: 'EXTERNAL_PROVIDER_REQUIRED',
        message: `production futures feed required for ${identityId}; cannot derive from GLD or reference gold`,
      });
    }

    return Object.freeze({ ok: false, code: 'UNSUPPORTED_IDENTITY', message: identity.kind });
  }

  async getMarketState(identityId: string, nowUtc: UtcInstant): Promise<GoldMarketResult<GoldMarketState>> {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return Object.freeze({ ok: false, code: 'UNKNOWN_IDENTITY', message: `unknown gold identity ${identityId}` });
    }

    let lastQuote: CapitalMarketObservation | null = null;
    if (identity.kind === 'etf_proxy' || identity.kind === 'reference_commodity') {
      const quoteResult = await this.getQuote(identityId, nowUtc);
      if (quoteResult.ok) {
        lastQuote = quoteResult.value;
      }
    }

    const rollSnapshot =
      identity.kind === 'futures_family' ||
      identity.kind === 'futures_contract' ||
      identity.kind === 'continuous_research'
        ? buildGoldFuturesRollSnapshot(nowUtc)
        : null;

    const sessionStatus = lastQuote?.sessionStatus ?? 'UNKNOWN';

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        schema: GOLD_MARKET_SCHEMA,
        identity,
        sessionStatus,
        lastQuote,
        rollSnapshot,
        relationships: GOLD_MARKET_STATE_RELATIONSHIPS,
        evaluatedAt: nowUtc,
      }),
      fromCache: false,
    });
  }

  async getBarHistory(
    identityId: string,
    interval: GoldBarInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<GoldBarHistoryResult> {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return Object.freeze({
        ok: false,
        code: 'UNKNOWN_IDENTITY',
        message: `unknown gold identity ${identityId}`,
        identityId,
      });
    }

    if (identity.kind === 'futures_contract' || identity.kind === 'futures_family') {
      if (identity.feedQualification === 'EXTERNAL_PROVIDER_REQUIRED') {
        return Object.freeze({
          ok: false,
          code: 'EXTERNAL_PROVIDER_REQUIRED',
          message: 'futures bar history requires external provider; GLD prices cannot substitute',
          identityId,
        });
      }
    }

    const cacheKey = `${identityId}:${interval}:${range.from}:${range.to}`;
    const cached = this.#barCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return Object.freeze({
        ok: true,
        candles: cached.value,
        identityId,
        interval,
        fromCache: true,
      });
    }

    let basePrice = 235_000n;
    if (identity.kind === 'etf_proxy') {
      const quote = await this.getQuote(identityId, nowUtc);
      if (quote.ok && quote.value.lastMinorUnits !== null) {
        basePrice = quote.value.lastMinorUnits;
      } else if (!quote.ok && quote.code !== 'NOT_CONFIGURED') {
        return Object.freeze({ ok: false, code: quote.code, message: quote.message, identityId });
      }
    } else if (identity.kind === 'reference_commodity') {
      const ref = await this.#reference.getCommodityPrice('gold', nowUtc);
      if (ref.ok) {
        basePrice = ref.value.priceMinorUnits;
      }
    } else if (identity.kind === 'continuous_research') {
      // Continuous series uses its own deterministic seed — never GLD-derived.
      basePrice = 236_500n;
    }

    const providerId =
      identity.kind === 'etf_proxy'
        ? 'finnhub'
        : identity.kind === 'reference_commodity'
          ? 'sunrey-market-reference-simulation'
          : 'helios-gold-sandbox';

    const rawBars = buildDeterministicGoldBars({
      identityId,
      interval,
      from: range.from,
      to: range.to,
      nowUtc,
      basePriceMinorUnits: basePrice,
      providerId,
    });

    const knowableBars = filterKnowableBars(rawBars, nowUtc);
    if (!assertOrderedBars(knowableBars)) {
      return Object.freeze({
        ok: false,
        code: 'BAR_ORDERING_VIOLATION',
        message: 'bar history is not strictly ordered by periodStart',
        identityId,
      });
    }

    this.#barCache.set(cacheKey, { value: knowableBars, expiresAtMs: Date.now() + 60_000 });

    return Object.freeze({
      ok: true,
      candles: knowableBars,
      identityId,
      interval,
      fromCache: false,
    });
  }

  async get4hTrendHistory(
    identityId: string,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<GoldBarHistoryResult & { readonly trendReady: boolean }> {
    const result = await this.getBarHistory(identityId, '4h', range, nowUtc);
    if (!result.ok) {
      return Object.freeze({ ...result, trendReady: false });
    }
    const trendReady = result.candles.length >= GOLD_4H_TREND_MIN_BARS;
    return Object.freeze({ ...result, trendReady });
  }

  isExecutable(identityId: string): boolean {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return false;
    }
    if (identity.kind === 'continuous_research') {
      return false;
    }
    const futuresMeta = resolveFuturesMetadata(identityId);
    if (futuresMeta) {
      return isExecutableFuturesIdentity(futuresMeta);
    }
    return identity.executable;
  }

  assertNotFabricatedFromGld(identityId: string): boolean {
    const identity = resolveGoldIdentity(identityId);
    if (!identity) {
      return true;
    }
    if (identity.kind === 'futures_contract' || identity.kind === 'futures_family') {
      return identity.feedQualification === 'EXTERNAL_PROVIDER_REQUIRED';
    }
    if (identity.kind === 'continuous_research') {
      const meta = resolveFuturesMetadata(identityId);
      return meta !== undefined && isContinuousResearchSeries(meta);
    }
    return true;
  }
}

function commodityToCapitalMarketObservation(
  commodity: { readonly priceMinorUnits: bigint; readonly currency: string; readonly priceScale: number; readonly effectiveTime: UtcInstant; readonly providerId: string; readonly provenance: { readonly observationId: string; readonly rawPayloadHash: string | null; readonly capability: string; readonly authorityClass: import('../../../../provider-sdk/src/types.ts').AuthorityClass; readonly sourceUrl: string | null } },
  identityId: string,
  nowUtc: UtcInstant,
): CapitalMarketObservation {
  const instrument = resolveCapitalMarketInstrument(identityId);
  const venue = Object.freeze({
    venueId: 'COMEX',
    mic: 'XCEC',
    displayName: 'COMEX (reference)',
    exchange: 'COMEX',
  });
  return Object.freeze({
    schema: 'sunrey.capital-market.v1',
    authority: 'REFERENCE_ONLY',
    observationType: 'quote',
    instrument: instrument ?? Object.freeze({
      instrumentId: identityId,
      symbol: 'XAU',
      vendorSymbol: 'XAU',
      assetClass: 'commodity',
      venue,
      currency: commodity.currency,
      isin: null,
      figi: null,
      providerNativeId: 'gold',
    }),
    bidMinorUnits: commodity.priceMinorUnits - 1n,
    askMinorUnits: commodity.priceMinorUnits + 1n,
    lastMinorUnits: commodity.priceMinorUnits,
    openMinorUnits: null,
    highMinorUnits: null,
    lowMinorUnits: null,
    previousCloseMinorUnits: null,
    volumeUnits: null,
    priceScale: commodity.priceScale,
    currency: commodity.currency,
    sessionStatus: 'OPEN',
    providerId: commodity.providerId,
    sourceTimestamp: commodity.effectiveTime,
    arrivalTimestamp: nowUtc,
    availabilityTimestamp: commodity.effectiveTime,
    entitlement: Object.freeze({
      entitlementClass: 'sandbox',
      feedTier: 'sandbox',
      delayedMinutes: null,
      licensedForRealtime: false,
      providerDeclaredRealtime: false,
    }),
    sequenceNumber: null,
    provenance: Object.freeze({
      providerId: commodity.providerId,
      authorityClass: commodity.provenance.authorityClass,
      sourceUrl: commodity.provenance.sourceUrl,
      rawPayloadHash: commodity.provenance.rawPayloadHash ?? '',
      observationId: commodity.provenance.observationId,
      capability: commodity.provenance.capability,
    }),
  });
}

export function createGoldMarketIntelligenceService(
  options?: GoldMarketIntelligenceOptions,
): GoldMarketIntelligenceService {
  return new GoldMarketIntelligenceService(options);
}
