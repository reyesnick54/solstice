/**
 * Wave 4 — Economic Awareness Fabric shared types.
 *
 * Normalized observations, provider lineage, provenance, and entity
 * resolution inputs for the information plane. This layer has zero
 * monetary authority and does not mint or settle.
 */

import type { AuthorityClass } from '../../../provider-sdk/src/observation-types.ts';
import type { CanonicalDataSourceCategory } from '../productive/source-taxonomy/types.ts';
import type { FactType, UnitCode } from '../oracle/types.ts';

export const ECONOMIC_AWARENESS_FABRIC_ID = 'sunrey.economic-awareness-fabric.v1' as const;
export const ECONOMIC_AWARENESS_FABRIC_VERSION = 1 as const;

export const SOURCE_CLASS_KINDS = [
  'DIRECT_SENSOR',
  'PRIMARY_OPERATOR',
  'GOVERNMENT_REFERENCE',
  'SATELLITE_REMOTE',
  'ENTERPRISE_SYSTEM',
  'DERIVED_MODEL',
  'AGGREGATOR',
  'ATTESTATION',
  'CREDENTIAL',
  'RECEIPT',
  'RESEARCH_REFERENCE',
  'EMPLOYMENT_VERIFICATION',
  'COMPUTATION_RECEIPT',
  'AUTHORIZED_DATA_PROOF',
] as const;
export type SourceClassKind = (typeof SOURCE_CLASS_KINDS)[number];

export const RIGHTS_STATUSES = [
  'CLEAR',
  'RESTRICTED',
  'PROHIBITED',
  'UNKNOWN',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const INTEGRITY_STATUSES = [
  'VERIFIED',
  'TAMPERED',
  'INCOMPLETE',
  'UNVERIFIED',
] as const;
export type IntegrityStatus = (typeof INTEGRITY_STATUSES)[number];

export const ECONOMY_DOMAINS = ['PRODUCTIVE', 'HUMAN', 'REFERENCE'] as const;
export type EconomyDomain = (typeof ECONOMY_DOMAINS)[number];

export type ProviderLineage = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly upstreamSourceId: string | null;
  readonly upstreamOrganizationId: string;
  readonly controllerId: string;
  readonly sharedControlGroup: string | null;
  readonly lineageRootId: string;
  readonly sourceClass: SourceClassKind;
  readonly canonicalSourceCategory: CanonicalDataSourceCategory;
};

export type NormalizedEconomicObservation = {
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceClass: SourceClassKind;
  readonly canonicalSourceCategory: CanonicalDataSourceCategory;
  readonly factType: FactType;
  readonly subjectRef: string;
  readonly numericValue: number | null;
  readonly categoricalValue: string | null;
  readonly unit: UnitCode | null;
  readonly authorityClass: AuthorityClass;
  readonly observedAt: string;
  readonly collectedAt: string;
  readonly provenanceRef: string;
  readonly integrityStatus: IntegrityStatus;
  readonly rightsStatus: RightsStatus;
  readonly providerVerified: boolean;
  readonly lineage: ProviderLineage;
};

export type EntityResolutionBinding = {
  readonly entityId: string;
  readonly resolutionMethod: string;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly bindingRef: string;
};

export type ObservationContradiction = {
  readonly leftObservationId: string;
  readonly rightObservationId: string;
  readonly conflictKind: 'NUMERIC' | 'CATEGORICAL' | 'TEMPORAL' | 'RIGHTS';
  readonly detail: string;
};

export type CandidateEconomicProposition = {
  readonly propositionId: string;
  readonly domain: EconomyDomain;
  readonly factType: FactType;
  readonly subjectRef: string;
  readonly claimText: string;
  readonly unit: UnitCode | null;
  readonly expectedNumericValue: number | null;
  readonly measurementWindowStart: string;
  readonly measurementWindowEnd: string;
};

export const INFORMATION_CONSENSUS_CREATES_MONEY = false as const;
export const INFORMATION_CONSENSUS_GRANTS_EXECUTION_AUTHORITY = false as const;
