/**
 * Capital market provider HTTP endpoints.
 */

export type CapitalMarketHttpEndpoint = {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly path: string;
  readonly timeoutMs: number;
  readonly userAgent: string;
};

export const FINNHUB_ENDPOINT: CapitalMarketHttpEndpoint = Object.freeze({
  providerId: 'finnhub',
  baseUrl: 'https://finnhub.io/api/v1',
  path: '',
  timeoutMs: 15_000,
  userAgent: 'SunRey-Exchange/1.0 (+https://sunrey.com; capital-market-reference)',
});
