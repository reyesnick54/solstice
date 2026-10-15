/**
 * AAF07 certification profiles — verified against official provider documentation (simulation catalog).
 */

import type { Aaf07ProviderCertificationRecord } from './types.ts';
import { HELIOS_AAF07_CERTIFICATION_SCHEMA } from './types.ts';

export const KRAKEN_PROVIDER_ID = 'kraken' as const;
export const COINGECKO_REFERENCE_PROVIDER_ID = 'coingecko' as const;
export const FINNHUB_PROVIDER_ID = 'finnhub' as const;

/** Kraken REST public market data — venue-level observations. */
export const KRAKEN_AAF07_CERTIFICATION: Aaf07ProviderCertificationRecord = Object.freeze({
  schemaVersion: HELIOS_AAF07_CERTIFICATION_SCHEMA,
  providerId: KRAKEN_PROVIDER_ID,
  displayName: 'Kraken Exchange (public REST)',
  documentationUrl: 'https://docs.kraken.com/rest/',
  accessTermsUrl: 'https://www.kraken.com/legal/api',
  commercialUseStatus: 'ALLOWED_WITH_TERMS',
  commercialUseNotes:
    'Public market data endpoints are subject to Kraken API Terms of Use; redistribution and commercial use require compliance review.',
  timestampSemantics: 'UNIX_SECONDS_UTC',
  rateLimits: Object.freeze({
    requestsPerMinute: null,
    burstNotes: 'Tiered public REST counters; consult API counter headers and Kraken rate-limit documentation.',
    counterHeader: 'API-Counter',
  }),
  verifiedAt: '2026-10-15T00:00:00.000Z',
  verifiedBy: 'helios-aaf07-certification-catalog',
  grantsExecutionAuthority: false,
});

/** CoinGecko aggregated reference — not venue-level market data. */
export const COINGECKO_REFERENCE_AAF07_CERTIFICATION: Aaf07ProviderCertificationRecord = Object.freeze({
  schemaVersion: HELIOS_AAF07_CERTIFICATION_SCHEMA,
  providerId: COINGECKO_REFERENCE_PROVIDER_ID,
  displayName: 'CoinGecko (aggregated reference)',
  documentationUrl: 'https://docs.coingecko.com/reference/introduction',
  accessTermsUrl: 'https://www.coingecko.com/en/api_terms',
  commercialUseStatus: 'ALLOWED_WITH_TERMS',
  commercialUseNotes:
    'Aggregated index/reference pricing; not a primary venue tape. Commercial tiers and attribution per CoinGecko API terms.',
  timestampSemantics: 'UNIX_SECONDS_UTC',
  rateLimits: Object.freeze({
    requestsPerMinute: 30,
    burstNotes: 'Demo/free tier documented; pro tiers differ.',
    counterHeader: null,
  }),
  verifiedAt: '2026-10-15T00:00:00.000Z',
  verifiedBy: 'helios-aaf07-certification-catalog',
  grantsExecutionAuthority: false,
});

/** Finnhub equity / ETF REST — vendor epoch-second quote timestamps (see Finnhub quote API). */
export const FINNHUB_AAF07_CERTIFICATION: Aaf07ProviderCertificationRecord = Object.freeze({
  schemaVersion: HELIOS_AAF07_CERTIFICATION_SCHEMA,
  providerId: FINNHUB_PROVIDER_ID,
  displayName: 'Finnhub (US equities / ETFs)',
  documentationUrl: 'https://finnhub.io/docs/api',
  accessTermsUrl: 'https://finnhub.io/terms-of-service',
  commercialUseStatus: 'ALLOWED_WITH_TERMS',
  commercialUseNotes:
    'Free tier is personal-use restricted per Finnhub terms; redistribution prohibited. Paid tiers required for commercial redistribution.',
  timestampSemantics: 'UNIX_SECONDS_UTC',
  rateLimits: Object.freeze({
    requestsPerMinute: 60,
    burstNotes: '60 API calls per minute on free tier per Finnhub documentation.',
    counterHeader: null,
  }),
  verifiedAt: '2026-10-15T00:00:00.000Z',
  verifiedBy: 'helios-aaf07-certification-catalog',
  grantsExecutionAuthority: false,
});

export const AAF07_CERTIFIED_PROVIDER_CATALOG: Readonly<Record<string, Aaf07ProviderCertificationRecord>> =
  Object.freeze({
    [KRAKEN_PROVIDER_ID]: KRAKEN_AAF07_CERTIFICATION,
    [COINGECKO_REFERENCE_PROVIDER_ID]: COINGECKO_REFERENCE_AAF07_CERTIFICATION,
    [FINNHUB_PROVIDER_ID]: FINNHUB_AAF07_CERTIFICATION,
  });
