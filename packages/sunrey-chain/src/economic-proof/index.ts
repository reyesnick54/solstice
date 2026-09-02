export { WAVE3_ECONOMIC_PROOF_CAPABILITY } from './capability.ts';

export * from './policy/index.ts';
export * from './evidence/index.ts';
export * from './rights/index.ts';
export * from './human-economy/index.ts';
export * from './roots/index.ts';
export * as rights from './rights/index.ts';
export * as humanEconomy from './human-economy/index.ts';
export * as stateCommitment from './state-commitment/index.ts';
export { merkleRoot, merkleLeaf, sortedMerkleRoot } from './merkle.ts';
export { EXISTING_DUPLICATE_PROTECTIONS, WAVE3_GAPS_ADDRESSED } from './audit.ts';
export { deriveClaimFingerprint } from './claim-fingerprint.ts';
export {
  buildDuplicateCluster,
  deriveDuplicateClusterId,
  mergeClusterObservations,
} from './duplicate-cluster.ts';
export { deriveCanonicalEntityId, entityCommitmentFromRefs, resolveEntityAlias } from './entity-identity.ts';
export { deriveCanonicalEventId, quantizeToHour } from './event-identity.ts';
export { economicProofDigest } from './hash.ts';
export { appendLineageEdge, buildLineageRecord, normalizeLineageEdges, wouldCreateLineageCycle } from './lineage.ts';
export {
  authorizeMonetization,
  challengeBlocksMonetization,
  consumeMonetization,
  deriveConsumptionCommitment,
  emptyMonetizationLock,
  initialChallengeState,
  openChallenge,
  proposeMonetization,
  rejectMonetization,
  resolveChallenge,
  revokeMonetization,
} from './monetization-lock.ts';
export { deriveObservationFingerprint, isObservationReplay } from './observation-fingerprint.ts';
export {
  EconomicClaimRegistry,
  type EconomicClaimRegistrySnapshot,
  type RegisterClaimInput,
  type RegisterObservationInput,
  type RegistryFailure,
} from './registry.ts';
export {
  DEFAULT_MONETIZATION_POLICY,
  ECONOMIC_PROOF_SCHEMA_VERSION,
  type CanonicalEntityMaterial,
  type CanonicalEventMaterial,
  type ChallengeState,
  type ClaimFingerprint,
  type DuplicateCluster,
  type EconomicClaim,
  type EconomicObservation,
  type EntityAliasRef,
  type EntityAliasResolver,
  type LineageEdge,
  type LineageRecord,
  type MonetizationLock,
  type MonetizationLockStatus,
  type MonetizationPolicy,
} from './types.ts';
export * from './constants.ts';
export * from './types.ts';
export * from './serialization.ts';
export * from './ids.ts';
export * from './validation.ts';
export * from './authority.ts';
export * from './persistence.ts';
export * from './adapters.ts';
export * from './fixtures.ts';
