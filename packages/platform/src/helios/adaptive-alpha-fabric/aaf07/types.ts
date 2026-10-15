/**
 * AAF07 — external market-data provider certification (documentation, terms, semantics).
 * Certification gates adapter use; does not enable trading or live production connectivity.
 */

export const HELIOS_AAF07_CERTIFICATION_SCHEMA = 'sunrey.helios.aaf07.provider-certification.v1' as const;

export const COMMERCIAL_USE_STATUSES = [
  'ALLOWED',
  'ALLOWED_WITH_ATTRIBUTION',
  'ALLOWED_WITH_TERMS',
  'RESEARCH_ONLY',
  'PROHIBITED',
  'UNKNOWN',
] as const;
export type CommercialUseStatus = (typeof COMMERCIAL_USE_STATUSES)[number];

export const TIMESTAMP_SEMANTICS = [
  'UNIX_SECONDS_UTC',
  'UNIX_MILLISECONDS_UTC',
  'RFC3339_UTC',
  'VENUE_LOCAL_WITH_OFFSET',
  'UNKNOWN',
] as const;
export type TimestampSemantics = (typeof TIMESTAMP_SEMANTICS)[number];

export type ProviderRateLimitProfile = {
  readonly requestsPerMinute: number | null;
  readonly burstNotes: string | null;
  readonly counterHeader: string | null;
};

export type Aaf07ProviderCertificationRecord = {
  readonly schemaVersion: typeof HELIOS_AAF07_CERTIFICATION_SCHEMA;
  readonly providerId: string;
  readonly displayName: string;
  readonly documentationUrl: string;
  readonly accessTermsUrl: string;
  readonly commercialUseStatus: CommercialUseStatus;
  readonly commercialUseNotes: string;
  readonly timestampSemantics: TimestampSemantics;
  readonly rateLimits: ProviderRateLimitProfile;
  readonly verifiedAt: string;
  readonly verifiedBy: string;
  readonly grantsExecutionAuthority: false;
};

export type Aaf07CertificationVerdict = {
  readonly providerId: string;
  readonly certified: boolean;
  readonly blockers: readonly string[];
  readonly record: Aaf07ProviderCertificationRecord | null;
  readonly grantsExecutionAuthority: false;
};
