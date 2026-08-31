/**
 * External data plane orchestrator with failure isolation and cache metadata.
 */

import { bundleObservationEvidence } from '../../provider-sdk/src/index.ts';
import {
  createDataDelivery,
  createDefaultAdapterStates,
  type ProviderAdapterState,
  type Wave2AdapterContext,
} from './adapters.ts';
import { buildWave2CoverageReport } from './coverage.ts';
import type { ExternalDataHealth, SearchableEntity } from './models.ts';
import { createWave2Services, type CompanyIntelligenceService, type FxReferenceService, type MacroDataService, type MarketReferenceService } from './services.ts';
import { FIXTURE_FILINGS } from './fixtures.ts';
import {
  createDefaultWave5AdapterStates,
  createWave5DataDelivery,
  WAVE5_IMPLEMENTED_PROVIDER_IDS,
} from './wave5-adapters.ts';
import { buildWave5CoverageReport } from './wave5-coverage.ts';
import { createWave5Services, type Wave5Services } from './wave5-services.ts';
import { ProviderRiskMonitor } from './wave5-provider-risk.ts';

export type ExternalDataPlaneOptions = {
  readonly nowUtc?: string;
  readonly states?: Map<string, ProviderAdapterState>;
  readonly wave5States?: Map<string, ProviderAdapterState>;
};

export class ExternalDataPlane {
  readonly macro: MacroDataService;
  readonly fx: FxReferenceService;
  readonly markets: MarketReferenceService;
  readonly company: CompanyIntelligenceService;
  readonly wave5: Wave5Services;
  readonly providerRisk: ProviderRiskMonitor;
  readonly #ctx: Wave2AdapterContext;
  readonly #wave5Ctx;
  readonly #delivery;
  readonly #wave5Delivery;

  constructor(options: ExternalDataPlaneOptions = {}) {
    const nowUtc = options.nowUtc ?? new Date().toISOString();
    this.#ctx = {
      nowUtc,
      states: options.states ?? createDefaultAdapterStates(),
    };
    this.#wave5Ctx = {
      nowUtc,
      states: options.wave5States ?? createDefaultWave5AdapterStates(),
    };
    const services = createWave2Services(this.#ctx);
    this.macro = services.macro;
    this.fx = services.fx;
    this.markets = services.markets;
    this.company = services.company;
    this.wave5 = createWave5Services(this.#wave5Ctx);
    this.providerRisk = new ProviderRiskMonitor(this.#wave5Ctx);
    this.#delivery = createDataDelivery(Date.parse(nowUtc));
    this.#wave5Delivery = createWave5DataDelivery(Date.parse(nowUtc));
  }

  adapterContext(): Wave2AdapterContext {
    return this.#ctx;
  }

  setProviderState(providerId: string, patch: Partial<ProviderAdapterState>): void {
    const current = this.#ctx.states.get(providerId) ?? this.#wave5Ctx.states.get(providerId);
    if (!current) {
      return;
    }
    if (this.#ctx.states.has(providerId)) {
      this.#ctx.states.set(providerId, { ...current, ...patch });
    }
    if (this.#wave5Ctx.states.has(providerId)) {
      this.#wave5Ctx.states.set(providerId, { ...current, ...patch });
    }
  }

  wave5AdapterContext() {
    return this.#wave5Ctx;
  }

  async cachedFetch(providerId: string, capability: string, resourceId: string) {
    if (WAVE5_IMPLEMENTED_PROVIDER_IDS.includes(providerId)) {
      return this.#wave5Delivery.get({ providerId, capability, resourceId });
    }
    return this.#delivery.get({ providerId, capability, resourceId });
  }

  agentEvidenceBundle() {
    const observations = [
      ...this.macro.getIndicators().observations,
      ...this.fx.getRates().observations,
      ...this.markets.getQuotes().observations,
      ...this.company.getLatestFilings().observations,
    ];
    return bundleObservationEvidence(observations);
  }

  health(): readonly ExternalDataHealth[] {
    const wave2 = [...this.#ctx.states.entries()].map(([providerId, state]) =>
      Object.freeze({
        providerId,
        enabled: state.enabled,
        health: state.down || state.malformed ? 'unhealthy' : state.rateLimited ? 'degraded' : state.lastError ? 'degraded' : 'healthy',
        lastSuccess: state.lastSuccess,
        lastError: state.lastError,
        cacheFreshness: state.lastSuccess ? 'fresh' : 'none',
        circuitState: state.circuitState,
        credentialReady: !providerId.includes('alpha') && !providerId.includes('bls'),
      }),
    );
    const wave5 = [...this.#wave5Ctx.states.entries()].map(([providerId, state]) =>
      Object.freeze({
        providerId,
        enabled: state.enabled,
        health: state.down || state.malformed ? 'unhealthy' : state.rateLimited ? 'degraded' : state.lastError ? 'degraded' : 'healthy',
        lastSuccess: state.lastSuccess,
        lastError: state.lastError,
        cacheFreshness: state.lastSuccess ? 'fresh' : 'none',
        circuitState: state.circuitState,
        credentialReady: !providerId.includes('eia') && !providerId.includes('openaq'),
      }),
    );
    return Object.freeze([...wave2, ...wave5]);
  }

  coverageReport() {
    return buildWave2CoverageReport();
  }

  wave5CoverageReport() {
    return buildWave5CoverageReport();
  }

  searchIndex(): readonly SearchableEntity[] {
    const entities = new Map<string, SearchableEntity>();
    for (const filing of FIXTURE_FILINGS) {
      const existing = entities.get(filing.entityId);
      const filingTypes = existing ? [...existing.filingTypes, filing.formType] : [filing.formType];
      entities.set(filing.entityId, {
        entityId: filing.entityId,
        companyName: filing.companyName,
        ticker: filing.companyName.startsWith('Apple') ? 'AAPL' : null,
        jurisdiction: filing.jurisdiction,
        filingTypes: Object.freeze([...new Set(filingTypes)]),
        topics: Object.freeze(['equity', 'sec-filing']),
      });
    }
    return Object.freeze([...entities.values()]);
  }

  search(query: { readonly company?: string; readonly ticker?: string; readonly filingType?: string }) {
    return this.searchIndex().filter((entry) => {
      if (query.ticker && entry.ticker !== query.ticker) {
        return false;
      }
      if (query.company && !entry.companyName.toLowerCase().includes(query.company.toLowerCase())) {
        return false;
      }
      if (query.filingType && !entry.filingTypes.includes(query.filingType)) {
        return false;
      }
      return true;
    });
  }
}

export function createExternalDataPlane(options?: ExternalDataPlaneOptions): ExternalDataPlane {
  return new ExternalDataPlane(options);
}
