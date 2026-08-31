/**
 * Deterministic Wave 4 provider fixtures — no live network in CI.
 */

import type {
  BusinessIdentityEvidence,
  ComplianceEvidence,
  DigitalRiskEvidence,
  EndpointSecurityObservation,
  ServiceIncidentObservation,
  ThreatIndicator,
  VulnerabilityObservation,
} from './models.ts';

export const FIXTURE_COMPLIANCE: readonly ComplianceEvidence[] = Object.freeze([
  {
    evidenceId: 'cmp-sanctions-clear-001',
    subjectRef: 'idn:jane-doe-1985-03-15',
    screeningType: 'SANCTIONS',
    matchStatus: 'NO_MATCH',
    matchScore: 0.02,
    matchedFields: Object.freeze([]),
    reasonCodes: Object.freeze(['NO_SANCTIONS_MATCH']),
    providerId: 'open-sanctions',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:open-sanctions:sanctions-screen',
    grantsDecision: false,
  },
  {
    evidenceId: 'cmp-sanctions-possible-001',
    subjectRef: 'idn:john-smith-1970-01-01',
    screeningType: 'SANCTIONS',
    matchStatus: 'POSSIBLE_MATCH',
    matchScore: 0.72,
    matchedFields: Object.freeze(['name']),
    reasonCodes: Object.freeze(['NAME_SIMILARITY_ONLY', 'DOB_MISMATCH', 'NATIONALITY_MISMATCH']),
    providerId: 'open-sanctions',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:open-sanctions:sanctions-screen',
    grantsDecision: false,
  },
  {
    evidenceId: 'cmp-pep-clear-001',
    subjectRef: 'idn:jane-doe-1985-03-15',
    screeningType: 'PEP',
    matchStatus: 'NO_MATCH',
    matchScore: 0.01,
    matchedFields: Object.freeze([]),
    reasonCodes: Object.freeze(['NO_PEP_MATCH']),
    providerId: 'open-sanctions',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:open-sanctions:pep-screen',
    grantsDecision: false,
  },
]);

export const FIXTURE_BUSINESS_IDENTITY: readonly BusinessIdentityEvidence[] = Object.freeze([
  {
    evidenceId: 'kyb-sunrey-uk-001',
    entityRef: 'biz:sunrey-ltd-uk',
    legalName: 'SunRey Financial Ltd',
    jurisdiction: 'GB',
    registrationNumber: '12345678',
    lei: '549300SUNREY00000001',
    status: 'ACTIVE',
    officers: Object.freeze([{ name: 'Jane Director', role: 'Director' }]),
    providerId: 'companies-house-uk',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:companies-house-uk:company-profile',
    grantsDecision: false,
  },
  {
    evidenceId: 'kyb-gleif-001',
    entityRef: 'biz:sunrey-ltd-uk',
    legalName: 'SunRey Financial Ltd',
    jurisdiction: 'GB',
    registrationNumber: null,
    lei: '549300SUNREY00000001',
    status: 'ACTIVE',
    officers: Object.freeze([]),
    providerId: 'gleif-lei',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:gleif-lei:lei-record',
    grantsDecision: false,
  },
]);

export const FIXTURE_DIGITAL_RISK: readonly DigitalRiskEvidence[] = Object.freeze([
  {
    evidenceId: 'dr-ip-low-001',
    subjectRef: 'ip:203.0.113.10',
    riskType: 'IP',
    riskLevel: 'LOW',
    riskScore: 12,
    indicators: Object.freeze(['RESIDENTIAL_IP']),
    providerId: 'ip-api',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:ip-api:ip-lookup',
    grantsDecision: false,
  },
  {
    evidenceId: 'dr-ip-high-001',
    subjectRef: 'ip:198.51.100.99',
    riskType: 'IP',
    riskLevel: 'HIGH',
    riskScore: 87,
    indicators: Object.freeze(['TOR_EXIT', 'KNOWN_PROXY']),
    providerId: 'abuseipdb',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:abuseipdb:check',
    grantsDecision: false,
  },
]);

