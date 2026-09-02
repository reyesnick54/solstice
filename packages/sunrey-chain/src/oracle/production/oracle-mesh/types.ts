/**
 * MoonRey Productive Oracle Mesh — canonical types.
 *
 * An oracle is an information source. It is NOT a monetary authority.
 * Observations feed Information Consensus; they do not mint MoonRey.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EconomicObservation } from '../../../economic-proof/types.ts';
import type { ProofFreshnessState } from '../../../economic-proof/constants.ts';

export const ORACLE_MESH_SCHEMA = 'sunrey.productive.oracle-mesh.v1' as const;
export const ORACLE_MESH_CAPABILITY = 'sunrey-productive-oracle-mesh' as const;

export const ORACLE_MESH_MINTS_MOONREY = false as const;
export const ORACLE_MESH_IS_NOT_MONETARY_AUTHORITY = true as const;
export const MARKET_REFERENCE_IS_NOT_PRODUCTION_PROOF = true as const;
export const CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED = true as const;
export const SINGLE_SOURCE_IS_NOT_CONSENSUS = true as const;

/** Productive domains supported by the oracle mesh. */
export const PRODUCTIVE_MESH_DOMAINS = [
  'ENERGY',
  'COMPUTE',
  'MANUFACTURING',
  'AGRICULTURE',
  'LOGISTICS',
  'WATER',
  'RESOURCES',
] as const;
export type ProductiveMeshDomain = (typeof PRODUCTIVE_MESH_DOMAINS)[number];

/** Wave 5 productive oracle source classes — specialized for physical economy. */
export const PRODUCTIVE_ORACLE_SOURCE_CLASSES = [
  'DIRECT_SENSOR',
  'PRIMARY_OPERATOR',
  'UTILITY_OR_GRID',
  'ENTERPRISE_SYSTEM',
  'GOVERNMENT',
  'SATELLITE',
  'GEOSPATIAL',
  'LOGISTICS_OPERATOR',
  'NETWORK_OPERATOR',
  'MARKET_REFERENCE',
  'ACADEMIC',
  'DERIVED_MODEL',
  'AGGREGATOR',
] as const;
export type ProductiveOracleSourceClass = (typeof PRODUCTIVE_ORACLE_SOURCE_CLASSES)[number];

/** Oracle disagreement levels — never blindly average conflicting data. */
export const ORACLE_DISAGREEMENT_LEVELS = [
  'AGREEMENT',
  'MINOR_VARIANCE',
  'OUTLIER',
  'MATERIAL_CONFLICT',
  'INSUFFICIENT_EVIDENCE',
] as const;
export type OracleDisagreementLevel = (typeof ORACLE_DISAGREEMENT_LEVELS)[number];

/** Evaluation outcomes for productive oracle mesh. */
export const ORACLE_MESH_RESULTS = [
  'PRODUCTIVE_FACT_SUPPORTED',
  'CORROBORATED',
  'SINGLE_SOURCE_ONLY',
  'POLICY_NOT_SATISFIED',
  'INSUFFICIENT_INDEPENDENT_SOURCES',
  'STALE_EVIDENCE',
  'INVALID_RIGHTS',
  'SOURCE_CLASS_REJECTED',
  'MARKET_REFERENCE_CANNOT_SUBSTITUTE',
  'MATERIAL_CONFLICT',
  'PROVIDER_OUTAGE',
  'REQUIRES_MANUAL_REVIEW',
] as const;
export type OracleMeshResult = (typeof ORACLE_MESH_RESULTS)[number];

export const ORACLE_MESH_EXPLANATION_CODES = [
  'INDEPENDENT_SOURCES_SATISFIED',
  'INDEPENDENT_SOURCES_INSUFFICIENT',
  'COPIED_SOURCES_COLLAPSED',
  'STALE_SOURCE_EXCLUDED',
  'OUTLIER_DETECTED',
  'MINOR_VARIANCE_WITHIN_TOLERANCE',
  'MATERIAL_CONFLICT_DETECTED',
  'MARKET_REFERENCE_NOT_PRODUCTION_EVIDENCE',
  'DIRECT_EVIDENCE_REQUIRED',
  'SOURCE_CLASS_NOT_PERMITTED',
  'RIGHTS_INVALID',
  'PROVIDER_OPERATIONALLY_UNAVAILABLE',
  'ECONOMIC_SUFFICIENCY_NOT_MET',
  'REPLAY_DEDUPLICATED',
  'MANUAL_REVIEW_TRIGGERED',
  'ORACLE_CANNOT_MINT',
  'SINGLE_SOURCE_PROHIBITED',
] as const;
export type OracleMeshExplanationCode = (typeof ORACLE_MESH_EXPLANATION_CODES)[number];

