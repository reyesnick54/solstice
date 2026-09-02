import type { UtcInstant } from '../../../domain/src/time.ts';

export const ECONOMIC_PROOF_SCHEMA_VERSION = 'sunrey.economic-proof.v1' as const;

export type EconomyKind = 'HUMAN' | 'PRODUCTIVE';

export type EntityKind =
  | 'PSEUDONYMOUS_PERSON'
  | 'FACTORY'
  | 'COMPUTE_CLUSTER'
  | 'POWER_PLANT'
  | 'FARM'
  | 'VEHICLE_FLEET'
  | 'PARCEL'
  | 'RESEARCH_CONTRIBUTION'
  | 'PRODUCTIVE_ASSET';

export type CanonicalEntityId = string & { readonly __brand: 'CanonicalEntityId' };
export type CanonicalEventId = string & { readonly __brand: 'CanonicalEventId' };
export type ObservationFingerprint = string & { readonly __brand: 'ObservationFingerprint' };
export type ClaimFingerprint = string & { readonly __brand: 'ClaimFingerprint' };
export type DuplicateClusterId = string & { readonly __brand: 'DuplicateClusterId' };
export type EconomicClaimId = string & { readonly __brand: 'EconomicClaimId' };
export type EconomicObservationId = string & { readonly __brand: 'EconomicObservationId' };
export type MonetizationContextId = string & { readonly __brand: 'MonetizationContextId' };
export type MonetizationConsumptionCommitment = string & { readonly __brand: 'MonetizationConsumptionCommitment' };

export type MonetizationLockStatus =
  | 'UNMONETIZED'
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'CONSUMED'
  | 'REJECTED'
  | 'REVOKED'
  | 'CHALLENGED';

export type ChallengeStatus =
  | 'NONE'
  | 'OPEN'
  | 'MATERIAL_DISPUTE'
  | 'RESOLVED_UPHELD'
  | 'RESOLVED_INVALIDATED';

export type ClusterResolutionStatus =
  | 'SINGLE_OBSERVATION'
  | 'CORROBORATING'
  | 'PENDING_REVIEW'
  | 'RESOLVED_SINGLE_EVENT';

export type LineageEdgeKind =
  | 'OBSERVED_FROM'
  | 'ATTESTED_BY'
  | 'TRANSFORMED_FROM'
  | 'AGGREGATED_FROM'
  | 'NORMALIZED_FROM'
  | 'DERIVED_FROM'
  | 'PRODUCED';

export type LineageEdge = {
  readonly kind: LineageEdgeKind;
  readonly parentRef: string;
  readonly childRef: string;
  readonly methodologyVersion?: string;
  readonly transformation?: string;
};

export type LineageRecord = {
  readonly edges: readonly LineageEdge[];
  readonly methodologyVersion: string;
  readonly producedRefs: readonly string[];
};

export type MonetizationLock = {
  readonly status: MonetizationLockStatus;
  readonly contextId: MonetizationContextId | null;
  readonly consumptionCommitment: MonetizationConsumptionCommitment | null;
  readonly replayKey: string | null;
  readonly updatedAtUtc: UtcInstant;
};

export type ChallengeState = {
  readonly status: ChallengeStatus;
  readonly reason: string | null;
  readonly openedAtUtc: UtcInstant | null;
  readonly resolvedAtUtc: UtcInstant | null;
};

export type EntityAliasRef = {
  readonly aliasKind: string;
  readonly aliasValueCommitment: string;
};

export type CanonicalEntityMaterial = {
  readonly economy: EconomyKind;
  readonly entityKind: EntityKind;
  readonly entityCommitment: string;
  readonly jurisdiction?: string;
};

export type CanonicalEventMaterial = {
  readonly canonicalEntityId: CanonicalEntityId;
  readonly economicAction: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly locationCommitment?: string;
  readonly domainIdentifierCommitment?: string;
};

export type EconomicObservation = {
  readonly schemaVersion: typeof ECONOMIC_PROOF_SCHEMA_VERSION;
  readonly observationId: EconomicObservationId;
  readonly economy: EconomyKind;
  readonly providerId: string;
  readonly sourceClass: string;
  readonly providerRecordId: string;
  readonly observationFingerprint: ObservationFingerprint;
  readonly payloadDigest: string;
  readonly observedAtUtc: UtcInstant;
  readonly canonicalEntityId: CanonicalEntityId;
  readonly canonicalEventId: CanonicalEventId;
};

export type EconomicClaim = {
  readonly schemaVersion: typeof ECONOMIC_PROOF_SCHEMA_VERSION;
  readonly claimId: EconomicClaimId;
  readonly economy: EconomyKind;
  readonly canonicalEntityId: CanonicalEntityId;
  readonly canonicalEventId: CanonicalEventId;
  readonly claimFingerprint: ClaimFingerprint;
  readonly duplicateClusterId: DuplicateClusterId;
  readonly observationIds: readonly EconomicObservationId[];
  readonly sourceClasses: readonly string[];
  readonly lineage: LineageRecord;
  readonly monetizationLock: MonetizationLock;
  readonly challengeState: ChallengeState;
  readonly economicAction: string;
  readonly quantity: bigint;
  readonly unit: string;
};

export type DuplicateCluster = {
  readonly clusterId: DuplicateClusterId;
  readonly canonicalEventId: CanonicalEventId;
  readonly economy: EconomyKind;
  readonly observationIds: readonly EconomicObservationId[];
  readonly sourceClasses: readonly string[];
  readonly claimId: EconomicClaimId | null;
  readonly resolutionStatus: ClusterResolutionStatus;
  readonly confidence: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type EntityAliasResolver = {
  readonly resolveAlias: (alias: EntityAliasRef) => CanonicalEntityId | null;
  readonly registerAlias?: (alias: EntityAliasRef, canonicalEntityId: CanonicalEntityId) => void;
};

export type MonetizationPolicy = {
  readonly allowProgressionUnderChallenge: boolean;
};

export const DEFAULT_MONETIZATION_POLICY: MonetizationPolicy = Object.freeze({
  allowProgressionUnderChallenge: false,
});
