/**
 * ACCESS Wave 3 / Prompt 37 — transaction orchestration types.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderRef } from '../ids.ts';
import type {
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
} from '../domain/ids.ts';
import type {
  AccessCategoryId,
  AccessDomainTransactionStatus,
  AccessUnit,
} from '../domain/taxonomy.ts';
import type { AccessProviderId } from '../providers/types.ts';

export const ACCESS_TRANSACTION_SCHEMA_VERSION = 1 as const;

export type AccessCheckoutQuote = {
  readonly quoteId: AccessDomainQuoteId;
  readonly transactionId: AccessDomainTransactionId;
  readonly providerId: ProviderRef;
  readonly providerProductId: string;
  readonly category: AccessCategoryId;
  readonly requestedUnits: bigint;
  readonly unit: AccessUnit;
  readonly providerPriceMinorUnits: bigint;
  readonly taxesMinorUnits: bigint;
  readonly mandatoryFeesMinorUnits: bigint;
  readonly securityDepositMinorUnits: bigint;
  readonly totalProviderAmountMinorUnits: bigint;
  readonly accessPoolContributionMinorUnits: bigint;
  readonly userContributionMinorUnits: bigint;
  readonly tokenConversionContributionMinorUnits: bigint;
  readonly entitlementUnitsReserved: bigint;
  readonly currency: string;
  readonly expiresAt: UtcInstant;
  readonly providerQuoteReference: string;
  readonly coveragePolicyId: string;
  readonly coveragePolicyVersion: string;
  readonly evidenceReference: AccessEvidenceRef;
};

export type AccessFulfillmentEvidence = {
  readonly evidenceId: string;
  readonly transactionId: AccessDomainTransactionId;
  readonly providerId: ProviderRef;
  readonly kind:
    | 'PROVIDER_CONFIRMATION'
    | 'TICKET_ISSUED'
    | 'STAY_COMPLETED'
    | 'RIDE_COMPLETED'
    | 'COMPUTE_CONSUMED'
    | 'ENERGY_DELIVERED'
    | 'NO_SHOW'
    | 'PROVIDER_STATUS';
  readonly providerReference: string | null;
  readonly quantityFulfilled: bigint;
  readonly occurredAt: UtcInstant;
  readonly evidenceHash: string;
  readonly evidenceReference: AccessEvidenceRef;
};

export const ACCESS_RECONCILIATION_ISSUE_TYPES = [
  'BOOKING_WITHOUT_PAYMENT',
  'PAYMENT_WITHOUT_BOOKING',
  'ENTITLEMENT_MISMATCH',
  'FUNDING_MISMATCH',
  'REFUND_MISMATCH',
  'DUPLICATE_PAYMENT',
  'DUPLICATE_BOOKING',
  'UNKNOWN_PROVIDER_STATE',
  'STALE_BOOKING_STATE',
] as const;
export type AccessReconciliationIssueType = (typeof ACCESS_RECONCILIATION_ISSUE_TYPES)[number];

export const RECONCILIATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ReconciliationSeverity = (typeof RECONCILIATION_SEVERITIES)[number];

export const RECONCILIATION_RESOLUTION_STATUSES = [
  'OPEN',
  'AUTO_RESOLVED',
  'ESCALATED',
  'MANUAL_RESOLVED',
  'DISMISSED',
] as const;
export type ReconciliationResolutionStatus = (typeof RECONCILIATION_RESOLUTION_STATUSES)[number];

export type AccessReconciliationIssue = {
  readonly issueId: string;
  readonly type: AccessReconciliationIssueType;
  readonly severity: ReconciliationSeverity;
  readonly transactionId: AccessDomainTransactionId;
  readonly providerId: ProviderRef | null;
  readonly detectedAt: UtcInstant;
  readonly expectedState: string;
  readonly actualState: string;
  readonly resolutionStatus: ReconciliationResolutionStatus;
  readonly evidenceReference: AccessEvidenceRef;
};

export type AccessTransactionContext = {
  readonly schemaVersion: typeof ACCESS_TRANSACTION_SCHEMA_VERSION;
  readonly transactionId: AccessDomainTransactionId;
  readonly userId: AccessUserId;
  readonly category: AccessCategoryId;
  readonly productId: AccessProductId | null;
  readonly entitlementId: AccessDomainEntitlementId | null;
  readonly fundingPoolId: string | null;
  readonly status: AccessDomainTransactionStatus;
  readonly version: number;
  readonly quote: AccessCheckoutQuote | null;
  readonly entitlementReservationId: string | null;
  readonly fundingReservationId: string | null;
  readonly providerReservationReference: string | null;
  readonly providerBookingReference: string | null;
  readonly userPaymentAuthorizationId: string | null;
  readonly providerPaymentAuthorizationId: string | null;
  readonly userPaymentCaptureId: string | null;
  readonly providerPaymentCaptureId: string | null;
  readonly reservationId: AccessDomainReservationId | null;
  readonly redemptionId: AccessDomainRedemptionId | null;
  readonly settlementId: AccessDomainSettlementId | null;
  readonly providerId: ProviderRef | null;
  readonly providerIdCanonical: AccessProviderId | null;
  readonly capturedAmountMinorUnits: bigint;
  readonly refundedAmountMinorUnits: bigint;
  readonly fulfillmentEvidence: readonly AccessFulfillmentEvidence[];
  readonly reconciliationIssues: readonly AccessReconciliationIssue[];
  readonly idempotencyKeys: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type OrchestratorOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly idempotent?: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type PaymentAuthorizationResult = {
  readonly authorizationId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly rail: string;
  readonly captured: boolean;
  readonly captureId: string | null;
  readonly voided: boolean;
  readonly refundedMinorUnits: bigint;
};

export type ProviderBookingStatusResult = {
  readonly bookingId: string;
  readonly state: 'CONFIRMED' | 'CANCELLED' | 'FAILED' | 'UNKNOWN';
  readonly providerReservationId: string | null;
};

export type AccessPaymentRailId = 'USER_FIAT' | 'PROVIDER_VIRTUAL_CARD' | 'ACCESS_POOL_INTERNAL';

export type AccessWebhookEvent = {
  readonly webhookEventId: string;
  readonly source: 'PROVIDER' | 'PAYMENT';
  readonly providerId: AccessProviderId | null;
  readonly transactionId: AccessDomainTransactionId | null;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly signatureVerified: boolean;
  readonly occurredAt: UtcInstant;
  readonly payloadReference: string;
};
