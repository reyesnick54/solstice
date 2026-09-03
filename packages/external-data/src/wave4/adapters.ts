/**
 * Wave 4 provider adapter registry with simulation fixtures.
 */

import {
  buildExternalObservation,
  canonicalJsonStringify,
  type ExternalObservation,
} from '../../../provider-sdk/src/index.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import type { ProviderAdapterState } from '../adapters.ts';
import {
  FIXTURE_BUSINESS_IDENTITY,
  FIXTURE_COMPLIANCE,
  FIXTURE_DIGITAL_RISK,
  FIXTURE_ENDPOINT_SECURITY,
  FIXTURE_SERVICE_INCIDENTS,
  FIXTURE_THREAT_INDICATORS,
  FIXTURE_VULNERABILITIES,
  MALFORMED_JSON_FIXTURE,
  TIMEOUT_PROVIDER,
} from './fixtures.ts';
import { WAVE4_IMPLEMENTED_PROVIDER_IDS } from './catalog-entries.ts';
import type {
  BusinessIdentityEvidence,
  ComplianceEvidence,
  DependencyExposureStatus,
  DependencyVulnerabilityMapping,
  DigitalRiskEvidence,
  EndpointSecurityObservation,
  ServiceIncidentObservation,
  ThreatIndicator,
  VulnerabilityObservation,
} from './models.ts';
import { sanitizeUntrustedIndicator } from './safe-url.ts';

export { WAVE4_IMPLEMENTED_PROVIDER_IDS };

export type Wave4AdapterContext = {
  readonly nowUtc: string;
  readonly states: Map<string, ProviderAdapterState>;
};

export function createDefaultWave4AdapterStates(): Map<string, ProviderAdapterState> {
  const states = new Map<string, ProviderAdapterState>();
  for (const providerId of WAVE4_IMPLEMENTED_PROVIDER_IDS) {
    states.set(providerId, {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    });
  }
  return states;
}

function stateFor(ctx: Wave4AdapterContext, providerId: string): ProviderAdapterState {
  return (
    ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    }
  );
}

function guardProvider(ctx: Wave4AdapterContext, providerId: string): string | null {
  const state = stateFor(ctx, providerId);
  if (!state.enabled) {
    return 'PROVIDER_DISABLED';
  }
  if (state.down || providerId === TIMEOUT_PROVIDER) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (state.rateLimited) {
    return 'RATE_LIMITED';
  }
  if (state.malformed) {
    return 'INVALID_PAYLOAD';
  }
  return null;
}

function observe<T>(
  ctx: Wave4AdapterContext,
  input: {
    readonly providerId: string;
    readonly category: 'compliance' | 'kyb_identity' | 'fraud_risk' | 'cybersecurity';
    readonly capability: string;
    readonly dataset: string;
    readonly data: T;
    readonly rawPayload: string;
    readonly authorityClass?: 'authoritative_official' | 'reference_data' | 'community_data';
  },
): ExternalObservation<T> | null {
  const failure = guardProvider(ctx, input.providerId);
  if (failure) {
    const state = ctx.states.get(input.providerId);
    if (state) {
      ctx.states.set(input.providerId, { ...state, lastError: failure });
    }
    return null;
  }
  const built = buildExternalObservation({
    providerId: input.providerId,
    providerCategory: input.category,
    capability: input.capability,
    data: input.data,
    source: {
      provider: input.providerId,
      dataset: input.dataset,
      sourceUrl: null,
    },
    time: { retrievedAt: asUtcInstant(ctx.nowUtc), sourceTimestamp: asUtcInstant(ctx.nowUtc) },
    authorityClass: input.authorityClass ?? 'reference_data',
    provenance: {
      requestId: `wave4-${input.providerId}`,
      rawPayload: input.rawPayload,
      providerSchemaVersion: 'fixture/1',
    },
  });
  if (!built.ok) {
    return null;
  }
  const state = ctx.states.get(input.providerId);
  if (state) {
    ctx.states.set(input.providerId, { ...state, lastSuccess: ctx.nowUtc, lastError: null });
  }
  return built.value;
}

export function fetchComplianceEvidence(
  ctx: Wave4AdapterContext,
  subjectRef?: string,
): readonly ExternalObservation<ComplianceEvidence>[] {
  const results: ExternalObservation<ComplianceEvidence>[] = [];
  for (const evidence of FIXTURE_COMPLIANCE) {
    if (subjectRef && evidence.subjectRef !== subjectRef) {
      continue;
    }
    const providerId = evidence.providerId;
    if (providerId === 'open-sanctions' || providerId === 'un-sanctions' || providerId === 'eu-sanctions') {
      const obs = observe(ctx, {
        providerId,
        category: 'compliance',
        capability: evidence.screeningType === 'PEP' ? 'pep_screening' : 'sanctions',
        dataset: 'screening',
        data: evidence,
        rawPayload: canonicalJsonStringify(evidence),
        authorityClass: providerId === 'open-sanctions' ? 'reference_data' : 'authoritative_official',
      });
      if (obs) {
        results.push(obs);
      }
    }
  }
  return Object.freeze(results);
}

