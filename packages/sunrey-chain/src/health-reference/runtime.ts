/**
 * Health reference runtime — catalog-backed provider registration.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import { buildCatalogIndex, createProviderRegistry, type ProviderRegistry } from '../../../provider-sdk/src/index.ts';
import { createWave6FixtureProviders } from './adapters/fixture-adapters.ts';
import type { HealthProvider } from './adapters/base.ts';
import { HEALTH_CATALOG_ENTRIES } from './catalog-entries.ts';
import { HealthReferenceCache } from './cache.ts';
import { createAllHealthProviders } from './providers.ts';
import { HealthReferenceService } from './service.ts';
import { HEALTH_ADAPTER_IDS, type HealthAdapterId } from './types.ts';

export type HealthProviderRuntimeMode = 'simulation' | 'live';

export type HealthProviderRuntime = {
  readonly mode: HealthProviderRuntimeMode;
  readonly registry: ProviderRegistry;
  readonly providers: Readonly<Record<HealthAdapterId, HealthProvider>>;
  readonly cache: HealthReferenceCache;
  readonly service: HealthReferenceService;
};

export function assertNoLiveHealthNetwork(mode: HealthProviderRuntimeMode): void {
  if (mode === 'live' && ENVIRONMENT === 'simulation') {
    throw new Error('live health provider network access is blocked while ENVIRONMENT=simulation');
  }
}

export function createHealthProviderRuntime(
  options: { readonly mode?: HealthProviderRuntimeMode; readonly nowUtc?: () => string } = {},
): HealthProviderRuntime {
  const mode = options.mode ?? 'simulation';
  assertNoLiveHealthNetwork(mode);

  const catalog = buildCatalogIndex({
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [...HEALTH_CATALOG_ENTRIES],
  });

  const registry = createProviderRegistry({ catalogIndex: catalog });
  const providers = createWave6FixtureProviders(
    options.nowUtc ? { nowUtc: options.nowUtc } : undefined,
  );
  const cache = new HealthReferenceCache();
  const service = new HealthReferenceService({
    providers,
    cache,
    ...(options.nowUtc ? { nowUtc: options.nowUtc } : {}),
  });

  const bundles = createAllHealthProviders(Object.values(providers) as HealthProvider[]);
  for (const bundle of bundles) {
    registry.register(bundle.provider, {
      activationMode: 'preview_only',
      credentialAvailable: mode === 'simulation',
      featureFlagEnabled: true,
    });
  }

  return Object.freeze({
    mode,
    registry,
    providers,
    cache,
    service,
  });
}

export { HEALTH_ADAPTER_IDS };
