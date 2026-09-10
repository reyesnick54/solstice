/**
 * Ticketmaster Discovery API v2 — events/venues/attractions, read-only.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type TmEvent = {
  readonly id?: string;
  readonly name?: string;
  readonly url?: string;
  readonly dates?: { readonly start?: { readonly localDate?: string; readonly localTime?: string; readonly dateTime?: string } };
  readonly classifications?: readonly { readonly segment?: { readonly name?: string }; readonly genre?: { readonly name?: string } }[];
  readonly priceRanges?: readonly { readonly min?: number; readonly max?: number; readonly currency?: string }[];
  readonly images?: readonly { readonly url?: string; readonly ratio?: string }[];
  readonly _embedded?: {
    readonly venues?: readonly {
      readonly name?: string;
      readonly city?: { readonly name?: string };
      readonly country?: { readonly countryCode?: string };
      readonly location?: { readonly latitude?: string; readonly longitude?: string };
    }[];
  };
};

type TmSearchResponse = {
  readonly _embedded?: { readonly events?: readonly TmEvent[] };
  readonly page?: { readonly totalElements?: number };
};

export class TicketmasterLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'ticketmaster',
        displayName: 'Ticketmaster Discovery',
        categories: Object.freeze(['EXPERIENCES']),
        consumerCategories: Object.freeze(['EXPERIENCES']),
        authenticationType: 'API_KEY_QUERY',
        termsClassification: 'FREE_API_KEY_REQUIRED',
        credentialEnvKey: 'TICKETMASTER_API_KEY',
        cacheTtlSeconds: 600,
        requiredCredential: (config) => config.ticketmasterApiKey !== null,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const params = new URLSearchParams({
      apikey: this.envConfig.ticketmasterApiKey!,
      size: String(Math.min(request.limit ?? 20, 50)),
    });
    if (request.query) params.set('keyword', request.query);
    if (request.city) params.set('city', request.city);
    if (request.country) params.set('countryCode', request.country);
    if (request.latitude !== undefined && request.longitude !== undefined) {
      params.set('latlong', `${request.latitude},${request.longitude}`);
      if (request.radiusKm) params.set('radius', String(Math.round(request.radiusKm)));
    }
    if (request.startDate) params.set('startDateTime', `${request.startDate}T00:00:00Z`);
    if (request.endDate) params.set('endDateTime', `${request.endDate}T23:59:59Z`);

    const cacheKey = `ticketmaster:${params.toString()}`;
    return this.withCache(cacheKey, 600, async () => {
      const response = await this.http.requestJson<TmSearchResponse>({
        providerId: this.providerId,
        method: 'GET',
        url: `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const events = response.data._embedded?.events ?? [];
      const offers = events.map((event) => {
        const venue = event._embedded?.venues?.[0];
        const classification = event.classifications?.[0];
        const priceRange = event.priceRanges?.[0];
        const image = event.images?.find((img) => img.ratio === '16_9') ?? event.images?.[0];
        const offerId = `tm_${event.id ?? Math.random()}`;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: event.url ?? null,
          retrievedAt,
          sourceTimestamp: event.dates?.start?.dateTime ?? null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        const priceMinorUnits =
          priceRange?.min !== undefined ? BigInt(Math.round(priceRange.min * 100)) : null;
        return this.buildOffer({
          offerId,
          category: 'EXPERIENCES',
          title: event.name ?? 'Event',
          description: classification?.genre?.name ?? classification?.segment?.name ?? null,
          location: venue?.name ?? null,
          city: venue?.city?.name ?? request.city ?? null,
          country: venue?.country?.countryCode ?? request.country ?? null,
          latitude: venue?.location?.latitude ? Number.parseFloat(venue.location.latitude) : null,
          longitude: venue?.location?.longitude ? Number.parseFloat(venue.location.longitude) : null,
          priceMinorUnits,
          currency: priceRange?.currency ?? 'USD',
          priceLabel:
            priceRange?.min !== undefined && priceRange?.max !== undefined
              ? `$${priceRange.min}-$${priceRange.max}`
              : null,
          imageUrl: image?.url ?? null,
          externalUrl: event.url ?? null,
          availability: 'AVAILABLE',
          metadata: Object.freeze({
            category: classification?.segment?.name ?? null,
            subcategory: classification?.genre?.name ?? null,
            startDate: event.dates?.start?.localDate ?? null,
            startTime: event.dates?.start?.localTime ?? null,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'ticketmaster-search',
        providerUrl: 'https://app.ticketmaster.com/discovery/v2/events.json',
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

export function createTicketmasterLiveAdapter(deps?: BaseLiveAdapterDeps): TicketmasterLiveAdapter {
  return new TicketmasterLiveAdapter(deps);
}
