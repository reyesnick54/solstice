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

export type RegisteredEconomicObservation = {
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
/**
 * Wave 3 — Economic Proof lattice shared types.
 */

import type {
  CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
  ChallengeStatus,
  EconomicClaimType,
  EconomicDomain,
  ECONOMIC_EVIDENCE_SCHEMA_VERSION,
  ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  EvidenceKind,
  MonetizationStatus,
  ProofFreshnessState,
  ProofIntegrityState,
  ProofSourceClass,
  ProofVerificationStatus,
  VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
} from './constants.ts';

export type GeographicContext = {
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly locality: string | null;
};

export type TemporalBounds = {
  readonly startUtc: string;
  readonly endUtc: string;
};

export type GeographicBounds = {
  readonly jurisdiction: string;
  readonly region: string | null;
};

export type LabeledQuantity = {
  readonly value: bigint;
  readonly unit: string;
  readonly metric: string;
};

export type ProvenanceReference = {
  readonly provenanceId: string;
  readonly sourceId: string;
  readonly method: string;
  readonly collectedAtUtc: string;
};

export type RightsReference = {
  readonly rightsId: string;
  readonly scopeDigest: string;
  readonly purposeDigest: string;
};

export type LicenseReference = {
  readonly licenseId: string;
  readonly licenseClass: string;
  readonly permittedUseDigest: string;
};

export type PolicyReference = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly methodologyDigest: string;
};

export type ContentReference = {
  readonly contentDigest: string;
  readonly storageRef: string | null;
  readonly encryptionEnvelopeRef: string | null;
};

export type FreshnessAssessment = {
  readonly state: ProofFreshnessState;
  readonly observedAtUtc: string;
  readonly receivedAtUtc: string;
  readonly maxAgeSeconds: bigint;
  readonly expiresAtUtc: string;
};

export type ConfidenceAssessment = {
  readonly scoreBps: number;
  readonly sampleCount: number;
  readonly notesRef: string | null;
};

/** Authority boundary — observations cannot mint, issue, or set market price. */
export type ObservationAuthorityBoundary = {
  readonly mintsNativeAsset: false;
  readonly issuesExecutionAuthority: false;
  readonly setsExchangePrice: false;
  readonly authorizesGovernance: false;
};

/**
 * Canonical Wave 3 economic observation: a source reported or measured something.
 * Distinct from oracle `OracleObservation` and economy-data `EconomicObservation`.
 */
export type EconomicObservation = {
  readonly schemaVersion: typeof ECONOMIC_OBSERVATION_SCHEMA_VERSION;
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceClass: ProofSourceClass;
  readonly economicDomain: EconomicDomain;
  readonly subjectRef: string;
  readonly resourceRef: string | null;
  readonly metric: string;
  readonly quantity: LabeledQuantity;
  readonly observedAtUtc: string;
  readonly receivedAtUtc: string;
  readonly geographicContext: GeographicContext;
  readonly jurisdiction: string;
  readonly provenanceRef: ProvenanceReference;
  readonly evidenceRefs: readonly string[];
  readonly licenseRef: LicenseReference;
  readonly verificationStatus: ProofVerificationStatus;
  readonly confidence: ConfidenceAssessment;
  readonly freshness: FreshnessAssessment;
  readonly integrity: ProofIntegrityState;
  readonly simulation: true;
  readonly authority: ObservationAuthorityBoundary;
};

export type EvidenceMaterialReference = {
  readonly kind: EvidenceKind;
  readonly materialDigest: string;
  readonly externalRef: string | null;
  readonly attestationRef: string | null;
};

/** Authority boundary — evidence cannot mint or authorize governance. */
export type EvidenceAuthorityBoundary = {
  readonly mintsNativeAsset: false;
  readonly issuesExecutionAuthority: false;
  readonly replacesVaultAuthority: false;
};

/**
 * Material supporting or refuting an economic claim. Raw sensitive content stays off-chain.
 */
