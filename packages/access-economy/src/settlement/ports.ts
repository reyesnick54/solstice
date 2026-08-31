/**
 * ACCESS Wave 3 Prompt 35 — Settlement orchestration ports.
 *
 * External dependencies (compliance, user funding, canonical ledger) are injected.
 * access-economy does not import Kernel, ledger, or payments packages.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessEvidenceRef } from '../domain/ids.ts';
import type {
  AccessPaymentAuthorizationResult,
  AccessPaymentCaptureResult,
  AccessPaymentRefundResult,
  AccessPaymentStatusResult,
  AccessPaymentVoidResult,
  AccessSettlementPlan,
  AccessSettlementSourceOfFunds,
  UserFundingSourceRef,
} from './types.ts';

/** Compliance / risk gate — reuses existing Kernel decision semantics via port. */
export type ComplianceGatePort = {
  evaluate(input: {
    readonly accessTransactionId: string;
    readonly userId: string;
    readonly plan: AccessSettlementPlan;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<
    | { readonly approved: true; readonly evidenceReference: AccessEvidenceRef }
    | { readonly approved: false; readonly refusalCode: string; readonly evidenceReference: AccessEvidenceRef }
  >;
};

/** User fiat contribution authorization through canonical payment infrastructure. */
export type UserFundingPort = {
  authorize(input: {
    readonly userId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly fundingSource: UserFundingSourceRef;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<
    | AccessPaymentAuthorizationResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
    | { readonly ok: false; readonly code: 'UNKNOWN'; readonly evidenceReference: AccessEvidenceRef }
  >;

  capture(input: {
    readonly paymentReference: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<
    | AccessPaymentCaptureResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  void(input: {
    readonly paymentReference: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<
    | AccessPaymentVoidResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  refund(input: {
    readonly paymentReference: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<
    | AccessPaymentRefundResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  getPaymentStatus(input: {
    readonly paymentReference: string;
    readonly idempotencyKey: string;
  }): Promise<AccessPaymentStatusResult>;
};

/** Canonical fiat ledger — authoritative monetary state. */
export type CanonicalFiatLedgerPort = {
  postSettlementCapture(input: {
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly sourceOfFunds: AccessSettlementSourceOfFunds;
    readonly providerAmount: bigint;
    readonly currency: string;
    readonly providerPaymentReference: string;
    readonly idempotencyKey: string;
    readonly evidenceReference: AccessEvidenceRef;
    readonly now: UtcInstant;
  }): Promise<{ readonly journalId: string; readonly evidenceReference: AccessEvidenceRef }>;

  postSettlementRefund(input: {
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly refundAllocation: import('./types.ts').AccessRefundAllocation;
    readonly idempotencyKey: string;
    readonly evidenceReference: AccessEvidenceRef;
    readonly now: UtcInstant;
  }): Promise<{ readonly journalId: string; readonly evidenceReference: AccessEvidenceRef }>;
};

/** Evidence recording — no sensitive payment data. */
export type SettlementEvidencePort = {
  seal(input: {
    readonly kind: string;
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly payload: Readonly<Record<string, string | number | boolean>>;
    readonly now: UtcInstant;
  }): AccessEvidenceRef;
};
