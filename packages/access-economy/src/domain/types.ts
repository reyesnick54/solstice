import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderRef } from '../ids.ts';
import type { AllocationPolicyId } from '../ids.ts';
import type { AccessGeography } from './geography.ts';
import type {
  AccessAllocationId,
  AccessAllocationSnapshotId,
  AccessCapacityId,
  AccessDomainEntitlementId,
  AccessDomainQuoteId,
  AccessDomainRedemptionId,
  AccessDomainReservationId,
  AccessDomainSettlementId,
  AccessDomainTransactionId,
  AccessEvidenceRef,
  AccessFundingPoolId,
  AccessProductId,
  AccessUserId,
} from './ids.ts';
import {
  ACCESS_DOMAIN_SCHEMA_VERSION,
  ACCESS_DOMAIN_TAXONOMY_VERSION,
  type AccessCapacitySource,
  type AccessCapacityStatus,
  type AccessCategoryId,
  type AccessDomainEntitlementStatus,
  type AccessDomainQuoteStatus,
  type AccessDomainRedemptionStatus,
  type AccessDomainReservationStatus,
  type AccessDomainSettlementStatus,
  type AccessDomainTransactionStatus,
  type AccessUnit,
} from './taxonomy.ts';

/**
 * Explicit non-cash posture for every Access entitlement record.
 * Access is a governed usage right — not cash, token, deposit, or guaranteed redemption.
 */
export const ACCESS_ENTITLEMENT_NON_CASH_FLAGS = Object.freeze({
  isCash: false,
  isBankBalance: false,
  isStablecoin: false,
  isGuaranteedFiatRedemption: false,
  isUserDeposit: false,
  isMonetaryAsset: false,
  isWithdrawable: false,
  isTransferable: false,
});

export type AccessDomainFailureCode =
  | 'NEGATIVE_UNITS'
  | 'OVER_RESERVED'
  | 'OVER_CONSUMED'
  | 'INVALID_REMAINING_UNITS'
  | 'INVALID_AVAILABLE_CAPACITY'
  | 'NEGATIVE_AMOUNT'
  | 'INVALID_CATEGORY'
  | 'INVALID_UNIT'
  | 'INVALID_STATUS'
  | 'MISSING_EVIDENCE_REF'
  | 'ENTITLEMENT_IS_NOT_CASH';

export type AccessDomainFailure = {
  readonly code: AccessDomainFailureCode;
  readonly message: string;
};

/** Governed category metadata for catalog and allocation policy binding. */
export type AccessCategory = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly id: AccessCategoryId;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly defaultUnit: AccessUnit;
  readonly allocationPolicyId: AllocationPolicyId | null;
  readonly fundingPoolId: AccessFundingPoolId | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Catalog product describing a unitized access offering. Provider-agnostic. */
export type AccessProduct = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly accessProductId: AccessProductId;
  readonly category: AccessCategoryId;
  readonly name: string;
  readonly description: string;
  readonly unit: AccessUnit;
  readonly providerId: ProviderRef | null;
  readonly providerProductId: string | null;
  readonly geography: AccessGeography | null;
  readonly termsReference: string | null;
  readonly enabled: boolean;
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Real available productive capacity for a period. */
export type AccessCapacity = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly capacityId: AccessCapacityId;
  readonly category: AccessCategoryId;
  readonly accessProductId: AccessProductId | null;
  readonly providerId: ProviderRef | null;
  readonly geography: AccessGeography;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly totalUnits: bigint;
  readonly reservedUnits: bigint;
  readonly consumedUnits: bigint;
  readonly availableUnits: bigint;
  readonly capacitySource: AccessCapacitySource;
  readonly fundingSource: AccessFundingPoolId | null;
  readonly status: AccessCapacityStatus;
  readonly evidenceReference: AccessEvidenceRef;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/**
 * Non-cash right to use productive capacity.
 *
 * AccessEntitlement ≠ Cash ≠ Token ≠ Deposit ≠ Guaranteed Redemption.
 */
export type AccessEntitlement = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly entitlementId: AccessDomainEntitlementId;
  readonly userId: AccessUserId;
  readonly category: AccessCategoryId;
  readonly accessProductId: AccessProductId | null;
  readonly unit: AccessUnit;
  readonly allocatedUnits: bigint;
  readonly reservedUnits: bigint;
  readonly consumedUnits: bigint;
  readonly remainingUnits: bigint;
  readonly effectiveFrom: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly allocationSnapshotId: AccessAllocationSnapshotId | null;
  readonly status: AccessDomainEntitlementStatus;
  readonly termsVersion: string;
  readonly nonCash: typeof ACCESS_ENTITLEMENT_NON_CASH_FLAGS;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Records why and how an entitlement was created. Formula logic is Prompt 29. */