export type EconomicEvidence = {
  readonly schemaVersion: typeof ECONOMIC_EVIDENCE_SCHEMA_VERSION;
  readonly evidenceId: string;
  readonly economicDomain: EconomicDomain;
  readonly subjectRef: string;
  readonly observationIds: readonly string[];
  readonly materials: readonly EvidenceMaterialReference[];
  readonly provenanceRefs: readonly ProvenanceReference[];
  readonly rightsRefs: readonly RightsReference[];
  readonly licenseRef: LicenseReference;
  readonly purposeDigest: string;
  readonly consentReceiptDigest: string | null;
  readonly sealedAtUtc: string;
  readonly contentCommitment: string;
  readonly simulation: true;
  readonly authority: EvidenceAuthorityBoundary;
};

export type VerifierAttribution = {
  readonly verifierId: string;
  readonly verifierClass: 'POLICY_ENGINE' | 'ORACLE_QUORUM' | 'HUMAN_REVIEW' | 'MULTI_SOURCE';
  readonly signatureRef: string | null;
};

/** Authority boundary — verified facts cannot mint. */
export type VerifiedFactAuthorityBoundary = {
  readonly mintsNativeAsset: false;
  readonly issuesExecutionAuthority: false;
  readonly overridesTaxonomy: false;
};

/**
 * System-determined fact under a verification methodology. Not monetary authorization.
 */
export type VerifiedEconomicFact = {
  readonly schemaVersion: typeof VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION;
  readonly verifiedFactId: string;
  readonly economicDomain: EconomicDomain;
  readonly subjectRef: string;
  readonly resourceRef: string | null;
  readonly metric: string;
  readonly quantity: LabeledQuantity;
  readonly verificationMethodologyId: string;
  readonly verificationMethodologyVersion: string;
  readonly supportingEvidenceIds: readonly string[];
  readonly verifiedAtUtc: string;
  readonly verifiers: readonly VerifierAttribution[];
  readonly confidence: ConfidenceAssessment;
  readonly verificationStatus: ProofVerificationStatus;
  readonly challengeStatus: ChallengeStatus;
  readonly temporalBounds: TemporalBounds;
  readonly geographicBounds: GeographicBounds;
  readonly simulation: true;
  readonly authority: VerifiedFactAuthorityBoundary;
};

export type ClaimLineage = {
  readonly parentClaimId: string | null;
  readonly supersededByClaimId: string | null;
  readonly derivationPath: readonly string[];
};

/** Authority boundary — claims cannot mint or hold balances. */
export type ClaimAuthorityBoundary = {
  readonly mintsNativeAsset: false;
  readonly issuesExecutionAuthority: false;
  readonly isWalletBalance: false;
};

/**
 * Canonical economic event or proposition eligible for downstream valuation.
 * Human and productive domains remain distinct.
 */
export type CanonicalEconomicClaim = {
  readonly schemaVersion: typeof CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION;
  readonly economicClaimId: string;
  readonly claimType: EconomicClaimType;
  readonly economicDomain: EconomicDomain;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly subjectRef: string;
  readonly resourceRef: string | null;
  readonly temporalBounds: TemporalBounds;
  readonly geographicBounds: GeographicBounds;
  readonly supportingFactIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly provenanceRefs: readonly ProvenanceReference[];
  readonly rightsRefs: readonly RightsReference[];
  readonly policyRefs: readonly PolicyReference[];
  readonly lineage: ClaimLineage;
  readonly duplicateFingerprint: string;
  readonly verificationStatus: ProofVerificationStatus;
  readonly challengeStatus: ChallengeStatus;
  readonly monetizationStatus: MonetizationStatus;
  readonly simulation: true;
  readonly authority: ClaimAuthorityBoundary;
};

export type ProofRejectionCode =
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'MISSING_REQUIRED_ID'
  | 'INVALID_TEMPORAL_RANGE'
  | 'INVALID_ECONOMIC_DOMAIN'
  | 'NEGATIVE_PHYSICAL_QUANTITY'
  | 'UNLABELED_NUMERIC'
  | 'MISSING_PROVENANCE'
  | 'MISSING_METRIC'
  | 'MISSING_UNIT'
  | 'MONETARY_AUTHORITY_FORBIDDEN'
  | 'RAW_PAYLOAD_REQUIRED'
  | 'DOMAIN_MISMATCH'
  | 'MALFORMED_CLAIM';

export type ProofResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ProofRejectionCode; readonly message: string };
