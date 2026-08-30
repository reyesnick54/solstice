/**
 * Crypto market reference provider port.
 *
 * Adapters implement this contract. They do not execute trades, post journals,
 * issue Execution Authority, or mutate Exchange order books.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  CryptoAssetSearchQuery,
  CryptoHistoryInterval,
  CryptoMarketAssetMetadata,
  CryptoMarketCapability,
  CryptoMarketHistoryCandle,
  CryptoMarketReferenceQuote,
  CryptoMarketReferenceResult,
} from './types.ts';

export type CryptoMarketProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
  readonly blocked: boolean;
};

export type CryptoMarketReferenceProvider = {
  readonly providerId: string;
  readonly capabilities: readonly CryptoMarketCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  readonly blocked: boolean;

  health(nowUtc: UtcInstant): CryptoMarketProviderHealth;
  supportsCapability(capability: CryptoMarketCapability): boolean;

  getQuote(assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<CryptoMarketReferenceQuote>>;
  getQuotes(
    assetIds: readonly string[],
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketReferenceQuote[]>>;
  getHistory(
    assetId: string,
    interval: CryptoHistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketHistoryCandle[]>>;
  searchAssets(
    query: CryptoAssetSearchQuery,
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketAssetMetadata[]>>;
  getAssetMetadata(assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<CryptoMarketAssetMetadata>>;
};