export type AccessAllocation = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly allocationId: AccessAllocationId;
  readonly userId: AccessUserId;
  readonly category: AccessCategoryId;
  readonly period: string;
  readonly capacityId: AccessCapacityId;
  readonly allocatedUnits: bigint;
  readonly allocationPolicyId: AllocationPolicyId;
  readonly allocationPolicyVersion: string;
  readonly inputSnapshotReference: string;
  readonly evidenceReference: AccessEvidenceRef;
  readonly createdAt: UtcInstant;
};

/** Provider quote model. No live provider integration in Prompt 28. */
export type AccessQuote = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly quoteId: AccessDomainQuoteId;
  readonly userId: AccessUserId;
  readonly providerId: ProviderRef;
  readonly providerProductId: string;
  readonly category: AccessCategoryId;
  readonly requestedUnits: bigint;
  readonly unit: AccessUnit;
  /** Provider price in minor units. */
  readonly providerPrice: bigint;
  readonly currency: string;
  readonly taxes: bigint;
  readonly mandatoryFees: bigint;
  readonly optionalFees: bigint;
  readonly securityDeposit: bigint;
  readonly totalProviderAmount: bigint;
  readonly eligibleAccessAmount: bigint;
  readonly userContribution: bigint;
  readonly expiresAt: UtcInstant;
  readonly providerQuoteReference: string | null;
  readonly status: AccessDomainQuoteStatus;
  readonly evidenceReference: AccessEvidenceRef | null;
  readonly createdAt: UtcInstant;
};

/** Reservation holding entitlement and optional funding. No provider API yet. */
export type AccessReservation = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly reservationId: AccessDomainReservationId;
  readonly userId: AccessUserId;
  readonly quoteId: AccessDomainQuoteId;
  readonly providerId: ProviderRef;
  readonly category: AccessCategoryId;
  readonly requestedUnits: bigint;
  readonly reservedEntitlementUnits: bigint;
  /** Optional fiat hold amount in minor units — not a balance. */
  readonly reservedFundingAmount: bigint | null;
  readonly providerReservationReference: string | null;
  readonly expiresAt: UtcInstant;
  readonly status: AccessDomainReservationStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Fulfillment record. Failed bookings must be capable of reversal. */
export type AccessRedemption = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly redemptionId: AccessDomainRedemptionId;
  readonly userId: AccessUserId;
  readonly entitlementId: AccessDomainEntitlementId;
  readonly reservationId: AccessDomainReservationId | null;
  readonly category: AccessCategoryId;
  readonly unit: AccessUnit;
  readonly unitsConsumed: bigint;
  readonly providerId: ProviderRef | null;
  readonly providerFulfillmentReference: string | null;
  readonly fulfilledAt: UtcInstant | null;
  readonly status: AccessDomainRedemptionStatus;
  readonly evidenceReference: AccessEvidenceRef;
  readonly createdAt: UtcInstant;
};

/** Settlement model. Payment execution is Prompt 35. */
export type AccessSettlement = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly settlementId: AccessDomainSettlementId;
  readonly accessTransactionId: AccessDomainTransactionId;
  readonly providerId: ProviderRef;
  readonly currency: string;
  readonly providerAmount: bigint;
  readonly accessPoolContribution: bigint;
  readonly userFiatContribution: bigint;
  /** Defaults to zero at launch. Token allocation is Prompt 29. */
  readonly tokenConversionContribution: bigint;
  readonly taxAmount: bigint;
  readonly feeAmount: bigint;
  readonly authorizationReference: string | null;
  readonly captureReference: string | null;
  readonly refundReference: string | null;
  readonly status: AccessDomainSettlementStatus;
  readonly evidenceReference: AccessEvidenceRef | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Lifecycle anchor tying quote, reservation, redemption, and settlement. */
export type AccessTransaction = {
  readonly schemaVersion: typeof ACCESS_DOMAIN_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ACCESS_DOMAIN_TAXONOMY_VERSION;
  readonly transactionId: AccessDomainTransactionId;
  readonly userId: AccessUserId;
  readonly category: AccessCategoryId;
  readonly productId: AccessProductId | null;
  readonly entitlementId: AccessDomainEntitlementId | null;
  readonly allocationId: AccessAllocationId | null;
  readonly quoteId: AccessDomainQuoteId | null;
  readonly reservationId: AccessDomainReservationId | null;
  readonly redemptionId: AccessDomainRedemptionId | null;
  readonly settlementId: AccessDomainSettlementId | null;
  readonly providerId: ProviderRef | null;
  readonly status: AccessDomainTransactionStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessDomainRecord =
  | AccessCategory
  | AccessProduct
  | AccessCapacity
  | AccessEntitlement
  | AccessAllocation
  | AccessQuote
  | AccessReservation
  | AccessRedemption
  | AccessSettlement
  | AccessTransaction;
