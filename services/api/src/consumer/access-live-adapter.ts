/**
 * Consumer BFF adapter for Access Live Provider Fabric.
 * Orchestration only — live reads stay server-side with provenance.
 */

import { ACCESS_POSTURE } from '../../../../packages/human-access-economy/src/taxonomy.ts';
import {
  createAccessLiveProviderFabricService,
  type AccessLiveProviderFabricService,
} from '../../../../packages/external-data/src/access-live/fabric-service.ts';
import type { AccessLiveOffer, LiveAccessProviderId } from '../../../../packages/external-data/src/access-live/types.ts';
import type { ConsumerAccessCategory } from '../../../../packages/external-data/src/access-live/taxonomy.ts';

export type AccessLiveSearchInput = {
  readonly query?: string;
  readonly category?: string;
  readonly providerId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly radiusKm?: number;
  readonly city?: string;
  readonly country?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly currency?: string;
  readonly limit?: number;
};

export type AccessLiveHomeInput = {
  readonly latitude?: number;
  readonly longitude?: number;
  readonly city?: string;
  readonly country?: string;
  readonly limit?: number;
};

export type AccessLiveBff = {
  readonly home: (input?: AccessLiveHomeInput) => Promise<unknown>;
  readonly search: (input: AccessLiveSearchInput) => Promise<unknown>;
  readonly providerHealth: (providerId: string) => Promise<unknown>;
  readonly providerStatus: () => Promise<unknown>;
};

function serializeLiveOffer(offer: AccessLiveOffer) {
  return Object.freeze({
    ...offer,
    priceMinorUnits: offer.priceMinorUnits?.toString() ?? null,
  });
}

export function createAccessLiveBff(
  fabric: AccessLiveProviderFabricService = createAccessLiveProviderFabricService(),
): AccessLiveBff {
  return Object.freeze({
    async home(input: AccessLiveHomeInput = {}) {
      const feed = await fabric.buildHomeFeed(input);
      return Object.freeze({
        schema: feed.schema,
        ...ACCESS_POSTURE,
        ...feed,
        featuredOffers: feed.featuredOffers.map(serializeLiveOffer),
        nearby: feed.nearby.map(serializeLiveOffer),
        experiences: feed.experiences.map(serializeLiveOffer),
        compute: feed.compute.map(serializeLiveOffer),
        goods: feed.goods.map(serializeLiveOffer),
        energy: feed.energy.map(serializeLiveOffer),
      });
    },

    async search(input: AccessLiveSearchInput) {
      const result = await fabric.search({
        requestId: `live_search_${Date.now()}`,
        ...(input.query !== undefined ? { query: input.query } : {}),
        ...(input.category !== undefined ? { category: input.category as ConsumerAccessCategory } : {}),
        ...(input.providerId !== undefined ? { providerId: input.providerId as LiveAccessProviderId } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.radiusKm !== undefined ? { radiusKm: input.radiusKm } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
        ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      });
      return Object.freeze({
        schema: 'sunrey.consumer.access.live-search.v1',
        ...ACCESS_POSTURE,
        requestId: result.requestId,
        retrievedAt: result.retrievedAt,
        items: result.offers.map(serializeLiveOffer),
        providerErrors: result.providerErrors,
      });
    },

    async providerHealth(providerId: string) {
      const health = await fabric.getProviderHealth(providerId as LiveAccessProviderId);
      if (!health) {
        return Object.freeze({
          ok: false as const,
          error: Object.freeze({ code: 'NOT_FOUND', message: 'live provider not found' }),
        });
      }
      return Object.freeze({
        ok: true as const,
        value: Object.freeze({
          schema: 'sunrey.consumer.access.provider-health.v1',
          ...ACCESS_POSTURE,
          ...health,
        }),
      });
    },

    async providerStatus() {
      const status = await fabric.providerStatusMatrix();
      return Object.freeze({
        schema: 'sunrey.consumer.access.provider-status.v1',
        ...ACCESS_POSTURE,
        items: status,
        partnerGated: fabric.listPartnerGatedProviders(),
      });
    },
  });
}
