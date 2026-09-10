/**
 * Shared helpers for live Access provider adapters.
 */

import { cacheAgeSeconds, readLiveProviderCache, writeLiveProviderCache } from '../cache.ts';
import { resolveLiveProviderEnvConfig, type LiveProviderEnvConfig } from '../config.ts';
import { LiveProviderHttpClient, type FetchLike } from '../http-client.ts';
import type {
  AccessLiveOffer,
  AccessOfferProvenance,
  LiveAccessProviderAdapter,
  LiveAccessProviderId,
  LiveIntegrationState,
  LiveProviderAdapterResult,
  LiveProviderHealth,
  LiveProviderRegistration,
  LiveProviderSearchRequest,
  LiveTransactionalState,
  TermsClassification,
  AuthenticationType,
} from '../types.ts';
import { toConsumerCategory, type AccessCapacityCategory, type ConsumerAccessCategory } from '../taxonomy.ts';

export type BaseLiveAdapterConfig = {
  readonly providerId: LiveAccessProviderId;
  readonly displayName: string;
  readonly categories: readonly AccessCapacityCategory[];
  readonly consumerCategories: readonly ConsumerAccessCategory[];
  readonly authenticationType: AuthenticationType;
  readonly termsClassification: TermsClassification;
  readonly credentialEnvKey: string | null;
  readonly optionalEnabledEnvKey?: string;
  readonly cacheTtlSeconds: number;
  readonly requiredCredential?: (config: LiveProviderEnvConfig) => boolean;
};

export type BaseLiveAdapterDeps = {
  readonly fetchFn?: FetchLike;
  readonly config?: LiveProviderEnvConfig;
  readonly nowUtc?: () => string;
};

export abstract class BaseLiveAccessAdapter implements LiveAccessProviderAdapter {
  readonly providerId: LiveAccessProviderId;
  protected readonly http: LiveProviderHttpClient;
  protected readonly envConfig: LiveProviderEnvConfig;
  protected readonly nowUtc: () => string;
  protected lastSuccessfulRead: string | null = null;
  protected lastError: string | null = null;
  private readonly adapterConfig: BaseLiveAdapterConfig;

  constructor(adapterConfig: BaseLiveAdapterConfig, deps: BaseLiveAdapterDeps = {}) {
    this.providerId = adapterConfig.providerId;
    this.adapterConfig = adapterConfig;
    this.envConfig = deps.config ?? resolveLiveProviderEnvConfig();
    this.http = new LiveProviderHttpClient({ fetchFn: deps.fetchFn });
    this.nowUtc = deps.nowUtc ?? (() => new Date().toISOString());
  }

  registration(): LiveProviderRegistration {
    const credentialConfigured = this.isCredentialConfigured();
    const integrationState = this.resolveIntegrationState(credentialConfigured);
    return Object.freeze({
      providerId: this.providerId,
      displayName: this.adapterConfig.displayName,
      categories: this.adapterConfig.categories,
      consumerCategories: this.adapterConfig.consumerCategories,
      capabilities: Object.freeze(['CATALOG_SEARCH', 'AVAILABILITY']),
      authenticationType: this.adapterConfig.authenticationType,
      integrationState,
      connectivityState: this.lastSuccessfulRead ? 'CONNECTED' : credentialConfigured ? 'UNKNOWN' : 'DISCONNECTED',
      transactionalState: 'READ_ONLY' as LiveTransactionalState,
      termsClassification: this.adapterConfig.termsClassification,
      credentialConfigured,
      transactionCapability: false,
      cacheTtlSeconds: this.adapterConfig.cacheTtlSeconds,
      lastSuccessfulRead: this.lastSuccessfulRead,
      lastError: this.lastError,
      healthMessage: this.healthMessage(integrationState, credentialConfigured),
    });
  }

  async health(): Promise<LiveProviderHealth> {
    const credentialConfigured = this.isCredentialConfigured();
    const integrationState = this.resolveIntegrationState(credentialConfigured);
    return Object.freeze({
      providerId: this.providerId,
      integrationState,
      connectivityState: this.lastSuccessfulRead ? 'CONNECTED' : credentialConfigured ? 'UNKNOWN' : 'DISCONNECTED',
      healthy: integrationState === 'LIVE_READ' || integrationState === 'FREE_PUBLIC',
      credentialConfigured,
      lastSuccessfulRead: this.lastSuccessfulRead,
      lastError: this.lastError,
      message: this.healthMessage(integrationState, credentialConfigured),
      checkedAt: this.nowUtc(),
    });
  }

  abstract search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>>;

  protected isCredentialConfigured(): boolean {
    if (this.adapterConfig.requiredCredential) {
      return this.adapterConfig.requiredCredential(this.envConfig);
    }
    if (!this.adapterConfig.credentialEnvKey) return true;
    const value = process.env[this.adapterConfig.credentialEnvKey];
    return typeof value === 'string' && value.trim().length > 0;
  }

