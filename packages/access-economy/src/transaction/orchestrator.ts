/**
 * ACCESS Wave 3 / Prompt 37 — authoritative Access transaction orchestrator.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import {
  accessDomainQuoteIdFor,
  accessDomainReservationIdFor,
  accessDomainSettlementIdFor,
  accessDomainTransactionIdFor,
  accessEvidenceRefFor,
  asAccessDomainEntitlementId,
  asAccessDomainTransactionId,
  asAccessUserId,
} from '../domain/ids.ts';
import { ACCESS_DOMAIN_SCHEMA_VERSION } from '../domain/taxonomy.ts';
import type { AccessCategoryId, AccessUnit } from '../domain/taxonomy.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import { providerRefFor, subjectRefFor } from '../ids.ts';
import type { AccessProviderGateway } from '../providers/gateway.ts';
import type { AccessProviderId, ProviderQuote } from '../providers/types.ts';
import { AccessCoverageEngine } from './coverage-engine.ts';
import { resolveEntitlementRestorationPolicy } from './entitlement-restoration-policy.ts';
import { resolveFulfillmentPolicy } from './fulfillment-policy.ts';
import { allocateRefund } from './refund-policy.ts';
import { compensateTransaction } from './saga.ts';
import { AccessSettlementOrchestrator } from './settlement-orchestrator.ts';
import { AccessPaymentRail } from './payment-rail.ts';
import { AccessTransactionStore } from './store.ts';
import type { ConfigurableSimulationProvider } from './simulation-provider.ts';
import type {
  AccessCheckoutQuote,
  AccessFulfillmentEvidence,
  AccessTransactionContext,
  AccessWebhookEvent,
  OrchestratorOutcome,
} from './types.ts';

const RESERVATION_TTL = '2026-09-01T12:00:00.000Z';

export type AccessTransactionOrchestratorDeps = {
  readonly solvency: AccessSolvencyService;
  readonly gateway: AccessProviderGateway;
  readonly paymentRail: AccessPaymentRail;
  readonly simulationProvider?: ConfigurableSimulationProvider;
};

export class AccessTransactionOrchestrator {
  private readonly solvency: AccessSolvencyService;
  private readonly gateway: AccessProviderGateway;
  private readonly paymentRail: AccessPaymentRail;
  private readonly simulationProvider?: ConfigurableSimulationProvider;
  readonly store: AccessTransactionStore;
  readonly coverageEngine: AccessCoverageEngine;
  readonly settlementOrchestrator: AccessSettlementOrchestrator;
  private readonly startIdempotency = new Map<string, string>();

  constructor(deps: AccessTransactionOrchestratorDeps) {
    this.solvency = deps.solvency;
    this.gateway = deps.gateway;
    this.paymentRail = deps.paymentRail;
    this.simulationProvider = deps.simulationProvider;
    this.store = new AccessTransactionStore();
    this.coverageEngine = new AccessCoverageEngine(deps.solvency);
    this.settlementOrchestrator = new AccessSettlementOrchestrator(deps.paymentRail);
  }

  async start(input: {
    readonly userId: string;
    readonly category: AccessCategoryId;
    readonly entitlementId: string;
    readonly fundingPoolId: string;
    readonly unit: AccessUnit;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const priorTx = this.startIdempotency.get(input.idempotencyKey);
    if (priorTx) {
      const ctx = this.store.get(priorTx);
      if (ctx) {
        return { ok: true, value: ctx, idempotent: true };
      }
    }
    const transactionId = asAccessDomainTransactionId(
      accessDomainTransactionIdFor(`tx-${input.idempotencyKey}`),
    );
    const context: AccessTransactionContext = Object.freeze({
      schemaVersion: 1,
      transactionId,
      userId: asAccessUserId(input.userId),
      category: input.category,
      productId: null,
      entitlementId: asAccessDomainEntitlementId(input.entitlementId),
      fundingPoolId: input.fundingPoolId,
      status: 'CREATED',
      version: 0,
      quote: null,
      entitlementReservationId: null,
      fundingReservationId: null,
      providerReservationReference: null,
      providerBookingReference: null,
      userPaymentAuthorizationId: null,
      providerPaymentAuthorizationId: null,
      userPaymentCaptureId: null,
      providerPaymentCaptureId: null,
      reservationId: null,
      redemptionId: null,
      settlementId: null,
      providerId: null,
      providerIdCanonical: null,
      capturedAmountMinorUnits: 0n,
      refundedAmountMinorUnits: 0n,
      fulfillmentEvidence: Object.freeze([]),
      reconciliationIssues: Object.freeze([]),
      idempotencyKeys: Object.freeze({}),
      createdAt: input.now,
      updatedAt: input.now,
    });
    await awaitSave(this.store, context);
    this.startIdempotency.set(input.idempotencyKey, transactionId);
    return { ok: true, value: context };
  }

  async quote(input: {
    readonly transactionId: string;
    readonly providerId: AccessProviderId;
    readonly providerProductId: string;
    readonly providerQuote: ProviderQuote;
    readonly taxesMinorUnits: bigint;
    readonly mandatoryFeesMinorUnits: bigint;
    readonly securityDepositMinorUnits: bigint;
    readonly entitlementClass: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    if (input.idempotencyKey in context.idempotencyKeys) {
      return { ok: true, value: context, idempotent: true };
    }

    const balance = this.solvency.getEntitlementLedger().getBalance(context.entitlementId!);
    if (!balance) {
      return { ok: false, code: 'ENTITLEMENT_NOT_FOUND', message: 'entitlement not found' };
    }

    const quoteId = accessDomainQuoteIdFor(`quote-${input.transactionId}`);
    const coverage = this.coverageEngine.evaluate({
      transactionId: context.transactionId,
      quoteId,
      userId: context.userId,
      category: context.category,
      unit: context.category === 'MOBILITY' ? 'VEHICLE_DAY' : 'OTHER',
      entitlementClass: input.entitlementClass,
      entitlementRemainingUnits: balance.remaining,
      fundingPoolId: context.fundingPoolId!,
      providerQuote: input.providerQuote,
      taxesMinorUnits: input.taxesMinorUnits,
      mandatoryFeesMinorUnits: input.mandatoryFeesMinorUnits,
      securityDepositMinorUnits: input.securityDepositMinorUnits,
      now: input.now,
    });
    if (!coverage.ok) {
      return coverage;
    }

    const transitioned = await awaitTransition(this.store, context.transactionId, 'QUOTED', {
      quote: coverage.checkoutQuote,
      providerId: providerRefFor(input.providerId),
      providerIdCanonical: input.providerId,
      productId: null,
      idempotencyKeys: Object.freeze({ ...context.idempotencyKeys, quote: input.idempotencyKey }),
      updatedAt: input.now,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    return { ok: true, value: transitioned.context };
  }

  async approveEligibility(input: {
    readonly transactionId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    return this.transitionSimple(input.transactionId, 'ELIGIBILITY_APPROVED', input.idempotencyKey, 'eligibility', input.now);
  }

  async reserve(input: {
    readonly transactionId: string;
    readonly userApproved?: boolean;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    let context = this.store.get(input.transactionId);
    if (!context?.quote) {
      return { ok: false, code: 'QUOTE_REQUIRED', message: 'checkout quote required' };
    }
    if (input.idempotencyKey in context.idempotencyKeys && context.entitlementReservationId) {
      return { ok: true, value: context, idempotent: true };
    }
    if (context.quote.userContributionMinorUnits > 0n && input.userApproved !== true) {
      return { ok: false, code: 'USER_APPROVAL_REQUIRED', message: 'user must approve co-pay amount' };
    }

    if (context.status === 'QUOTED') {
      const approved = await awaitTransition(this.store, context.transactionId, 'ELIGIBILITY_APPROVED', {
        updatedAt: input.now,
      });
      if (!approved.ok) {
        return approved;
      }
      context = approved.context;
    }

    const quote = context.quote!;
    const expiresAt = asUtcInstant(RESERVATION_TTL);

    const entReserve = await this.solvency.getEntitlementReservations().reserve({
      entitlementId: context.entitlementId!,
      accessTransactionId: context.transactionId,
      userId: subjectRefFor(context.userId),
      category: context.category,
      unit: quote.unit,
      quantity: quote.entitlementUnitsReserved,
      expiresAt,
      evidenceReference: accessEvidenceRefFor(`ent-res:${context.transactionId}`),
      idempotencyKey: `ent:${input.idempotencyKey}`,
      now: input.now,
    });
    if (!entReserve.ok && entReserve.code !== 'IDEMPOTENT') {
      return { ok: false, code: entReserve.code, message: 'entitlement reservation failed' };
    }
    const entitlementReservationId =
      entReserve.ok ? entReserve.reservation.entitlementReservationId : entReserve.reservation!.entitlementReservationId;

    const fundReserve = await this.solvency.reserveFunding({
      fundingPoolId: context.fundingPoolId!,
      accessTransactionId: context.transactionId,
      userId: subjectRefFor(context.userId),
      currency: quote.currency,
      amountMinorUnits: quote.accessPoolContributionMinorUnits,
      category: context.category,
      expiresAt,
      evidenceReference: accessEvidenceRefFor(`fund-res:${context.transactionId}`),
      idempotencyKey: `fund:${input.idempotencyKey}`,
      now: input.now,
    });
    if (!fundReserve.ok && fundReserve.code !== 'IDEMPOTENT') {
      await this.solvency.getEntitlementReservations().release({
        entitlementReservationId,
        evidenceReference: accessEvidenceRefFor(`ent-release:${context.transactionId}`),
        idempotencyKey: `ent-release:${input.idempotencyKey}`,
        now: input.now,
      });
      return { ok: false, code: fundReserve.code, message: 'funding reservation failed' };
    }
    const fundingReservationId =
      fundReserve.ok ? fundReserve.reservation.fundingReservationId : fundReserve.reservation!.fundingReservationId;

    const settlementResult = this.settlementOrchestrator.createSettlement({
      transactionId: context.transactionId,
      providerId: context.providerId!,
      checkoutQuote: quote,
      now: input.now,
    });
    if (!settlementResult.ok) {
      return settlementResult;
    }

    let userAuthId: string | null = null;
    if (quote.userContributionMinorUnits > 0n) {
      const userAuth = this.settlementOrchestrator.authorizeUserContribution({
        transactionId: context.transactionId,
        settlementId: settlementResult.value.settlementId,
        amountMinorUnits: quote.userContributionMinorUnits,
        currency: quote.currency,
        idempotencyKey: `user-auth:${input.idempotencyKey}`,
        now: input.now,
      });
      if (!userAuth.ok) {
        await compensateTransaction(context, {
          solvency: this.solvency,
          paymentRail: this.paymentRail,
          now: input.now,
          evidencePrefix: 'compensate',
        });
        return userAuth;
      }
      userAuthId = userAuth.value.authorizationId;
    }

    const providerAuth = this.settlementOrchestrator.authorizeProviderPayment({
      transactionId: context.transactionId,
      settlementId: settlementResult.value.settlementId,
      amountMinorUnits: quote.totalProviderAmountMinorUnits,
      currency: quote.currency,
      idempotencyKey: `provider-auth:${input.idempotencyKey}`,
      now: input.now,
    });
    if (!providerAuth.ok) {
      await compensateTransaction(
        { ...context, entitlementReservationId, fundingReservationId, userPaymentAuthorizationId: userAuthId },
        { solvency: this.solvency, paymentRail: this.paymentRail, now: input.now, evidencePrefix: 'compensate' },
      );
      return providerAuth;
    }

    const providerReserve = this.gateway.reserve({
      requestId: `rsv_${context.transactionId}`,
      providerId: context.providerIdCanonical!,
      quoteId: quote.providerQuoteReference,
      subjectRef: subjectRefFor(context.userId),
      idempotencyKey: `provider-reserve:${input.idempotencyKey}`,
    });
    if (!providerReserve.ok) {
      await compensateTransaction(
        {
          ...context,
          entitlementReservationId,
          fundingReservationId,
          userPaymentAuthorizationId: userAuthId,
          providerPaymentAuthorizationId: providerAuth.value.authorizationId,
        },
        { solvency: this.solvency, paymentRail: this.paymentRail, now: input.now, evidencePrefix: 'compensate' },
      );
      return { ok: false, code: providerReserve.code, message: providerReserve.message };
    }

    const transitioned = await awaitTransition(this.store, context.transactionId, 'PROVIDER_RESERVED', {
      entitlementReservationId,
      fundingReservationId,
      settlementId: settlementResult.value.settlementId,
      reservationId: accessDomainReservationIdFor(`res-${context.transactionId}`),
      userPaymentAuthorizationId: userAuthId,
      providerPaymentAuthorizationId: providerAuth.value.authorizationId,
      providerReservationReference: providerReserve.value.reservationId,
      idempotencyKeys: Object.freeze({ ...context.idempotencyKeys, reserve: input.idempotencyKey }),
      updatedAt: input.now,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    return { ok: true, value: transitioned.context };
  }

  async book(input: {
    readonly transactionId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context?.quote || !context.providerReservationReference) {
      return { ok: false, code: 'RESERVE_REQUIRED', message: 'reservation required before booking' };
    }
    if (input.idempotencyKey in context.idempotencyKeys && context.providerBookingReference) {
      return { ok: true, value: context, idempotent: true };
    }

    const booking = this.gateway.book({
      requestId: `book_${context.transactionId}`,
      providerId: context.providerIdCanonical!,
      reservationId: context.providerReservationReference,
      subjectRef: subjectRefFor(context.userId),
      idempotencyKey: input.idempotencyKey,
    });

    if (!booking.ok && booking.code === 'TIMEOUT') {
      const reconciled = await awaitTransition(this.store, context.transactionId, 'RECONCILIATION_REQUIRED', {
        idempotencyKeys: Object.freeze({ ...context.idempotencyKeys, book: input.idempotencyKey }),
        updatedAt: input.now,
      });
      return reconciled.ok
        ? { ok: true, value: reconciled.context }
        : { ok: false, code: 'RECONCILIATION_REQUIRED', message: booking.message };
    }

    if (!booking.ok) {
      await compensateTransaction(context, {
        solvency: this.solvency,
        paymentRail: this.paymentRail,
        now: input.now,
        evidencePrefix: 'book-fail',
      });
      const failed = await awaitTransition(this.store, context.transactionId, 'FAILED', { updatedAt: input.now });
      return failed.ok
        ? { ok: false, code: booking.code, message: booking.message }
        : { ok: false, code: booking.code, message: booking.message };
    }

    const providerCapture = this.settlementOrchestrator.captureProviderPayment({
      authorizationId: context.providerPaymentAuthorizationId!,
      settlementId: context.settlementId!,
      amountMinorUnits: context.quote.totalProviderAmountMinorUnits,
      idempotencyKey: `provider-cap:${input.idempotencyKey}`,
      now: input.now,
    });
    if (!providerCapture.ok) {
      const reconciled = await awaitTransition(this.store, context.transactionId, 'RECONCILIATION_REQUIRED', {
        providerBookingReference: booking.value.bookingId,
        updatedAt: input.now,
      });
      return { ok: false, code: providerCapture.code, message: providerCapture.message };
    }

    let userCaptureId: string | null = context.userPaymentCaptureId;
    if (context.quote.userContributionMinorUnits > 0n && context.userPaymentAuthorizationId) {
      const userCapture = this.settlementOrchestrator.captureUserContribution({
        authorizationId: context.userPaymentAuthorizationId,
        settlementId: context.settlementId!,
        amountMinorUnits: context.quote.userContributionMinorUnits,
        idempotencyKey: `user-cap:${input.idempotencyKey}`,
        now: input.now,
      });
      if (!userCapture.ok) {
        return userCapture;
      }
      userCaptureId = userCapture.value.captureReference ?? null;
    }

    const transitioned = await awaitTransition(this.store, context.transactionId, 'BOOKED', {
      providerBookingReference: booking.value.bookingId,
      providerPaymentCaptureId: providerCapture.value.captureReference,
      userPaymentCaptureId: userCaptureId,
      capturedAmountMinorUnits: context.quote.totalProviderAmountMinorUnits,
      idempotencyKeys: Object.freeze({ ...context.idempotencyKeys, book: input.idempotencyKey }),
      updatedAt: input.now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }

  async confirmFulfillment(input: {
    readonly transactionId: string;
    readonly quantityFulfilled: bigint;
    readonly kind: AccessFulfillmentEvidence['kind'];
    readonly providerReference?: string;
    readonly noShow?: boolean;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }

    const evidence: AccessFulfillmentEvidence = Object.freeze({
      evidenceId: `ful_${randomUUID()}`,
      transactionId: context.transactionId,
      providerId: context.providerId!,
      kind: input.noShow ? 'NO_SHOW' : input.kind,
      providerReference: input.providerReference ?? context.providerBookingReference,
      quantityFulfilled: input.quantityFulfilled,
      occurredAt: input.now,
      evidenceHash: `hash:${input.idempotencyKey}`,
      evidenceReference: accessEvidenceRefFor(`fulfillment:${input.idempotencyKey}`),
    });

    const policy = resolveFulfillmentPolicy(context.category);
    let nextStatus = 'FULFILLED' as const;
    if (input.noShow && policy.supportsNoShow) {
      nextStatus = 'FULFILLED';
    }

    if (
      policy.entitlementConsumptionPoint === 'AT_FULFILLMENT' ||
      policy.entitlementConsumptionPoint === 'AT_IRREVERSIBLE_ISSUANCE'
    ) {
      if (context.entitlementReservationId && !input.noShow) {
        await this.solvency.getEntitlementReservations().consume({
          entitlementReservationId: context.entitlementReservationId,
          evidenceReference: evidence.evidenceReference,
          idempotencyKey: `ent-consume:${input.idempotencyKey}`,
          now: input.now,
        });
      }
    }

    if (policy.fundingConsumptionPoint === 'AT_CAPTURE' && context.fundingReservationId && !input.noShow) {
      await this.solvency.consumeFunding({
        fundingReservationId: context.fundingReservationId,
        evidenceReference: evidence.evidenceReference,
        idempotencyKey: `fund-consume:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    const transitioned = await awaitTransition(this.store, context.transactionId, nextStatus, {
      fulfillmentEvidence: Object.freeze([...context.fulfillmentEvidence, evidence]),
      updatedAt: input.now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }

  async settle(input: {
    readonly transactionId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    if (context.status === 'SETTLED') {
      return { ok: true, value: context, idempotent: true };
    }
    const transitioned = await awaitTransition(this.store, context.transactionId, 'SETTLED', {
      updatedAt: input.now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }

  async cancel(input: {
    readonly transactionId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
    readonly providerNonRefundable?: boolean;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    if (context.status === 'CANCELLED') {
      return { ok: true, value: context, idempotent: true };
    }
    if (context.status === 'SETTLED' || context.status === 'REFUNDED' || context.status === 'PARTIALLY_REFUNDED') {
      return { ok: false, code: 'INVALID_STATE', message: 'cannot cancel settled transaction' };
    }

    if (context.providerBookingReference) {
      this.gateway.cancel({
        requestId: `cancel_${context.transactionId}`,
        providerId: context.providerIdCanonical!,
        bookingId: context.providerBookingReference,
        reason: 'user_cancelled',
        idempotencyKey: `cancel:${input.idempotencyKey}`,
      });
    }

    const restoration = resolveEntitlementRestorationPolicy(context.category).evaluate({
      originalUnitsConsumed: context.quote?.entitlementUnitsReserved ?? 0n,
      fulfillmentEvidence: context.fulfillmentEvidence,
      cancellationTiming: 'BEFORE_SERVICE',
      providerNonRefundable: input.providerNonRefundable ?? false,
      noShow: false,
    });

    if (restoration.restoreUnits > 0n && context.entitlementReservationId) {
      const entRes = this.solvency.getEntitlementReservations().getReservation(context.entitlementReservationId);
      if (entRes?.status === 'RESERVED') {
        await this.solvency.getEntitlementReservations().release({
          entitlementReservationId: context.entitlementReservationId,
          evidenceReference: accessEvidenceRefFor(`cancel-restore:${input.idempotencyKey}`),
          idempotencyKey: `cancel-restore:${input.idempotencyKey}`,
          now: input.now,
        });
      }
    } else if (!input.providerNonRefundable) {
      await compensateTransaction(context, {
        solvency: this.solvency,
        paymentRail: this.paymentRail,
        now: input.now,
        evidencePrefix: 'cancel',
      });
    }

    const transitioned = await awaitTransition(this.store, context.transactionId, 'CANCELLED', {
      updatedAt: input.now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }

  async refund(input: {
    readonly transactionId: string;
    readonly totalRefundMinorUnits: bigint;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
    readonly providerNonRefundable?: boolean;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context?.quote) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    const maxRefund = context.capturedAmountMinorUnits - context.refundedAmountMinorUnits;
    if (input.totalRefundMinorUnits > maxRefund) {
      return { ok: false, code: 'REFUND_EXCEEDS_CAPTURE', message: 'refund exceeds captured amount' };
    }

    const allocation = allocateRefund({
      totalRefundMinorUnits: input.totalRefundMinorUnits,
      originalAccessContribution: context.quote.accessPoolContributionMinorUnits,
      originalUserContribution: context.quote.userContributionMinorUnits,
      originalTokenContribution: context.quote.tokenConversionContributionMinorUnits,
      policyId: 'PROPORTIONAL_V1',
    });

    if (context.providerPaymentCaptureId && allocation.userRefundMinorUnits > 0n) {
      this.paymentRail.refund({
        captureId: context.providerPaymentCaptureId,
        amountMinorUnits: allocation.userRefundMinorUnits,
        idempotencyKey: `refund-user:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    const newRefunded = context.refundedAmountMinorUnits + input.totalRefundMinorUnits;
    const nextStatus =
      newRefunded >= context.capturedAmountMinorUnits ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const restoration = resolveEntitlementRestorationPolicy(context.category).evaluate({
      originalUnitsConsumed: context.quote.entitlementUnitsReserved,
      fulfillmentEvidence: context.fulfillmentEvidence,
      cancellationTiming: input.providerNonRefundable ? 'AFTER_SERVICE' : 'BEFORE_SERVICE',
      providerNonRefundable: input.providerNonRefundable ?? false,
      noShow: false,
    });
    void restoration;

    const transitioned = await awaitTransition(this.store, context.transactionId, nextStatus, {
      refundedAmountMinorUnits: newRefunded,
      updatedAt: input.now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }

  async reconcile(input: {
    readonly transactionId: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }

    if (this.simulationProvider && context.status === 'RECONCILIATION_REQUIRED') {
      const status = this.simulationProvider.getBookingStatus({
        reservationId: context.providerReservationReference ?? undefined,
        idempotencyKey: context.idempotencyKeys['book'] ?? undefined,
      });
      if (status.ok && status.value.state === 'CONFIRMED') {
        const transitioned = await awaitTransition(this.store, context.transactionId, 'BOOKED', {
          providerBookingReference: status.value.bookingId,
          updatedAt: input.now,
        });
        return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
      }
    }

    return { ok: true, value: context };
  }

  async requote(input: {
    readonly transactionId: string;
    readonly providerQuote: ProviderQuote;
    readonly taxesMinorUnits: bigint;
    readonly mandatoryFeesMinorUnits: bigint;
    readonly securityDepositMinorUnits: bigint;
    readonly entitlementClass: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(input.transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    if (context.quote && input.providerQuote.providerPriceMinorUnits > context.quote.totalProviderAmountMinorUnits) {
      const toRequote = await awaitTransition(this.store, context.transactionId, 'REQUOTE_REQUIRED', {
        updatedAt: input.now,
      });
      if (!toRequote.ok) {
        return toRequote;
      }
    }
    return await this.quote({
      transactionId: input.transactionId,
      providerId: context.providerIdCanonical!,
      providerProductId: input.providerQuote.catalogItemId,
      providerQuote: input.providerQuote,
      taxesMinorUnits: input.taxesMinorUnits,
      mandatoryFeesMinorUnits: input.mandatoryFeesMinorUnits,
      securityDepositMinorUnits: input.securityDepositMinorUnits,
      entitlementClass: input.entitlementClass,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
  }

  applyWebhook(event: AccessWebhookEvent): OrchestratorOutcome<AccessTransactionContext> {
    const context = this.store.get(event.transactionId!);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }

    if (event.kind === 'PAYMENT_CAPTURED' && context.status !== 'SETTLED') {
      return this.settle({
        transactionId: context.transactionId,
        idempotencyKey: event.idempotencyKey,
        now: event.occurredAt,
      });
    }
    if (event.kind === 'BOOKING_CONFIRMED' && context.status === 'BOOKING_PENDING') {
      return this.book({
        transactionId: context.transactionId,
        idempotencyKey: event.idempotencyKey,
        now: event.occurredAt,
      });
    }
    if (event.kind === 'PAYMENT_AUTHORIZED' && context.status === 'USER_PAYMENT_AUTHORIZED') {
      return { ok: true, value: context, idempotent: true };
    }
    return { ok: true, value: context };
  }

  getContext(transactionId: string): AccessTransactionContext | null {
    return this.store.get(transactionId);
  }

  private async transitionSimple(
    transactionId: string,
    status: AccessTransactionContext['status'],
    idempotencyKey: string,
    keyName: string,
    now: UtcInstant,
  ): Promise<OrchestratorOutcome<AccessTransactionContext>> {
    const context = this.store.get(transactionId);
    if (!context) {
      return { ok: false, code: 'NOT_FOUND', message: 'transaction not found' };
    }
    if (idempotencyKey in context.idempotencyKeys) {
      return { ok: true, value: context, idempotent: true };
    }
    const transitioned = await awaitTransition(this.store, transactionId, status, {
      idempotencyKeys: Object.freeze({ ...context.idempotencyKeys, [keyName]: idempotencyKey }),
      updatedAt: now,
    });
    return transitioned.ok ? { ok: true, value: transitioned.context } : transitioned;
  }
}

async function awaitSave(store: AccessTransactionStore, context: AccessTransactionContext): Promise<void> {
  await store.save(context);
}

async function awaitTransition(
  store: AccessTransactionStore,
  transactionId: string,
  status: AccessTransactionContext['status'],
  patch: Partial<AccessTransactionContext> & { readonly updatedAt: UtcInstant },
): Promise<
  | { readonly ok: true; readonly context: AccessTransactionContext }
  | { readonly ok: false; readonly code: string; readonly message: string }
> {
  const result = await store.transition(transactionId, status, patch);
  if (!result.ok) {
    return { ok: false, code: result.code, message: `transition failed: ${result.code}` };
  }
  return { ok: true, context: result.context };
}

export function createAccessTransactionOrchestrator(
  deps: AccessTransactionOrchestratorDeps,
): AccessTransactionOrchestrator {
  return new AccessTransactionOrchestrator(deps);
}
