/**
 * ACCESS Wave 1 Prompt 30 — Funding and solvency types.
 *
 * Money is integer minor units (bigint). Access units are bigint counts.
 * Three economic states are kept separate: tokens, Access units, fiat funding.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessFundingPoolStatus,
  AccessFundingReservationStatus,
  AccessFundingSourceStatus,
  AccessFundingSourceType,
  AccessEntitlementReservationStatus,
  EntitlementDirection,
  EntitlementLedgerEntryType,
  FundedCapacityState,
  FundingCategoryPolicy,
  FundingDirection,
  FundingLedgerEntryType,
  FundingValueKind,
  SolvencyStatus,
} from './taxonomy.ts';

export type EvidenceRef = string;

/** Geographic / program restriction envelope for funding sources and pools. */
export type FundingRestriction = {
  readonly country?: string;
  readonly region?: string;
  readonly city?: string;
  readonly programId?: string;
  readonly category?: string;
  readonly providerId?: string;
};

/** Access funding pool — real fiat or committed funding for provider settlement. */
export type AccessFundingPool = {
  readonly fundingPoolId: string;
  readonly name: string;
  readonly category: string | null;
  readonly currency: string;
  readonly geography: string | null;
  readonly programId: string | null;
  readonly categoryPolicy: FundingCategoryPolicy;
  readonly status: AccessFundingPoolStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Funding source attached to a pool. */
export type AccessFundingSource = {
  readonly sourceId: string;
  readonly fundingPoolId: string;
  readonly sourceType: AccessFundingSourceType;
  readonly valueKind: FundingValueKind;
  readonly currency: string;
  readonly amountCommitted: bigint;
  readonly amountReceived: bigint;
  readonly restrictions: FundingRestriction;
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly evidenceReference: EvidenceRef;
  readonly status: AccessFundingSourceStatus;
};

/** Immutable entitlement ledger entry. */
export type EntitlementLedgerEntry = {
  readonly entryId: string;
  readonly entitlementId: string;
  readonly userId: string;
  readonly category: string;
  readonly unit: string;
  readonly quantity: bigint;
  readonly direction: EntitlementDirection;
  readonly entryType: EntitlementLedgerEntryType;
  readonly transactionReference: string;
  readonly allocationReference: string | null;
  readonly reservationReference: string | null;
  readonly evidenceReference: EvidenceRef;
  readonly createdAt: UtcInstant;
};

/** Immutable funding ledger entry. */
export type FundingLedgerEntry = {
  readonly entryId: string;
  readonly fundingPoolId: string;
  readonly sourceId: string | null;
  readonly currency: string;
  readonly amountMinorUnits: bigint;
  readonly direction: FundingDirection;
  readonly entryType: FundingLedgerEntryType;
  readonly transactionReference: string;
  readonly reservationReference: string | null;
  readonly evidenceReference: EvidenceRef;
  readonly createdAt: UtcInstant;
};

/** Derived entitlement balance from ledger entries. */
export type EntitlementBalance = {
  readonly entitlementId: string;
  readonly userId: string;
  readonly category: string;
  readonly unit: string;
  readonly allocated: bigint;
  readonly reserved: bigint;
  readonly consumed: bigint;
  readonly expired: bigint;
  readonly released: bigint;
  readonly reversed: bigint;
  readonly remaining: bigint;
};

/** Derived funding pool balance from ledger entries and active sources. */
export type FundingPoolBalance = {
  readonly fundingPoolId: string;
  readonly currency: string;
  readonly totalReceived: bigint;
  readonly totalCommitted: bigint;
  readonly cashReceived: bigint;
  readonly discountCapacity: bigint;
  readonly pendingSettlement: bigint;
  readonly capturedSettlement: bigint;
  readonly refundReserve: bigint;
  readonly riskReserve: bigint;
  readonly reservedFunding: bigint;
  readonly availableFunding: bigint;
  readonly availableCashFunding: bigint;
  readonly availableDiscountCapacity: bigint;
};

/** Funding reservation before provider settlement. */
export type AccessFundingReservation = {
  readonly fundingReservationId: string;
  readonly fundingPoolId: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly currency: string;
  readonly amountMinorUnits: bigint;
  readonly expiresAt: UtcInstant;
  readonly status: AccessFundingReservationStatus;
  readonly idempotencyKey: string;
  readonly evidenceReference: EvidenceRef;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Entitlement unit reservation before redemption. */
export type AccessEntitlementReservation = {
  readonly entitlementReservationId: string;
  readonly entitlementId: string;
  readonly accessTransactionId: string;
  readonly userId: string;
  readonly category: string;
  readonly unit: string;
  readonly quantity: bigint;
  readonly expiresAt: UtcInstant;
  readonly status: AccessEntitlementReservationStatus;
  readonly idempotencyKey: string;
  readonly evidenceReference: EvidenceRef;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Funded capacity marker for AccessCapacity pools. */
export type FundedCapacityMarker = {
  readonly poolId: string;
  readonly category: string;
  readonly state: FundedCapacityState;
  readonly cashFundingMinorUnits: bigint;
  readonly discountCapacityMinorUnits: bigint;
  readonly providerContributedUnits: bigint;
  readonly allocatableUnits: bigint;
  readonly allocationRightsUnits: bigint;
  readonly payableCoverageUnits: bigint;
};

/** Solvency snapshot for a funding pool. */
export type SolvencySnapshot = {
  readonly fundingPoolId: string;
  readonly currency: string;
  readonly status: SolvencyStatus;
  readonly balance: FundingPoolBalance;
  readonly tokenConversionContribution: typeof import('./taxonomy.ts').TOKEN_CONVERSION_CONTRIBUTION;
};

/** Wave 1 end-to-end result. */
export type AccessWave1Result = {
  readonly userId: string;
  readonly entitlements: readonly {
    readonly category: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly entitlementId: string;
  }[];
  readonly fundingPools: readonly {
    readonly category: string | null;
    readonly fundingPoolId: string;
    readonly availableFundingMinorUnits: bigint;
    readonly currency: string;
  }[];
  readonly tokenConversionContribution: typeof import('./taxonomy.ts').TOKEN_CONVERSION_CONTRIBUTION;
  readonly evidenceReferences: readonly EvidenceRef[];
};
