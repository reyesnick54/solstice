/**
 * ACCESS Wave 3 Prompt 35 — Simulated payment rail for tests and rehearsal.
 *
 * No live merchant payment. Injected/fake transport only.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  accessDomainEntitlementIdFor,
  accessDomainQuoteIdFor,
  accessDomainTransactionIdFor,
  accessEvidenceRefFor,
  accessFundingPoolIdFor,
  accessUserIdFor,
  type AccessEvidenceRef,
} from '../../domain/ids.ts';
import { providerRefFor } from '../../ids.ts';
import type {
  AccessPaymentRailAuthorizeInput,
  AccessPaymentRailCaptureInput,
  AccessPaymentRailReconcileInput,
  AccessPaymentRailRefundInput,
  AccessPaymentRailStatusInput,
  AccessPaymentRailVoidInput,
  AccessPaymentRail,
} from '../payment-rail.ts';
import type {
  CanonicalFiatLedgerPort,
  ComplianceGatePort,
  SettlementEvidencePort,
  UserFundingPort,
} from '../ports.ts';
import type {
  AccessPaymentAuthorizationResult,
  AccessPaymentCaptureResult,
  AccessPaymentReconcileResult,
  AccessPaymentRefundResult,
  AccessPaymentStatusResult,
  AccessPaymentVoidResult,
  AccessRefundAllocation,
  AccessSettlementPlan,
  AccessSettlementSourceOfFunds,
} from '../types.ts';

type SimulatedPaymentState = {
  readonly paymentReference: string;
  readonly authorizedAmount: bigint;
  readonly capturedAmount: bigint;
  readonly refundedAmount: bigint;
  readonly currency: string;
  readonly status: 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
};

export type SimulatedPaymentRailOptions = {
  readonly failAuthorize?: boolean;
  readonly timeoutOnAuthorize?: boolean;
  readonly failCapture?: boolean;
};

export class SimulatedAccessPaymentRail implements AccessPaymentRail {
  readonly descriptor = Object.freeze({
    railKind: 'SIMULATED' as const,
    capabilities: Object.freeze([
      'AUTHORIZE',
      'CAPTURE',
      'VOID',
      'REFUND',
      'PARTIAL_REFUND',
      'STATUS',
      'RECONCILE',
    ] as const),
    settlementStrategy: 'AUTHORIZE_THEN_BOOK_THEN_CAPTURE' as const,
  });

  private readonly payments = new Map<string, SimulatedPaymentState>();
  private readonly authorizeIdempotency = new Map<string, AccessPaymentAuthorizationResult>();
  private readonly captureIdempotency = new Map<string, AccessPaymentCaptureResult>();
  private readonly voidIdempotency = new Map<string, AccessPaymentVoidResult>();
  private readonly refundIdempotency = new Map<string, AccessPaymentRefundResult>();
  private readonly options: SimulatedPaymentRailOptions;

  constructor(options: SimulatedPaymentRailOptions = {}) {
    this.options = options;
  }

  async authorize(
    input: AccessPaymentRailAuthorizeInput,
  ): Promise<
    | AccessPaymentAuthorizationResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
    | { readonly ok: false; readonly code: 'UNKNOWN'; readonly evidenceReference: AccessEvidenceRef }
  > {
    const prior = this.authorizeIdempotency.get(input.idempotencyKey);
    if (prior) {
      return prior;
    }

    if (this.options.timeoutOnAuthorize) {
      return Object.freeze({
        ok: false as const,
        code: 'UNKNOWN' as const,
        evidenceReference: accessEvidenceRefFor(`evidence:timeout:${input.idempotencyKey}`),
      });
    }

    if (this.options.failAuthorize) {
      return Object.freeze({
        ok: false as const,
        code: 'DECLINED',
        evidenceReference: accessEvidenceRefFor(`evidence:declined:${input.idempotencyKey}`),
      });
    }

    const paymentReference = `sim_pay_${randomUUID()}`;
    const result: AccessPaymentAuthorizationResult = Object.freeze({
      ok: true,
      paymentReference,
      remoteStatus: 'AUTHORIZED',
      evidenceReference: accessEvidenceRefFor(`evidence:auth:${paymentReference}`),
      providerFacingAmount: input.providerFacingAmount,
      currency: input.currency,
    });

    this.payments.set(paymentReference, Object.freeze({
      paymentReference,
      authorizedAmount: input.providerFacingAmount,
      capturedAmount: 0n,
      refundedAmount: 0n,
      currency: input.currency,
      status: 'AUTHORIZED',
    }));
    this.authorizeIdempotency.set(input.idempotencyKey, result);
    return result;
  }

  async capture(
    input: AccessPaymentRailCaptureInput,
  ): Promise<
    | AccessPaymentCaptureResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  > {
    const prior = this.captureIdempotency.get(input.idempotencyKey);
    if (prior) {
      return prior;
    }

    if (this.options.failCapture) {
      return Object.freeze({
        ok: false as const,
        code: 'CAPTURE_FAILED',
        evidenceReference: accessEvidenceRefFor(`evidence:capture-fail:${input.idempotencyKey}`),
      });
    }

    const payment = this.payments.get(input.paymentReference);
    if (!payment || payment.status !== 'AUTHORIZED') {
      return Object.freeze({
        ok: false as const,
        code: 'INVALID_STATE',
        evidenceReference: accessEvidenceRefFor(`evidence:capture-invalid:${input.idempotencyKey}`),
      });
    }

    const result: AccessPaymentCaptureResult = Object.freeze({
      ok: true,
      captureReference: `sim_cap_${randomUUID()}`,
      remoteStatus: 'CAPTURED',
      evidenceReference: accessEvidenceRefFor(`evidence:capture:${input.paymentReference}`),
    });

    this.payments.set(input.paymentReference, Object.freeze({
      ...payment,
      capturedAmount: input.amountMinorUnits,
      status: 'CAPTURED',
    }));
    this.captureIdempotency.set(input.idempotencyKey, result);
    return result;
  }

  async void(
    input: AccessPaymentRailVoidInput,
  ): Promise<
    | AccessPaymentVoidResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  > {
    const prior = this.voidIdempotency.get(input.idempotencyKey);
    if (prior) {
      return prior;
    }

    const payment = this.payments.get(input.paymentReference);
    if (!payment || payment.status !== 'AUTHORIZED') {
      return Object.freeze({
        ok: false as const,
        code: 'INVALID_STATE',
        evidenceReference: accessEvidenceRefFor(`evidence:void-invalid:${input.idempotencyKey}`),
      });
    }

    const result: AccessPaymentVoidResult = Object.freeze({
      ok: true,
      voidReference: `sim_void_${randomUUID()}`,
      remoteStatus: 'VOIDED',
      evidenceReference: accessEvidenceRefFor(`evidence:void:${input.paymentReference}`),
    });

    this.payments.set(input.paymentReference, Object.freeze({
      ...payment,
      status: 'VOIDED',
    }));
    this.voidIdempotency.set(input.idempotencyKey, result);
    return result;
  }

  async refund(
    input: AccessPaymentRailRefundInput,
  ): Promise<
    | AccessPaymentRefundResult
    | { readonly ok: false; readonly code: string; readonly evidenceReference: AccessEvidenceRef }
  > {
    const prior = this.refundIdempotency.get(input.idempotencyKey);
    if (prior) {
      return prior;
    }

    const payment = this.payments.get(input.paymentReference);
    if (!payment || (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED')) {
      return Object.freeze({
        ok: false as const,
        code: 'INVALID_STATE',
        evidenceReference: accessEvidenceRefFor(`evidence:refund-invalid:${input.idempotencyKey}`),
      });
    }

    const newRefunded = payment.refundedAmount + input.amountMinorUnits;
    const status = newRefunded >= payment.capturedAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const result: AccessPaymentRefundResult = Object.freeze({
      ok: true,
      refundReference: `sim_ref_${randomUUID()}`,
      remoteStatus: status === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      evidenceReference: accessEvidenceRefFor(`evidence:refund:${input.paymentReference}`),
      refundedAmount: input.amountMinorUnits,
    });

    this.payments.set(input.paymentReference, Object.freeze({
      ...payment,
      refundedAmount: newRefunded,
      status,
    }));
    this.refundIdempotency.set(input.idempotencyKey, result);
    return result;
  }

  async getPaymentStatus(input: AccessPaymentRailStatusInput): Promise<AccessPaymentStatusResult> {
    const payment = this.payments.get(input.paymentReference);
    if (!payment) {
      return Object.freeze({
        paymentReference: input.paymentReference,
        remoteStatus: 'UNKNOWN',
        evidenceReference: accessEvidenceRefFor(`evidence:status-unknown:${input.paymentReference}`),
      });
    }

    const remoteStatus =
      payment.status === 'AUTHORIZED'
        ? 'AUTHORIZED'
        : payment.status === 'CAPTURED'
          ? 'CAPTURED'
          : payment.status === 'VOIDED'
            ? 'VOIDED'
            : payment.status === 'REFUNDED'
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED';

    return Object.freeze({
      paymentReference: input.paymentReference,
      remoteStatus,
      evidenceReference: accessEvidenceRefFor(`evidence:status:${input.paymentReference}`),
    });
  }

  async reconcile(input: AccessPaymentRailReconcileInput): Promise<AccessPaymentReconcileResult> {
    const status = await this.getPaymentStatus({
      paymentReference: input.paymentReference,
      idempotencyKey: input.idempotencyKey,
    });
    return Object.freeze({
      paymentReference: input.paymentReference,
      remoteStatus: status.remoteStatus,
      evidenceReference: status.evidenceReference,
      reconciled: status.remoteStatus !== 'UNKNOWN',
    });
  }

  getPayment(paymentReference: string): SimulatedPaymentState | undefined {
    return this.payments.get(paymentReference);
  }
}

export class SimulatedUserFundingPort implements UserFundingPort {
  private readonly rail: SimulatedAccessPaymentRail;
  private readonly authorizeIdempotency = new Map<string, AccessPaymentAuthorizationResult>();

  constructor(rail?: SimulatedAccessPaymentRail) {
    this.rail = rail ?? new SimulatedAccessPaymentRail();
  }

  async authorize(input: {
    readonly userId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly fundingSource: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    const prior = this.authorizeIdempotency.get(input.idempotencyKey);
    if (prior) {
      return prior;
    }
    const stubPlan: AccessSettlementPlan = Object.freeze({
      planId: 'user-funding',
      checkoutQuoteId: accessDomainQuoteIdFor('user-funding'),
      accessTransactionId: accessDomainTransactionIdFor(input.accessTransactionId),
      userId: accessUserIdFor(input.userId),
      providerId: providerRefFor('user-funding'),
      category: 'OTHER',
      unit: 'OTHER',
      entitlementId: accessDomainEntitlementIdFor('user-funding'),
      entitlementUnits: 0n,
      fundingPoolId: accessFundingPoolIdFor('user-funding'),
      currency: input.currency,
      providerAmount: input.amountMinorUnits,
      accessPoolContribution: 0n,
      userContribution: input.amountMinorUnits,
      tokenConversionContribution: 0n,
      otherProgramContribution: 0n,
      paymentRail: 'SIMULATED',
      providerPaymentMethod: 'user-funding',
      userFundingSource: input.fundingSource,
      settlementStrategy: 'AUTHORIZE_THEN_BOOK_THEN_CAPTURE',
      expiresAt: input.now,
      evidenceReference: accessEvidenceRefFor('evidence:user-funding'),
    });
    const result = await this.rail.authorize({
      plan: stubPlan,
      providerPaymentMethod: input.fundingSource,
      providerFacingAmount: input.amountMinorUnits,
      currency: input.currency,
      accessTransactionId: input.accessTransactionId,
      settlementId: input.settlementId,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    if ('ok' in result && result.ok) {
      this.authorizeIdempotency.set(input.idempotencyKey, result);
    }
    return result;
  }

  async capture(input: {
    readonly paymentReference: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.rail.capture(input);
  }

  async void(input: {
    readonly paymentReference: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.rail.void(input);
  }

  async refund(input: {
    readonly paymentReference: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.rail.refund(input);
  }

  async getPaymentStatus(input: { readonly paymentReference: string; readonly idempotencyKey: string }) {
    return this.rail.getPaymentStatus(input);
  }
}

export class SimulatedComplianceGatePort implements ComplianceGatePort {
  private readonly approved: boolean;
  private readonly calls: Array<{ accessTransactionId: string; idempotencyKey: string }> = [];

  constructor(approved = true) {
    this.approved = approved;
  }

  async evaluate(input: {
    readonly accessTransactionId: string;
    readonly userId: string;
    readonly plan: AccessSettlementPlan;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    this.calls.push({
      accessTransactionId: input.accessTransactionId,
      idempotencyKey: input.idempotencyKey,
    });
    if (this.approved) {
      return Object.freeze({
        approved: true as const,
        evidenceReference: accessEvidenceRefFor(`evidence:compliance:${input.idempotencyKey}`),
      });
    }
    return Object.freeze({
      approved: false as const,
      refusalCode: 'KERNEL_REFUSE',
      evidenceReference: accessEvidenceRefFor(`evidence:compliance-refuse:${input.idempotencyKey}`),
    });
  }

  getCalls() {
    return Object.freeze([...this.calls]);
  }
}

export class SimulatedCanonicalFiatLedgerPort implements CanonicalFiatLedgerPort {
  private readonly settlementRecords: Array<{ journalId: string; settlementId: string; type: string }> = [];
  private readonly captureIdempotency = new Map<string, string>();
  private readonly refundIdempotency = new Map<string, string>();

  async postSettlementCapture(input: {
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly sourceOfFunds: AccessSettlementSourceOfFunds;
    readonly providerAmount: bigint;
    readonly currency: string;
    readonly providerPaymentReference: string;
    readonly idempotencyKey: string;
    readonly evidenceReference: AccessEvidenceRef;
    readonly now: UtcInstant;
  }) {
    const prior = this.captureIdempotency.get(input.idempotencyKey);
    if (prior) {
      return Object.freeze({
        journalId: prior,
        evidenceReference: accessEvidenceRefFor(`evidence:ledger:${prior}`),
      });
    }
    const journalId = `journal_${randomUUID()}`;
    this.settlementRecords.push({ journalId, settlementId: input.settlementId, type: 'CAPTURE' });
    this.captureIdempotency.set(input.idempotencyKey, journalId);
    return Object.freeze({
      journalId,
      evidenceReference: accessEvidenceRefFor(`evidence:ledger:${journalId}`),
    });
  }

  async postSettlementRefund(input: {
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly refundAllocation: AccessRefundAllocation;
    readonly idempotencyKey: string;
    readonly evidenceReference: AccessEvidenceRef;
    readonly now: UtcInstant;
  }) {
    const prior = this.refundIdempotency.get(input.idempotencyKey);
    if (prior) {
      return Object.freeze({
        journalId: prior,
        evidenceReference: accessEvidenceRefFor(`evidence:ledger:${prior}`),
      });
    }
    const journalId = `journal_ref_${randomUUID()}`;
    this.settlementRecords.push({ journalId, settlementId: input.settlementId, type: 'REFUND' });
    this.refundIdempotency.set(input.idempotencyKey, journalId);
    return Object.freeze({
      journalId,
      evidenceReference: accessEvidenceRefFor(`evidence:ledger:${journalId}`),
    });
  }

  getJournals() {
    return Object.freeze([...this.settlementRecords]);
  }
}

export class SimulatedSettlementEvidencePort implements SettlementEvidencePort {
  seal(input: {
    readonly kind: string;
    readonly settlementId: string;
    readonly accessTransactionId: string;
    readonly payload: Readonly<Record<string, string | number | boolean>>;
    readonly now: UtcInstant;
  }) {
    const safePayload = Object.fromEntries(
      Object.entries(input.payload).filter(
        ([key]) => !/pan|card.?number|cvv|credential/i.test(key),
      ),
    );
    return accessEvidenceRefFor(
      `evidence:${input.kind}:${input.settlementId}:${JSON.stringify(safePayload)}`,
    );
  }
}
