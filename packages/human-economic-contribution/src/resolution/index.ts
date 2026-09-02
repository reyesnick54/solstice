export { HUMAN_ECONOMY_UNIQUENESS_CONTROLS } from './audit.ts';
export { aggregationKeyForClass, isRecurringContributionClass, recurringKeysDistinct } from './aggregation.ts';
export { permittedRolesForClass, rolesRequiredForClass, validateContributorRole } from './authorship.ts';
export {
  buildCanonicalHumanContributionEvent,
  canonicalEventMaterialDigest,
  quantizePeriodForClass,
  rolesCompatible,
} from './canonical-event.ts';
export { buildResolutionCluster, canGenerateClaim, generateHumanEconomicClaim } from './claim-generation.ts';
export {
  classifyCrossIdentityConflict,
  commitmentKindFromObservation,
  createCrossIdentityIndex,
  detectCrossIdentityConflict,
  registerAuthoritativeIdentity,
} from './cross-identity.ts';
export { groupObservationsByCanonicalEvent, observationsShareCanonicalEvent, resolveCrossSourceObservations } from './cross-source.ts';
export { HumanContributionResolutionEngine, type HumanContributionResolutionSnapshot, type SubmitObservationInput } from './engine.ts';
export { deriveActorCommitment, deriveContributionResolutionFingerprint, fingerprintMaterialFromObservation } from './fingerprint.ts';
export {
  actorCommitmentFromAnchors,
  asAuthoritativeIdCommitment,
  asCanonicalHumanContributionEventId,
  asContributionResolutionFingerprint,
  asEvidenceObservationId,
  asHumanEconomicClaimId,
  asHumanEconomicIdentityId,
  asMonetizationConsumptionCommitment,
  asMonetizationContextId,
  asResolutionClusterId,
  asWalletBindingRef,
  authoritativeIdCommitmentFrom,
  canonicalHumanContributionEventIdFor,
  consumptionCommitmentOf,
  contentCommitmentFromEvidence,
  contributionResolutionFingerprintFor,
  evidenceObservationIdFor,
  humanEconomicClaimIdFor,
  humanEconomicIdentityIdFor,
  monetizationKeyOf,
  observationReplayKey,
  resolutionClusterIdFor,
  walletBindingRefFor,
} from './ids.ts';
export {
  HumanContributionMonetizationStore,
  emptyMonetizationLock,
  wave3CompatibleReplayKey as monetizationReplayKey,
} from './monetization-lock.ts';
export { assessContributionSplitting, nearDuplicateAuthoritativeIds, timestampAlterationSuspected } from './splitting.ts';
export type { AggregationKeyMaterial } from './aggregation.ts';
export type { CrossIdentityIndex } from './cross-identity.ts';
export type { CrossSourceResolutionResult } from './cross-source.ts';
export type { ResolutionFingerprintMaterial } from './fingerprint.ts';
export type { MonetizationTransitionResult } from './monetization-lock.ts';
export type { SplittingAssessment } from './splitting.ts';
export type { EconomicIdentityRegistry, WalletAliasResolver } from './wallet.ts';
export type {
  AuthoritativeIdCommitment,
  CanonicalHumanContributionEvent,
  CanonicalHumanContributionEventMaterial,
  ContributorRole,
  CrossIdentityConflict,
  CrossIdentityConflictCode,
  EvidenceObservation,
  HumanEconomicClaim,
  HumanEconomicClaimId,
  HumanEconomicIdentityId,
  HumanEconomicIdentityMaterial,
  MonetizationConsumptionCommitment,
  MonetizationContextId,
  MonetizationLock,
  MonetizationLockStatus,
  ResolutionCluster,
  ResolutionClusterId,
  ResolutionFailure,
  ResolutionFailureCode,
  ResolutionStatus,
  UniquenessControlAudit,
  WalletBindingMaterial,
  WalletBindingRef,
} from './types.ts';
export { RESOLUTION_ID_PREFIXES } from './types.ts';
export { createEconomicIdentityRegistry, resolveEconomicIdentity } from './wallet.ts';
