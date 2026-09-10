/**
 * U.S. EIA Open Data API v2 — reference energy intelligence, not transactional.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type EiaSeriesResponse = {
  readonly response?: {
    readonly data?: readonly (readonly [string, number])[];
    readonly description?: string;
    readonly name?: string;
  };
};

const DEFAULT_SERIES = 'EBA.TEX-ALL.D.H';

export class EiaLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'eia',
        displayName: 'U.S. Energy Information Administration',
        categories: Object.freeze(['ENERGY']),
        consumerCategories: Object.freeze(['ENERGY']),
        authenticationType: 'API_KEY_QUERY',
        termsClassification: 'FREE_API_KEY_REQUIRED',
        credentialEnvKey: 'EIA_API_KEY',
        cacheTtlSeconds: 3600,
        requiredCredential: (config) => config.eiaApiKey !== null,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const seriesId = request.query?.trim() || DEFAULT_SERIES;
    const cacheKey = `eia:${seriesId}`;
    return this.withCache(cacheKey, 3600, async () => {
      const params = new URLSearchParams({
        api_key: this.envConfig.eiaApiKey!,
      });
      const response = await this.http.requestJson<EiaSeriesResponse>({
        providerId: this.providerId,
        method: 'GET',
        url: `https://api.eia.gov/v2/electricity/rto/region-data/data/?${params.toString()}&frequency=hourly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=5`,
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const data = response.data.response?.data ?? [];
      const offers: AccessLiveOffer[] = data.slice(0, request.limit ?? 5).map((row, index) => {
        const [period, value] = row;
        const offerId = `eia_${seriesId}_${period}`;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: 'https://www.eia.gov/opendata/',
          retrievedAt,
          sourceTimestamp: period,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        return this.buildOffer({
          offerId,
          category: 'ENERGY',
          title: response.data.response?.name ?? `EIA ${seriesId}`,
          description: response.data.response?.description ?? 'Reference electricity demand data',
          location: 'United States',
          city: null,
          country: 'US',
          latitude: null,
          longitude: null,
          priceMinorUnits: null,
          currency: null,
          priceLabel: value !== undefined ? `${value} MWh` : null,
          imageUrl: null,
          externalUrl: 'https://www.eia.gov/opendata/',
          availability: 'REFERENCE_AVAILABILITY_DATA',
          metadata: Object.freeze({
            seriesId,
            period,
            value,
            role: 'REFERENCE_AVAILABILITY_DATA',
            index,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: `eia-${seriesId}`,
        providerUrl: 'https://api.eia.gov/v2/',
        retrievedAt,
        sourceTimestamp: data[0]?.[0] ?? null,
        liveRead: true,
        simulation: false,
        stale: false,
      });
      return this.succeed(Object.freeze(offers), provenance);
    });
  }
}

export function createEiaLiveAdapter(deps?: BaseLiveAdapterDeps): EiaLiveAdapter {
  return new EiaLiveAdapter(deps);
}
