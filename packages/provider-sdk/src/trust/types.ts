/**
 * External Data Trust Engine — canonical trust result models.
 *
 * Deterministic, explainable trust outputs. No execution authority.
 */

import type { AuthorityClass, ExternalObservation, FreshnessStatus } from '../types.ts';
import type { TrustReason, TrustReasonCode } from './reason-codes.ts';

export const TRUST_RESULT_STATUSES = [
  'TRUSTED',
  'SUPPORTED',
  'LOW_CONFIDENCE',
  'CONFLICTED',
  'STALE',
  'INSUFFICIENT_DATA',
  'UNAVAILABLE',
] as const;
export type TrustResultStatus = (typeof TRUST_RESULT_STATUSES)[number];

export const CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const OUTLIER_STATUSES = ['NONE', 'OUTLIER', 'SUSPECTED_OUTLIER'] as const;
export type OutlierStatus = (typeof OUTLIER_STATUSES)[number];

export const SELECTION_METHODS = [
  'SINGLE_AUTHORITATIVE_SOURCE',
  'AUTHORITY_PRECEDENCE',
  'WEIGHTED_MEDIAN',
  'MEDIAN',
  'TRIMMED_MEAN',
  'MAJORITY_CATEGORICAL',
  'RETAIN_ALL',
  'NO_SELECTION',
] as const;
export type SelectionMethod = (typeof SELECTION_METHODS)[number];

export const TRUST_POLICY_PROFILES = [
  'FX_REFERENCE',
  'MARKET_REFERENCE',
  'MACROECONOMIC',
  'WEATHER',
  'ENERGY',
  'RESOURCE',
  'GEOSPATIAL',
  'COMPLIANCE_EVIDENCE',
  'CHAIN_STATE',
  'HEALTH_REFERENCE',
  'RESEARCH',
  'JOB_OPPORTUNITY',
  'GENERIC',
] as const;
export type TrustPolicyProfile = (typeof TRUST_POLICY_PROFILES)[number];

export const PROVIDER_HEALTH_TRUST = ['healthy', 'degraded', 'suspicious', 'quarantined'] as const;
export type ProviderHealthTrust = (typeof PROVIDER_HEALTH_TRUST)[number];

export const SCHEMA_VALIDITY_TRUST = ['valid', 'partially_valid', 'invalid'] as const;
export type SchemaValidityTrust = (typeof SCHEMA_VALIDITY_TRUST)[number];

/** Optional lineage metadata — only when known; never fabricated. */
export type ObservationLineage = {
  readonly upstreamSource?: string | null;
  readonly datasetOrigin?: string | null;
  readonly sourceFamily?: string | null;
};

export type TrustObservationContext<T = unknown> = {
  readonly observation: ExternalObservation<T>;
  readonly lineage?: ObservationLineage;
  /** Provider risk state from ProviderRiskMonitor when available. */
  readonly providerRiskState?: 'NORMAL' | 'DEGRADED' | 'SUSPICIOUS' | 'COMPROMISED_SUSPECTED' | 'DISABLED' | 'UNKNOWN' | null;
  readonly quarantined?: boolean;
  /** Canonical semantic identity for equivalence checks. */
  readonly semanticKey?: string | null;
  readonly unit?: string | null;
  /** Numeric value for numeric consensus strategies. */
  readonly numericValue?: number | null;
  readonly outlierStatus?: OutlierStatus;
};

export type AuthoritySummary = {
  readonly dominantClass: AuthorityClass | null;
  readonly classesPresent: readonly AuthorityClass[];
  readonly officialSourceCount: number;
};

export type TrustFactorAssessment = {
  readonly authority: AuthorityClass;
  readonly freshness: FreshnessStatus;
  readonly providerHealth: ProviderHealthTrust;
  readonly schemaValidity: SchemaValidityTrust;
  readonly corroborationCount: number;
  readonly providerDiversity: number;
  readonly outlierStatus: OutlierStatus;
};

export type CanonicalTrustResult<T> = {
  readonly canonicalValue: T | null;
  readonly canonicalUnit: string | null;
  readonly status: TrustResultStatus;
  readonly confidenceScore: number | null;
  readonly confidenceBand: ConfidenceBand;
  readonly freshness: FreshnessStatus;
  readonly inputObservationIds: readonly string[];
  readonly selectedObservationIds: readonly string[];
  readonly supportingObservationIds: readonly string[];
  readonly conflictingObservationIds: readonly string[];
  readonly excludedObservationIds: readonly string[];
  readonly authoritySummary: AuthoritySummary;
  readonly providerDiversity: number;
  readonly corroborationCount: number;
  readonly outlierStatus: OutlierStatus;
  readonly selectionMethod: SelectionMethod;
  readonly trustPolicyVersion: string;
  readonly trustPolicyProfile: TrustPolicyProfile;
  readonly reasons: readonly TrustReason[];
  readonly generatedAt: string;
  /** Trust metadata never grants execution authority. */
  readonly grantsExecutionAuthority: false;
};

export type TrustedObservationSet<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly trust: CanonicalTrustResult<T>;
};

export type CanonicalExternalValue<T> = {
  readonly value: T;
  readonly unit: string | null;
  readonly trust: CanonicalTrustResult<T>;
};

/** Audit record — references observation IDs, does not duplicate raw payloads. */
export type TrustResultRecord = {
  readonly recordId: string;
  readonly trustPolicyVersion: string;
  readonly trustPolicyProfile: TrustPolicyProfile;
  readonly inputObservationIds: readonly string[];
  readonly selectedObservationIds: readonly string[];
  readonly excludedObservationIds: readonly string[];
  readonly reasonCodes: readonly TrustReasonCode[];
  readonly status: TrustResultStatus;
  readonly confidenceBand: ConfidenceBand;
  readonly generatedAt: string;
};

export type TrustEvidenceMetadata = {
  readonly sourceCount: number;
  readonly corroborationCount: number;
  readonly confidenceBand: ConfidenceBand;
  readonly confidenceScore: number | null;
  readonly freshness: FreshnessStatus;
  readonly status: TrustResultStatus;
  readonly hasConflicts: boolean;
  readonly authorityDominant: AuthorityClass | null;
  readonly trustPolicyVersion: string;
  readonly grantsExecutionAuthority: false;
};
