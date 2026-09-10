/**
 * Yelp Fusion API — optional trial/paid adapter, disabled by default.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type YelpBusiness = {
  readonly id?: string;
  readonly name?: string;
  readonly url?: string;
  readonly image_url?: string;
  readonly location?: {
    readonly address1?: string;
    readonly city?: string;
    readonly country?: string;
  };
  readonly coordinates?: { readonly latitude?: number; readonly longitude?: number };
  readonly categories?: readonly { readonly title?: string }[];
  readonly price?: string;
};

type YelpSearchResponse = {
  readonly businesses?: readonly YelpBusiness[];
};

export class YelpLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'yelp',
        displayName: 'Yelp',
        categories: Object.freeze(['FOOD', 'SERVICES', 'EXPERIENCES']),
        consumerCategories: Object.freeze(['FOOD', 'ROBOTS_SERVICES', 'EXPERIENCES']),
        authenticationType: 'BEARER',
        termsClassification: 'TRIAL_OR_PAID',
        credentialEnvKey: 'YELP_API_KEY',
        optionalEnabledEnvKey: 'YELP_ENABLED',
        cacheTtlSeconds: 900,
        requiredCredential: (config) => config.yelpApiKey !== null,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const params = new URLSearchParams({
      term: request.query ?? 'restaurants',
      limit: String(Math.min(request.limit ?? 10, 50)),
    });
    if (request.latitude !== undefined && request.longitude !== undefined) {
      params.set('latitude', String(request.latitude));
      params.set('longitude', String(request.longitude));
      if (request.radiusKm) params.set('radius', String(Math.round(request.radiusKm * 1000)));
    } else if (request.city) {
      params.set('location', request.city);
    }

    const cacheKey = `yelp:${params.toString()}`;
    return this.withCache(cacheKey, 900, async () => {
      const response = await this.http.requestJson<YelpSearchResponse>({
        providerId: this.providerId,
        method: 'GET',
        url: `https://api.yelp.com/v3/businesses/search?${params.toString()}`,
        headers: {
          Authorization: `Bearer ${this.envConfig.yelpApiKey}`,
        },
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const businesses = response.data.businesses ?? [];
      const offers = businesses.map((biz) => {
        const offerId = `yelp_${biz.id ?? Math.random()}`;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: biz.url ?? null,
          retrievedAt,
          sourceTimestamp: null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        const locationParts = [biz.location?.address1, biz.location?.city, biz.location?.country].filter(Boolean);
        return this.buildOffer({
          offerId,
          category: 'FOOD',
          title: biz.name ?? 'Business',
          description: biz.categories?.map((c) => c.title).join(', ') ?? null,
          location: locationParts.join(', ') || null,
          city: biz.location?.city ?? request.city ?? null,
          country: biz.location?.country ?? request.country ?? null,
          latitude: biz.coordinates?.latitude ?? null,
          longitude: biz.coordinates?.longitude ?? null,
          priceMinorUnits: null,
          currency: null,
          priceLabel: biz.price ?? null,
          imageUrl: biz.image_url ?? null,
          externalUrl: biz.url ?? null,
          availability: 'AVAILABLE',
          metadata: Object.freeze({
            businessId: biz.id ?? null,
            trialOrPaid: true,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'yelp-search',
        providerUrl: 'https://api.yelp.com/v3/businesses/search',
        retrievedAt,
        sourceTimestamp: null,
        liveRead: true,
        simulation: false,
        stale: false,
      });
      return this.succeed(Object.freeze(offers), provenance);
    });
  }
}

export function createYelpLiveAdapter(deps?: BaseLiveAdapterDeps): YelpLiveAdapter {
  return new YelpLiveAdapter(deps);
}
