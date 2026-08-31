/**
 * Access Wave 4 transaction orchestrator — product lifecycle coordinator.
 */

import { randomUUID } from 'node:crypto';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AccessActor } from '../access.ts';
import type { HumanAccessEconomyStore } from '../store.ts';
import { ACCESS_CATEGORY_LABELS, type AccessCategory } from '../taxonomy.ts';
import type { AccessEntitlement, AccessFailure, AccessQuote, AccessReservation } from '../types.ts';
import { buildActivityItem } from './activity.ts';
import type { AccessActivityItem } from './activity.ts';
import {
  allocationAvailableEvent,
  bookingConfirmedEvent,
  bookingProcessingEvent,
  createAccessProductEvent,
  paymentActionRequiredEvent,
  quoteExpiringEvent,
  refundProcessedEvent,
} from './events.ts';
import type { AccessProductEvent } from './events.ts';
import { detectExpiringEntitlements, expirationEventsFromNotices } from './expiration.ts';
import { AccessFunnelTracker } from './funnel.ts';
import { AccessNotificationService } from './notifications.ts';
import { buildAccessReceipt, buildAccessRefundReceipt, formatMoneyLabel } from './receipts.ts';
import type { AccessReceipt, AccessRefundReceipt } from './receipts.ts';
import {
  projectAccessHistory,
  projectAccessHomeSummary,
  projectAccessLanding,
  projectCheckout,
  projectSupportContext,
  projectUpcomingAccess,
} from './projections.ts';
import { AccessReconciliationService } from './reconciliation.ts';
import {
  AccessTransactionStateMachine,
  newStateTransitionId,
  type AccessPriceChangeView,
  type AccessProductTransaction,
  type AccessQuoteExpiredView,
} from './transactions.ts';
import { listAccessActionCenterCards, toExternalEvent } from './action-center.ts';
import type { AccessActionCenterExternalEvent } from './action-center.ts';
import { filterActivityItems } from './activity.ts';
import type { AccessHistoryFilter } from './taxonomy.ts';
import type { AccessCapabilityView } from '../projections.ts';

const NOW_DEFAULT = '2026-08-23T12:00:00.000Z';

function newTransactionId(): string {
  return `acc_txn_${randomUUID()}`;
}

function newReceiptId(): string {
  return `acc_rcp_${randomUUID()}`;
}

function newEventId(): string {
  return `acc_evt_${randomUUID()}`;
}

function unitLabelFor(category: AccessCategory): string {
  switch (category) {
    case 'MOBILITY':
      return 'Mobility Day';
    case 'STAY_HOUSING':
      return 'Night';
    case 'EXPERIENCES':
      return 'Experience Credit';
    case 'COMPUTE_AI':
      return 'Hour';
    default:
      return 'unit';
  }
}

export class AccessTransactionOrchestrator {
  readonly store: HumanAccessEconomyStore;
  private readonly stateMachine = new AccessTransactionStateMachine();
  private readonly reconciliation = new AccessReconciliationService();
  readonly notifications = new AccessNotificationService();
  readonly funnel = new AccessFunnelTracker();
  private readonly now: () => string;

  constructor(store: HumanAccessEconomyStore, now: () => string = () => NOW_DEFAULT) {
    this.store = store;
    this.now = now;
  }

  homeSummary(capability: AccessCapabilityView, customerId: string) {
    return projectAccessHomeSummary({
      capability,
      entitlements: capability.enabled ? this.store.listEntitlements(customerId) : [],
    });
  }

  landing(capability: AccessCapabilityView, customerId: string) {
    return projectAccessLanding({
      capability,
      entitlements: capability.enabled ? this.store.listEntitlements(customerId) : [],
      recommendations: capability.enabled ? this.store.listRecommendations() : [],
    });
  }

  history(
    customerId: string,
    filter: AccessHistoryFilter = 'ALL',
    category?: AccessCategory,
    fromDate?: string,
    toDate?: string,
  ) {
    const items = filterActivityItems(this.store.listProductActivities(customerId), filter, category, fromDate, toDate);
    return projectAccessHistory(items, filter);
  }

  upcoming(customerId: string) {
    return Object.freeze({
      schema: 'sunrey.consumer.access.upcoming.v1',
      productionReady: false as const,
      productionActive: false as const,
      liveConnectivityEnabled: false as const,
      items: projectUpcomingAccess({
        transactions: this.store.listTransactions(customerId),
        reservations: this.store.listReservations(customerId),
      }),
    });
  }

