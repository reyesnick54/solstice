/**
 * SunReyProvider wrappers for Wave 5 productive-economy adapters.
 */

import type { SunReyProvider } from '../../../provider-sdk/src/contract.ts';
import { catalogEntryToDescriptor } from '../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import type { ProviderCapability, ProviderHealthStatus, ProviderRuntimeContext } from '../../../provider-sdk/src/types.ts';
import type { Wave5Adapter } from './adapters/base.ts';
import { WAVE5_CATALOG_ENTRIES, type Wave5AdapterId } from './catalog-entries.ts';

export type Wave5ProviderBundle = {
  readonly providerId: Wave5AdapterId;
  readonly provider: SunReyProvider;
  readonly adapter: Wave5Adapter;
  readonly catalogEntry: CatalogProviderEntry;
};

function catalogEntryFor(providerId: Wave5AdapterId): CatalogProviderEntry {
  const entry = WAVE5_CATALOG_ENTRIES.find((candidate) => candidate.provider_id === providerId);
  if (!entry) {
    throw new Error(`wave5 catalog entry missing for ${providerId}`);
  }
  return entry;
}

export function createWave5Provider(adapter: Wave5Adapter): Wave5ProviderBundle {
  const catalogEntry = catalogEntryFor(adapter.providerId);
  const descriptor = catalogEntryToDescriptor(catalogEntry, 'preview_only');

  const provider: SunReyProvider = Object.freeze({
    id: adapter.providerId,
    descriptor,
    async initialize(_context: ProviderRuntimeContext): Promise<void> {},
    async healthCheck(): Promise<ProviderHealthStatus> {
      return Object.freeze({
        providerId: adapter.providerId,
        state: 'healthy',
        status: 'ready',
        checkedAt: new Date().toISOString(),
        message: 'simulation fixture adapter',
        latencyMs: 1,
      });
    },
    getCapabilities(): readonly ProviderCapability[] {
      return catalogEntry.capabilities;
    },
    async shutdown(): Promise<void> {},
  });

  return Object.freeze({ providerId: adapter.providerId, provider, adapter, catalogEntry });
}

export function createAllWave5Providers(adapters: readonly Wave5Adapter[]): readonly Wave5ProviderBundle[] {
  return Object.freeze(adapters.map((adapter) => createWave5Provider(adapter)));
}
