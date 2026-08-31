/**
 * Wave 1 — canonical external observation envelope types.
 */

import type { UtcInstant } from '../../domain/src/time.ts';

export const EXTERNAL_OBSERVATION_SCHEMA = 'sunrey.external-observation.v1' as const;
export const NORMALIZATION_SCHEMA_VERSION = 1 as const;

/** Catalog-aligned and regulated-provider categories for external observations. */
export const OBSERVATION_PROVIDER_CATEGORIES = [
  'macroeconomics',
  'foreign_exchange',
  'markets',
  'securities',
  'commodities',
  'corporate_filings',
  'government_open_data',
  'research',
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
export type ObservationProviderCategory = (typeof OBSERVATION_PROVIDER_CATEGORIES)[number];

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
  readonly retrievedAt: UtcInstant;
  readonly sourceTimestamp: UtcInstant | null;
  readonly effectiveAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly staleAfter: UtcInstant | null;
};

export type ObservationConfidence = {
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

export type ExternalObservation<T> = {
  readonly observationId: string;
  readonly providerId: string;
  readonly providerCategory: ObservationProviderCategory;
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
