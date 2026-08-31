/**
 * Wave 4 canonical evidence and intelligence models.
 *
 * Observations only — no execution authority, compliance decisions, or balances.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';

/** Compliance screening evidence — sanctions, PEP, watchlists. */
export type ComplianceEvidence = {
  readonly evidenceId: string;
  readonly subjectRef: string;
  readonly screeningType: 'SANCTIONS' | 'PEP' | 'WATCHLIST' | 'ADVERSE_MEDIA';
  readonly matchStatus: 'NO_MATCH' | 'POSSIBLE_MATCH' | 'CONFIRMED_MATCH' | 'UNAVAILABLE';
  readonly matchScore: number | null;
  readonly matchedFields: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly providerId: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
  readonly grantsDecision: false;
};

/** KYB / corporate identity evidence. */
export type BusinessIdentityEvidence = {
  readonly evidenceId: string;
  readonly entityRef: string;
  readonly legalName: string;
  readonly jurisdiction: string;
  readonly registrationNumber: string | null;
  readonly lei: string | null;
  readonly status: 'ACTIVE' | 'DISSOLVED' | 'UNKNOWN' | 'UNAVAILABLE';
  readonly officers: readonly { readonly name: string; readonly role: string }[];
  readonly providerId: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
  readonly grantsDecision: false;
};

/** Fraud / digital-risk evidence — IP, email, device, network. */
export type DigitalRiskEvidence = {
  readonly evidenceId: string;
  readonly subjectRef: string;
  readonly riskType: 'IP' | 'EMAIL' | 'DEVICE' | 'NETWORK' | 'BEHAVIORAL';
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN' | 'UNAVAILABLE';
  readonly riskScore: number | null;
  readonly indicators: readonly string[];
  readonly providerId: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
  readonly grantsDecision: false;
};

/** CVE vulnerability observation — not a duplicate canonical CVE registry. */
export type VulnerabilityObservation = {
  readonly cveId: string;
  readonly description: string;
  readonly publishedAt: string;
  readonly modifiedAt: string;
  readonly severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  readonly cvssVersion: string | null;
  readonly cvssScore: number | null;
  readonly vector: string | null;
  readonly affectedProducts: readonly string[];
  readonly references: readonly string[];
  readonly providerId: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
};

/** Dependency exposure status — distinct from CVE existence. */
export type DependencyExposureStatus =
  | 'CVE_EXISTS'
  | 'DEPENDENCY_POTENTIALLY_AFFECTED'
  | 'CONFIRMED_VULNERABLE'
  | 'NOT_AFFECTED'
  | 'UNKNOWN';

export type DependencyVulnerabilityMapping = {
  readonly dependencyId: string;
  readonly dependencyName: string;
  readonly dependencyVersion: string;
  readonly cveId: string;
  readonly exposureStatus: DependencyExposureStatus;
  readonly evidenceRef: string;
  readonly assessedAt: string;
};

export const THREAT_INDICATOR_TYPES = [
  'MALICIOUS_URL',
  'PHISHING_URL',
  'MALWARE_URL',
  'MALICIOUS_DOMAIN',
  'SUSPICIOUS_IP',
] as const;
export type ThreatIndicatorType = (typeof THREAT_INDICATOR_TYPES)[number];

/** Threat intelligence indicator — source payload treated as untrusted. */
export type ThreatIndicator = {
  readonly indicator: string;
  readonly indicatorType: ThreatIndicatorType;
  readonly classification: string;
  readonly confidence: number | null;
  readonly firstSeen: string | null;
  readonly lastSeen: string | null;
  readonly targetBrand: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  readonly providerId: string;
  readonly sourceRecord: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
};

export type EndpointSecurityObservation = {
  readonly host: string;
  readonly scanType: 'TLS' | 'HTTP' | 'COMBINED';
  readonly grade: string | null;
  readonly tlsVersion: string | null;
  readonly certificateStatus: 'VALID' | 'EXPIRED' | 'INVALID' | 'UNKNOWN';
  readonly httpSecurityHeaders: readonly { readonly name: string; readonly present: boolean }[];
  readonly observedAt: string;
  readonly providerId: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly provenance: string;
};

export type ServiceIncidentObservation = {
  readonly serviceProvider: string;
  readonly serviceName: string;
  readonly status: 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' | 'UNKNOWN';
  readonly incidentType: string;
  readonly startedAt: string | null;
  readonly resolvedAt: string | null;
  readonly region: string | null;
  readonly source: string;
  readonly retrievedAt: string;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
};

export const PROVIDER_RISK_STATES = [
  'NORMAL',
  'DEGRADED',
  'SUSPICIOUS',
  'COMPROMISED_SUSPECTED',
  'DISABLED',
  'UNKNOWN',
] as const;
export type ProviderRiskState = (typeof PROVIDER_RISK_STATES)[number];

export const PROVIDER_RISK_DIMENSIONS = [
  'availability',
  'security',
  'data_integrity',
  'credential',
  'licensing_governance',
] as const;
export type ProviderRiskDimension = (typeof PROVIDER_RISK_DIMENSIONS)[number];

export type ProviderRiskFactor = {
  readonly dimension: ProviderRiskDimension;
  readonly contribution: number;
  readonly reason: string;
};

export type ProviderRiskScore = {
  readonly providerId: string;
  readonly score: number;
  readonly state: ProviderRiskState;
  readonly factors: readonly ProviderRiskFactor[];
  readonly assessedAt: string;
  readonly quarantined: boolean;
  readonly quarantineReason: string | null;
};

export type ProviderQuarantineRecord = {
  readonly providerId: string;
  readonly quarantinedAt: string;
  readonly reason: string;
  readonly triggeredBy: string;
  readonly previousState: ProviderRiskState;
  readonly restoredAt: string | null;
  readonly restorationValidated: boolean;
};

export type Wave4CoverageStatus =
  | 'IMPLEMENTED'
  | 'BLOCKED'
  | 'DEPRECATED'
  | 'UNAVAILABLE'
  | 'NOT_WAVE_4';

export type Wave4ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: Wave4CoverageStatus;
  readonly notes: string;
};

export type ExternalComplianceObservation = ExternalObservation<ComplianceEvidence>;
export type ExternalBusinessIdentityObservation = ExternalObservation<BusinessIdentityEvidence>;
export type ExternalDigitalRiskObservation = ExternalObservation<DigitalRiskEvidence>;
export type ExternalVulnerabilityObservation = ExternalObservation<VulnerabilityObservation>;
export type ExternalThreatIndicatorObservation = ExternalObservation<ThreatIndicator>;
export type ExternalEndpointSecurityObservation = ExternalObservation<EndpointSecurityObservation>;
export type ExternalServiceIncidentObservation = ExternalObservation<ServiceIncidentObservation>;
