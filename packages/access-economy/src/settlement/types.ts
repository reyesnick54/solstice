/**
 * ACCESS Wave 3 / Prompt 36 — Restricted virtual-card settlement types.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessCategoryId } from '../domain/taxonomy.ts';
import type { ProviderRef } from '../ids.ts';
import type { AccessCardBufferPolicy } from './buffer-policy.ts';
import type {
  AccessCardLifecycleEvent,
  AccessPaymentRailCapability,
  AccessPaymentRailStatus,
  AccessSettlementRailFailureCode,
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