  getTransaction(actor: AccessActor, transactionId: string): Result<AccessProductTransaction, AccessFailure> {
    const txn = this.store.transactions.get(transactionId);
    if (!txn || txn.userId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access transaction not found' });
    }
    return ok(txn);
  }

  getCheckout(actor: AccessActor, transactionId: string): Result<ReturnType<typeof projectCheckout>, AccessFailure> {
    const txn = this.getTransaction(actor, transactionId);
    if (!txn.ok) {
      return txn;
    }
    return ok(projectCheckout(txn.value));
  }

  getReceipt(actor: AccessActor, receiptId: string): Result<AccessReceipt, AccessFailure> {
    const receipt = this.store.receipts.get(receiptId);
    if (!receipt || receipt.userId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access receipt not found' });
    }
    return ok(receipt);
  }

  listReceipts(actor: AccessActor): readonly AccessReceipt[] {
    return [...this.store.receipts.values()].filter((row) => row.userId === actor.customerId);
  }

  getRefundReceipt(actor: AccessActor, refundReceiptId: string): Result<AccessRefundReceipt, AccessFailure> {
    const receipt = this.store.refundReceipts.get(refundReceiptId);
    if (!receipt || receipt.userId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'access refund receipt not found' });
    }
    return ok(receipt);
  }

  getSupportContext(actor: AccessActor, transactionId: string) {
    const txn = this.getTransaction(actor, transactionId);
    if (!txn.ok) {
      return txn;
    }
    const lastEvent = this.store.listProductEvents(actor.customerId)[0]?.type ?? null;
    return ok(projectSupportContext(txn.value, lastEvent));
  }

  actionCenterEvents(customerId: string): readonly AccessActionCenterExternalEvent[] {
    const cards = listAccessActionCenterCards(this.store.listProductEvents(customerId));
    return cards.map(toExternalEvent);
  }

  createFromQuote(
    actor: AccessActor,
    quote: AccessQuote,
    input: {
      readonly providerDisplayName: string;
      readonly providerTotalMinorUnits: string;
      readonly accessCoverageMinorUnits: string;
      readonly userContributionMinorUnits: string;
      readonly depositMinorUnits?: string | null;
      readonly unitsUsed?: string;
      readonly entitlementBefore?: string | null;
      readonly providerId?: string | null;
      readonly location?: string | null;
      readonly fundingAvailable?: boolean;
    },
  ): AccessProductTransaction {
    const at = this.now();
    const transactionId = newTransactionId();
    const txn: AccessProductTransaction = Object.freeze({
      transactionId,
      userId: actor.customerId,
      category: quote.category,
      status: 'QUOTED',
      productStatusLabel: 'Quoted',
      quoteId: quote.quoteId,
      reservationId: null,
      redemptionId: null,
      providerId: input.providerId ?? null,
      providerDisplayName: input.providerDisplayName,
      serviceName: quote.summary,
      location: input.location ?? null,
      currency: quote.pricing?.currency ?? 'USD',
      providerTotalMinorUnits: input.providerTotalMinorUnits,
      accessCoverageMinorUnits: input.accessCoverageMinorUnits,
      userContributionMinorUnits: input.userContributionMinorUnits,
      depositMinorUnits: input.depositMinorUnits ?? null,
      unitsUsed: input.unitsUsed ?? '1',
      unitLabel: unitLabelFor(quote.category),
      entitlementBefore: input.entitlementBefore ?? null,
      entitlementAfter: null,
      confirmationReference: null,
      quoteExpiresAt: quote.expiresAt,
      serviceDate: null,
      cancellationDeadline: null,
      requiredActions: Object.freeze([]),
      dataState: 'SIMULATED',
      fundingAvailable: input.fundingAvailable ?? true,
      purchaseBlocked: false,
      createdAt: at,
      updatedAt: at,
      stateTransitionId: newStateTransitionId(transactionId, 'QUOTED', at),
    });
    this.store.transactions.set(transactionId, txn);
    this.recordActivity(txn, 'RESERVATION', 'Quote created');
    this.funnel.record({
      eventType: 'ACCESS_QUOTED',
      occurredAt: at,
      customerId: actor.customerId,
      category: quote.category,
      transactionId,
    });
    return txn;
  }

  startCheckout(actor: AccessActor, transactionId: string): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    if (!txnResult.value.fundingAvailable) {
      return err({
        code: 'REDEMPTION_BLOCKED',
        message: 'funded redemption temporarily unavailable; entitlement unchanged',
      });
    }
    if (txnResult.value.purchaseBlocked) {
      return err({ code: 'INVALID_TRANSITION', message: 'purchase blocked while confirming booking' });
    }
    const at = this.now();
    if (txnResult.value.quoteExpiresAt && txnResult.value.quoteExpiresAt < at) {
      const expired = this.stateMachine.transition(txnResult.value, 'QUOTE_EXPIRED', at);
      if (expired) {
        this.store.transactions.set(transactionId, expired);
      }
      return err({ code: 'QUOTE_EXPIRED', message: 'access quote has expired' });
    }
    const next = this.stateMachine.transition(txnResult.value, 'CHECKOUT_STARTED', at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot start checkout from current status' });
    }
    this.store.transactions.set(transactionId, next);
    this.funnel.record({
      eventType: 'ACCESS_CHECKOUT_STARTED',
      occurredAt: at,
      customerId: actor.customerId,
      category: next.category,
      transactionId,
    });
    if (BigInt(next.userContributionMinorUnits) > 0n) {
      this.emitEvent(
        paymentActionRequiredEvent({
          eventId: newEventId(),
          occurredAt: at,
          customerId: actor.customerId,
          transactionId,
          stateTransitionId: next.stateTransitionId,
          amountLabel: formatMoneyLabel(next.userContributionMinorUnits, next.currency),
        }),
      );
    }
    return ok(next);
  }

  confirmBooking(
    actor: AccessActor,
    transactionId: string,
    input: {
      readonly reservationId?: string;
      readonly redemptionId?: string;
      readonly confirmationReference?: string;
      readonly processing?: boolean;
      readonly serviceDate?: string | null;
      readonly entitlementAfter?: string | null;
    } = {},
  ): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    let txn = txnResult.value;
    if (['QUOTED', 'PRICE_CHANGED'].includes(txn.status)) {
      const checkout = this.stateMachine.transition(txn, 'CHECKOUT_STARTED', at);
      if (!checkout) {
        return err({ code: 'INVALID_TRANSITION', message: 'cannot start checkout before confirming' });
      }
      txn = checkout;
      this.store.transactions.set(transactionId, txn);
    }
    if (input.processing) {
      this.reconciliation.markPending(transactionId, at);
      const processing = this.stateMachine.transition(txn, 'PROCESSING_CONFIRMATION', at);
      if (!processing) {
        return err({ code: 'INVALID_TRANSITION', message: 'cannot enter processing state' });
      }
      txn = Object.freeze({ ...processing, purchaseBlocked: true });
      this.store.transactions.set(transactionId, txn);
      this.emitEvent(
        bookingProcessingEvent({
          eventId: newEventId(),
          occurredAt: at,
          customerId: actor.customerId,
          transactionId,
          stateTransitionId: txn.stateTransitionId,
          serviceName: txn.serviceName,
        }),
      );
      return ok(txn);
    }
    const next = this.stateMachine.transition(txn, 'BOOKING_CONFIRMED', at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot confirm booking from current status' });
    }
    txn = Object.freeze({
      ...next,
      reservationId: input.reservationId ?? next.reservationId,
      redemptionId: input.redemptionId ?? next.redemptionId,
      confirmationReference: input.confirmationReference ?? next.confirmationReference,
      serviceDate: input.serviceDate ?? next.serviceDate,
      entitlementAfter: input.entitlementAfter ?? next.entitlementAfter,
      purchaseBlocked: false,
    });
    this.store.transactions.set(transactionId, txn);
    this.emitEvent(
      bookingConfirmedEvent({
        eventId: newEventId(),
        occurredAt: at,
        customerId: actor.customerId,
        transactionId,
        stateTransitionId: txn.stateTransitionId,
        serviceName: txn.serviceName,
        providerDisplayName: txn.providerDisplayName ?? 'Provider',
      }),
    );
    this.generateBookingReceipt(txn);
    this.recordActivity(txn, 'BOOKING', 'Booking confirmed');
    this.funnel.record({
      eventType: 'ACCESS_BOOKED',
      occurredAt: at,
      customerId: actor.customerId,
      category: txn.category,
      transactionId,
    });
    return ok(txn);
  }

  reconcileBooking(
    actor: AccessActor,
    transactionId: string,
    outcome: import('./reconciliation.ts').ReconciliationOutcome,
  ): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const reconciled = this.reconciliation.reconcile(txnResult.value, outcome, at);
    if (!reconciled) {
      return err({ code: 'INVALID_TRANSITION', message: 'reconciliation not applicable' });
    }
    this.store.transactions.set(transactionId, reconciled);
    if (reconciled.status === 'BOOKING_CONFIRMED') {
      this.emitEvent(
        bookingConfirmedEvent({
          eventId: newEventId(),
          occurredAt: at,
          customerId: actor.customerId,
          transactionId,
          stateTransitionId: reconciled.stateTransitionId,
          serviceName: reconciled.serviceName,
          providerDisplayName: reconciled.providerDisplayName ?? 'Provider',
        }),
      );
      this.generateBookingReceipt(reconciled);
    }
    return ok(reconciled);
  }

  fulfill(actor: AccessActor, transactionId: string): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const next = this.stateMachine.transition(txnResult.value, 'FULFILLED', at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot fulfill from current status' });
    }
    this.store.transactions.set(transactionId, next);
    this.generateSettlementReceipt(next);
    this.recordActivity(next, 'FULFILLMENT', 'Access transaction completed');
    return ok(next);
  }

  cancel(
    actor: AccessActor,
    transactionId: string,
    input: { readonly penaltyMinorUnits?: string; readonly providerRefundMinorUnits?: string } = {},
  ): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const next = this.stateMachine.transition(txnResult.value, 'CANCELLED', at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot cancel from current status' });
    }
    this.store.transactions.set(transactionId, next);
    this.emitEvent(
      createAccessProductEvent({
        eventId: newEventId(),
        type: 'ACCESS_BOOKING_CANCELLED',
        occurredAt: at,
        customerId: actor.customerId,
        transactionId,
        stateTransitionId: next.stateTransitionId,
        resourceId: transactionId,
        summary: `Booking cancelled: ${next.serviceName}`,
        userTitle: 'Booking cancelled',
        userBody: `Your ${next.serviceName} booking has been cancelled.`,
      }),
    );
    this.recordActivity(next, 'CANCELLATION', 'Booking cancelled');
    this.funnel.record({
      eventType: 'ACCESS_CANCELLED',
      occurredAt: at,
      customerId: actor.customerId,
      category: next.category,
      transactionId,
    });
    if (input.providerRefundMinorUnits) {
      return this.processRefund(actor, transactionId, {
        providerRefundMinorUnits: input.providerRefundMinorUnits,
        penaltyMinorUnits: input.penaltyMinorUnits ?? '0',
        partial: false,
        entitlementRestored: next.unitsUsed,
      });
    }
    return ok(next);
  }

  processRefund(
    actor: AccessActor,
    transactionId: string,
    input: {
      readonly providerRefundMinorUnits: string;
      readonly penaltyMinorUnits: string;
      readonly returnedToUserMinorUnits?: string;
      readonly returnedToPoolMinorUnits?: string;
      readonly partial: boolean;
      readonly entitlementRestored?: string | null;
    },
  ): Result<AccessProductTransaction, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const status = input.partial ? 'PARTIAL_REFUND' : 'REFUNDED';
    const pending = this.stateMachine.transition(txnResult.value, 'REFUND_PENDING', at);
    if (!pending) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot refund from current status' });
    }
    const next = this.stateMachine.transition(pending, status, at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'refund transition failed' });
    }
    this.store.transactions.set(transactionId, next);
    const returnedToUser = input.returnedToUserMinorUnits ?? input.providerRefundMinorUnits;
    const returnedToPool =
      input.returnedToPoolMinorUnits ??
      String(BigInt(input.providerRefundMinorUnits) - BigInt(returnedToUser) - BigInt(input.penaltyMinorUnits));
    const originalReceipt = [...this.store.receipts.values()].find(
      (row) => row.accessTransactionId === transactionId,
    );
    const refundReceipt = buildAccessRefundReceipt({
      refundReceiptId: `acc_rrc_${randomUUID()}`,
      originalReceiptId: originalReceipt?.receiptId ?? 'unknown',
      accessTransactionId: transactionId,
      userId: actor.customerId,
      providerDisplayName: next.providerDisplayName ?? 'Provider',
      serviceName: next.serviceName,
      currency: next.currency,
      providerRefund: input.providerRefundMinorUnits,
      returnedToUser,
      returnedToAccessPool: returnedToPool,
      penaltyAmount: input.penaltyMinorUnits,
      entitlementRestored: input.entitlementRestored ?? null,
      entitlementNotRestored: input.entitlementRestored ? null : next.unitsUsed,
      status,
      processedAt: at,
    });
    this.store.refundReceipts.set(refundReceipt.refundReceiptId, refundReceipt);
    this.emitEvent(
      refundProcessedEvent({
        eventId: newEventId(),
        occurredAt: at,
        customerId: actor.customerId,
        transactionId,
        stateTransitionId: next.stateTransitionId,
        amountLabel: formatMoneyLabel(returnedToUser, next.currency),
        partial: input.partial,
      }),
    );
    this.recordActivity(next, 'REFUND', input.partial ? 'Partial refund processed' : 'Refund processed');
    return ok(next);
  }

  applyPriceChange(
    actor: AccessActor,
    transactionId: string,
    input: {
      readonly newProviderTotal: string;
      readonly newAccessCoverage: string;
      readonly newUserContribution: string;
    },
  ): Result<AccessPriceChangeView, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const next = this.stateMachine.transition(txnResult.value, 'PRICE_CHANGED', at);
    if (!next) {
      return err({ code: 'INVALID_TRANSITION', message: 'cannot apply price change' });
    }
    const updated = Object.freeze({
      ...next,
      providerTotalMinorUnits: input.newProviderTotal,
      accessCoverageMinorUnits: input.newAccessCoverage,
      userContributionMinorUnits: input.newUserContribution,
      requiredActions: Object.freeze(['CONFIRM_PRICE_CHANGE'] as const),
    });
    this.store.transactions.set(transactionId, updated);
    const requiresConfirmation = BigInt(input.newUserContribution) > BigInt(txnResult.value.userContributionMinorUnits);
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.price-changed.v1',
        transactionId,
        previousProviderTotal: txnResult.value.providerTotalMinorUnits,
        newProviderTotal: input.newProviderTotal,
        previousAccessCoverage: txnResult.value.accessCoverageMinorUnits,
        newAccessCoverage: input.newAccessCoverage,
        previousUserContribution: txnResult.value.userContributionMinorUnits,
        newUserContribution: input.newUserContribution,
        currency: txnResult.value.currency,
        requiresConfirmation,
        requiredAction: 'CONFIRM_PRICE_CHANGE',
      }),
    );
  }

  quoteExpiredView(actor: AccessActor, transactionId: string): Result<AccessQuoteExpiredView, AccessFailure> {
    const txnResult = this.getTransaction(actor, transactionId);
    if (!txnResult.ok) {
      return txnResult;
    }
    const at = this.now();
    const next = this.stateMachine.transition(txnResult.value, 'QUOTE_EXPIRED', at);
    if (next) {
      this.store.transactions.set(transactionId, next);
    }
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.quote-expired.v1',
        transactionId,
        quoteId: txnResult.value.quoteId ?? '',
        expiredAt: at,
        requiredAction: 'REQUOTE',
      }),
    );
  }

  runExpirationScan(customerId: string): readonly AccessProductEvent[] {
    const at = this.now();
    const notices = detectExpiringEntitlements(
      this.store.listEntitlements(customerId),
      at,
      this.store.expirationNotified,
    );
    for (const notice of notices) {
      this.store.expirationNotified.add(`${notice.entitlementId}:${notice.noticeDay}`);
    }
    const events = expirationEventsFromNotices(notices, at, newEventId);
    for (const event of events) {
      this.emitEvent(event);
    }
    return events;
  }

  seedAllocationEvents(customerId: string): void {
    const at = this.now();
    for (const ent of this.store.listEntitlements(customerId)) {
      if (ent.status !== 'ACTIVE' || (ent.remainingUses ?? 0) <= 0) {
        continue;
      }
      this.emitEvent(
        allocationAvailableEvent({
          eventId: newEventId(),
          occurredAt: at,
          customerId,
          entitlementId: ent.entitlementId,
          categoryLabel: ACCESS_CATEGORY_LABELS[ent.category],
          units: ent.remainingUses ?? 0,
          unitLabel: unitLabelFor(ent.category),
        }),
      );
    }
  }

  linkReservation(transactionId: string, reservation: AccessReservation): void {
    const txn = this.store.transactions.get(transactionId);
    if (!txn) {
      return;
    }
    this.store.transactions.set(
      transactionId,
      Object.freeze({
        ...txn,
        reservationId: reservation.reservationId,
        serviceDate: reservation.startsAt,
        location: reservation.location,
        updatedAt: this.now(),
      }),
    );
  }

  private generateBookingReceipt(txn: AccessProductTransaction): AccessReceipt {
    const receipt = buildAccessReceipt({
      receiptId: newReceiptId(),
      receiptType: 'BOOKING_CONFIRMATION',
      accessTransactionId: txn.transactionId,
      userId: txn.userId,
      providerDisplayName: txn.providerDisplayName ?? 'Provider',
      serviceName: txn.serviceName,
      category: txn.category,
      serviceDate: txn.serviceDate,
      location: txn.location,
      financial: Object.freeze({
        providerTotal: txn.providerTotalMinorUnits,
        accessCoverage: txn.accessCoverageMinorUnits,
        userContribution: txn.userContributionMinorUnits,
        taxes: '0',
        mandatoryFees: '0',
        optionalFees: '0',
        depositAmount: txn.depositMinorUnits,
        refundAmount: null,
        currency: txn.currency,
      }),
      access: Object.freeze({
        unit: txn.unitLabel,
        unitsUsed: txn.unitsUsed,
        entitlementBefore: txn.entitlementBefore,
        entitlementAfter: txn.entitlementAfter,
      }),
      booking: Object.freeze({
        confirmationReference: txn.confirmationReference,
        bookingStatus: txn.status,
      }),
      settlementStatus: 'PENDING',
      generatedAt: this.now(),
      evidenceReference: `access:receipt:${txn.transactionId}:booking`,
    });
    this.store.receipts.set(receipt.receiptId, receipt);
    return receipt;
  }

  private generateSettlementReceipt(txn: AccessProductTransaction): AccessReceipt {
    const receipt = buildAccessReceipt({
      receiptId: newReceiptId(),
      receiptType: 'SETTLEMENT',
      accessTransactionId: txn.transactionId,
      userId: txn.userId,
      providerDisplayName: txn.providerDisplayName ?? 'Provider',
      serviceName: txn.serviceName,
      category: txn.category,
      serviceDate: txn.serviceDate,
      location: txn.location,
      financial: Object.freeze({
        providerTotal: txn.providerTotalMinorUnits,
        accessCoverage: txn.accessCoverageMinorUnits,
        userContribution: txn.userContributionMinorUnits,
        taxes: '0',
        mandatoryFees: '0',
        optionalFees: '0',
        depositAmount: txn.depositMinorUnits,
        refundAmount: null,
        currency: txn.currency,
      }),
      access: Object.freeze({
        unit: txn.unitLabel,
        unitsUsed: txn.unitsUsed,
        entitlementBefore: txn.entitlementBefore,
        entitlementAfter: txn.entitlementAfter,
      }),
      booking: Object.freeze({
        confirmationReference: txn.confirmationReference,
        bookingStatus: 'FULFILLED',
      }),
      settlementStatus: 'SETTLED',
      generatedAt: this.now(),
      evidenceReference: `access:receipt:${txn.transactionId}:settlement`,
    });
    this.store.receipts.set(receipt.receiptId, receipt);
    return receipt;
  }

  private emitEvent(event: AccessProductEvent): void {
    if (this.notifications.isDuplicate(event.deduplicationKey)) {
      return;
    }
    this.store.productEvents.set(event.eventId, event);
    this.notifications.deliver(event, Date.parse(event.occurredAt), event.occurredAt);
  }

  private recordActivity(txn: AccessProductTransaction, type: import('./activity.ts').AccessActivityItem['type'], summary: string): void {
    const item = buildActivityItem({
      activityId: `acc_pact_${randomUUID()}`,
      customerId: txn.userId,
      type,
      title: txn.serviceName,
      summary,
      category: txn.category,
      transactionId: txn.transactionId,
      status: txn.status,
      occurredAt: this.now(),
      providerDisplayName: txn.providerDisplayName,
      serviceName: txn.serviceName,
      location: txn.location,
      financialSummary: `${txn.currency} ${txn.userContributionMinorUnits} you pay`,
    });
    this.store.productActivities.set(item.activityId, item);
  }
}

export { AccessTransactionStateMachine };
