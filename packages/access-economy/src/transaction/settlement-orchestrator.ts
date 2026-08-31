/**
 * ACCESS Wave 3 / Prompt 35 — fiat settlement orchestrator.
 *
 * Orchestrates user contribution and provider virtual-card settlement.
 * Does not post to canonical ledger directly — records settlement evidence.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { accessDomainSettlementIdFor, accessEvidenceRefFor } from '../domain/ids.ts';
import type { AccessSettlement } from '../domain/types.ts';
import { buildAccessSettlement } from '../domain/invariants.ts';
import { ACCESS_DOMAIN_SCHEMA_VERSION, ACCESS_DOMAIN_TAXONOMY_VERSION } from '../domain/taxonomy.ts';
import type { ProviderRef } from '../ids.ts';
import type { AccessCheckoutQuote } from './types.ts';
import type { AccessDomainSettlementId, AccessDomainTransactionId } from '../domain/ids.ts';
import { AccessPaymentRail } from './payment-rail.ts';

export type SettlementOrchestratorOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly idempotent?: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class AccessSettlementOrchestrator {
  private readonly paymentRail: AccessPaymentRail;
  private readonly settlements = new Map<string, AccessSettlement>();
  private readonly byTransaction = new Map<string, string>();

  constructor(paymentRail: AccessPaymentRail) {
    this.paymentRail = paymentRail;
  }

  createSettlement(input: {
    readonly transactionId: AccessDomainTransactionId;
    readonly providerId: ProviderRef;
    readonly checkoutQuote: AccessCheckoutQuote;
    readonly now: UtcInstant;
  }): SettlementOrchestratorOutcome<AccessSettlement> {
    const existing = this.byTransaction.get(input.transactionId);
    if (existing) {
      return { ok: true, value: this.settlements.get(existing)!, idempotent: true };
    }
    const settlementId = accessDomainSettlementIdFor(`settlement-${input.transactionId}`);
    const settlement = buildAccessSettlement({
      schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
      taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
      settlementId,
      accessTransactionId: input.transactionId,
      providerId: input.providerId,
      currency: input.checkoutQuote.currency,
      providerAmount: input.checkoutQuote.totalProviderAmountMinorUnits,
      accessPoolContribution: input.checkoutQuote.accessPoolContributionMinorUnits,
      userFiatContribution: input.checkoutQuote.userContributionMinorUnits,
      tokenConversionContribution: input.checkoutQuote.tokenConversionContributionMinorUnits,
      taxAmount: input.checkoutQuote.taxesMinorUnits,
      feeAmount: input.checkoutQuote.mandatoryFeesMinorUnits,
      authorizationReference: null,
      captureReference: null,
      refundReference: null,
      status: 'PENDING',
      evidenceReference: accessEvidenceRefFor(`settlement:${settlementId}`),
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.settlements.set(settlementId, settlement);
    this.byTransaction.set(input.transactionId, settlementId);
    return { ok: true, value: settlement };
  }

  authorizeUserContribution(input: {
    readonly transactionId: AccessDomainTransactionId;
    readonly settlementId: AccessDomainSettlementId;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): SettlementOrchestratorOutcome<{ readonly authorizationId: string; readonly settlement: AccessSettlement }> {
    const settlement = this.settlements.get(input.settlementId);
    if (!settlement) {
      return { ok: false, code: 'NOT_FOUND', message: 'settlement not found' };
    }
    const auth = this.paymentRail.authorize({
      transactionId: input.transactionId,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      rail: 'USER_FIAT',
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    if (!auth.ok) {
      return auth;
    }
    const updated = this.updateSettlement(settlement, {
      status: 'AUTHORIZED',
      authorizationReference: auth.value.authorizationId,
      updatedAt: input.now,
    });
    return { ok: true, value: { authorizationId: auth.value.authorizationId, settlement: updated } };
  }

  authorizeProviderPayment(input: {
    readonly transactionId: AccessDomainTransactionId;
    readonly settlementId: AccessDomainSettlementId;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): SettlementOrchestratorOutcome<{ readonly authorizationId: string; readonly settlement: AccessSettlement }> {
    const settlement = this.settlements.get(input.settlementId);
    if (!settlement) {
      return { ok: false, code: 'NOT_FOUND', message: 'settlement not found' };
    }
    const auth = this.paymentRail.authorize({
      transactionId: input.transactionId,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      rail: 'PROVIDER_VIRTUAL_CARD',
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      restrictedMerchantAmountMinorUnits: input.amountMinorUnits,
      securityDepositSeparate: true,
    });
    if (!auth.ok) {
      return auth;
    }
    const updated = this.updateSettlement(settlement, {
      status: 'AUTHORIZED',
      authorizationReference: settlement.authorizationReference ?? auth.value.authorizationId,
      updatedAt: input.now,
    });
    return { ok: true, value: { authorizationId: auth.value.authorizationId, settlement: updated } };
  }

  captureProviderPayment(input: {
    readonly authorizationId: string;
    readonly settlementId: AccessDomainSettlementId;
    readonly amountMinorUnits: bigint;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): SettlementOrchestratorOutcome<AccessSettlement> {
    const settlement = this.settlements.get(input.settlementId);
    if (!settlement) {
      return { ok: false, code: 'NOT_FOUND', message: 'settlement not found' };
    }
    const capture = this.paymentRail.capture({
      authorizationId: input.authorizationId,
      amountMinorUnits: input.amountMinorUnits,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    if (!capture.ok) {
      return capture;
    }
    const updated = this.updateSettlement(settlement, {
      status: 'CAPTURED',
      captureReference: capture.value.captureId,
      updatedAt: input.now,
    });
    return { ok: true, value: updated };
  }

  captureUserContribution(input: {
    readonly authorizationId: string;
    readonly settlementId: AccessDomainSettlementId;
    readonly amountMinorUnits: bigint;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): SettlementOrchestratorOutcome<AccessSettlement> {
    return this.captureProviderPayment(input);
  }

  getSettlement(settlementId: AccessDomainSettlementId): AccessSettlement | null {
    return this.settlements.get(settlementId) ?? null;
  }

  getSettlementForTransaction(transactionId: AccessDomainTransactionId): AccessSettlement | null {
    const id = this.byTransaction.get(transactionId);
    return id ? this.settlements.get(id) ?? null : null;
  }

  private updateSettlement(
    settlement: AccessSettlement,
    patch: Partial<AccessSettlement> & { readonly updatedAt: UtcInstant },
  ): AccessSettlement {
    const updated = Object.freeze({ ...settlement, ...patch });
    this.settlements.set(updated.settlementId, updated);
    return updated;
  }
}
