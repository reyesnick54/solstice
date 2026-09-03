// @ts-nocheck
/**
 * Deterministic simulation market reference adapter.
 *
 * Used for sandbox/tests when catalog providers are absent or disabled.
 * Clearly non-production. Not a catalog provider.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { commodityAssetId, resolveMarketAsset, searchRegisteredAssets } from '../assets.ts';
import { defaultCommodityUnit, validatePriceMinorUnits } from '../units.ts';
import {
  buildSandboxAssetMetadata,
  buildSandboxCommodityObservation,
  buildSandboxHistory,
  buildSandboxQuote,
  SANDBOX_PROVIDER_ID,
} from '../sandbox-builders.ts';
import type { MarketReferenceProvider, MarketReferenceProviderHealth } from '../provider.ts';
import type {
  AssetSearchQuery,
  CommodityCode,
  HistoryInterval,
  MarketReferenceCapability,
  MarketReferenceResult,
} from '../types.ts';

export type SimulationScenario = 'normal' | 'stale' | 'unavailable' | 'invalid';

export class SimulationMarketReferenceAdapter implements MarketReferenceProvider {
  readonly providerId = SANDBOX_PROVIDER_ID;
  readonly capabilities: readonly MarketReferenceCapability[] = Object.freeze([
    'market_prices',
    'securities',
    'commodity_prices',
    'resource_prices',
    'asset_metadata',
    'market_history',
    'metals',
  ]);
  readonly priority = 'fallback' as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  #scenario: SimulationScenario = 'normal';
  #circuitOpen = false;
  #rateLimited = false;

  setScenario(scenario: SimulationScenario): void {
    this.#scenario = scenario;
  }

  setCircuitOpen(open: boolean): void {
    this.#circuitOpen = open;
  }

  setRateLimited(rateLimited: boolean): void {
    this.#rateLimited = rateLimited;
  }

  health(nowUtc: UtcInstant): MarketReferenceProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      status: this.#circuitOpen || this.#scenario === 'unavailable' ? 'unavailable' : 'healthy',
      circuitState: this.#circuitOpen ? 'OPEN' : 'CLOSED',
      rateLimited: this.#rateLimited,
      lastSuccessAt: this.#circuitOpen ? null : nowUtc,
      message: this.#rateLimited ? 'rate limited' : null,
    });
  }

  supportsCapability(capability: MarketReferenceCapability): boolean {
    return (this.capabilities as readonly string[]).includes(capability);
  }

  async getQuote(assetId: string, nowUtc: UtcInstant) {
    return this.guard(nowUtc, async () => {
      const asset = resolveMarketAsset(assetId);
      if (!asset) {
        return { ok: false, code: 'UNKNOWN_ASSET', message: `unknown asset ${assetId}`, providerId: this.providerId };
      }
      const quote = buildSandboxQuote(asset, nowUtc);
      if (this.#scenario === 'invalid') {
        return { ok: false, code: 'INVALID_PRICE', message: 'negative price', providerId: this.providerId };
      }
      const validated = validatePriceMinorUnits(quote.priceMinorUnits);
      if (!validated.ok) {
        return { ok: false, code: 'INVALID_PRICE', message: validated.error, providerId: this.providerId };
      }
      return { ok: true, value: quote, fromCache: false, fallbackProviderId: null };
    });
  }

  async getQuotes(assetIds: readonly string[], nowUtc: UtcInstant) {
    const quotes = [];
    for (const assetId of assetIds) {
      const result = await this.getQuote(assetId, nowUtc);
      if (!result.ok) {
        return result;
      }
      quotes.push(result.value);
    }
    return { ok: true, value: Object.freeze(quotes), fromCache: false, fallbackProviderId: null };
  }

  async getHistory(
    assetId: string,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ) {
    return this.guard(nowUtc, async () => {
      if (!resolveMarketAsset(assetId)) {
        return { ok: false, code: 'UNKNOWN_ASSET', message: `unknown asset ${assetId}`, providerId: this.providerId };
      }
      return {
        ok: true,
        value: buildSandboxHistory(assetId, interval, range.from, range.to, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      };
    });
  }

  async getCommodityPrice(commodity: CommodityCode, nowUtc: UtcInstant) {
    return this.guard(nowUtc, async () => {
      if (!commodityAssetId(commodity)) {
        return { ok: false, code: 'UNKNOWN_COMMODITY', message: commodity, providerId: this.providerId };
      }
      const observation = buildSandboxCommodityObservation(commodity, nowUtc);
      const validated = validatePriceMinorUnits(observation.priceMinorUnits);
      if (!validated.ok) {
        return { ok: false, code: 'INVALID_PRICE', message: validated.error, providerId: this.providerId };
      }
      return { ok: true, value: observation, fromCache: false, fallbackProviderId: null };
    });
  }

  async getCommodityHistory(
    commodity: CommodityCode,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ) {
    const assetId = commodityAssetId(commodity);
    if (!assetId) {
      return { ok: false, code: 'UNKNOWN_COMMODITY', message: commodity, providerId: null };
    }
    return this.getHistory(assetId, interval, range, nowUtc);
  }

  async searchAssets(query: AssetSearchQuery, nowUtc: UtcInstant) {
    return this.guard(nowUtc, async () => ({
      ok: true,
      value: Object.freeze(
        searchRegisteredAssets(query.query, query.limit ?? 20).map((asset) => buildSandboxAssetMetadata(asset.assetId, nowUtc)),
      ),
      fromCache: false,
      fallbackProviderId: null,
    }));
  }

  async getAssetMetadata(assetId: string, nowUtc: UtcInstant) {
    return this.guard(nowUtc, async () => {
      if (!resolveMarketAsset(assetId)) {
        return { ok: false, code: 'UNKNOWN_ASSET', message: assetId, providerId: this.providerId };
      }
      return {
        ok: true,
        value: buildSandboxAssetMetadata(assetId, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      };
    });
  }

  private async guard<T>(
    nowUtc: UtcInstant,
    fn: () => Promise<MarketReferenceResult<T>>,
  ): Promise<MarketReferenceResult<T>> {
    void nowUtc;
    if (this.#circuitOpen || this.#scenario === 'unavailable') {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'provider unavailable', providerId: this.providerId };
    }
    if (this.#rateLimited) {
      return { ok: false, code: 'RATE_LIMITED', message: 'rate limited', providerId: this.providerId };
    }
    return fn();
  }
}

export function createSimulationMarketReferenceAdapter(): SimulationMarketReferenceAdapter {
  return new SimulationMarketReferenceAdapter();
}
