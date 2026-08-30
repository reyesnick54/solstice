/**
 * SunReyProvider wrappers for macro adapters — ProviderRegistry registration.
 */

import type { SunReyProvider } from '../../../provider-sdk/src/contract.ts';
import { catalogEntryToDescriptor } from '../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import type {
  ProviderCapability,
  ProviderHealthStatus,
  ProviderRuntimeContext,
} from '../../../provider-sdk/src/types.ts';
import type { MacroCatalogProviderId } from './catalog-entries.ts';
import { MACRO_CATALOG_ENTRIES } from './catalog-entries.ts';
import type { MacroAdapter } from './adapters/base.ts';

export type MacroProviderBundle = {
  readonly providerId: MacroCatalogProviderId;
  readonly provider: SunReyProvider;
  readonly adapter: MacroAdapter;
  readonly catalogEntry: CatalogProviderEntry;
};

function catalogEntryFor(providerId: MacroCatalogProviderId): CatalogProviderEntry {
  const entry = MACRO_CATALOG_ENTRIES.find((candidate) => candidate.provider_id === providerId);
  if (!entry) {
    throw new Error(`macro catalog entry missing for ${providerId}`);
  }
  return entry;
}

export function createMacroProvider(adapter: MacroAdapter): MacroProviderBundle {
  const catalogEntry = catalogEntryFor(adapter.providerId);
  const descriptor = catalogEntryToDescriptor(catalogEntry, 'preview_only');
  let initialized = false;

  const provider: SunReyProvider = Object.freeze({
    id: adapter.providerId,
    descriptor,
    async initialize(_context: ProviderRuntimeContext): Promise<void> {
      initialized = true;
    },
    async healthCheck(): Promise<ProviderHealthStatus> {
      return adapter.healthCheck();
    },
    getCapabilities(): readonly ProviderCapability[] {
      return catalogEntry.capabilities;
    },
    async shutdown(): Promise<void> {
      initialized = false;
    },
  });

  return Object.freeze({
    providerId: adapter.providerId,
    provider,
    adapter,
    catalogEntry,
  });
}

export function createAllMacroProviders(adapters: readonly MacroAdapter[]): readonly MacroProviderBundle[] {
  return Object.freeze(adapters.map((adapter) => createMacroProvider(adapter)));
}
