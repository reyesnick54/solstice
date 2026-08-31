/**
 * Consumer BFF surface for crypto market reference data.
 *
 * Reference/research only. Does not expose credentials, internal rate-limit
 * state, internal URLs, or raw provider payloads.
 */

import {
  ALL_CRYPTO_MARKET_ADAPTERS,
  buildBffCryptoHistory,
  buildBffCryptoQuote,
  DEFAULT_CRYPTO_NOW,
  isNativeSunReyAsset,
  resolveCryptoAsset,
} from '../../../../packages/sunrey-exchange/src/crypto-market/index.ts';
import type { CryptoHistoryInterval } from '../../../../packages/sunrey-exchange/src/crypto-market/types.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type CryptoMarketBffSurface = {
  markets(principal: BffPrincipal, requestId: string): unknown | BffErrorEnvelope;
  asset(principal: BffPrincipal, assetId: string, requestId: string): unknown | BffErrorEnvelope;
  history(
    principal: BffPrincipal,
    assetId: string,
    query: Readonly<Record<string, string>>,
    requestId: string,
  ): unknown | BffErrorEnvelope;
};

export function createCryptoMarketBffSurface(): CryptoMarketBffSurface {
  return Object.freeze({
    markets(principal: BffPrincipal, requestId: string) {
      void principal;
      return {
        schema: 'sunrey.bff.crypto-markets.v1',
        requestId,
        referenceOnly: true,
        executionAuthorized: false,
        environment: 'simulation',
        providers: ALL_CRYPTO_MARKET_ADAPTERS.map((provider) => ({
          providerId: provider.providerId,
          priority: provider.priority,
          blocked: provider.blocked,
        })),
        separation: Object.freeze({
          referenceOnly: true,
          mutatesExchangeOrderBook: false,
          agentCanTradeDirectly: false,
        }),
      };
    },

    asset(principal: BffPrincipal, assetId: string, requestId: string) {
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
      const quote = buildBffCryptoQuote(assetId);
      if (!quote) {
        return bffError({
          errorCode: 'QUOTE_UNAVAILABLE',
          category: 'UPSTREAM',
          message: `quote unavailable for ${assetId}`,
          retryable: false,
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
        providerId: quote.providerId,
        providerName: quote.providerId,
        freshness: quote.freshness.status,
        sourceTimestamp: quote.marketTimestamp,
        priceSourceType: quote.provenance.priceSourceType,
        observationId: quote.observationId,
        fromCache: false,
      };
    },

    history(principal: BffPrincipal, assetId: string, query: Readonly<Record<string, string>>, requestId: string) {
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
      const candles = buildBffCryptoHistory(assetId, interval, from, to);
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
