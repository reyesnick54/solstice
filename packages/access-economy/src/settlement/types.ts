/**
 * ACCESS Wave 3 — Fiat settlement (Prompt 35) and restricted virtual-card (Prompt 36) types.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessDomainEntitlementId,
  AccessDomainQuoteId,
  AccessDomainSettlementId,
  AccessDomainTransactionId,
  AccessEvidenceRef,
  AccessFundingPoolId,
  AccessUserId,
} from '../domain/ids.ts';
import type { AccessCategoryId, AccessUnit } from '../domain/taxonomy.ts';
import type { ProviderRef } from '../ids.ts';
import type { AccessCardBufferPolicy } from './buffer-policy.ts';
import type { IssuerControlSupport } from './issuer-port.ts';
import type {
  AccessCardLifecycleEvent,
  AccessPaymentRailCapability,
  AccessPaymentRailKind,
  AccessPaymentRailStatus,
  AccessPaymentRemoteStatus,
  AccessSettlementOrchestrationStatus,
  AccessSettlementRailFailureCode,
  AccessSettlementStrategy,
  AccessVirtualCardPurpose,
  AccessVirtualCardStatus,
} from './taxonomy.ts';

/** Virtual card issuance request. Never includes SR/MR in provider-facing metadata. */
export type AccessVirtualCardRequest = {
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly maximumAmount: bigint;
  readonly currency: string;
  readonly merchantRestriction?: string;
  readonly merchantCategoryRestriction?: readonly string[];
  readonly countryRestriction?: string;
  readonly validFrom: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly singleUse: boolean;
  readonly providerId: ProviderRef;
  readonly purpose: AccessVirtualCardPurpose;
  readonly idempotencyKey: string;
  readonly category: AccessCategoryId;
  readonly fundingReservationId: string;
  readonly userFiatContributionMinorUnits: bigint;
  readonly accessPoolContributionMinorUnits: bigint;
  readonly bufferPolicy?: AccessCardBufferPolicy;
  readonly securityDepositRequired?: boolean;
  /** Must be zero or absent. SR/MR card funding is forbidden. */
  readonly tokenConversionContributionMinorUnits?: bigint;
};

/** Server-owned spending controls for Access virtual cards. */
export type AccessCardControls = {
  readonly maximumAmountMinorUnits: bigint;
  readonly singleTransaction: boolean;
  readonly singleUse: boolean;
  readonly expiresAt: UtcInstant;
  readonly merchantId: string | null;
  readonly allowedMerchantCategories: readonly string[] | null;
  readonly blockedMerchantCategories: readonly string[];
  readonly country: string | null;
  readonly currency: string;
  readonly allowedMerchant: string | null;
};

export type { IssuerControlSupport } from './issuer-port.ts';

export type AccessVirtualCardRecord = {
  readonly cardId: string;
  readonly providerCardId: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly providerId: ProviderRef;
  readonly last4: string | null;
  readonly status: AccessVirtualCardStatus;
  readonly controls: AccessCardControls;
  readonly fundingReservationId: string;
  readonly issuerProviderId: string;
  readonly authorizedAmountMinorUnits: bigint;
  readonly capturedAmountMinorUnits: bigint;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessCardAuthorizationRecord = {
  readonly authorizationId: string;
  readonly cardId: string;
  readonly settlementId: string;
  readonly merchantId: string;
  readonly merchantCategory: string;
  readonly country: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly status: 'PENDING' | 'APPROVED' | 'DECLINED';
  readonly declineReason: AccessSettlementRailFailureCode | null;
  readonly processorReference: string;
  readonly incremental: boolean;
  readonly createdAt: UtcInstant;
};

export type AccessCardCaptureRecord = {
  readonly captureId: string;
  readonly authorizationId: string;
  readonly cardId: string;
  readonly settlementId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly processorReference: string;
  readonly createdAt: UtcInstant;
};

export type AccessCardLifecycleEventRecord = {
  readonly eventId: string;
  readonly cardId: string;
  readonly settlementId: string;
  readonly eventType: AccessCardLifecycleEvent;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly evidenceReference: string;
  readonly createdAt: UtcInstant;
};

export type AccessSettlementReconciliation = {
  readonly reconciliationId: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly cardId: string | null;
  readonly authorizationIds: readonly string[];
  readonly captureIds: readonly string[];
  readonly fundingReservationId: string;
  readonly providerAmountMinorUnits: bigint;
  readonly authorizedAmountMinorUnits: bigint;
  readonly capturedAmountMinorUnits: bigint;
  readonly currency: string;
  readonly reconciledAt: UtcInstant;
};

export type VirtualCardCreationResult =
  | { readonly ok: true; readonly card: AccessVirtualCardRecord }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

export type AuthorizationValidationResult =
  | { readonly ok: true; readonly authorization: AccessCardAuthorizationRecord }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

export type CaptureResult =
  | { readonly ok: true; readonly capture: AccessCardCaptureRecord }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

export type RefundResult =
  | { readonly ok: true; readonly refundId: string; readonly amountMinorUnits: bigint }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

export type VoidResult =
  | { readonly ok: true; readonly authorizationId: string }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

export type DisableCardResult =
  | { readonly ok: true; readonly card: AccessVirtualCardRecord }
  | { readonly ok: false; readonly code: AccessSettlementRailFailureCode; readonly message: string };

/** Canonical Access payment rail port. */
export type AccessPaymentRail = {
  readonly railId: typeof import('./taxonomy.ts').RESTRICTED_CARD_RAIL_ID;
  readonly capabilities: readonly AccessPaymentRailCapability[];
  readonly status: AccessPaymentRailStatus;
  readonly issuerProviderId: string;
  readonly controlSupport: IssuerControlSupport;

  createVirtualCard(request: AccessVirtualCardRequest): Promise<VirtualCardCreationResult>;
  validateAuthorization(input: {
    readonly cardId: string;
    readonly settlementId: string;
    readonly merchantId: string;
    readonly merchantCategory: string;
    readonly country: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly incremental?: boolean;
    readonly now: UtcInstant;
  }): AuthorizationValidationResult;
  capture(input: {
    readonly authorizationId: string;
    readonly amountMinorUnits: bigint;
    readonly now: UtcInstant;
  }): CaptureResult;
  voidAuthorization(input: {
    readonly authorizationId: string;
    readonly now: UtcInstant;
  }): VoidResult;
  refund(input: {
    readonly captureId: string;
    readonly amountMinorUnits: bigint;
    readonly now: UtcInstant;
  }): RefundResult;
  getCardStatus(cardId: string): AccessVirtualCardRecord | undefined;
  disableCard(input: {
    readonly cardId: string;
    readonly reason: string;
    readonly now: UtcInstant;
  }): DisableCardResult;
  reconcile(settlementId: string, now: UtcInstant): AccessSettlementReconciliation | undefined;
};

export type FundingReservationVerifier = {
  isReserved(input: {
    readonly fundingReservationId: string;
    readonly accessTransactionId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
  }): boolean;
};

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
