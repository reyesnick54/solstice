export {
  PARTICIPATION_SCALE,
  COEFF_BPS_SCALE,
  isqrt,
  ratioScaled,
  sqrtTransformScaled,
  dualBonusTerm,
  weightedParticipation,
} from './fixed-point.ts';
export {
  ACCESS_15_POLICY_VERSION,
  ACCESS_15_SCHEMA_VERSION,
  ENGINEERING_SIMULATION_PARAMETERS,
  ACCESS_EPOCH_STATUSES,
  ACCESS_EPOCH_CADENCES,
  ACCESS_ALLOCATION_CATEGORIES,
  ACCESS_ECONOMIC_MODES,
  ACCESS_COMMITMENT_KINDS,
  type AccessEpoch,
  type AccessEpochStatus,
  type AccessEpochCadence,
  type AccessAllocationCategory,
  type AccessEconomicMode,
  type AccessCommitmentKind,
  type BalanceCheckpoint,
  type TokenBalanceHistoryPort,
  type EligibleSupplySnapshot,
  type TokenParticipationSnapshot,
  type ParticipationTransformPolicy,
  type CategoryParticipationCoefficients,
  type DualParticipationPolicy,
  type AccessCommitmentPolicy,
  type AccessCapacityPool,
  type NormalizedParticipation,
  type AccessAllocationRecord,
  type IssuedAccessEntitlement,
  type AllocationRunResult,
} from './types.ts';
export {
  computeTwab,
  checkpointAt,
  flatEpochCheckpoints,
  DEFAULT_TWAB_POLICY,
  type TwabPolicy,
  type TwabResult,
} from './twab.ts';
export {
  DEFAULT_SQRT_TRANSFORM,
  SIMULATION_CATEGORY_COEFFICIENTS,
  SIMULATION_DUAL_PARTICIPATION_POLICY,
  SIMULATION_COMMITMENT_POLICIES,
  assertCoefficientConstraints,
  coefficientsForCategory,
  ACCESS_15_ACTIVE_POLICY_VERSION,
} from './policy.ts';
export { evaluateAntiGaming, deduplicateCustodySources, type AntiGamingResult } from './anti-gaming.ts';
export { deriveAllocatableCapacity, buildCapacityPool, CATEGORY_CAPACITY_UNITS } from './capacity.ts';
export { normalizeParticipation, computeNormalizedWeight } from './participation.ts';
export {
  allocateProportional,
  totalAllocated,
  assertNoOverAllocation,
  DEFAULT_ALLOCATION_CONSTRAINTS,
  type AllocationConstraints,
} from './allocate.ts';
export { issueEntitlementsFromAllocations } from './entitlement.ts';
export { ACCESS_ECONOMIC_MODE_DESCRIPTORS, modeAllowsEpochAllocation } from './modes.ts';
export {
  ACCESS_15_INVARIANT_IDS,
  checkAccess15Invariants,
  allAccess15InvariantsHeld,
  serializeAllocationResult,
  type Access15InvariantId,
  type Access15InvariantResult,
} from './invariants.ts';
export {
  runDualTokenAllocation,
  buildParticipationSnapshots,
  demoEpoch,
  demoSupply,
  demoParticipants,
  demoPools,
  syntheticParticipants,
  eligibleSupplyForParticipants,
  type ParticipantInput,
  type RunAllocationInput,
} from './engine.ts';
