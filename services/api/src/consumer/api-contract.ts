/**
 * Wave 8 — Consumer API contract versioning and deprecation.
 */

import { CONSUMER_API_DOMAINS } from './domains.ts';

export const CONSUMER_API_CONTRACT_VERSION = '1.0.0-wave8' as const;
export const CONSUMER_API_SCHEMA_FAMILY = 'sunrey.consumer' as const;

export type DeprecationNotice = {
  readonly route: string;
  readonly replacement: string;
  readonly sunsetAfter: string | null;
  readonly reason: string;
};

export const DEPRECATED_ROUTES: readonly DeprecationNotice[] = Object.freeze([
  {
    route: 'GET /api/v1/me/actions',
    replacement: 'GET /api/v1/actions',
    sunsetAfter: '2026-12-01',
    reason: 'Unified Action Center under /api/v1/actions',
  },
  {
    route: 'GET /api/v1/economy/sunrey-coin',
    replacement: 'GET /api/v1/sunrey/supply',
    sunsetAfter: '2026-12-01',
    reason: 'SunRey product domain split',
  },
  {
    route: 'GET /api/v1/economy/moonrey-coin',
    replacement: 'GET /api/v1/moonrey/supply',
    sunsetAfter: '2026-12-01',
    reason: 'MoonRey product domain split',
  },
  {
    route: 'GET /api/v1/portfolio',
    replacement: 'GET /api/v1/grow/portfolio',
    sunsetAfter: '2026-12-01',
    reason: 'Grow portfolio canonical path',
  },
  {
    route: 'GET /api/v1/goals',
    replacement: 'GET /api/v1/grow/goals',
    sunsetAfter: '2026-12-01',
    reason: 'Grow goals canonical path',
  },
]);

export type ConsumerContractManifest = {
  readonly schema: 'sunrey.consumer.api-contract.v1';
  readonly contractVersion: typeof CONSUMER_API_CONTRACT_VERSION;
  readonly apiVersion: 'v1';
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly domains: readonly { readonly domain: string; readonly basePath: string; readonly classification: string }[];
  readonly deprecations: readonly DeprecationNotice[];
  readonly compatibility: {
    readonly breakingChangePolicy: 'explicit-version-bump';
    readonly clientMustSendApiVersion: false;
    readonly serverSendsApiVersionHeader: true;
  };
};

export function consumerContractManifest(): ConsumerContractManifest {
  return Object.freeze({
    schema: 'sunrey.consumer.api-contract.v1',
    contractVersion: CONSUMER_API_CONTRACT_VERSION,
    apiVersion: 'v1',
    environment: 'simulation',
    productionActive: false,
    liveConnectivityEnabled: false,
    domains: CONSUMER_API_DOMAINS.map((row) =>
      Object.freeze({
        domain: row.domain,
        basePath: row.basePath,
        classification: row.classification,
      }),
    ),
    deprecations: DEPRECATED_ROUTES,
    compatibility: Object.freeze({
      breakingChangePolicy: 'explicit-version-bump',
      clientMustSendApiVersion: false,
      serverSendsApiVersionHeader: true,
    }),
  });
}

export function deprecationForPath(method: string, path: string): DeprecationNotice | undefined {
  const key = `${method.toUpperCase()} ${path}`;
  return DEPRECATED_ROUTES.find((row) => row.route === key);
}

export const CONTRACT_RESPONSE_HEADERS = Object.freeze({
  'x-sunrey-api-version': 'v1',
  'x-sunrey-contract-version': CONSUMER_API_CONTRACT_VERSION,
});
