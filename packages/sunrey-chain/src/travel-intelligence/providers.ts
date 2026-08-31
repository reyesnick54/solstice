/**
 * SunReyProvider wrappers for travel adapters — ProviderRegistry registration.
 */

import type { SunReyProvider } from '../../../provider-sdk/src/contract.ts';
import { catalogEntryToDescriptor } from '../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import type { ProviderCapability, ProviderHealthStatus, ProviderRuntimeContext } from '../../../provider-sdk/src/types.ts';
import type { TravelProvider } from './adapters/base.ts';
import { catalogEntryForProvider } from './catalog-entries.ts';
import type { TravelAdapterId } from './types.ts';

export type TravelProviderBundle = {
  readonly providerId: TravelAdapterId;
  readonly provider: SunReyProvider;
  readonly adapter: TravelProvider;
  readonly catalogEntry: CatalogProviderEntry;
};

export function createTravelProvider(adapter: TravelProvider): TravelProviderBundle {
  const catalogEntry = catalogEntryForProvider(adapter.providerId);
  if (!catalogEntry) {
    throw new Error(`travel catalog entry missing for ${adapter.providerId}`);
  }
  const descriptor = catalogEntryToDescriptor(catalogEntry, 'preview_only');

  const provider: SunReyProvider = Object.freeze({
    id: adapter.providerId,
    descriptor,
    async initialize(_context: ProviderRuntimeContext): Promise<void> {
      /* fixture */
    },
    async healthCheck(): Promise<ProviderHealthStatus> {
      const health = adapter.health();
      return Object.freeze({
        providerId: adapter.providerId,
        state: health.healthy ? (health.degraded ? 'degraded' : 'healthy') : 'unhealthy',
        status: health.healthy ? 'ready' : 'unhealthy',
        checkedAt: new Date().toISOString(),
        message: health.message,
        latencyMs: null,
      });
    },
    getCapabilities(): readonly ProviderCapability[] {
      return adapter.capabilities;
    },
    async shutdown(): Promise<void> {
      /* fixture */
    },
  });

  return Object.freeze({
    providerId: adapter.providerId,
    provider,
    adapter,
    catalogEntry,
  });
}

export function createAllTravelProviders(
  adapters: readonly TravelProvider[],
): readonly TravelProviderBundle[] {
  return Object.freeze(adapters.map((adapter) => createTravelProvider(adapter)));
}
