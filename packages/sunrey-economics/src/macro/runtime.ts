/**
 * Macro provider runtime — catalog, registry, data delivery, simulation/live modes.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { ProviderAuthResolver } from '../../../provider-sdk/src/auth.ts';
import {
  buildCatalogIndex,
  createFetchProviderTransport,
  createProviderRegistry,
  createProviderTransportConfig,
  type CatalogIndex,
  type FetchLike,
  type HttpProviderTransport,
  type ProviderRegistry,
} from '../../../provider-sdk/src/index.ts';
import { ProviderDataDeliveryService } from '../../../sunrey-chain/src/provider-runtime/data-delivery/service.ts';
import type { ProviderFetchFn, ProviderFetchResult } from '../../../sunrey-chain/src/provider-runtime/data-delivery/types.ts';
import { MACRO_CATALOG_ENTRIES } from './catalog-entries.ts';
import {
  createMacroAdapter,
  createMacroAdapterContext,
  createMacroFixtureTransport,
  MACRO_ADAPTER_IDS,
  type MacroAdapter,
  type MacroAdapterId,
} from './adapters/index.ts';
import { createAllMacroProviders, type MacroProviderBundle } from './providers.ts';
import { createMacroDataService, MacroDataService } from './service.ts';

export type MacroProviderRuntimeMode = 'simulation' | 'live';

export type MacroProviderRuntime = {
  readonly mode: MacroProviderRuntimeMode;
  readonly catalog: CatalogIndex;
  readonly registry: ProviderRegistry;
  readonly adapters: ReadonlyMap<MacroAdapterId, MacroAdapter>;
  readonly bundles: readonly MacroProviderBundle[];
  readonly dataDelivery: ProviderDataDeliveryService;
  readonly service: MacroDataService;
};

export type MacroProviderRuntimeOptions = {
  readonly mode?: MacroProviderRuntimeMode;
  readonly catalogPath?: string;
  readonly nowUtc?: () => string;
  readonly authResolver?: ProviderAuthResolver;
  readonly fetchFn?: FetchLike;
};

class StaticAuthResolver implements ProviderAuthResolver {
  readonly resolverId = 'macro.static-auth';
  async resolve() {
    return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
  }
}

export function assertNoLiveNetwork(mode: MacroProviderRuntimeMode): void {
  if (mode === 'live' && ENVIRONMENT === 'simulation') {
    throw new Error('live macro provider network access is blocked while ENVIRONMENT=simulation');
  }
}

function createTransportForProvider(
  providerId: MacroAdapterId,
  mode: MacroProviderRuntimeMode,
  authResolver: ProviderAuthResolver,
  fetchFn?: FetchLike,
): HttpProviderTransport {
  if (mode === 'simulation') {
    return createMacroFixtureTransport(providerId);
  }
  assertNoLiveNetwork(mode);
  const entry = MACRO_CATALOG_ENTRIES.find((candidate) => candidate.provider_id === providerId);
  if (!entry?.endpoints.base_url) {
    throw new Error(`missing base_url for macro provider ${providerId}`);
  }
  return createFetchProviderTransport({
    config: createProviderTransportConfig({
      serviceVersion: '0.1.0',
      environment: 'production',
      endpoint: {
        providerId,
        baseUrl: entry.endpoints.base_url,
      },
    }),
    authResolver,
    authStrategy: { kind: 'none' },
    ...(fetchFn ? { fetchFn } : {}),
  });
}

export function createMacroProviderRuntime(options: MacroProviderRuntimeOptions = {}): MacroProviderRuntime {
  const mode = options.mode ?? 'simulation';
  assertNoLiveNetwork(mode);

  const catalog = buildCatalogIndex({
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [...MACRO_CATALOG_ENTRIES],
  });

  const registry = createProviderRegistry({ catalogIndex: catalog });
  const authResolver = options.authResolver ?? new StaticAuthResolver();
  const nowUtc = options.nowUtc ?? (() => new Date().toISOString());

  const adapters = new Map<MacroAdapterId, MacroAdapter>();
  for (const providerId of MACRO_ADAPTER_IDS) {
    const transport = createTransportForProvider(providerId, mode, authResolver, options.fetchFn);
    const context = createMacroAdapterContext({
      transport,
      authResolver,
      simulationOnly: mode === 'simulation',
      nowUtc,
    });
    adapters.set(providerId, createMacroAdapter(providerId, context));
  }

  const bundles = createAllMacroProviders([...adapters.values()]);
  for (const bundle of bundles) {
    registry.register(bundle.provider, {
      activationMode: mode === 'simulation' ? 'preview_only' : 'enabled',
      credentialAvailable: mode === 'simulation',
      featureFlagEnabled: true,
    });
  }

  const adapterById = new Map([...adapters.entries()]);
  const fetchFn: ProviderFetchFn = async ({ providerId, capability, resourceId }) => {
    const adapter = adapterById.get(providerId as MacroAdapterId);
    if (!adapter) {
      return Object.freeze({ ok: false, errorSafe: `unknown provider ${providerId}` });
    }
    const result = await adapter.fetchIndicator(resourceId);
    if (!result.ok) {
      return Object.freeze({ ok: false, errorSafe: result.message });
    }
    return Object.freeze({
      ok: true,
      observation: Object.freeze({
        schema: 'sunrey.external-data.observation.v1' as const,
        observationId: result.value.observationId,
        providerId,
        capability,
        resourceId,
        schemaVersion: '1',
        normalizedValue: Object.freeze({
          value: result.value.data.value !== null ? String(result.value.data.value) : '',
          unit: result.value.data.unit ?? '',
        }),
        provenance: Object.freeze({
          sourceId: providerId,
          collectedAtUtc: result.value.time.retrievedAt,
          providerTimestampUtc: result.value.time.sourceTimestamp,
          deduplicationKey: `${providerId}:${resourceId}`,
          contentHash: result.value.provenance.rawPayloadHash,
        }),
        simulation: true as const,
      }),
      rawPayload: JSON.stringify(result.value.data),
    } satisfies ProviderFetchResult);
  };

  const clock = Object.freeze({
    nowUtc,
    nowMs: () => Date.parse(nowUtc()),
  });

  const dataDelivery = new ProviderDataDeliveryService({ clock, fetchFn });
  const service = createMacroDataService({ bundles, registry, nowUtc });

  return Object.freeze({
    mode,
    catalog,
    registry,
    adapters,
    bundles,
    dataDelivery,
    service,
  });
}