  protected isOptionalEnabled(): boolean {
    if (!this.adapterConfig.optionalEnabledEnvKey) return true;
    const value = process.env[this.adapterConfig.optionalEnabledEnvKey];
    return value === 'true' || value === '1';
  }

  protected resolveIntegrationState(credentialConfigured: boolean): LiveIntegrationState {
    if (this.adapterConfig.optionalEnabledEnvKey && !this.isOptionalEnabled()) {
      return 'NOT_CONFIGURED';
    }
    if (!credentialConfigured && this.adapterConfig.authenticationType !== 'NONE') {
      return 'CONFIGURATION_REQUIRED';
    }
    if (this.lastError && !this.lastSuccessfulRead) {
      return 'ERROR';
    }
    if (this.lastSuccessfulRead) {
      return 'LIVE_READ';
    }
    if (this.adapterConfig.termsClassification === 'FREE_PUBLIC') {
      return credentialConfigured ? 'LIVE_READ' : 'FREE_PUBLIC';
    }
    return credentialConfigured ? 'LIVE_READ' : 'CONFIGURATION_REQUIRED';
  }

  protected healthMessage(integrationState: LiveIntegrationState, credentialConfigured: boolean): string {
    if (integrationState === 'NOT_CONFIGURED') return 'optional adapter disabled';
    if (!credentialConfigured && this.adapterConfig.authenticationType !== 'NONE') {
      return 'API key required';
    }
    if (this.lastError) return this.lastError;
    if (this.lastSuccessfulRead) return 'live read healthy';
    return 'awaiting first successful read';
  }

  protected buildProvenance(input: {
    providerRecordId: string;
    providerUrl: string | null;
    retrievedAt: string;
    sourceTimestamp: string | null;
    liveRead: boolean;
    simulation: boolean;
    stale: boolean;
  }): AccessOfferProvenance {
    return Object.freeze({
      providerId: this.providerId,
      providerRecordId: input.providerRecordId,
      providerUrl: input.providerUrl,
      retrievedAt: input.retrievedAt,
      sourceTimestamp: input.sourceTimestamp,
      cacheAgeSeconds: cacheAgeSeconds(input.retrievedAt),
      liveRead: input.liveRead,
      simulation: input.simulation,
      stale: input.stale,
    });
  }

  protected buildOffer(input: {
    offerId: string;
    category: AccessCapacityCategory;
    title: string;
    description: string | null;
    location: string | null;
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    priceMinorUnits: bigint | null;
    currency: string | null;
    priceLabel: string | null;
    imageUrl: string | null;
    externalUrl: string | null;
    availability: string | null;
    metadata: Readonly<Record<string, string | number | boolean | null>>;
    provenance: AccessOfferProvenance;
  }): AccessLiveOffer {
    return Object.freeze({
      offerId: input.offerId,
      providerId: this.providerId,
      displayName: this.adapterConfig.displayName,
      category: input.category,
      consumerCategory: toConsumerCategory(input.category),
      title: input.title,
      description: input.description,
      location: input.location,
      city: input.city,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
      priceMinorUnits: input.priceMinorUnits,
      currency: input.currency,
      priceLabel: input.priceLabel,
      imageUrl: input.imageUrl,
      externalUrl: input.externalUrl,
      availability: input.availability,
      metadata: input.metadata,
      provenance: input.provenance,
    });
  }

  protected async withCache<T>(
    cacheKey: string,
    ttlSeconds: number,
    loader: () => Promise<LiveProviderAdapterResult<T>>,
  ): Promise<LiveProviderAdapterResult<T>> {
    const cached = readLiveProviderCache<T>(cacheKey);
    if (cached) {
      const provenance = this.buildProvenance({
        providerRecordId: cacheKey,
        providerUrl: null,
        retrievedAt: cached.retrievedAt,
        sourceTimestamp: null,
        liveRead: true,
        simulation: false,
        stale: true,
      });
      return { ok: true, value: cached.value, provenance };
    }
    const result = await loader();
    if (result.ok) {
      writeLiveProviderCache(cacheKey, result.value, ttlSeconds, this.nowUtc());
    }
    return result;
  }

  protected fail(code: string, message: string): LiveProviderAdapterResult<never> {
    this.lastError = message;
    return { ok: false, code, message };
  }

  protected succeed<T>(value: T, provenance: AccessOfferProvenance): LiveProviderAdapterResult<T> {
    this.lastSuccessfulRead = provenance.retrievedAt;
    this.lastError = null;
    return { ok: true, value, provenance };
  }

  protected requireCredentials(): LiveProviderAdapterResult<never> | null {
    if (!this.isCredentialConfigured()) {
      return this.fail('CONFIGURATION_REQUIRED', `${this.providerId} API key not configured`);
    }
    if (this.adapterConfig.optionalEnabledEnvKey && !this.isOptionalEnabled()) {
      return this.fail('NOT_CONFIGURED', `${this.providerId} adapter is disabled`);
    }
    return null;
  }
}