/** Provider and dataset lineage for source-independence analysis. */
export type ProviderLineage = {
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly datasetOriginId: string;
  readonly copiedFromProviderId: string | null;
  readonly derivedFromDatasetId: string | null;
  readonly sourceClass: ProductiveOracleSourceClass;
};

/** Rights and license gate for observation admission. */
export type ObservationRights = {
  readonly licenseId: string;
  readonly commercialUsePermitted: boolean;
  readonly redistributionPermitted: boolean;
  readonly purposeBound: boolean;
};

/** Raw productive source record before normalization. */
export type ProductiveSourceRecord = {
  readonly providerId: string;
  readonly sourceRecordId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly datasetOriginId: string;
  readonly copiedFromProviderId: string | null;
  readonly derivedFromDatasetId: string | null;
  readonly sourceClass: ProductiveOracleSourceClass;
  readonly domain: ProductiveMeshDomain;
  readonly subjectRef: string;
  readonly resourceRef: string;
  readonly metric: string;
  readonly value: bigint;
  readonly unit: string;
  readonly observedAtUtc: UtcInstant;
  readonly receivedAtUtc: UtcInstant;
  readonly freshnessState: ProofFreshnessState;
  readonly rights: ObservationRights;
  readonly evidenceRef: string;
  readonly payloadDigest: string;
  readonly providerAvailable: boolean;
};

/** Candidate productive event under evaluation. */
export type ProductiveCandidateEvent = {
  readonly eventId: string;
  readonly domain: ProductiveMeshDomain;
  readonly subjectRef: string;
  readonly resourceRef: string;
  readonly metric: string;
  readonly measurementStartUtc: UtcInstant;
  readonly measurementEndUtc: UtcInstant;
};

/** Productive asset reference for mesh evaluation. */
export type ProductiveMeshAsset = {
  readonly assetId: string;
  readonly domain: ProductiveMeshDomain;
  readonly canonicalRef: string;
  readonly displayLabel: string;
};

/** Tolerance assessment for numeric corroboration. */
export type ToleranceAssessment = {
  readonly toleranceBps: number;
  readonly spreadBps: number;
  readonly withinTolerance: boolean;
  readonly medianValue: bigint;
  readonly values: readonly bigint[];
};

/** Conflict report between observations. */
export type OracleConflictReport = {
  readonly disagreementLevel: OracleDisagreementLevel;
  readonly outlierProviderIds: readonly string[];
  readonly spreadBps: number;
  readonly detail: string;
};

/** Freshness summary across admitted observations. */
export type MeshFreshnessSummary = {
  readonly worstState: ProofFreshnessState;
  readonly staleExcludedCount: number;
  readonly admittedCount: number;
};

/** Versioned quorum / verification policy — not monetary supply policy. */
export type ProductiveVerificationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly domain: ProductiveMeshDomain;
  readonly requiredSourceClasses: readonly ProductiveOracleSourceClass[];
  readonly minimumIndependentSources: number;
  readonly optionalSourceClasses: readonly ProductiveOracleSourceClass[];
  readonly freshnessMaxAgeSeconds: number;
  readonly toleranceRangeBps: number;
  readonly requiredDirectEvidence: boolean;
  readonly manualReviewTriggers: readonly OracleDisagreementLevel[];
  readonly confidenceThresholdBps: number;
  readonly prohibitSingleSource: boolean;
};

/** Auditable oracle mesh evaluation receipt — feeds Information Consensus. */
export type ProductiveOracleEvaluation = {
  readonly schema: typeof ORACLE_MESH_SCHEMA;
  readonly evaluationId: string;
  readonly productiveAsset: ProductiveMeshAsset;
  readonly candidateEvent: ProductiveCandidateEvent;
  readonly observations: readonly EconomicObservation[];
  readonly providers: readonly string[];
  readonly sourceClasses: readonly ProductiveOracleSourceClass[];
  readonly providerLineage: readonly ProviderLineage[];
  readonly independentSourceCount: number;
  readonly rawSourceCount: number;
  readonly freshness: MeshFreshnessSummary;
  readonly conflicts: OracleConflictReport;
  readonly tolerances: ToleranceAssessment | null;
  readonly result: OracleMeshResult;
  readonly methodologyPolicyVersion: string;
  readonly explanationCodes: readonly OracleMeshExplanationCode[];
  readonly evaluatedAtUtc: UtcInstant;
  readonly mintsMoonRey: false;
  readonly grantsExecutionAuthority: false;
};
