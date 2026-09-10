/**
 * Access Live Provider Fabric Service — aggregates live read adapters safely.
 */

import { matchesCategoryFilter, CONSUMER_ACCESS_CATEGORIES, type ConsumerAccessCategory } from './taxonomy.ts';
import { createLiveProviderCapabilityRegistry, PARTNER_GATED_PROVIDER_STATUS, type LiveProviderCapabilityRegistry } from './registry.ts';
import type {
  AccessHomeFeed,
  AccessLiveOffer,
  LiveAccessProviderId,
  LiveProviderError,
  LiveProviderHealth,
  LiveProviderRegistration,
  LiveProviderSearchRequest,
  LiveProviderSearchResult,
} from './types.ts';
import type { BaseLiveAdapterDeps } from './adapters/base.ts';
import { CONSUMER_CATEGORY_LABELS } from './taxonomy.ts';

export type AccessLiveProviderFabricServiceOptions = {
  readonly registry?: LiveProviderCapabilityRegistry;
  readonly deps?: BaseLiveAdapterDeps;
  readonly nowUtc?: () => string;
};

export class AccessLiveProviderFabricService {
  readonly registry: LiveProviderCapabilityRegistry;
  private readonly nowUtc: () => string;

  constructor(options: AccessLiveProviderFabricServiceOptions = {}) {
    this.registry = options.registry ?? createLiveProviderCapabilityRegistry(options.deps);
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  listProviders(): readonly LiveProviderRegistration[] {
    return this.registry.listRegistrations();
  }

  listPartnerGatedProviders() {
    return PARTNER_GATED_PROVIDER_STATUS;
  }

  async getProviderHealth(providerId: LiveAccessProviderId): Promise<LiveProviderHealth | null> {
    const adapter = this.registry.get(providerId);
    if (!adapter) return null;
    return adapter.health();
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderSearchResult> {
    const adapters = request.providerId
      ? [this.registry.get(request.providerId)].filter(Boolean)
      : this.registry.list();

    const offers: AccessLiveOffer[] = [];
    const errors: LiveProviderError[] = [];

    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        if (!adapter) return;
        const outcome = await adapter.search(request);
        if (outcome.ok) {
          const filtered = outcome.value.filter((offer) =>
            matchesCategoryFilter(offer.category, request.category),
          );
          offers.push(...filtered);
        } else {
          errors.push(
            Object.freeze({
              providerId: adapter.providerId,
              code: outcome.code,
              message: outcome.message,
              integrationState: adapter.registration().integrationState,
            }),
          );
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(
          Object.freeze({
            providerId: 'unknown',
            code: 'UNEXPECTED_ERROR',
            message: result.reason instanceof Error ? result.reason.message : 'unexpected error',
            integrationState: 'ERROR',
          }),
        );
      }
    }

    const liveOffers = offers.filter((offer) => offer.provenance.liveRead && !offer.provenance.simulation);
    return Object.freeze({
      requestId: request.requestId,
      offers: Object.freeze(liveOffers),
      providerErrors: Object.freeze(errors),
      retrievedAt: this.nowUtc(),
    });
  }

  async getOffer(providerId: LiveAccessProviderId, offerId: string): Promise<AccessLiveOffer | null> {
    const adapter = this.registry.get(providerId);
    if (!adapter?.getOffer) {
      const search = await this.search({
        requestId: `offer_${offerId}`,
        providerId,
        limit: 100,
      });
      return search.offers.find((offer) => offer.offerId === offerId) ?? null;
    }
    const outcome = await adapter.getOffer(offerId);
    return outcome.ok ? outcome.value : null;
  }

  async buildHomeFeed(input?: {
    readonly latitude?: number;
    readonly longitude?: number;
    readonly city?: string;
    readonly country?: string;
    readonly limit?: number;
  }): Promise<AccessHomeFeed> {
    const requestId = `home_${this.nowUtc()}`;
    const searchBase: LiveProviderSearchRequest = {
      requestId,
      limit: input?.limit ?? 20,
      ...(input?.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input?.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input?.city ? { city: input.city } : {}),
      ...(input?.country ? { country: input.country } : {}),
    };

    const [searchResult, providerStatus] = await Promise.all([
      this.search(searchBase),
      Promise.resolve(this.listProviders()),
    ]);

    const liveOffers = searchResult.offers;
    const categoryCounts = new Map<ConsumerAccessCategory, { offerCount: number; liveCount: number }>();
    for (const category of CONSUMER_ACCESS_CATEGORIES) {
      categoryCounts.set(category, { offerCount: 0, liveCount: 0 });
    }
    for (const offer of liveOffers) {
      const row = categoryCounts.get(offer.consumerCategory);
      if (row) {
        row.offerCount += 1;
        if (offer.provenance.liveRead) row.liveCount += 1;
      }
    }

    const configuredProviderCount = providerStatus.filter((p) => p.credentialConfigured || p.integrationState === 'FREE_PUBLIC').length;
    const liveProviderCount = providerStatus.filter((p) => p.integrationState === 'LIVE_READ').length;
    const unavailableProviderCount = providerStatus.length - liveProviderCount;

    return Object.freeze({
      schema: 'sunrey.consumer.access.home.v2',
      generatedAt: this.nowUtc(),
      liveProviderCount,
      configuredProviderCount,
      unavailableProviderCount,
      categories: Object.freeze(
        CONSUMER_ACCESS_CATEGORIES.map((category) =>
          Object.freeze({
            category,
            label: CONSUMER_CATEGORY_LABELS[category],
            offerCount: categoryCounts.get(category)?.offerCount ?? 0,
            liveCount: categoryCounts.get(category)?.liveCount ?? 0,
          }),
        ),
      ),
      featuredOffers: Object.freeze(liveOffers.slice(0, 8)),
      nearby: Object.freeze(
        liveOffers.filter((o) => o.latitude !== null && o.longitude !== null).slice(0, 10),
      ),
      experiences: Object.freeze(liveOffers.filter((o) => o.consumerCategory === 'EXPERIENCES').slice(0, 10)),
      compute: Object.freeze(liveOffers.filter((o) => o.consumerCategory === 'COMPUTE_AI').slice(0, 10)),
      goods: Object.freeze(liveOffers.filter((o) => o.consumerCategory === 'GOODS').slice(0, 10)),
      energy: Object.freeze(liveOffers.filter((o) => o.consumerCategory === 'ENERGY').slice(0, 10)),
      providerStatus,
    });
  }

  async providerStatusMatrix(): Promise<readonly LiveProviderRegistration[]> {
    return this.listProviders();
  }
}

export function createAccessLiveProviderFabricService(
  options?: AccessLiveProviderFabricServiceOptions,
): AccessLiveProviderFabricService {
  return new AccessLiveProviderFabricService(options);
}
