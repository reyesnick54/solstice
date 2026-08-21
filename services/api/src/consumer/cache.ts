/**
 * Conservative BFF cache policy.
 * Authentication is never satisfied from a public cache.
 */

export const CACHE_CLASSES = ['NO_STORE', 'PRIVATE_SHORT_TTL', 'ETAG_REVALIDATION', 'SERVER_CACHE'] as const;
export type CacheClass = (typeof CACHE_CLASSES)[number];

export type CachePolicy = {
  readonly class: CacheClass;
  readonly cacheControl: string;
  readonly vary: string;
  readonly public: false;
  readonly notes: string;
};

export const FINANCIAL_CACHE: CachePolicy = Object.freeze({
  class: 'NO_STORE',
  cacheControl: 'no-store, no-cache, private',
  vary: 'Authorization',
  public: false,
  notes: 'Balances, activity, Home, and any money-bearing response. Never public.',
});

export const BOOTSTRAP_CACHE: CachePolicy = Object.freeze({
  class: 'PRIVATE_SHORT_TTL',
  cacheControl: 'private, max-age=15, must-revalidate',
  vary: 'Authorization',
  public: false,
  notes: 'Bootstrap and capability discovery. Short private TTL only. Auth still required.',
});

export const CATALOG_CACHE: CachePolicy = Object.freeze({
  class: 'ETAG_REVALIDATION',
  cacheControl: 'private, max-age=60, must-revalidate',
  vary: 'Authorization',
  public: false,
  notes: 'Client-safe enumerations and resource catalog. Revalidate; never public.',
});

export function cachePolicyForPath(path: string): CachePolicy {
  if (
    path === '/api/v1/me/bootstrap' ||
    path === '/api/v1/me/capabilities' ||
    path === '/api/v1/catalog/enums' ||
    path === '/api/v1/catalog/resources'
  ) {
    return path.startsWith('/api/v1/catalog/') ? CATALOG_CACHE : BOOTSTRAP_CACHE;
  }
  return FINANCIAL_CACHE;
}
