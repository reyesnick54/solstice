/**
 * Approved live HTTP endpoints for crypto market reference providers.
 */

const DEFAULT_USER_AGENT = 'SunRey-Exchange/1.0 (+https://sunrey.com; crypto-market-reference)';

function defaultCryptoMarketUserAgent(): string {
  return DEFAULT_USER_AGENT;
}

export type CryptoMarketHttpEndpoint = {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly path: string;
  readonly userAgent: string;
  readonly timeoutMs?: number;
};

export const LIVE_CRYPTO_MARKET_ENDPOINTS = Object.freeze({
  coingeckoQuote: Object.freeze({
    providerId: 'coingecko',
    baseUrl: 'https://api.coingecko.com',
    path: '/api/v3/coins',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 15_000,
  }),
  coingeckoHistory: Object.freeze({
    providerId: 'coingecko',
    baseUrl: 'https://api.coingecko.com',
    path: '/api/v3/coins',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 20_000,
  }),
  coincapQuote: Object.freeze({
    providerId: 'coincap',
    baseUrl: 'https://api.coincap.io',
    path: '/v2/assets',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 15_000,
  }),
  coincapHistory: Object.freeze({
    providerId: 'coincap',
    baseUrl: 'https://api.coincap.io',
    path: '/v2/assets',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 20_000,
  }),
  coinpaprikaQuote: Object.freeze({
    providerId: 'coinpaprika',
    baseUrl: 'https://api.coinpaprika.com',
    path: '/v1/tickers',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 15_000,
  }),
  coinpaprikaHistory: Object.freeze({
    providerId: 'coinpaprika',
    baseUrl: 'https://api.coinpaprika.com',
    path: '/v1/tickers',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 20_000,
  }),
  coinloreQuote: Object.freeze({
    providerId: 'coinlore',
    baseUrl: 'https://api.coinlore.net',
    path: '/api/ticker',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 15_000,
  }),
  cryptocompareQuote: Object.freeze({
    providerId: 'cryptocompare',
    baseUrl: 'https://min-api.cryptocompare.com',
    path: '/data/pricemultifull',
    userAgent: defaultCryptoMarketUserAgent(),
    timeoutMs: 15_000,
  }),
} as const);

export const LIVE_CRYPTO_MARKET_PROVIDER_IDS = Object.freeze([
  'coingecko',
  'coincap',
  'coinpaprika',
  'coinlore',
] as const);

export const API_KEY_CRYPTO_MARKET_PROVIDER_IDS = Object.freeze(['cryptocompare'] as const);