export function fetchBusinessIdentityEvidence(
  ctx: Wave4AdapterContext,
  entityRef?: string,
): readonly ExternalObservation<BusinessIdentityEvidence>[] {
  const results: ExternalObservation<BusinessIdentityEvidence>[] = [];
  for (const evidence of FIXTURE_BUSINESS_IDENTITY) {
    if (entityRef && evidence.entityRef !== entityRef) {
      continue;
    }
    const obs = observe(ctx, {
      providerId: evidence.providerId,
      category: 'kyb_identity',
      capability: 'kyb',
      dataset: 'company-profile',
      data: evidence,
      rawPayload: canonicalJsonStringify(evidence),
      authorityClass: evidence.providerId === 'gleif-lei' ? 'authoritative_official' : 'reference_data',
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchDigitalRiskEvidence(
  ctx: Wave4AdapterContext,
  subjectRef?: string,
): readonly ExternalObservation<DigitalRiskEvidence>[] {
  const results: ExternalObservation<DigitalRiskEvidence>[] = [];
  for (const evidence of FIXTURE_DIGITAL_RISK) {
    if (subjectRef && evidence.subjectRef !== subjectRef) {
      continue;
    }
    const obs = observe(ctx, {
      providerId: evidence.providerId,
      category: 'fraud_risk',
      capability: 'ip_risk',
      dataset: 'risk-check',
      data: evidence,
      rawPayload: canonicalJsonStringify(evidence),
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchVulnerabilityObservations(
  ctx: Wave4AdapterContext,
): readonly ExternalObservation<VulnerabilityObservation>[] {
  const results: ExternalObservation<VulnerabilityObservation>[] = [];
  const failure = guardProvider(ctx, 'nvd');
  if (failure === 'INVALID_PAYLOAD') {
    return Object.freeze([]);
  }
  for (const vuln of FIXTURE_VULNERABILITIES) {
    const obs = observe(ctx, {
      providerId: 'nvd',
      category: 'cybersecurity',
      capability: 'vulnerability_intelligence',
      dataset: 'cve-feed',
      data: vuln,
      rawPayload: failure === 'INVALID_PAYLOAD' ? MALFORMED_JSON_FIXTURE : canonicalJsonStringify(vuln),
      authorityClass: 'authoritative_official',
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchThreatIndicators(
  ctx: Wave4AdapterContext,
): readonly ExternalObservation<ThreatIndicator>[] {
  const results: ExternalObservation<ThreatIndicator>[] = [];
  for (const indicator of FIXTURE_THREAT_INDICATORS) {
    const sanitized = {
      ...indicator,
      indicator: sanitizeUntrustedIndicator(indicator.indicator),
    };
    const obs = observe(ctx, {
      providerId: indicator.providerId,
      category: 'cybersecurity',
      capability: indicator.indicatorType === 'PHISHING_URL' ? 'phishing' : 'malicious_url',
      dataset: 'threat-feed',
      data: sanitized,
      rawPayload: canonicalJsonStringify(sanitized),
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchEndpointSecurityObservations(
  ctx: Wave4AdapterContext,
): readonly ExternalObservation<EndpointSecurityObservation>[] {
  const results: ExternalObservation<EndpointSecurityObservation>[] = [];
  for (const scan of FIXTURE_ENDPOINT_SECURITY) {
    const obs = observe(ctx, {
      providerId: scan.providerId,
      category: 'cybersecurity',
      capability: scan.scanType === 'TLS' ? 'tls_security' : 'http_security',
      dataset: 'endpoint-scan',
      data: scan,
      rawPayload: canonicalJsonStringify(scan),
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchServiceIncidentObservations(
  ctx: Wave4AdapterContext,
): readonly ExternalObservation<ServiceIncidentObservation>[] {
  const results: ExternalObservation<ServiceIncidentObservation>[] = [];
  for (const incident of FIXTURE_SERVICE_INCIDENTS) {
    const providerId = incident.source;
    const obs = observe(ctx, {
      providerId,
      category: 'cybersecurity',
      capability: 'outage_monitoring',
      dataset: 'service-status',
      data: incident,
      rawPayload: canonicalJsonStringify(incident),
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

/** Map CVE observations to SunRey dependencies without claiming exposure. */
export function mapDependencyVulnerabilities(
  vulnerabilities: readonly VulnerabilityObservation[],
  dependencies: readonly { dependencyId: string; dependencyName: string; dependencyVersion: string }[],
): readonly DependencyVulnerabilityMapping[] {
  const mappings: DependencyVulnerabilityMapping[] = [];
  for (const vuln of vulnerabilities) {
    for (const dep of dependencies) {
      let exposureStatus: DependencyExposureStatus = 'CVE_EXISTS';
      for (const product of vuln.affectedProducts) {
        if (product.toLowerCase().includes(dep.dependencyName.toLowerCase())) {
          exposureStatus = 'DEPENDENCY_POTENTIALLY_AFFECTED';
          const versionMatch = product.match(/<\s*([\d.]+)/);
          if (versionMatch && dep.dependencyVersion < versionMatch[1]!) {
            exposureStatus = 'CONFIRMED_VULNERABLE';
          }
        }
      }
      if (exposureStatus !== 'CVE_EXISTS' || vuln.affectedProducts.length === 0) {
        mappings.push(
          Object.freeze({
            dependencyId: dep.dependencyId,
            dependencyName: dep.dependencyName,
            dependencyVersion: dep.dependencyVersion,
            cveId: vuln.cveId,
            exposureStatus,
            evidenceRef: `nvd:${vuln.cveId}:${dep.dependencyId}`,
            assessedAt: vuln.retrievedAt,
          }),
        );
      }
    }
  }
  return Object.freeze(mappings);
}