export const FIXTURE_VULNERABILITIES: readonly VulnerabilityObservation[] = Object.freeze([
  {
    cveId: 'CVE-2024-12345',
    description: 'Example vulnerability in example-library before 1.2.3',
    publishedAt: '2024-06-15T00:00:00.000Z',
    modifiedAt: '2024-06-20T00:00:00.000Z',
    severity: 'HIGH',
    cvssVersion: '3.1',
    cvssScore: 7.5,
    vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    affectedProducts: Object.freeze(['example-library < 1.2.3']),
    references: Object.freeze(['https://nvd.nist.gov/vuln/detail/CVE-2024-12345']),
    providerId: 'nvd',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:nvd:cve-feed',
  },
]);

export const FIXTURE_THREAT_INDICATORS: readonly ThreatIndicator[] = Object.freeze([
  {
    indicator: 'http://malicious-example.test/phish',
    indicatorType: 'PHISHING_URL',
    classification: 'phishing',
    confidence: 0.95,
    firstSeen: '2026-08-01T00:00:00.000Z',
    lastSeen: '2026-08-29T00:00:00.000Z',
    targetBrand: 'SunRey',
    status: 'ACTIVE',
    providerId: 'phishstats',
    sourceRecord: 'fixture-phish-001',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:phishstats:phishing-feed',
  },
  {
    indicator: 'malware-distribution.test',
    indicatorType: 'MALICIOUS_DOMAIN',
    classification: 'malware',
    confidence: 0.88,
    firstSeen: '2026-07-15T00:00:00.000Z',
    lastSeen: '2026-08-28T00:00:00.000Z',
    targetBrand: null,
    status: 'ACTIVE',
    providerId: 'urlhaus',
    sourceRecord: 'fixture-urlhaus-001',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
    provenance: 'fixture:urlhaus:malicious-url-feed',
  },
]);

export const FIXTURE_ENDPOINT_SECURITY: readonly EndpointSecurityObservation[] = Object.freeze([
  {
    host: 'api.sunrey.dev',
    scanType: 'TLS',
    grade: 'A',
    tlsVersion: 'TLS 1.3',
    certificateStatus: 'VALID',
    httpSecurityHeaders: Object.freeze([]),
    observedAt: '2026-08-30T10:00:00.000Z',
    providerId: 'mozilla-tls-observatory',
    freshness: 'fresh',
    provenance: 'fixture:mozilla-tls-observatory:scan',
  },
  {
    host: 'api.sunrey.dev',
    scanType: 'HTTP',
    grade: 'B+',
    tlsVersion: null,
    certificateStatus: 'UNKNOWN',
    httpSecurityHeaders: Object.freeze([
      { name: 'Strict-Transport-Security', present: true },
      { name: 'Content-Security-Policy', present: true },
      { name: 'X-Frame-Options', present: false },
    ]),
    observedAt: '2026-08-30T10:00:00.000Z',
    providerId: 'mozilla-http-observatory',
    freshness: 'fresh',
    provenance: 'fixture:mozilla-http-observatory:scan',
  },
]);

export const FIXTURE_SERVICE_INCIDENTS: readonly ServiceIncidentObservation[] = Object.freeze([
  {
    serviceProvider: 'cloudflare',
    serviceName: 'Cloudflare CDN',
    status: 'OPERATIONAL',
    incidentType: 'none',
    startedAt: null,
    resolvedAt: null,
    region: 'GLOBAL',
    source: 'outagedeck',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
  },
  {
    serviceProvider: 'example-provider',
    serviceName: 'Example Provider API',
    status: 'DEGRADED',
    incidentType: 'performance',
    startedAt: '2026-08-30T08:00:00.000Z',
    resolvedAt: null,
    region: 'US-EAST',
    source: 'downstatus',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    freshness: 'fresh',
  },
]);

/** SunRey software dependencies for vulnerability mapping tests. */
export const SUNREY_DEPENDENCIES = Object.freeze([
  { dependencyId: 'dep-node', dependencyName: 'node', dependencyVersion: '22.14.0' },
  { dependencyId: 'dep-pg', dependencyName: 'pg', dependencyVersion: '8.13.0' },
  { dependencyId: 'dep-example-lib', dependencyName: 'example-library', dependencyVersion: '1.2.0' },
]);

export const MALFORMED_JSON_FIXTURE = '{"invalid": true, "cve": ';
export const RATE_LIMIT_FIXTURE = 'RATE_LIMITED';
export const TIMEOUT_PROVIDER = 'wave4-timeout-provider';
