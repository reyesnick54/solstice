/**
 * Google Places API — optional, billing-account required, disabled by default.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type GooglePlace = {
  readonly id?: string;
  readonly displayName?: { readonly text?: string };
  readonly formattedAddress?: string;
  readonly location?: { readonly latitude?: number; readonly longitude?: number };
  readonly types?: readonly string[];
  readonly googleMapsUri?: string;
};

type GoogleSearchResponse = {
  readonly places?: readonly GooglePlace[];
};

export class GooglePlacesLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'google-places',
        displayName: 'Google Places',
        categories: Object.freeze(['FOOD', 'SERVICES', 'EXPERIENCES', 'HOUSING_ROOM_NIGHTS', 'TRANSPORTATION']),
        consumerCategories: Object.freeze(['FOOD', 'ROBOTS_SERVICES', 'EXPERIENCES', 'STAY_HOUSING', 'MOBILITY']),
        authenticationType: 'API_KEY_HEADER',
        termsClassification: 'FREE_USAGE_TIER',
        credentialEnvKey: 'GOOGLE_PLACES_API_KEY',
        optionalEnabledEnvKey: 'GOOGLE_PLACES_ENABLED',
        cacheTtlSeconds: 900,
        requiredCredential: (config) => config.googlePlacesApiKey !== null,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const cacheKey = `google-places:${request.query}:${request.latitude}:${request.longitude}`;
    return this.withCache(cacheKey, 900, async () => {
      const body = {
        textQuery: request.query ?? 'restaurants',
        maxResultCount: Math.min(request.limit ?? 10, 20),
        ...(request.latitude !== undefined && request.longitude !== undefined
          ? {
              locationBias: {
                circle: {
                  center: { latitude: request.latitude, longitude: request.longitude },
                  radius: (request.radiusKm ?? 5) * 1000,
                },
              },
            }
          : {}),
      };

      const response = await this.http.requestJson<GoogleSearchResponse>({
        providerId: this.providerId,
        method: 'POST',
        url: 'https://places.googleapis.com/v1/places:searchText',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.envConfig.googlePlacesApiKey!,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const places = response.data.places ?? [];
      const offers = places.map((place) => {
        const offerId = `gplaces_${place.id ?? Math.random()}`;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: place.googleMapsUri ?? null,
          retrievedAt,
          sourceTimestamp: null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        return this.buildOffer({
          offerId,
          category: 'FOOD',
          title: place.displayName?.text ?? 'Place',
          description: place.types?.join(', ') ?? null,
          location: place.formattedAddress ?? null,
          city: request.city ?? null,
          country: request.country ?? null,
          latitude: place.location?.latitude ?? null,
          longitude: place.location?.longitude ?? null,
          priceMinorUnits: null,
          currency: null,
          priceLabel: null,
          imageUrl: null,
          externalUrl: place.googleMapsUri ?? null,
          availability: 'AVAILABLE',
          metadata: Object.freeze({
            placeId: place.id ?? null,
            types: place.types?.join(',') ?? null,
            billingRequired: true,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'google-places-search',
        providerUrl: 'https://places.googleapis.com/v1/places:searchText',
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

export function createGooglePlacesLiveAdapter(deps?: BaseLiveAdapterDeps): GooglePlacesLiveAdapter {
  return new GooglePlacesLiveAdapter(deps);
}
