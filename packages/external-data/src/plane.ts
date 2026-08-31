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
import { createWave5ExternalData, wave5CoverageReport, type Wave5ExternalData } from './productive-economy.ts';
import { createWave2Services, type CompanyIntelligenceService, type FxReferenceService, type MacroDataService, type MarketReferenceService } from './services.ts';
import { FIXTURE_FILINGS } from './fixtures.ts';
import {
  createDefaultWave5AdapterStates,
  createWave5DataDelivery,
  WAVE5_IMPLEMENTED_PROVIDER_IDS,
} from './wave5-adapters.ts';
import { buildWave5CoverageReport } from './wave5-coverage.ts';
import { createWave5Services, type Wave5Services } from './wave5-services.ts';
import { createWave4Services, type ProviderRiskService } from './wave4/services.ts';
import type { ComplianceEvidenceService, BusinessIdentityService, DigitalRiskService, VulnerabilityIntelligenceService, ThreatIntelligenceService, EndpointSecurityService, ServiceOutageService } from './wave4/services.ts';
import { createDefaultWave4AdapterStates } from './wave4/adapters.ts';
import { buildWave4CoverageReport } from './wave4/coverage.ts';
import { WAVE4_IMPLEMENTED_PROVIDER_IDS } from './wave4/catalog-entries.ts';
import { createExternalDataTrustPlane, type ExternalDataTrustPlane } from './trust-engine/index.ts';
import {
  buildWave6KnowledgeBundle,
  createWave6Services,
  type Wave6Services,
  wave6ProviderHealth,
} from './wave6/services.ts';
import { buildWave6ConsumerSnapshots } from './wave6/bridges.ts';
import { buildWave6CoverageReport } from './wave6/coverage.ts';
import { createDefaultWave6AdapterStates, setWave6ProviderState } from './wave6/adapters.ts';
import { WAVE6_IMPLEMENTED_PROVIDER_IDS } from './wave6/catalog-entries.ts';

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
  readonly #ctx: Wave2AdapterContext;
  readonly #wave5Ctx;
  readonly productiveEconomy: Wave5ExternalData;
  readonly compliance: ComplianceEvidenceService;
  readonly businessIdentity: BusinessIdentityService;
  readonly digitalRisk: DigitalRiskService;
  readonly vulnerability: VulnerabilityIntelligenceService;
  readonly threatIntel: ThreatIntelligenceService;
  readonly endpointSecurity: EndpointSecurityService;
  readonly serviceOutage: ServiceOutageService;
  readonly providerRisk: ProviderRiskService;
  readonly trust: ExternalDataTrustPlane;
  readonly wave6: Wave6Services;
  readonly #wave6Ctx;
  readonly #wave4Ctx;
  readonly #delivery;
  readonly #wave5Delivery;

  constructor(options: ExternalDataPlaneOptions = {}) {
    const nowUtc = options.nowUtc ?? new Date().toISOString();
    const wave2States = options.states ?? createDefaultAdapterStates();
    const wave4States = createDefaultWave4AdapterStates();
    for (const [id, state] of wave2States) {
      wave4States.set(id, state);
    }
    this.#ctx = { nowUtc, states: wave2States };
    this.#wave4Ctx = { nowUtc, states: wave4States };
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
    this.productiveEconomy = createWave5ExternalData({ nowUtc: () => nowUtc });
    const wave4 = createWave4Services(this.#wave4Ctx);
    this.compliance = wave4.compliance;
    this.businessIdentity = wave4.businessIdentity;
    this.digitalRisk = wave4.digitalRisk;
    this.vulnerability = wave4.vulnerability;
    this.threatIntel = wave4.threatIntel;
    this.endpointSecurity = wave4.endpointSecurity;
    this.serviceOutage = wave4.serviceOutage;
    this.providerRisk = wave4.providerRisk;
    this.trust = createExternalDataTrustPlane({ nowUtc: () => nowUtc });
    const wave6States = createDefaultWave6AdapterStates();
    for (const [id, state] of wave2States) {
      wave6States.set(id, state);
    }
    this.#wave6Ctx = { nowUtc, states: wave6States };
    this.wave6 = createWave6Services(this.#wave6Ctx);
    this.#delivery = createDataDelivery(Date.parse(nowUtc));
    this.#wave5Delivery = createWave5DataDelivery(Date.parse(nowUtc));
  }

  adapterContext(): Wave2AdapterContext {
    return this.#ctx;
  }

  setProviderState(providerId: string, patch: Partial<ProviderAdapterState>): void {
    const current =
      this.#ctx.states.get(providerId) ??
      this.#wave4Ctx.states.get(providerId) ??
      this.#wave5Ctx.states.get(providerId) ??
      this.#wave6Ctx.states.get(providerId);
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
    if (this.#wave5Ctx.states.has(providerId)) {
      this.#wave5Ctx.states.set(providerId, updated);
    }
    if (this.#wave6Ctx.states.has(providerId)) {
      setWave6ProviderState(this.#wave6Ctx, providerId, patch);
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

  async agentEvidenceBundleWithProductiveEconomy() {
    const base = this.agentEvidenceBundle();
    const productive = await this.productiveEconomy.getProductiveEconomicObservations();
    const knowledge = buildWave6KnowledgeBundle(this.wave6);
    return Object.freeze({
      ...base,
      productiveEconomyEvidenceCount: productive.length,
      knowledgeEvidenceCount:
        knowledge.researchCount +
        knowledge.patentCount +
        knowledge.aiEconomicCount +
        knowledge.opportunityCount,
      grantsExecutionAuthority: false as const,
      treatedAsTradeInstruction: false as const,
    });
  }

  wave6KnowledgeBundle() {
    return buildWave6KnowledgeBundle(this.wave6);
  }

  wave6ConsumerSnapshots() {
    return buildWave6ConsumerSnapshots(this.wave6);
  }

  wave6CoverageReport() {
    return buildWave6CoverageReport();
  }

  wave6ProviderIds(): readonly string[] {
    return WAVE6_IMPLEMENTED_PROVIDER_IDS;
  }

  wave6Health() {
    return wave6ProviderHealth(this.#wave6Ctx.states);
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
    return Object.freeze({
      wave2: buildWave2CoverageReport(),
      wave5: wave5CoverageReport(),
    });
  }

  wave4CoverageReport() {
    return buildWave4CoverageReport();
  }

  wave4ProviderIds(): readonly string[] {
    return WAVE4_IMPLEMENTED_PROVIDER_IDS;
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

  knowledgeSearch(query: { readonly q?: string; readonly topic?: string }) {
    return this.wave6.research.searchWorks(query).observations.map((o) =>
      Object.freeze({
        workId: o.data.workId,
        title: o.data.title,
        providerId: o.providerId,
        topics: o.data.topics,
        provenance: o.provenance.requestId ?? o.providerId,
      }),
    );
  }
}

export function createExternalDataPlane(options?: ExternalDataPlaneOptions): ExternalDataPlane {
  return new ExternalDataPlane(options);
}
