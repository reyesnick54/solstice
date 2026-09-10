/**
 * Crypto market reference adapters — live HTTP with fixture simulation fallback.
 */

import type { CryptoMarketReferenceProvider } from '../provider.ts';
import type { CryptoMarketCapability } from '../types.ts';
import type { CryptoMarketHttpClientOptions } from '../http/client.ts';
import { createFixtureCryptoMarketAdapter } from './fixture-adapter.ts';
import {
  createLiveCoingeckoAdapter,
  createLiveCoincapAdapter,
  createLiveCoinloreAdapter,
  createLiveCoinpaprikaAdapter,
  createLiveCryptocompareAdapter,
} from './live-adapter.ts';

export { createFixtureCryptoMarketAdapter } from './fixture-adapter.ts';
export {
  createLiveCoingeckoAdapter,
  createLiveCoincapAdapter,
  createLiveCoinloreAdapter,
  createLiveCoinpaprikaAdapter,
  createLiveCryptocompareAdapter,
  LiveCryptoMarketAdapter,
} from './live-adapter.ts';
export {
  normalizeCoingeckoBtc,
  normalizeCoincapBtc,
  normalizeCoinpaprikaBtc,
  normalizeCoinloreBtc,
  normalizeCryptocompareBtc,
  normalizeCoinmarketcapBtc,
  normalizeFixtureQuote,
  normalizeProviderQuote,
  loadCryptoFixture,
} from './normalize.ts';

export type CryptoMarketAdapterFactoryOptions = CryptoMarketHttpClientOptions;

export function createCryptoMarketAdapter(
  providerId: string,
  options?: CryptoMarketAdapterFactoryOptions,
): CryptoMarketReferenceProvider {
  switch (providerId) {
    case 'coingecko':
      return createLiveCoingeckoAdapter(options);
    case 'coincap':
      return createLiveCoincapAdapter(options);
    case 'coinpaprika':
      return createLiveCoinpaprikaAdapter(options);
    case 'coinlore':
      return createLiveCoinloreAdapter(options);
    case 'cryptocompare':
      return createLiveCryptocompareAdapter(options);
    case 'coinmarketcap':
      return COINMARKETCAP_ADAPTER;
    default:
      return createFixtureCryptoMarketAdapter({
        providerId,
        precedence: 99,
        priority: 'fallback',
        capabilities: ['crypto_prices'],
      });
  }
}

export function createAllCryptoMarketAdapters(
  options?: CryptoMarketAdapterFactoryOptions,
): readonly CryptoMarketReferenceProvider[] {
  return Object.freeze([
    createCryptoMarketAdapter('coingecko', options),
    createCryptoMarketAdapter('coincap', options),
    createCryptoMarketAdapter('coinpaprika', options),
    createCryptoMarketAdapter('cryptocompare', options),
    createCryptoMarketAdapter('coinlore', options),
  ]);
}

export const COINGECKO_ADAPTER = createCryptoMarketAdapter('coingecko');
export const COINCAP_ADAPTER = createCryptoMarketAdapter('coincap');
export const COINPAPRIKA_ADAPTER = createCryptoMarketAdapter('coinpaprika');
export const COINLORE_ADAPTER = createCryptoMarketAdapter('coinlore');
export const CRYPTOCOMPARE_ADAPTER = createCryptoMarketAdapter('cryptocompare');

export const COINMARKETCAP_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coinmarketcap',
  precedence: 99,
  priority: 'fallback',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_metadata'],
  blocked: true,
});

export const ALL_CRYPTO_MARKET_ADAPTERS: readonly CryptoMarketReferenceProvider[] = Object.freeze([
  COINGECKO_ADAPTER,
  COINCAP_ADAPTER,
  COINPAPRIKA_ADAPTER,
  CRYPTOCOMPARE_ADAPTER,
  COINLORE_ADAPTER,
]);

export function createFailingCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 90,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    simulateTimeout: true,
  });
}

export function createRateLimitedCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 91,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    simulateRateLimit: true,
  });
}

export function createCircuitOpenCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 92,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    circuitOpen: true,
  });
}

export function createStaleCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 93,
    priority: 'primary',
    capabilities: ['crypto_prices', 'crypto_market_data'] as readonly CryptoMarketCapability[],
    stale: true,
  });
}
