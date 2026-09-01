/**
 * Wave 4 canonical domain services — compliance, KYB, fraud, cybersecurity.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';
import type { ProviderAdapterState } from '../adapters.ts';
import {
  createDefaultWave4AdapterStates,
  fetchBusinessIdentityEvidence,
  fetchComplianceEvidence,
  fetchDigitalRiskEvidence,
  fetchEndpointSecurityObservations,
  fetchServiceIncidentObservations,
  fetchThreatIndicators,
  fetchVulnerabilityObservations,
  mapDependencyVulnerabilities,
  type Wave4AdapterContext,
} from './adapters.ts';
import { SUNREY_DEPENDENCIES } from './fixtures.ts';
import type {
  BusinessIdentityEvidence,
  ComplianceEvidence,
  DependencyVulnerabilityMapping,
  DigitalRiskEvidence,
  EndpointSecurityObservation,
  ServiceIncidentObservation,
  ThreatIndicator,
  VulnerabilityObservation,
} from './models.ts';
import { ProviderRiskMonitor, type ProviderRiskInput, type ProviderRiskScore } from './provider-risk-monitor.ts';
import {
  ProviderRiskMonitor as Wave5ProviderRiskMonitor,
  type ProviderRiskMonitorSnapshot,
} from '../wave5-provider-risk.ts';

export type Wave4ServiceResult<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly degraded: boolean;
  readonly stale: boolean;
  readonly providersUsed: readonly string[];
  readonly grantsDecision: false;
};

function summarize<T>(observations: readonly ExternalObservation<T>[]): Wave4ServiceResult<T> {
  return Object.freeze({
    observations,
    degraded: observations.length === 0,
    stale: false,
    providersUsed: Object.freeze([...new Set(observations.map((o) => o.providerId))]),
    grantsDecision: false,
  });
}

export class ComplianceEvidenceService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  screenSanctions(subjectRef: string): Wave4ServiceResult<ComplianceEvidence> {
    return summarize(
      fetchComplianceEvidence(this.#ctx, subjectRef).filter((o) => o.data.screeningType === 'SANCTIONS'),
    );
  }

  screenPep(subjectRef: string): Wave4ServiceResult<ComplianceEvidence> {
    return summarize(
      fetchComplianceEvidence(this.#ctx, subjectRef).filter((o) => o.data.screeningType === 'PEP'),
    );
  }

  screenWatchlists(subjectRef: string): Wave4ServiceResult<ComplianceEvidence> {
    return summarize(fetchComplianceEvidence(this.#ctx, subjectRef));
  }
}

export class BusinessIdentityService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  lookupKyb(entityRef: string): Wave4ServiceResult<BusinessIdentityEvidence> {
    return summarize(fetchBusinessIdentityEvidence(this.#ctx, entityRef));
  }
}

export class DigitalRiskService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  assessIpRisk(subjectRef: string): Wave4ServiceResult<DigitalRiskEvidence> {
    return summarize(fetchDigitalRiskEvidence(this.#ctx, subjectRef));
  }

  assessNetworkRisk(subjectRef: string): Wave4ServiceResult<DigitalRiskEvidence> {
    return summarize(
      fetchDigitalRiskEvidence(this.#ctx, subjectRef).filter((o) => o.data.riskType === 'IP' || o.data.riskType === 'NETWORK'),
    );
  }
}

export class VulnerabilityIntelligenceService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  getCveObservations(): Wave4ServiceResult<VulnerabilityObservation> {
    return summarize(fetchVulnerabilityObservations(this.#ctx));
  }

  mapToDependencies(): readonly DependencyVulnerabilityMapping[] {
    const vulns = fetchVulnerabilityObservations(this.#ctx).map((o) => o.data);
    return mapDependencyVulnerabilities(vulns, SUNREY_DEPENDENCIES);
  }
}

export class ThreatIntelligenceService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  getThreatIndicators(): Wave4ServiceResult<ThreatIndicator> {
    return summarize(fetchThreatIndicators(this.#ctx));
  }

  getPhishingIndicators(): Wave4ServiceResult<ThreatIndicator> {
    return summarize(
      fetchThreatIndicators(this.#ctx).filter((o) => o.data.indicatorType === 'PHISHING_URL'),
    );
  }

  getMaliciousUrls(): Wave4ServiceResult<ThreatIndicator> {
    return summarize(
      fetchThreatIndicators(this.#ctx).filter(
        (o) => o.data.indicatorType === 'MALICIOUS_URL' || o.data.indicatorType === 'MALWARE_URL',
      ),
    );
  }
}

export class EndpointSecurityService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  getObservations(): Wave4ServiceResult<EndpointSecurityObservation> {
    return summarize(fetchEndpointSecurityObservations(this.#ctx));
  }
}

export class ServiceOutageService {
  readonly #ctx: Wave4AdapterContext;

  constructor(ctx?: Wave4AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  }

  getIncidents(): Wave4ServiceResult<ServiceIncidentObservation> {
    return summarize(fetchServiceIncidentObservations(this.#ctx));
  }
}

export class ProviderRiskService {
  readonly #monitor: ProviderRiskMonitor;
  readonly #getStates: () => Map<string, ProviderAdapterState>;
  #wave5Monitor: Wave5ProviderRiskMonitor | null = null;

  constructor(monitor: ProviderRiskMonitor, getStates: () => Map<string, ProviderAdapterState>) {
    this.#monitor = monitor;
    this.#getStates = getStates;
  }

  bindWave5Monitor(monitor: Wave5ProviderRiskMonitor): void {
    this.#wave5Monitor = monitor;
  }

  snapshot(): ProviderRiskMonitorSnapshot {
    if (!this.#wave5Monitor) {
      throw new Error('Wave 5 provider risk monitor is not configured');
    }
    return this.#wave5Monitor.snapshot();
  }

  disableProvider(providerId: string): boolean {
    if (!this.#wave5Monitor) {
      return false;
    }
    return this.#wave5Monitor.disableProvider(providerId);
  }

  enableProvider(providerId: string): boolean {
    if (!this.#wave5Monitor) {
      return false;
    }
    return this.#wave5Monitor.enableProvider(providerId);
  }

  assessProvider(providerId: string, extras?: Partial<ProviderRiskInput>): ProviderRiskScore {
    const state = this.#getStates().get(providerId);
    if (!state) {
      return this.#monitor.assess({
        providerId,
        adapterState: {
          enabled: false,
          down: true,
          rateLimited: false,
          malformed: false,
          lastSuccess: null,
          lastError: 'UNKNOWN_PROVIDER',
          circuitState: 'OPEN',
        },
        ...extras,
      });
    }
    return this.#monitor.assess({ providerId, adapterState: state, ...extras });
  }

  assessAll(): readonly ProviderRiskScore[] {
    const states = this.#getStates();
    const inputs: ProviderRiskInput[] = [...states.entries()].map(([providerId, adapterState]) => ({
      providerId,
      adapterState,
    }));
    return this.#monitor.assessAll(inputs);
  }

  quarantine(providerId: string, reason: string, triggeredBy: string) {
    const score = this.assessProvider(providerId);
    return this.#monitor.quarantine(providerId, reason, triggeredBy, score.state);
  }

  get monitor(): ProviderRiskMonitor {
    return this.#monitor;
  }
}

export function createWave4Services(ctx?: Wave4AdapterContext) {
  const context = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave4AdapterStates() };
  const monitor = new ProviderRiskMonitor({ nowUtc: context.nowUtc });
  return Object.freeze({
    compliance: new ComplianceEvidenceService(context),
    businessIdentity: new BusinessIdentityService(context),
    digitalRisk: new DigitalRiskService(context),
    vulnerability: new VulnerabilityIntelligenceService(context),
    threatIntel: new ThreatIntelligenceService(context),
    endpointSecurity: new EndpointSecurityService(context),
    serviceOutage: new ServiceOutageService(context),
    providerRisk: new ProviderRiskService(monitor, () => context.states),
    context,
  });
}
