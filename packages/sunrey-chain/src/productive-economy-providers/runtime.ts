/**
 * Wave 5 productive-economy provider runtime.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import {
  buildCatalogIndex,
  createProviderRegistry,
  type ProviderRegistry,
} from '../../../provider-sdk/src/index.ts';
import { WAVE5_ADAPTER_IDS, WAVE5_CATALOG_ENTRIES } from './catalog-entries.ts';
import { createWave5Adapter, type Wave5Adapter, type Wave5AdapterContext } from './adapters/base.ts';
import { createAllWave5Providers } from './providers.ts';
import { createProductiveEconomyServices, type ProductiveEconomicIndexFoundation } from './services.ts';

export type ProductiveEconomyRuntimeMode = 'simulation' | 'live';

export type ProductiveEconomyProviderRuntime = {
  readonly mode: ProductiveEconomyRuntimeMode;
  readonly registry: ProviderRegistry;
  readonly adapters: ReadonlyMap<string, Wave5Adapter>;
  readonly services: ReturnType<typeof createProductiveEconomyServices>;
  readonly index: ProductiveEconomicIndexFoundation;
};

export type ProductiveEconomyRuntimeOptions = {
  readonly mode?: ProductiveEconomyRuntimeMode;
  readonly nowUtc?: () => string;
  readonly adapterContext?: Partial<Wave5AdapterContext>;
};

export function assertNoLiveNetwork(mode: ProductiveEconomyRuntimeMode): void {
  if (mode === 'live' && ENVIRONMENT === 'simulation') {
    throw new Error('live productive-economy provider network access is blocked while ENVIRONMENT=simulation');
  }
}

export function createProductiveEconomyRuntime(
  options: ProductiveEconomyRuntimeOptions = {},
): ProductiveEconomyProviderRuntime {
  const mode = options.mode ?? 'simulation';
  assertNoLiveNetwork(mode);

  const nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  const ctx: Wave5AdapterContext = {
    nowUtc,
    simulationOnly: mode === 'simulation',
    ...options.adapterContext,
  };

  const catalog = buildCatalogIndex({
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [...WAVE5_CATALOG_ENTRIES],
  });

  const registry = createProviderRegistry({ catalogIndex: catalog });
  const adapters = new Map<string, Wave5Adapter>();

  for (const providerId of WAVE5_ADAPTER_IDS) {
    adapters.set(providerId, createWave5Adapter(providerId, ctx));
  }

  const bundles = createAllWave5Providers([...adapters.values()]);
  for (const bundle of bundles) {
    registry.register(bundle.provider, {
      activationMode: mode === 'simulation' ? 'preview_only' : 'enabled',
      credentialAvailable: mode === 'simulation',
      featureFlagEnabled: true,
    });
  }

  const services = createProductiveEconomyServices(ctx);

  return Object.freeze({
    mode,
    registry,
    adapters,
    services,
    index: services.index,
  });
}

export { WAVE5_ADAPTER_IDS };
