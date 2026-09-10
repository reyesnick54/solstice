/**
 * Reference economic data adapters — context only, not Access vendors.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest, LiveAccessProviderId } from '../types.ts';

type ReferenceAdapterSpec = {
  readonly providerId: LiveAccessProviderId;
  readonly displayName: string;
  readonly endpoint: string;
  readonly termsClassification: 'FREE_PUBLIC' | 'FREE_API_KEY_REQUIRED';
  readonly credentialEnvKey: string | null;
  readonly cacheTtlSeconds: number;
  readonly buildUrl: (request: LiveProviderSearchRequest, apiKey: string | null) => string;
  readonly parse: (data: unknown, retrievedAt: string) => readonly AccessLiveOffer[];
};

function createReferenceAdapter(spec: ReferenceAdapterSpec, deps: BaseLiveAdapterDeps = {}) {
  return class extends BaseLiveAccessAdapter {
    constructor() {
      super(
        {
          providerId: spec.providerId,
          displayName: spec.displayName,
          categories: Object.freeze(['GOODS']),
          consumerCategories: Object.freeze(['GOODS']),
          authenticationType: spec.credentialEnvKey ? 'API_KEY_QUERY' : 'NONE',
          termsClassification: 'REFERENCE_DATA' as const,
          credentialEnvKey: spec.credentialEnvKey,
          cacheTtlSeconds: spec.cacheTtlSeconds,
        },
        deps,
      );
    }

    async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
      if (spec.credentialEnvKey && !this.isCredentialConfigured()) {
        return this.fail('CONFIGURATION_REQUIRED', `${spec.providerId} API key not configured`);
      }
      const apiKey = spec.credentialEnvKey ? process.env[spec.credentialEnvKey] ?? null : null;
      const cacheKey = `${spec.providerId}:${request.query ?? 'default'}`;
      return this.withCache(cacheKey, spec.cacheTtlSeconds, async () => {
        const response = await this.http.requestJson<unknown>({
          providerId: this.providerId,
          method: 'GET',
          url: spec.buildUrl(request, apiKey),
        });
        if (!response.ok) return this.fail(response.code, response.message);
        const retrievedAt = this.nowUtc();
        const offers = spec.parse(response.data, retrievedAt);
        const provenance = this.buildProvenance({
          providerRecordId: `${spec.providerId}-reference`,
          providerUrl: spec.endpoint,
          retrievedAt,
          sourceTimestamp: retrievedAt,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        return this.succeed(Object.freeze(offers), provenance);
      });
    }
  };
}

const FrankfurterAdapter = createReferenceAdapter({
  providerId: 'frankfurter',
  displayName: 'Frankfurter FX Reference',
  endpoint: 'https://api.frankfurter.app',
  termsClassification: 'FREE_PUBLIC',
  credentialEnvKey: null,
  cacheTtlSeconds: 1800,
  buildUrl: (request) => {
    const base = request.query?.toUpperCase() || 'USD';
    return `https://api.frankfurter.app/latest?from=${base}`;
  },
  parse: (data, retrievedAt) => {
    const payload = data as { base?: string; date?: string; rates?: Record<string, number> };
    const rates = payload.rates ?? {};
    return Object.entries(rates).slice(0, 10).map(([currency, rate]) => ({
      offerId: `fx_${payload.base}_${currency}`,
      providerId: 'frankfurter',
      displayName: 'Frankfurter FX Reference',
      category: 'GOODS' as const,
      consumerCategory: 'GOODS' as const,
      title: `${payload.base}/${currency} reference rate`,
      description: 'Economic context — not an Access vendor',
      location: null,
      city: null,
      country: null,
      latitude: null,
      longitude: null,
      priceMinorUnits: null,
      currency,
      priceLabel: String(rate),
      imageUrl: null,
      externalUrl: 'https://www.frankfurter.app/',
      availability: 'REFERENCE_DATA',
      metadata: Object.freeze({ role: 'REFERENCE_DATA', rate, base: payload.base ?? null }),
      provenance: Object.freeze({
        providerId: 'frankfurter',
        providerRecordId: `fx_${payload.base}_${currency}`,
        providerUrl: 'https://api.frankfurter.app',
        retrievedAt,
        sourceTimestamp: payload.date ?? null,
        cacheAgeSeconds: 0,
        liveRead: true,
        simulation: false,
        stale: false,
      }),
    }));
  },
});

const WorldBankAdapter = createReferenceAdapter({
  providerId: 'world-bank',
  displayName: 'World Bank Open Data',
  endpoint: 'https://api.worldbank.org',
  termsClassification: 'FREE_PUBLIC',
  credentialEnvKey: null,
  cacheTtlSeconds: 3600,
  buildUrl: () =>
    'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=5',
  parse: (data, retrievedAt) => {
    const rows = (data as unknown[])[1] as Array<{ country?: { value?: string }; date?: string; value?: string }> | undefined;
    return (rows ?? []).map((row, index) => ({
      offerId: `wb_${row.country?.value ?? index}`,
      providerId: 'world-bank',
      displayName: 'World Bank Open Data',
      category: 'GOODS' as const,
      consumerCategory: 'GOODS' as const,
      title: `${row.country?.value ?? 'Country'} GDP growth`,
      description: 'Economic context — not an Access vendor',
      location: row.country?.value ?? null,
      city: null,
      country: row.country?.value ?? null,
      latitude: null,
      longitude: null,
      priceMinorUnits: null,
      currency: null,
      priceLabel: row.value ? `${row.value}%` : null,
      imageUrl: null,
      externalUrl: 'https://data.worldbank.org/',
      availability: 'REFERENCE_DATA',
      metadata: Object.freeze({ role: 'REFERENCE_DATA', indicator: 'NY.GDP.MKTP.KD.ZG', year: row.date ?? null }),
      provenance: Object.freeze({
        providerId: 'world-bank',
        providerRecordId: `wb_${row.country?.value ?? index}`,
        providerUrl: 'https://api.worldbank.org',
        retrievedAt,
        sourceTimestamp: row.date ?? null,
        cacheAgeSeconds: 0,
        liveRead: true,
        simulation: false,
        stale: false,
      }),
    }));
  },
});

export function createFrankfurterLiveAdapter(deps?: BaseLiveAdapterDeps) {
  return new FrankfurterAdapter(deps);
}

export function createWorldBankLiveAdapter(deps?: BaseLiveAdapterDeps) {
  return new WorldBankAdapter(deps);
}
