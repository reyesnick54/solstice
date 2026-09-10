/**
 * eBay Browse API — read-only item discovery, no checkout.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type EbayTokenResponse = {
  readonly access_token?: string;
  readonly expires_in?: number;
};

type EbayItem = {
  readonly itemId?: string;
  readonly title?: string;
  readonly image?: { readonly imageUrl?: string };
  readonly condition?: string;
  readonly price?: { readonly value?: string; readonly currency?: string };
  readonly seller?: { readonly username?: string };
  readonly shippingOptions?: readonly { readonly shippingCost?: { readonly value?: string } }[];
  readonly itemLocation?: { readonly city?: string; readonly country?: string };
  readonly itemWebUrl?: string;
  readonly categories?: readonly { readonly categoryName?: string }[];
  readonly estimatedAvailabilities?: readonly { readonly estimatedAvailabilityStatus?: string }[];
};

type EbaySearchResponse = {
  readonly itemSummaries?: readonly EbayItem[];
  readonly total?: number;
};

let cachedEbayToken: { token: string; expiresAtMs: number } | null = null;

export class EbayLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'ebay',
        displayName: 'eBay',
        categories: Object.freeze(['GOODS']),
        consumerCategories: Object.freeze(['GOODS']),
        authenticationType: 'OAUTH_CLIENT_CREDENTIALS',
        termsClassification: 'FREE_API_KEY_REQUIRED',
        credentialEnvKey: 'EBAY_CLIENT_ID',
        cacheTtlSeconds: 180,
        requiredCredential: (config) => config.ebayClientId !== null && config.ebayClientSecret !== null,
      },
      deps,
    );
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.envConfig.ebayClientId || !this.envConfig.ebayClientSecret) return null;
    if (cachedEbayToken && Date.now() < cachedEbayToken.expiresAtMs) {
      return cachedEbayToken.token;
    }
    const credentials = Buffer.from(`${this.envConfig.ebayClientId}:${this.envConfig.ebayClientSecret}`).toString('base64');
    const response = await this.http.requestJson<EbayTokenResponse>({
      providerId: this.providerId,
      method: 'POST',
      url: 'https://api.ebay.com/identity/v1/oauth2/token',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    if (!response.ok || !response.data.access_token) return null;
    cachedEbayToken = {
      token: response.data.access_token,
      expiresAtMs: Date.now() + ((response.data.expires_in ?? 7200) - 60) * 1000,
    };
    return cachedEbayToken.token;
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const token = await this.getAccessToken();
    if (!token) {
      return this.fail('AUTH_FAILED', 'eBay OAuth token acquisition failed');
    }

    const params = new URLSearchParams({
      q: request.query ?? 'electronics',
      limit: String(Math.min(request.limit ?? 20, 50)),
    });
    const cacheKey = `ebay:${params.toString()}`;
    return this.withCache(cacheKey, 180, async () => {
      const response = await this.http.requestJson<EbaySearchResponse>({
        providerId: this.providerId,
        method: 'GET',
        url: `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': this.envConfig.ebayMarketplaceId,
        },
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const items = response.data.itemSummaries ?? [];
      const offers = items.map((item) => {
        const offerId = `ebay_${item.itemId ?? Math.random()}`;
        const priceValue = item.price?.value ? Number(item.price.value) : null;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: item.itemWebUrl ?? null,
          retrievedAt,
          sourceTimestamp: null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        return this.buildOffer({
          offerId,
          category: 'GOODS',
          title: item.title ?? 'eBay Item',
          description: item.condition ?? null,
          location: [item.itemLocation?.city, item.itemLocation?.country].filter(Boolean).join(', ') || null,
          city: item.itemLocation?.city ?? null,
          country: item.itemLocation?.country ?? null,
          latitude: null,
          longitude: null,
          priceMinorUnits: priceValue !== null ? BigInt(Math.round(priceValue * 100)) : null,
          currency: item.price?.currency ?? 'USD',
          priceLabel: item.price?.value ? `${item.price.currency ?? 'USD'} ${item.price.value}` : null,
          imageUrl: item.image?.imageUrl ?? null,
          externalUrl: item.itemWebUrl ?? null,
          availability: item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus ?? 'AVAILABLE',
          metadata: Object.freeze({
            itemId: item.itemId ?? null,
            condition: item.condition ?? null,
            seller: item.seller?.username ?? null,
            shippingCost: item.shippingOptions?.[0]?.shippingCost?.value ?? null,
            category: item.categories?.[0]?.categoryName ?? null,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'ebay-search',
        providerUrl: 'https://api.ebay.com/buy/browse/v1/item_summary/search',
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

export function createEbayLiveAdapter(deps?: BaseLiveAdapterDeps): EbayLiveAdapter {
  return new EbayLiveAdapter(deps);
}

export function resetEbayTokenCache(): void {
  cachedEbayToken = null;
}
