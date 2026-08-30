/**
 * Market reference provider port.
 *
 * Adapters implement this contract. They do not execute trades, post journals,
 * or issue Execution Authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AssetSearchQuery,
  CommodityCode,
  CommodityPriceObservation,
  HistoryInterval,
  MarketHistoryCandle,
  MarketReferenceAssetMetadata,
  MarketReferenceCapability,
  MarketReferenceQuote,
  MarketReferenceResult,
} from './types.ts';

export type MarketReferenceProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
};

export type MarketReferenceProvider = {
  readonly providerId: string;
  readonly capabilities: readonly MarketReferenceCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;

  health(nowUtc: UtcInstant): MarketReferenceProviderHealth;
  supportsCapability(capability: MarketReferenceCapability): boolean;

  getQuote(assetId: string, nowUtc: UtcInstant): Promise<MarketReferenceResult<MarketReferenceQuote>>;
  getQuotes(assetIds: readonly string[], nowUtc: UtcInstant): Promise<MarketReferenceResult<readonly MarketReferenceQuote[]>>;
  getHistory(
    assetId: string,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<MarketReferenceResult<readonly MarketHistoryCandle[]>>;
  getCommodityPrice(commodity: CommodityCode, nowUtc: UtcInstant): Promise<MarketReferenceResult<CommodityPriceObservation>>;
  getCommodityHistory(
    commodity: CommodityCode,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<MarketReferenceResult<readonly MarketHistoryCandle[]>>;
  searchAssets(query: AssetSearchQuery, nowUtc: UtcInstant): Promise<MarketReferenceResult<readonly MarketReferenceAssetMetadata[]>>;
  getAssetMetadata(assetId: string, nowUtc: UtcInstant): Promise<MarketReferenceResult<MarketReferenceAssetMetadata>>;
};

export type MarketReferenceProviderPort = Pick<
  MarketReferenceProvider,
  | 'providerId'
  | 'capabilities'
  | 'priority'
  | 'productionAuthorized'
  | 'liveProviderConnected'
  | 'health'
  | 'supportsCapability'
  | 'getQuote'
  | 'getQuotes'
  | 'getHistory'
  | 'getCommodityPrice'
  | 'getCommodityHistory'
  | 'searchAssets'
  | 'getAssetMetadata'
>;
