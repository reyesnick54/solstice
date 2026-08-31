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
import { createWave4Services, type ProviderRiskService } from './wave4/services.ts';
import type { ComplianceEvidenceService, BusinessIdentityService, DigitalRiskService, VulnerabilityIntelligenceService, ThreatIntelligenceService, EndpointSecurityService, ServiceOutageService } from './wave4/services.ts';
import { createDefaultWave4AdapterStates } from './wave4/adapters.ts';
import { buildWave4CoverageReport } from './wave4/coverage.ts';
import { WAVE4_IMPLEMENTED_PROVIDER_IDS } from './wave4/catalog-entries.ts';

export type ExternalDataPlaneOptions = {
  readonly nowUtc?: string;
  readonly states?: Map<string, ProviderAdapterState>;
};

export class ExternalDataPlane {
  readonly macro: MacroDataService;
  readonly fx: FxReferenceService;
  readonly markets: MarketReferenceService;
  readonly company: CompanyIntelligenceService;
  readonly compliance: ComplianceEvidenceService;
  readonly businessIdentity: BusinessIdentityService;
  readonly digitalRisk: DigitalRiskService;
  readonly vulnerability: VulnerabilityIntelligenceService;
  readonly threatIntel: ThreatIntelligenceService;
  readonly endpointSecurity: EndpointSecurityService;
  readonly serviceOutage: ServiceOutageService;
  readonly providerRisk: ProviderRiskService;
  readonly #ctx: Wave2AdapterContext;
  readonly #wave4Ctx;
  readonly #delivery;

  constructor(options: ExternalDataPlaneOptions = {}) {
    const nowUtc = options.nowUtc ?? new Date().toISOString();
    const wave2States = options.states ?? createDefaultAdapterStates();
    const wave4States = createDefaultWave4AdapterStates();
    for (const [id, state] of wave2States) {
      wave4States.set(id, state);
    }
    this.#ctx = { nowUtc, states: wave2States };
    this.#wave4Ctx = { nowUtc, states: wave4States };
    const services = createWave2Services(this.#ctx);
    this.macro = services.macro;
    this.fx = services.fx;
    this.markets = services.markets;
    this.company = services.company;
    const wave4 = createWave4Services(this.#wave4Ctx);
    this.compliance = wave4.compliance;
    this.businessIdentity = wave4.businessIdentity;
    this.digitalRisk = wave4.digitalRisk;
    this.vulnerability = wave4.vulnerability;
    this.threatIntel = wave4.threatIntel;
    this.endpointSecurity = wave4.endpointSecurity;
    this.serviceOutage = wave4.serviceOutage;
    this.providerRisk = wave4.providerRisk;
    this.#delivery = createDataDelivery(Date.parse(nowUtc));
  }

  adapterContext(): Wave2AdapterContext {
    return this.#ctx;
  }

  setProviderState(providerId: string, patch: Partial<ProviderAdapterState>): void {
    const current = this.#ctx.states.get(providerId) ?? this.#wave4Ctx.states.get(providerId);
    if (!current) {
      return;
    }
    const updated = { ...current, ...patch };
    if (this.#ctx.states.has(providerId)) {
      this.#ctx.states.set(providerId, updated);
    }
    if (this.#wave4Ctx.states.has(providerId)) {
      this.#wave4Ctx.states.set(providerId, updated);
    }
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

  wave4CoverageReport() {
    return buildWave4CoverageReport();
  }

  wave4ProviderIds(): readonly string[] {
    return WAVE4_IMPLEMENTED_PROVIDER_IDS;
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
