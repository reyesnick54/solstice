/**
 * ACCESS Wave 3 Prompt 35 — Access payment rail contract.
 *
 * Provider-facing fiat settlement abstraction. Rails implement only declared capabilities.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessEvidenceRef } from '../domain/ids.ts';
import type {
  AccessPaymentAuthorizationResult,
  AccessPaymentCaptureResult,
  AccessPaymentRailDescriptor,
  AccessPaymentReconcileResult,
  AccessPaymentRefundResult,
  AccessPaymentStatusResult,
  AccessPaymentVoidResult,
  AccessSettlementPlan,
  ProviderPaymentMethodRef,
} from './types.ts';
import type { AccessPaymentRailCapability } from './taxonomy.ts';
import { railSupportsCapability } from './taxonomy.ts';

export type AccessPaymentRailAuthorizeInput = {
  readonly plan: AccessSettlementPlan;
  readonly providerPaymentMethod: ProviderPaymentMethodRef;
  readonly providerFacingAmount: bigint;
  readonly currency: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AccessPaymentRailCaptureInput = {
  readonly paymentReference: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AccessPaymentRailVoidInput = {
  readonly paymentReference: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AccessPaymentRailRefundInput = {
  readonly paymentReference: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly accessTransactionId: string;
  readonly settlementId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AccessPaymentRailStatusInput = {
  readonly paymentReference: string;
  readonly idempotencyKey: string;
};

export type AccessPaymentRailReconcileInput = {
  readonly paymentReference: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

/** Canonical payment rail interface for provider fiat settlement. */
export type AccessPaymentRail = {
  readonly descriptor: AccessPaymentRailDescriptor;

  authorize(
    input: AccessPaymentRailAuthorizeInput,
  ): Promise<
    | AccessPaymentAuthorizationResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
    | { readonly ok: false; readonly code: 'UNKNOWN'; readonly evidenceReference: AccessEvidenceRef }
  >;

  capture(
    input: AccessPaymentRailCaptureInput,
  ): Promise<
    | AccessPaymentCaptureResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  void(
    input: AccessPaymentRailVoidInput,
  ): Promise<
    | AccessPaymentVoidResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  refund(
    input: AccessPaymentRailRefundInput,
  ): Promise<
    | AccessPaymentRefundResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  >;

  getPaymentStatus(input: AccessPaymentRailStatusInput): Promise<AccessPaymentStatusResult>;

  reconcile(input: AccessPaymentRailReconcileInput): Promise<AccessPaymentReconcileResult>;
};

export function assertRailCapability(
  rail: AccessPaymentRail,
  capability: AccessPaymentRailCapability,
): void {
  if (!railSupportsCapability(rail.descriptor.capabilities, capability)) {
    throw new RangeError(`rail ${rail.descriptor.railKind} does not support ${capability}`);
  }
}
