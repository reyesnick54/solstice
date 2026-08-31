/**
 * ACCESS Wave 3 Prompt 35 — Fiat settlement types.
 *
 * Money is integer minor units (bigint). No raw payment credentials.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderRef } from '../ids.ts';
import type {
  AccessDomainEntitlementId,
  AccessDomainQuoteId,
  AccessDomainSettlementId,
  AccessDomainTransactionId,
  AccessEvidenceRef,
  AccessFundingPoolId,
  AccessUserId,
} from '../domain/ids.ts';
import type { AccessUnit } from '../domain/taxonomy.ts';
import type {
  AccessPaymentRailCapability,
  AccessPaymentRailKind,
  AccessPaymentRemoteStatus,
  AccessSettlementOrchestrationStatus,
  AccessSettlementStrategy,
} from './taxonomy.ts';

/** Prompt 34 checkout quote — input to settlement plan. */
export type AccessCheckoutQuote = {
  readonly checkoutQuoteId: AccessDomainQuoteId;
  readonly userId: AccessUserId;
  readonly providerId: ProviderRef;
  readonly category: string;
  readonly unit: AccessUnit;
  readonly entitlementUnits: bigint;
  readonly entitlementId: AccessDomainEntitlementId;
  readonly fundingPoolId: AccessFundingPoolId;
  readonly currency: string;
  readonly providerAmount: bigint;
  readonly accessPoolContribution: bigint;
  readonly userContribution: bigint;
  /** Must be zero at launch. */
  readonly tokenConversionContribution: bigint;
  readonly otherProgramContribution: bigint;
  readonly expiresAt: UtcInstant;
  readonly evidenceReference: AccessEvidenceRef;
  readonly createdAt: UtcInstant;
};

/** Provider payment method reference — opaque, no credentials. */
export type ProviderPaymentMethodRef = string;

/** User funding source reference — opaque, no PAN or card data. */
export type UserFundingSourceRef = string;

/** Settlement plan derived from checkout quote. */
export type AccessSettlementPlan = {
  readonly planId: string;
  readonly checkoutQuoteId: AccessDomainQuoteId;
  readonly accessTransactionId: AccessDomainTransactionId;
  readonly userId: AccessUserId;
  readonly providerId: ProviderRef;
  readonly category: string;
  readonly unit: AccessUnit;
  readonly entitlementId: AccessDomainEntitlementId;
  readonly entitlementUnits: bigint;
  readonly fundingPoolId: AccessFundingPoolId;
  readonly currency: string;
  readonly providerAmount: bigint;
  readonly accessPoolContribution: bigint;
  readonly userContribution: bigint;
  readonly tokenConversionContribution: bigint;
  readonly otherProgramContribution: bigint;
  readonly paymentRail: AccessPaymentRailKind;
  readonly providerPaymentMethod: ProviderPaymentMethodRef;
  readonly userFundingSource: UserFundingSourceRef;
  readonly settlementStrategy: AccessSettlementStrategy;
  readonly expiresAt: UtcInstant;
  readonly evidenceReference: AccessEvidenceRef;
};

/** Source-of-funds split preserved for audit, refunds, and treasury. */
export type AccessSettlementSourceOfFunds = {
  readonly accessPoolContribution: bigint;
  readonly userFiatContribution: bigint;
  readonly tokenConversionContribution: bigint;
  readonly otherProgramContribution: bigint;
  readonly currency: string;
};

/** Refund allocation mapping — proportional basis for Prompt 37. */
export type AccessRefundAllocation = {
  readonly totalRefundAmount: bigint;
  readonly accessPoolRefund: bigint;
  readonly userRefund: bigint;
  readonly tokenConversionRefund: bigint;
  readonly otherProgramRefund: bigint;
  readonly currency: string;
  readonly policy: 'PROPORTIONAL' | 'POLICY_BASED';
  readonly evidenceReference: AccessEvidenceRef;
};

/** Evidence trail for settlement lifecycle. */
export type AccessSettlementEvidenceTrail = {
  readonly checkoutQuoteRef: AccessEvidenceRef | null;
  readonly fundingReservationRef: AccessEvidenceRef | null;
  readonly entitlementReservationRef: AccessEvidenceRef | null;
  readonly complianceRef: AccessEvidenceRef | null;
  readonly userAuthorizationRef: AccessEvidenceRef | null;
  readonly providerAuthorizationRef: AccessEvidenceRef | null;
  readonly captureRef: AccessEvidenceRef | null;
  readonly voidRef: AccessEvidenceRef | null;
  readonly refundRef: AccessEvidenceRef | null;
  readonly canonicalLedgerRef: AccessEvidenceRef | null;
};

/** Orchestrated settlement record — business context; canonical ledger is authoritative for fiat. */
export type AccessSettlementRecord = {
  readonly settlementId: AccessDomainSettlementId;
  readonly accessTransactionId: AccessDomainTransactionId;
  readonly plan: AccessSettlementPlan;
  readonly sourceOfFunds: AccessSettlementSourceOfFunds;
  readonly status: AccessSettlementOrchestrationStatus;
  readonly entitlementReservationId: string | null;
  readonly fundingReservationId: string | null;
  readonly userPaymentReference: string | null;
  readonly providerPaymentReference: string | null;
  readonly canonicalJournalId: string | null;
  readonly refundAllocation: AccessRefundAllocation | null;
  readonly evidence: AccessSettlementEvidenceTrail;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessSettlementFailureCode =
  | 'SETTLEMENT_EQUATION_MISMATCH'
  | 'TOKEN_CONVERSION_NON_ZERO'
  | 'QUOTE_EXPIRED'
  | 'COMPLIANCE_REFUSED'
  | 'INSUFFICIENT_ENTITLEMENT'
  | 'INSUFFICIENT_FUNDING'
  | 'USER_AUTHORIZATION_FAILED'
  | 'PROVIDER_AUTHORIZATION_FAILED'
  | 'CAPTURE_FAILED'
  | 'VOID_FAILED'
  | 'REFUND_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'UNKNOWN_REMOTE_STATE'
  | 'DUPLICATE_OPERATION'
  | 'INVALID_STATE'
  | 'RAIL_CAPABILITY_MISSING';

export type AccessSettlementFailure = {
  readonly code: AccessSettlementFailureCode;
  readonly message: string;
};

export type AccessPaymentRailDescriptor = {
  readonly railKind: AccessPaymentRailKind;
  readonly capabilities: readonly AccessPaymentRailCapability[];
  readonly settlementStrategy: AccessSettlementStrategy;
};

export type AccessPaymentAuthorizationResult = {
  readonly ok: true;
  readonly paymentReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
  readonly providerFacingAmount: bigint;
  readonly currency: string;
};

export type AccessPaymentCaptureResult = {
  readonly ok: true;
  readonly captureReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
};

export type AccessPaymentVoidResult = {
  readonly ok: true;
  readonly voidReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
};

export type AccessPaymentRefundResult = {
  readonly ok: true;
  readonly refundReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
  readonly refundedAmount: bigint;
};

export type AccessPaymentStatusResult = {
  readonly paymentReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
};

export type AccessPaymentReconcileResult = {
  readonly paymentReference: string;
  readonly remoteStatus: AccessPaymentRemoteStatus;
  readonly evidenceReference: AccessEvidenceRef;
  readonly reconciled: boolean;
};
