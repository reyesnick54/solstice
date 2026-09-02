/**
 * Wave 4 — EconomicObservationEnvelope.
 *
 * Shared information contract between external sources and the Wave 3
 * economic-proof architecture. Observations are economic inputs only.
 * They do not mint, set market price, or become VerifiedEconomicFacts.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MeasurementDimension } from '../../units/constitution.ts';
import type { GeographicReference } from './geography.ts';
import type { ObservationTimeWindow } from './time.ts';
import type { DomainExtension } from './extensions.ts';

export const ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA = 'sunrey.economic-observation-envelope.v1' as const;
export const ECONOMIC_OBSERVATION_ENVELOPE_VERSION = 1 as const;
export const NORMALIZATION_METHODOLOGY_VERSION = 'sunrey.economic-observation.normalization.v1' as const;
export const UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH = true as const;
export const OBSERVATION_IS_NOT_VERIFIED_FACT = true as const;
export const NORMALIZED_OBSERVATION_MINTS = false as const;

export const ECONOMIC_DOMAINS = [
  'ENERGY',
  'COMPUTE',
  'MANUFACTURING',
  'AGRICULTURE',
  'RESOURCES',
  'LOGISTICS',
  'BANDWIDTH',
  'WATER',
  'REAL_ESTATE',
  'RESEARCH',
  'WORKFORCE',
  'HEALTH_PUBLIC',
  'GEOSPATIAL',
  'REFERENCE',
  'HUMAN_ECONOMY',
  'OTHER',
] as const;
export type EconomicDomain = (typeof ECONOMIC_DOMAINS)[number];

export const SOURCE_CLASSES = [
  'SANDBOX_FIXTURE',
  'CERTIFIED_CANDIDATE',
  'INSTITUTIONAL',
  'SENSOR_NETWORK',
  'PUBLIC_REFERENCE',
  'RESEARCH_PUBLICATION',
  'GOVERNMENT_OPEN_DATA',
  'REGULATED_PROVIDER',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'SINGLE_SOURCE',
  'CORROBORATED',
  'DISPUTED',
  'STALE',
  'QUARANTINED',
] as const;
export type ObservationVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DISPUTE_STATUSES = ['NONE', 'OPEN', 'RESOLVED', 'ESCALATED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const FRESHNESS_STATES = ['FRESH', 'AGING', 'STALE', 'EXPIRED', 'UNKNOWN'] as const;
export type ObservationFreshnessState = (typeof FRESHNESS_STATES)[number];

export const RIGHTS_SCOPES = [
  'PUBLIC_DERIVED',
  'AGGREGATE_ONLY',
  'LICENSED_COMMERCIAL',
  'RESTRICTED_RESEARCH',
  'CONFIDENTIAL',
  'CONSENT_BOUND',
] as const;
export type RightsScope = (typeof RIGHTS_SCOPES)[number];

export const LICENSE_KINDS = [
  'CC_BY',
  'CC_BY_SA',
  'CC0',
  'OPEN_GOVERNMENT',
  'PROPRIETARY',
  'RESEARCH_ONLY',
  'SANDBOX_FIXTURE',
  'UNKNOWN',
] as const;
export type LicenseKind = (typeof LICENSE_KINDS)[number];

export const NORMALIZATION_REJECTION_CODES = [
  'UNLABELED_NUMERIC',
  'MISSING_METRIC',
  'MISSING_UNIT',
  'UNIT_UNKNOWN',
  'UNIT_INCOMPATIBLE',
  'DIMENSION_MISMATCH',
  'FLOAT_FORBIDDEN',
  'MISSING_TIME_CONTEXT',
  'INVALID_TIME_WINDOW',
  'MISSING_SOURCE_ID',
  'MISSING_PROVIDER_ID',
  'MISSING_PROVENANCE',
  'GEOGRAPHY_POLICY_VIOLATION',
  'ENTITY_AMBIGUOUS',
  'SCHEMA_VERSION_UNSUPPORTED',
  'LICENSE_FORBIDDEN',
  'DUPLICATE_FINGERPRINT',
] as const;
export type NormalizationRejectionCode = (typeof NORMALIZATION_REJECTION_CODES)[number];

export type NormalizedQuantity = {
  readonly mantissa: bigint;
  readonly scale: 0;
  readonly unit: string;
  readonly dimension: MeasurementDimension;
};

export type SourcePreservation = {
  readonly providerId: string;
  readonly sourceRecordId: string;
  readonly sourceDatasetId: string;
  readonly providerSchemaVersion: string;
  readonly providerSchemaId: string;
  readonly provenanceRef: string;
  readonly rawValueRef: string | null;
};

export type ObservationRights = {
  readonly license: LicenseKind;
  readonly rightsScope: RightsScope;
  readonly consentReference: string | null;
  readonly purposeReference: string | null;
};

export type ObservationFreshness = {
  readonly state: ObservationFreshnessState;
  readonly ageSeconds: bigint;
  readonly maxAgeSeconds: bigint | null;
};

export type ObservationConfidence = {
  readonly scoreBps: bigint | null;
  readonly basis: readonly string[];
};

export type EconomicObservationEnvelope = {
  readonly schemaVersion: typeof ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA;
  readonly envelopeVersion: typeof ECONOMIC_OBSERVATION_ENVELOPE_VERSION;
  readonly envelopeId: string;

  readonly providerId: string;
  readonly sourceClass: SourceClass;
  readonly source: SourcePreservation;

  readonly subjectOrResourceId: string;
  readonly canonicalEntityId: string | null;
  readonly eventId: string | null;

  readonly economicDomain: EconomicDomain;
  readonly category: string;
  readonly metric: string;

  readonly sourceValue: NormalizedQuantity;
  readonly normalizedValue: NormalizedQuantity;
  readonly canonicalUnit: string;

  readonly time: ObservationTimeWindow;
  readonly geography: GeographicReference;

  readonly provenanceHash: string;
  readonly evidenceHash: string | null;

  readonly rights: ObservationRights;
  readonly freshness: ObservationFreshness;
  readonly confidence: ObservationConfidence;
  readonly verificationStatus: ObservationVerificationStatus;
  readonly disputeStatus: DisputeStatus;

  readonly duplicateFingerprint: string;
  readonly lineageParentIds: readonly string[];

  readonly methodologyVersion: typeof NORMALIZATION_METHODOLOGY_VERSION;
  readonly extension: DomainExtension | null;

  readonly simulation: true;
  readonly environment: 'simulation';

  readonly verifiedFact: false;
  readonly mintsNativeAsset: false;
};

export type NormalizationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string };

export type QuarantinedObservation = {
  readonly quarantineId: string;
  readonly rejectedAt: UtcInstant;
  readonly code: NormalizationRejectionCode;
  readonly message: string;
  readonly source: SourcePreservation;
  readonly providerId: string;
  readonly economicDomain: EconomicDomain | null;
  readonly metric: string | null;
  readonly duplicateFingerprint: string | null;
  readonly rawPayloadDigest: string;
};

export function isEconomicDomain(value: string): value is EconomicDomain {
  return (ECONOMIC_DOMAINS as readonly string[]).includes(value);
}
