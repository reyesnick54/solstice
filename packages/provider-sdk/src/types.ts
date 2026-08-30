/**
 * Wave 1 — canonical external observation envelope.
 *
 * Shared normalization contract for third-party API payloads. Not a
 * provider integration, not a second oracle, and not Execution Authority.
 */

import type { UtcInstant } from '../../domain/src/time.ts';

export const EXTERNAL_OBSERVATION_SCHEMA = 'sunrey.external-observation.v1' as const;
export const NORMALIZATION_SCHEMA_VERSION = 1 as const;

export const PROVIDER_CATEGORIES = [
  'banking',
  'payments',
  'fx',
  'cards',
  'identity',
  'kyc',
  'kyb',
  'aml',
  'sanctions',
  'fraud',
  'travel_rule',
  'custody',
  'blockchain_analytics',
  'market_data',
  'oracle',
  'economic_data',
  'regulatory',
  'other',
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const AUTHORITY_CLASSES = [
  'authoritative_official',
  'regulated_provider',
  'reference_data',
  'research_data',
  'community_data',
  'derived_data',
] as const;
export type AuthorityClass = (typeof AUTHORITY_CLASSES)[number];

export const FRESHNESS_STATUSES = ['fresh', 'aging', 'stale', 'expired', 'unknown'] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const VALIDATION_STATUSES = [
  'valid',
  'schema_invalid',
  'bounds_invalid',
  'timestamp_invalid',
  'rejected_untrusted',
  'unknown',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const COMMERCIAL_USE_STATUSES = [
  'permitted',
  'restricted',
  'prohibited',
  'unknown',
] as const;
export type CommercialUseStatus = (typeof COMMERCIAL_USE_STATUSES)[number];

export const REDISTRIBUTION_STATUSES = [
  'permitted',
  'restricted',
  'prohibited',
  'unknown',
] as const;
export type RedistributionStatus = (typeof REDISTRIBUTION_STATUSES)[number];

export const CONFIDENCE_BASIS = [
  'authoritative_source',
  'regulated_provider',
  'schema_valid',
  'fresh',
  'corroborated',
  'provider_trust',
  'reference_data',
  'derived_only',
  'unknown',
] as const;
export type ConfidenceBasis = (typeof CONFIDENCE_BASIS)[number];

export type ObservationSource = {
  readonly provider: string;
  readonly dataset: string;
  readonly sourceUrl: string | null;
};

export type ObservationTime = {
  /** When SunRey retrieved the payload from the provider. */
  readonly retrievedAt: UtcInstant;
  /** When the provider says the underlying value was generated, if known. */
  readonly sourceTimestamp: UtcInstant | null;
  /** When the value is considered effective for use, if known. */
  readonly effectiveAt: UtcInstant | null;
  /** Hard expiry after which the observation must not be used without override. */
  readonly expiresAt: UtcInstant | null;
  /** Soft staleness boundary from provider/capability policy. */
  readonly staleAfter: UtcInstant | null;
};

export type ObservationConfidence = {
  /** 0.0–1.0 inclusive when scored; null when unknown. */
  readonly score: number | null;
  readonly basis: readonly ConfidenceBasis[];
};

export type ObservationQuality = {
  readonly confidence: ObservationConfidence;
  readonly freshnessStatus: FreshnessStatus;
  readonly validationStatus: ValidationStatus;
};

export type ObservationProvenance = {
  readonly requestId: string | null;
  readonly rawPayloadHash: string;
  readonly providerSchemaVersion: string;
  readonly normalizationVersion: string;
  readonly canonicalModelVersion: string | null;
};

export type ObservationLicensing = {
  readonly commercialUseStatus: CommercialUseStatus;
  readonly redistributionStatus: RedistributionStatus;
};

/**
 * Canonical normalized external observation envelope.
 * `data` holds provider-specific mapped domain payload after normalization.
 */
export type ExternalObservation<T> = {
  readonly observationId: string;
  readonly providerId: string;
  readonly providerCategory: ProviderCategory;
  readonly capability: string;
  readonly data: T;
  readonly source: ObservationSource;
  readonly time: ObservationTime;
  readonly quality: ObservationQuality;
  readonly authority: {
    readonly authorityClass: AuthorityClass;
  };
  readonly provenance: ObservationProvenance;
  readonly licensing: ObservationLicensing;
  readonly schemaVersion: typeof EXTERNAL_OBSERVATION_SCHEMA;
};

export type ProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };
