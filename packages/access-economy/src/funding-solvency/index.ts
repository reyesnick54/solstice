/**
 * ACCESS Wave 1 Prompt 30 — Funding and solvency exports.
 */

export {
  ACCESS_FUNDING_SOLVENCY_SCHEMA,
  ACCESS_FUNDING_SOLVENCY_CHUNK,
  ENTITLEMENT_LEDGER_ENTRY_TYPES,
  ENTITLEMENT_DIRECTIONS,
  FUNDING_LEDGER_ENTRY_TYPES,
  FUNDING_DIRECTIONS,
  FUNDING_SOURCE_TYPES,
  FUNDING_VALUE_KINDS,
  FUNDING_POOL_STATUSES,
  FUNDING_SOURCE_STATUSES,
  FUNDING_RESERVATION_STATUSES,
  ENTITLEMENT_RESERVATION_STATUSES,
  SOLVENCY_STATUSES,
  FUNDING_CATEGORY_POLICIES,
  FUNDED_CAPACITY_STATES,
  TOKEN_CONVERSION_CONTRIBUTION,
  isCashFundedSource,
  isDiscountSource,
  fundingValueKindForSource,
  type EntitlementLedgerEntryType,
  type EntitlementDirection,
  type FundingLedgerEntryType,
  type FundingDirection,
  type AccessFundingSourceType,
  type FundingValueKind,
  type AccessFundingPoolStatus,
  type AccessFundingSourceStatus,
  type AccessFundingReservationStatus,
  type AccessEntitlementReservationStatus,
  type SolvencyStatus,
  type FundingCategoryPolicy,
  type FundedCapacityState,
} from './taxonomy.ts';

export type {
  EvidenceRef,
  FundingRestriction,
  AccessFundingPool,
  AccessFundingSource,
  EntitlementLedgerEntry,
  FundingLedgerEntry,
  EntitlementBalance,
  FundingPoolBalance,
  AccessFundingReservation,
  AccessEntitlementReservation,
  FundedCapacityMarker,
  SolvencySnapshot,
  AccessWave1Result,
} from './types.ts';

export { deriveEntitlementBalance, deriveFundingPoolBalance, computeSolvencyEquation } from './balance.ts';
export { AccessEntitlementLedger, type AppendEntitlementEntryInput } from './entitlement-ledger.ts';
export { AccessFundingLedger, type AppendFundingEntryInput } from './funding-ledger.ts';
export { AccessFundingPoolRegistry } from './funding-pool.ts';
export {
  AccessFundingReservationStore,
  type FundingReservationResult,
} from './funding-reservation.ts';
export {
  AccessEntitlementReservationStore,
  type EntitlementReservationResult,
} from './entitlement-reservation.ts';
export { classifyFundedCapacity } from './funded-capacity.ts';
export {
  AccessSolvencyService,
  createAccessSolvencyService,
  type AccessSolvencyServiceConfig,
} from './solvency-service.ts';
export { runAccessWave1, type RunAccessWave1Input } from './wave1.ts';
export {
  ACCESS_WAVE1_INVARIANT_IDS,
  checkFundingNonNegative,
  checkEntitlementNonNegative,
  checkNoEntitlementDoubleSpend,
  checkCommittedFundingEligible,
  checkReservedPlusConsumedLeAllocated,
  checkTokenConversionZero,
  checkAllWave1Invariants,
  allWave1InvariantsHeld,
  type AccessWave1InvariantId,
  type Wave1InvariantResult,
} from './invariants.ts';
