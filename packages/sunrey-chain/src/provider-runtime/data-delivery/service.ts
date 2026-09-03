/**
 * Stale-while-revalidate provider data delivery orchestration.
 */

import { buildCacheKey } from './keys.ts';
import { assessCacheFreshness, InMemoryProviderDataCache, isObservationStructurallyValid } from './cache.ts';
import { resolveCachePolicy } from './policies.ts';
import { InMemoryObservationPersistence, toPersistedRecord } from './persistence.ts';
import { SingleFlightCoordinator } from './single-flight.ts';
import type {
  CachedObservationEnvelope,
  DataDeliveryClock,
  ObservationPersistenceStore,
  ProviderDataCache,
  ProviderFetchFn,
  ProviderFetchResult,
  RefreshFailureRecord,
} from './types.ts';

export type DataDeliveryResult = {
  readonly envelope: CachedObservationEnvelope;
  readonly source: 'cache_fresh' | 'cache_stale' | 'provider_fetch' | 'cache_retained_on_failure';
  readonly backgroundRefreshTriggered: boolean;
};

export class ProviderDataDeliveryService {
  private readonly cache: ProviderDataCache;
  private readonly persistence: ObservationPersistenceStore;
  private readonly clock: DataDeliveryClock;
  private readonly fetchFn: ProviderFetchFn;
  private readonly singleFlight: SingleFlightCoordinator<ProviderFetchResult>;
  private readonly failureRecords: RefreshFailureRecord[] = [];
  private readonly backgroundRefreshes: string[] = [];

  constructor(input: {
    readonly cache?: ProviderDataCache | undefined;
    readonly persistence?: ObservationPersistenceStore | undefined;
    readonly clock: DataDeliveryClock;
    readonly fetchFn: ProviderFetchFn;
  }) {
    this.cache = input.cache ?? new InMemoryProviderDataCache(input.clock);
    this.persistence = input.persistence ?? new InMemoryObservationPersistence();
    this.clock = input.clock;
    this.fetchFn = input.fetchFn;
    this.singleFlight = new SingleFlightCoordinator();
  }

  async get(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly resourceId: string;
  }): Promise<DataDeliveryResult | undefined> {
    const policy = resolveCachePolicy(input.capability);
    const key = buildCacheKey(input);
    const cached = await this.cache.get(key);
    const meta = await this.cache.getMetadata(key);

    if (cached && cached.freshness === 'FRESH') {
      return Object.freeze({
        envelope: cached,
        source: 'cache_fresh',
        backgroundRefreshTriggered: false,
      });
    }

    if (cached && meta) {
      const nowMs = this.clock.nowMs();
      const swrEnd = Date.parse(meta.expiresAtUtc);
      const hardExpire = Date.parse(meta.hardExpireAtUtc);
      if (nowMs < swrEnd) {
        this.triggerBackgroundRefresh(input, key, policy);
        return Object.freeze({
          envelope: { ...cached, stale: true, freshness: 'STALE_USABLE' as const },
          source: 'cache_stale' as const,
          backgroundRefreshTriggered: true,
        });
      }
      if (nowMs < hardExpire) {
        const fetched = await this.fetchAndMaybeCache(input, key, policy, false);
        if (fetched) {
          return Object.freeze({
            envelope: fetched,
            source: 'provider_fetch',
            backgroundRefreshTriggered: false,
          });
        }
        return Object.freeze({
          envelope: { ...cached, stale: true, freshness: 'STALE_USABLE' as const },
          source: 'cache_retained_on_failure' as const,
          backgroundRefreshTriggered: false,
        });
      }
    }

    const fetched = await this.fetchAndMaybeCache(input, key, policy, true);
    if (!fetched) {
      return undefined;
    }
    return Object.freeze({
      envelope: fetched,
      source: 'provider_fetch',
      backgroundRefreshTriggered: false,
    });
  }

  async refresh(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly resourceId: string;
  }): Promise<CachedObservationEnvelope | undefined> {
    const policy = resolveCachePolicy(input.capability);
    const key = buildCacheKey(input);
    return this.fetchAndMaybeCache(input, key, policy, false);
  }

  failures(): readonly RefreshFailureRecord[] {
    return Object.freeze([...this.failureRecords]);
  }

  backgroundRefreshKeys(): readonly string[] {
    return Object.freeze([...this.backgroundRefreshes]);
  }

  singleFlightInflightCount(): number {
    return this.singleFlight.inflightCount();
  }

  private triggerBackgroundRefresh(
    input: { readonly providerId: string; readonly capability: string; readonly resourceId: string },
    key: string,
    policy: ReturnType<typeof resolveCachePolicy>,
  ): void {
    if (this.backgroundRefreshes.includes(key)) {
      return;
    }
    this.backgroundRefreshes.push(key);
    void this.fetchAndMaybeCache(input, key, policy, false).finally(() => {
      const idx = this.backgroundRefreshes.indexOf(key);
      if (idx >= 0) {
        this.backgroundRefreshes.splice(idx, 1);
      }
    });
  }

  private async fetchAndMaybeCache(
    input: { readonly providerId: string; readonly capability: string; readonly resourceId: string },
    key: string,
    policy: ReturnType<typeof resolveCachePolicy>,
    recordFailureWhenEmpty: boolean,
  ): Promise<CachedObservationEnvelope | undefined> {
    const flightKey = key;
    const result = await this.singleFlight.run(flightKey, () =>
      this.fetchFn({
        providerId: input.providerId,
        capability: input.capability,
        resourceId: input.resourceId,
      }),
    );

    if (!result.ok) {
      const meta = await this.cache.getMetadata(key);
      const retained = meta !== undefined && assessCacheFreshness(meta, this.clock.nowMs()) !== 'EXPIRED';
      this.failureRecords.push(
        Object.freeze({
          providerId: input.providerId,
          capability: input.capability,
          resourceId: input.resourceId,
          failedAtUtc: this.clock.nowUtc(),
          errorSafe: result.errorSafe,
          retainedCached: retained,
        }),
      );
      if (recordFailureWhenEmpty && !retained) {
        return undefined;
      }
      return undefined;
    }

    if (!isObservationStructurallyValid(result.observation)) {
      const meta = await this.cache.getMetadata(key);
      const retained = meta !== undefined;
      this.failureRecords.push(
        Object.freeze({
          providerId: input.providerId,
          capability: input.capability,
          resourceId: input.resourceId,
          failedAtUtc: this.clock.nowUtc(),
          errorSafe: 'invalid provider payload',
          retainedCached: retained,
        }),
      );
      return retained ? await this.cache.get(key) : undefined;
    }

    await this.cache.set(key, result.observation, policy, result.rawPayload);
    if (policy.persistNormalized) {
      await this.persistence.persist(
        toPersistedRecord({
          observation: result.observation,
          policy,
          persistedAtUtc: this.clock.nowUtc(),
          rawPayload: result.rawPayload,
        }),
      );
      await this.persistence.cleanup({ nowUtc: this.clock.nowUtc(), policy });
    }
    return await this.cache.get(key);
  }
}
