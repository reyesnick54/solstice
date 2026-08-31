/**
 * Travel intelligence runtime — catalog-backed provider registration.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import { buildCatalogIndex, createProviderRegistry, type ProviderRegistry } from '../../../provider-sdk/src/index.ts';
import { createWave5FixtureProviders } from './adapters/fixture-adapters.ts';
import type { TravelProvider } from './adapters/base.ts';
import { TRAVEL_CATALOG_ENTRIES } from './catalog-entries.ts';
import { TravelIntelligenceCache } from './cache.ts';
import { EnvironmentalOracleService } from '../environmental-oracle/service.ts';
import { createAllTravelProviders } from './providers.ts';
import { TravelIntelligenceService } from './service.ts';
import { TRAVEL_ADAPTER_IDS, type TravelAdapterId } from './types.ts';

export type TravelProviderRuntimeMode = 'simulation' | 'live';

export type TravelProviderRuntime = {
  readonly mode: TravelProviderRuntimeMode;
  readonly registry: ProviderRegistry;
  readonly providers: Readonly<Record<TravelAdapterId, TravelProvider>>;
  readonly cache: TravelIntelligenceCache;
  readonly environmentalOracle: EnvironmentalOracleService;
  readonly service: TravelIntelligenceService;
};

export function assertNoLiveTravelNetwork(mode: TravelProviderRuntimeMode): void {
  if (mode === 'live' && ENVIRONMENT === 'simulation') {
    throw new Error('live travel provider network access is blocked while ENVIRONMENT=simulation');
  }
}

export function createTravelProviderRuntime(
  options: { readonly mode?: TravelProviderRuntimeMode; readonly nowUtc?: () => string } = {},
): TravelProviderRuntime {
  const mode = options.mode ?? 'simulation';
  assertNoLiveTravelNetwork(mode);

  const catalog = buildCatalogIndex({
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [...TRAVEL_CATALOG_ENTRIES],
  });

  const registry = createProviderRegistry({ catalogIndex: catalog });
  const providers = createWave5FixtureProviders(
    options.nowUtc ? { nowUtc: options.nowUtc } : undefined,
  );
  const cache = new TravelIntelligenceCache();
  const environmentalOracle = new EnvironmentalOracleService({
    cache,
    ...(options.nowUtc ? { nowUtc: options.nowUtc } : {}),
  });
  const service = new TravelIntelligenceService({
    providers,
    cache,
    environmentalOracle,
    ...(options.nowUtc ? { nowUtc: options.nowUtc } : {}),
  });

  const bundles = createAllTravelProviders(Object.values(providers));
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
    environmentalOracle,
    service,
  });
}
