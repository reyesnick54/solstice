/**
 * SunRey Access Live Provider Fabric — canonical types.
 *
 * Read-only external provider integration for Internal Alpha.
 * transactionCapability is always false for live read adapters.
 */

import type { AccessCapacityCategory, ConsumerAccessCategory } from './taxonomy.ts';

export const LIVE_ACCESS_PROVIDER_IDS = [
  'vast-ai',
  'ticketmaster',
  'eia',
  'open-charge-map',
  'ebay',
  'google-places',
  'yelp',
  'coingecko',
  'fred',
  'world-bank',
  'bls',
  'imf',
  'frankfurter',
  'sec-edgar',
  'us-treasury',
  'federal-register',
] as const;
export type LiveAccessProviderId = (typeof LIVE_ACCESS_PROVIDER_IDS)[number];

export const LIVE_INTEGRATION_STATES = [
  'LIVE_READ',
  'CONFIGURATION_REQUIRED',
  'FREE_PUBLIC',
  'FREE_API_KEY_REQUIRED',
  'FREE_USAGE_TIER',
  'SANDBOX',
  'PARTNER_APPROVAL_REQUIRED',
  'TRIAL_OR_PAID',
  'PAID_PROVIDER',
  'UNAVAILABLE',
  'ERROR',
  'STALE',
  'NOT_CONFIGURED',
  'DISABLED',
] as const;
export type LiveIntegrationState = (typeof LIVE_INTEGRATION_STATES)[number];

export const LIVE_CONNECTIVITY_STATES = [
  'CONNECTED',
  'DEGRADED',
  'DISCONNECTED',
  'UNKNOWN',
] as const;
export type LiveConnectivityState = (typeof LIVE_CONNECTIVITY_STATES)[number];

export const LIVE_TRANSACTIONAL_STATES = [
  'READ_ONLY',
  'TRANSACTIONAL_DISABLED',
  'PARTNER_REQUIRED',
] as const;
export type LiveTransactionalState = (typeof LIVE_TRANSACTIONAL_STATES)[number];

export const TERMS_CLASSIFICATIONS = [
  'FREE_PUBLIC',
  'FREE_API_KEY_REQUIRED',
  'FREE_USAGE_TIER',
  'TRIAL_OR_PAID',
  'PAID_PROVIDER',
  'PARTNER_APPROVAL_REQUIRED',
  'SANDBOX',
  'REFERENCE_DATA',
  'BILLING_ACCOUNT_REQUIRED',
] as const;
export type TermsClassification = (typeof TERMS_CLASSIFICATIONS)[number];

export const AUTHENTICATION_TYPES = [
  'NONE',
  'API_KEY_HEADER',
  'API_KEY_QUERY',
  'BEARER',
  'OAUTH_CLIENT_CREDENTIALS',
  'OPTIONAL_API_KEY',
] as const;
export type AuthenticationType = (typeof AUTHENTICATION_TYPES)[number];

export type AccessOfferProvenance = {
  readonly providerId: LiveAccessProviderId | string;
  readonly providerRecordId: string;
  readonly providerUrl: string | null;
  readonly retrievedAt: string;
  readonly sourceTimestamp: string | null;
  readonly cacheAgeSeconds: number;
  readonly liveRead: boolean;
  readonly simulation: boolean;
  readonly stale: boolean;
};

export type AccessLiveOffer = {
  readonly offerId: string;
  readonly providerId: LiveAccessProviderId | string;
  readonly displayName: string;
  readonly category: AccessCapacityCategory;
  readonly consumerCategory: ConsumerAccessCategory;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly priceMinorUnits: bigint | null;
  readonly currency: string | null;
  readonly priceLabel: string | null;
  readonly imageUrl: string | null;
  readonly externalUrl: string | null;
  readonly availability: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly provenance: AccessOfferProvenance;
};

export type LiveProviderSearchRequest = {
  readonly requestId: string;
  readonly query?: string;
  readonly category?: AccessCapacityCategory | ConsumerAccessCategory;
  readonly providerId?: LiveAccessProviderId;
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
  readonly simulation?: boolean;
};

export type LiveProviderSearchResult = {
  readonly requestId: string;
  readonly offers: readonly AccessLiveOffer[];
  readonly providerErrors: readonly LiveProviderError[];
  readonly retrievedAt: string;
};

export type LiveProviderError = {
  readonly providerId: LiveAccessProviderId | string;
  readonly code: string;
  readonly message: string;
  readonly integrationState: LiveIntegrationState;
};

export type LiveProviderRegistration = {
  readonly providerId: LiveAccessProviderId;
  readonly displayName: string;
  readonly categories: readonly AccessCapacityCategory[];
  readonly consumerCategories: readonly ConsumerAccessCategory[];
  readonly capabilities: readonly string[];
  readonly authenticationType: AuthenticationType;
  readonly integrationState: LiveIntegrationState;
  readonly connectivityState: LiveConnectivityState;
  readonly transactionalState: LiveTransactionalState;
  readonly termsClassification: TermsClassification;
  readonly credentialConfigured: boolean;
  readonly transactionCapability: false;
  readonly cacheTtlSeconds: number;
  readonly lastSuccessfulRead: string | null;
  readonly lastError: string | null;
  readonly healthMessage: string;
};

export type LiveProviderHealth = {
  readonly providerId: LiveAccessProviderId;
  readonly integrationState: LiveIntegrationState;
  readonly connectivityState: LiveConnectivityState;
  readonly healthy: boolean;
  readonly credentialConfigured: boolean;
  readonly lastSuccessfulRead: string | null;
  readonly lastError: string | null;
  readonly message: string;
  readonly checkedAt: string;
};

export type LiveProviderAdapterResult<T> =
  | { readonly ok: true; readonly value: T; readonly provenance: AccessOfferProvenance }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type LiveAccessProviderAdapter = {
  readonly providerId: LiveAccessProviderId;
  readonly registration: () => LiveProviderRegistration;
  readonly health: () => Promise<LiveProviderHealth>;
  readonly search: (request: LiveProviderSearchRequest) => Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>>;
  readonly getOffer?: (offerId: string) => Promise<LiveProviderAdapterResult<AccessLiveOffer>>;
};

export type AccessHomeFeed = {
  readonly schema: 'sunrey.consumer.access.home.v2';
  readonly generatedAt: string;
  readonly liveProviderCount: number;
  readonly configuredProviderCount: number;
  readonly unavailableProviderCount: number;
  readonly categories: readonly {
    readonly category: ConsumerAccessCategory;
    readonly label: string;
    readonly offerCount: number;
    readonly liveCount: number;
  }[];
  readonly featuredOffers: readonly AccessLiveOffer[];
  readonly nearby: readonly AccessLiveOffer[];
  readonly experiences: readonly AccessLiveOffer[];
  readonly compute: readonly AccessLiveOffer[];
  readonly goods: readonly AccessLiveOffer[];
  readonly energy: readonly AccessLiveOffer[];
  readonly providerStatus: readonly LiveProviderRegistration[];
};
