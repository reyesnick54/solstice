/**
 * AAF07 external market-data certification runtime.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { buildMarketDataProviderCapability } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';
import type { MarketDataProviderCapability } from '../../../../provider-sdk/src/market-data-capability/types.ts';
import type { MarketDataProviderHealth } from '../../../../provider-sdk/src/market-data-capability/types.ts';
import { createCapitalMarketService } from '../../../../sunrey-exchange/src/capital-market/service.ts';
import type { CapitalMarketProviderHealth } from '../../../../sunrey-exchange/src/capital-market/types.ts';
import { createMarketDataCertificationProvider, type MarketDataAdapterBindingOptions } from './adapter-binding.ts';
import {
  loadMarketDataCertificationCatalogIndex,
  resolveFreeApiEntry,
  resolveOverlayProvider,
} from './catalog.ts';
import { guardExternalMarketDataFetch, mapCapitalMarketResultToFetchOutcome, type MarketDataFetchOutcome } from './fetch-guard.ts';
import { runMarketDataQualificationHarness, type MarketDataQualificationHarnessResult } from './harness.ts';
import { sealMarketDataHealthEvidence, type MarketDataHealthEvidence } from './health-evidence.ts';
import { createMarketDataCertificationMetrics, type MarketDataCertificationMetrics } from './metrics.ts';
import { deriveMarketDataCertificationState } from './state.ts';

export type ExternalMarketDataCertificationRecord = {
  readonly capability: MarketDataProviderCapability;
  readonly harness: MarketDataQualificationHarnessResult;
  readonly healthEvidence: MarketDataHealthEvidence;
};

export type ExternalMarketDataCertificationRuntimeOptions = MarketDataAdapterBindingOptions & {
  readonly metrics?: MarketDataCertificationMetrics;
};

function mapHealth(health: CapitalMarketProviderHealth, nowUtc: UtcInstant): MarketDataProviderHealth {
  const state =
    health.status === 'healthy'
      ? 'HEALTHY'
      : health.status === 'degraded'
        ? 'DEGRADED'
        : health.status === 'unavailable'
          ? 'UNAVAILABLE'
          : 'UNKNOWN';
  return Object.freeze({
    state,
    message: health.message,
    lastHeartbeatAt: health.lastSuccessAt,
    lastSuccessfulFetchAt: health.lastSuccessAt,
    consecutiveFailures: health.circuitState === 'OPEN' ? 1 : 0,
  });
}

export class ExternalMarketDataCertificationRuntime {
  readonly #metrics: MarketDataCertificationMetrics;
  readonly #adapterOptions: MarketDataAdapterBindingOptions;
  readonly #catalogIndex = loadMarketDataCertificationCatalogIndex();

  constructor(options: ExternalMarketDataCertificationRuntimeOptions = {}) {
    this.#metrics = options.metrics ?? createMarketDataCertificationMetrics();
    this.#adapterOptions = Object.freeze({
      ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    });
  }

  metrics(): MarketDataCertificationMetrics {
    return this.#metrics;
  }

  listProviderIds(): readonly string[] {
    return Object.freeze(this.#catalogIndex.overlay.providers.map((row) => row.provider_id));
  }

  async certifyProvider(
    providerId: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<ExternalMarketDataCertificationRecord | null> {
    const overlay = resolveOverlayProvider(this.#catalogIndex.overlay, providerId);
    if (!overlay) {
      return null;
    }
    const catalogEntry = resolveFreeApiEntry(this.#catalogIndex.catalog, providerId);
    const provider = createMarketDataCertificationProvider(overlay, this.#adapterOptions);
    const credentialConfigured = provider.credentialConfigured();
    const harness = await runMarketDataQualificationHarness({
      overlay,
      catalogEntry,
      provider,
      nowUtc,
    });
    for (const row of harness.proofs) {
      if (!row.passed) {
        this.#metrics.recordProofFailure(providerId, row.id);
      }
    }
    const certificationState = deriveMarketDataCertificationState({
      overlay,
      catalogEntry,
      credentialConfigured,
      harness,
      explicitlyDegraded: certificationStateIsDegraded(harness),
    });
    const providerHealth = mapHealth(provider.health(nowUtc), nowUtc);
    const capability = buildMarketDataProviderCapability({
      overlay,
      catalogEntry,
      credentialConfigured,
      providerHealth,
      certificationState,
      evaluatedAtUtc: nowUtc,
    });
    const healthEvidence = sealMarketDataHealthEvidence({
      providerId,
      sealedAtUtc: nowUtc,
      providerHealth,
      harness,
    });
    const outcome =
      certificationState === 'DEGRADED' || certificationState === 'SUSPENDED'
        ? 'degraded'
        : harness.allPassed
          ? 'pass'
          : 'fail';
    this.#metrics.recordRun(providerId, outcome);
    return Object.freeze({ capability, harness, healthEvidence });
  }

  async certifyAll(nowUtc?: UtcInstant): Promise<readonly ExternalMarketDataCertificationRecord[]> {
    const instant = nowUtc ?? asUtcInstant(new Date().toISOString());
    const results: ExternalMarketDataCertificationRecord[] = [];
    for (const providerId of this.listProviderIds()) {
      const row = await this.certifyProvider(providerId, instant);
      if (row) {
        results.push(row);
      }
    }
    return Object.freeze(results);
  }

  async fetchExternalObservation(
    providerId: string,
    instrumentId: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<MarketDataFetchOutcome> {
    const overlay = resolveOverlayProvider(this.#catalogIndex.overlay, providerId);
    if (!overlay) {
      return Object.freeze({
        status: 'UNAVAILABLE',
        code: 'PROVIDER_NOT_REGISTERED',
        message: `provider ${providerId} is not in AAF07 overlay`,
        providerId,
        routeClass: 'external_live',
        silentFixtureRejected: false,
      });
    }
    const provider = createMarketDataCertificationProvider(overlay, this.#adapterOptions);
    const service = createCapitalMarketService({
      provider,
      externalQualificationPassed: true,
    });
    const result = await service.getObservation(instrumentId, nowUtc);
    if (!result.ok) {
      this.#metrics.recordFetchFailure(providerId, result.code);
      const guard = guardExternalMarketDataFetch({
        routeClass: overlay.route_class,
        primaryFailed: true,
        attemptedFixtureFallback: result.code === 'SILENT_FIXTURE',
        fixtureLabeled: false,
        environment: 'simulation',
        explicitSimulationAllowed: false,
      });
      if (!guard.allowed) {
        return Object.freeze({
          status: 'DEGRADED',
          code: guard.failureCode ?? 'SILENT_SIMULATION_REJECTED',
          message: 'external_live failure cannot fall back to unlabeled simulation',
          providerId,
          routeClass: overlay.route_class,
          silentFixtureRejected: true,
        });
      }
    }
    return mapCapitalMarketResultToFetchOutcome(overlay.route_class, result);
  }
}

function certificationStateIsDegraded(harness: MarketDataQualificationHarnessResult): boolean {
  const silent = harness.proofs.find((row) => row.id === 'no_silent_fixture_fallback');
  return silent ? !silent.passed : false;
}

export function createExternalMarketDataCertificationRuntime(
  options: ExternalMarketDataCertificationRuntimeOptions = {},
): ExternalMarketDataCertificationRuntime {
  return new ExternalMarketDataCertificationRuntime(options);
}
