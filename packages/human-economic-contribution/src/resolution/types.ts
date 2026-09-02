import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass, MeasurementUnit, SourceClass } from '../taxonomy.ts';

export type HumanEconomicIdentityId = string & { readonly __brand: 'HumanEconomicIdentityId' };
export type CanonicalHumanContributionEventId = string & { readonly __brand: 'CanonicalHumanContributionEventId' };
export type ContributionResolutionFingerprint = string & { readonly __brand: 'ContributionResolutionFingerprint' };
export type AuthoritativeIdCommitment = string & { readonly __brand: 'AuthoritativeIdCommitment' };
export type EvidenceObservationId = string & { readonly __brand: 'EvidenceObservationId' };
export type ResolutionClusterId = string & { readonly __brand: 'ResolutionClusterId' };
export type HumanEconomicClaimId = string & { readonly __brand: 'HumanEconomicClaimId' };
export type WalletBindingRef = string & { readonly __brand: 'WalletBindingRef' };
export type MonetizationContextId = string & { readonly __brand: 'MonetizationContextId' };
export type MonetizationConsumptionCommitment = string & { readonly __brand: 'MonetizationConsumptionCommitment' };

export const RESOLUTION_ID_PREFIXES = Object.freeze({
  humanEconomicIdentity: 'heid_',
  canonicalEvent: 'hcce_',
  resolutionFingerprint: 'hcrf_',
  authoritativeId: 'haic_',
  evidenceObservation: 'heobs_',
  resolutionCluster: 'hrcl_',
  humanEconomicClaim: 'heclm_',
  walletBinding: 'wbr_',
  monetizationContext: 'hctx_',
  consumptionCommitment: 'hccm_',
});

export type ContributorRole =
  | 'AUTHOR'
  | 'CO_AUTHOR'
  | 'DATA_CONTRIBUTOR'
  | 'RESEARCH_ASSISTANT'
  | 'EDITOR'
  | 'REVIEWER'
  | 'SERVICE_PROVIDER'
  | 'OTHER_GOVERNED_ROLE';

export type ResolutionStatus =
  | 'RESOLVED'
  | 'PENDING_CORROBORATION'
  | 'CONFLICT'
  | 'FRAUD_SUSPECTED'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'SPLITTING_SUSPECTED'
  | 'UNRESOLVED_DUPLICATE';

export type CrossIdentityConflictCode = 'CONFLICT' | 'FRAUD_SUSPECTED' | 'MANUAL_REVIEW_REQUIRED';

export type HumanEconomicIdentityMaterial = {
  readonly actorCommitment: string;
  readonly jurisdiction?: string;
};

export type WalletBindingMaterial = {
  readonly walletCommitment: string;
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
};

export type CanonicalHumanContributionEventMaterial = {
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly contributionClass: ContributionClass;
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly issuerCommitment?: string;
  readonly projectWorkIdentifier?: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly contentCommitment: string;
  readonly contributorRole?: ContributorRole;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: MeasurementUnit;
};

export type CanonicalHumanContributionEvent = CanonicalHumanContributionEventMaterial & {
  readonly canonicalEventId: CanonicalHumanContributionEventId;
  readonly resolutionFingerprint: ContributionResolutionFingerprint;
  readonly aggregationKey: string;
  readonly quantizedPeriodStart: UtcInstant;
  readonly quantizedPeriodEnd: UtcInstant | null;
};

export type EvidenceObservation = {
  readonly observationId: EvidenceObservationId;
  readonly sourceClass: SourceClass;
  readonly providerId: string;
  readonly providerRecordId: string;
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly walletBindingRef: WalletBindingRef | null;
  readonly contributionClass: ContributionClass;
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly issuerCommitment?: string;
  readonly projectWorkIdentifier?: string;
  readonly contentCommitment: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: MeasurementUnit;
  readonly contributorRole?: ContributorRole;
  readonly observedAtUtc: UtcInstant;
  readonly receiptId?: string;
  readonly credentialCommitment?: string;
};

export type ResolutionCluster = {
  readonly clusterId: ResolutionClusterId;
  readonly canonicalEventId: CanonicalHumanContributionEventId;
  readonly resolutionFingerprint: ContributionResolutionFingerprint;
  readonly observationIds: readonly EvidenceObservationId[];
  readonly sourceClasses: readonly SourceClass[];
  readonly resolutionStatus: ResolutionStatus;
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly claimId: HumanEconomicClaimId | null;
};

export type CrossIdentityConflict = {
  readonly authoritativeIdCommitment: AuthoritativeIdCommitment;
  readonly existingIdentityId: HumanEconomicIdentityId;
  readonly conflictingIdentityId: HumanEconomicIdentityId;
  readonly code: CrossIdentityConflictCode;
  readonly detectedAtUtc: UtcInstant;
};

export type HumanEconomicClaim = {
  readonly claimId: HumanEconomicClaimId;
  readonly canonicalEventId: CanonicalHumanContributionEventId;
  readonly resolutionFingerprint: ContributionResolutionFingerprint;
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly contributionClass: ContributionClass;
  readonly supportingObservationIds: readonly EvidenceObservationId[];
  readonly clusterId: ResolutionClusterId;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: MeasurementUnit;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly createdAtUtc: UtcInstant;
};

export type MonetizationLockStatus =
  | 'UNMONETIZED'
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'CONSUMED'
  | 'REJECTED'
  | 'REVOKED'
  | 'CHALLENGED';

export type MonetizationLock = {
  readonly status: MonetizationLockStatus;
  readonly contextId: MonetizationContextId | null;
  readonly consumptionCommitment: MonetizationConsumptionCommitment | null;
  readonly replayKey: string | null;
  readonly updatedAtUtc: UtcInstant;
};

export type ResolutionFailureCode =
  | 'OBSERVATION_REPLAY'
  | 'UNRESOLVED_DUPLICATE'
  | 'CROSS_IDENTITY_CONFLICT'
  | 'FRAUD_SUSPECTED'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'SPLITTING_SUSPECTED'
  | 'CLAIM_ALREADY_EXISTS'
  | 'CLAIM_NOT_RESOLVED'
  | 'DUPLICATE_MONETIZATION_KEY'
  | 'ALREADY_CONSUMED'
  | 'NOT_AUTHORIZED_FOR_CONSUMPTION'
  | 'CLUSTER_NOT_FOUND';

export type ResolutionFailure = {
  readonly code: ResolutionFailureCode;
  readonly message: string;
};

export type UniquenessControlAudit = {
  readonly control: string;
  readonly appliesToHumanEconomy: boolean;
  readonly scope: string;
  readonly wave6Extension: string | null;
};
