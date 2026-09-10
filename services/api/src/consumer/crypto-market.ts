/**
 * Consumer BFF surface for crypto market reference data.
 *
 * Reference/research only. Does not expose credentials, internal rate-limit
 * state, internal URLs, or raw provider payloads.
 */

import {
  ALL_CRYPTO_MARKET_ADAPTERS,
  buildBffCryptoHistoryAsync,
  buildBffCryptoQuoteAsync,
  createCryptoMarketReferenceService,
  DEFAULT_CRYPTO_NOW,
  isNativeSunReyAsset,
  resolveCryptoAsset,
} from '../../../../packages/sunrey-exchange/src/crypto-market/index.ts';
import type { CryptoHistoryInterval } from '../../../../packages/sunrey-exchange/src/crypto-market/types.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { DATA_MODE } from '../../../../packages/config/src/data-mode.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type CryptoMarketBffSurface = {
  markets(principal: BffPrincipal, requestId: string): unknown | BffErrorEnvelope;
  asset(principal: BffPrincipal, assetId: string, requestId: string): Promise<unknown | BffErrorEnvelope>;
  history(
    principal: BffPrincipal,
    assetId: string,
    query: Readonly<Record<string, string>>,
    requestId: string,
  ): Promise<unknown | BffErrorEnvelope>;
};

export type CryptoMarketBffOptions = {
  readonly service?: ReturnType<typeof createCryptoMarketReferenceService>;
};

export function createCryptoMarketBffSurface(options: CryptoMarketBffOptions = {}): CryptoMarketBffSurface {
  const service = options.service ?? createCryptoMarketReferenceService();

  return Object.freeze({
    markets(principal: BffPrincipal, requestId: string) {
      void principal;
      return {
        schema: 'sunrey.bff.crypto-markets.v1',
        requestId,
        referenceOnly: true,
        executionAuthorized: false,
        environment: 'simulation',
        dataMode: DATA_MODE,
        providers: ALL_CRYPTO_MARKET_ADAPTERS.map((provider) => ({
          providerId: provider.providerId,
          priority: provider.priority,
          blocked: provider.blocked,
          liveCapable: provider.liveCapable,
          liveProviderConnected: provider.liveProviderConnected,
        })),
        separation: Object.freeze({
          referenceOnly: true,
          mutatesExchangeOrderBook: false,
          agentCanTradeDirectly: false,
        }),
      };
    },

    async asset(principal: BffPrincipal, assetId: string, requestId: string) {
      void principal;
      if (isNativeSunReyAsset(assetId)) {
        return bffError({
          errorCode: 'NATIVE_ASSET_FORBIDDEN',
          category: 'VALIDATION',
          message: 'SunRey/MoonRey native assets are not external crypto reference assets',
          retryable: false,
          requestId,
        });
      }
      if (!resolveCryptoAsset(assetId)) {
        return bffError({
          errorCode: 'NOT_FOUND',
          category: 'NOT_FOUND',
          message: `unknown crypto asset ${assetId}`,
          retryable: false,
          requestId,
        });
      }
      const quote = await buildBffCryptoQuoteAsync(assetId, DEFAULT_CRYPTO_NOW, service);
      if (!quote) {
        return bffError({
          errorCode: 'QUOTE_UNAVAILABLE',
          category: 'UPSTREAM',
          message: `quote unavailable for ${assetId}`,
          retryable: true,
          requestId,
        });
      }
      return {
        schema: 'sunrey.bff.crypto-asset.v1',
        requestId,
        referenceOnly: true,
        assetId: quote.assetId,
        symbol: quote.symbol,
        network: quote.asset.network,
        contractAddress: quote.asset.contractAddress,
        priceMinorUnits: quote.priceMinorUnits.toString(),
        quoteCurrency: quote.quoteCurrency,
        marketCapMinorUnits: quote.marketCapMinorUnits?.toString() ?? null,
        volume24hMinorUnits: quote.volume24hMinorUnits?.toString() ?? null,
        change24hBps: quote.change24hBps?.toString() ?? null,
        high24hMinorUnits: quote.high24hMinorUnits?.toString() ?? null,
        low24hMinorUnits: quote.low24hMinorUnits?.toString() ?? null,
        providerId: quote.providerId,
        providerName: quote.providerId,
        freshness: quote.freshness.status,
        sourceTimestamp: quote.marketTimestamp,
        retrievalTimestamp: quote.retrievedAt,
        priceSourceType: quote.provenance.priceSourceType,
        observationId: quote.observationId,
        fromCache: false,
      };
    },

    async history(principal: BffPrincipal, assetId: string, query: Readonly<Record<string, string>>, requestId: string) {
      void principal;
      if (!resolveCryptoAsset(assetId)) {
        return bffError({
          errorCode: 'NOT_FOUND',
          category: 'NOT_FOUND',
          message: `unknown crypto asset ${assetId}`,
          retryable: false,
          requestId,
        });
      }
      const interval = (query.interval ?? '1d') as CryptoHistoryInterval;
      const from = asUtcInstant(query.from ?? '2026-01-01T00:00:00.000Z');
      const to = asUtcInstant(query.to ?? DEFAULT_CRYPTO_NOW);
      const candles = await buildBffCryptoHistoryAsync(assetId, interval, from, to, DEFAULT_CRYPTO_NOW, service);
      return {
        schema: 'sunrey.bff.crypto-history.v1',
        requestId,
        referenceOnly: true,
        assetId,
        interval,
        candles: candles.map((candle) => ({
          openMinorUnits: candle.openMinorUnits.toString(),
          highMinorUnits: candle.highMinorUnits.toString(),
          lowMinorUnits: candle.lowMinorUnits.toString(),
          closeMinorUnits: candle.closeMinorUnits.toString(),
          volumeMinorUnits: candle.volumeMinorUnits?.toString() ?? null,
          quoteCurrency: candle.quoteCurrency,
          periodStart: candle.periodStart,
          periodEnd: candle.periodEnd,
          providerId: candle.providerId,
        })),
        fromCache: false,
      };
    },
  });
}
