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

export type ExternalDataPlaneOptions = {
  readonly nowUtc?: string;
  readonly states?: Map<string, ProviderAdapterState>;
};

export class ExternalDataPlane {
  readonly macro: MacroDataService;
  readonly fx: FxReferenceService;
  readonly markets: MarketReferenceService;
  readonly company: CompanyIntelligenceService;
  readonly #ctx: Wave2AdapterContext;
  readonly #delivery;

  constructor(options: ExternalDataPlaneOptions = {}) {
    const nowUtc = options.nowUtc ?? new Date().toISOString();
    this.#ctx = {
      nowUtc,
      states: options.states ?? createDefaultAdapterStates(),
    };
    const services = createWave2Services(this.#ctx);
    this.macro = services.macro;
    this.fx = services.fx;
    this.markets = services.markets;
    this.company = services.company;
    this.#delivery = createDataDelivery(Date.parse(nowUtc));
  }

  adapterContext(): Wave2AdapterContext {
    return this.#ctx;
  }

  setProviderState(providerId: string, patch: Partial<ProviderAdapterState>): void {
    const current = this.#ctx.states.get(providerId);
    if (!current) {
      return;
    }
    this.#ctx.states.set(providerId, { ...current, ...patch });
  }

  async cachedFetch(providerId: string, capability: string, resourceId: string) {
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
    return Object.freeze(
      [...this.#ctx.states.entries()].map(([providerId, state]) =>
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
      ),
    );
  }

  coverageReport() {
    return buildWave2CoverageReport();
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
