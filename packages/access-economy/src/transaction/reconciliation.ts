// @ts-nocheck
/**
 * ACCESS Wave 3 — three-ledger reconciliation service.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { accessEvidenceRefFor } from '../domain/ids.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import type { ConfigurableSimulationProvider } from './simulation-provider.ts';
import type { AccessTransactionStore } from './store.ts';
import type { AccessReconciliationIssue, AccessTransactionContext } from './types.ts';
import type { AccessSettlementOrchestrator } from './settlement-orchestrator.ts';

export type ReconciliationOutcome = {
  readonly issues: readonly AccessReconciliationIssue[];
  readonly autoResolved: readonly string[];
  readonly escalated: readonly string[];
};

export class AccessReconciliationService {
  private readonly store: AccessTransactionStore;
  private readonly solvency: AccessSolvencyService;
  private readonly settlement: AccessSettlementOrchestrator;
  private readonly provider?: ConfigurableSimulationProvider;

  constructor(deps: {
    readonly store: AccessTransactionStore;
    readonly solvency: AccessSolvencyService;
    readonly settlement: AccessSettlementOrchestrator;
    readonly provider?: ConfigurableSimulationProvider;
  }) {
    this.store = deps.store;
    this.solvency = deps.solvency;
    this.settlement = deps.settlement;
    this.provider = deps.provider;
  }

  reconcileTransaction(transactionId: string, now: UtcInstant): ReconciliationOutcome {
    const context = this.store.get(transactionId);
    if (!context) {
      return Object.freeze({ issues: Object.freeze([]), autoResolved: Object.freeze([]), escalated: Object.freeze([]) });
    }
    const issues: AccessReconciliationIssue[] = [];
    const autoResolved: string[] = [];
    const escalated: string[] = [];

    const settlement = context.settlementId
      ? this.settlement.getSettlement(context.settlementId)
      : null;

    const booked = context.providerBookingReference !== null;
    const captured =
      settlement?.status === 'CAPTURED' ||
      context.capturedAmountMinorUnits > 0n ||
      context.providerPaymentCaptureId !== null;

    if (booked && !captured) {
      issues.push(this.issue('BOOKING_WITHOUT_PAYMENT', 'HIGH', context, 'payment captured', 'booking without capture', now));
    }
    if (captured && !booked) {
      issues.push(this.issue('PAYMENT_WITHOUT_BOOKING', 'CRITICAL', context, 'provider booking', 'capture without booking', now));
    }

    if (context.entitlementReservationId) {
      const entRes = this.solvency.getEntitlementReservations().getReservation(context.entitlementReservationId);
      if (entRes?.status === 'CONSUMED' && context.status === 'CANCELLED') {
        issues.push(this.issue('ENTITLEMENT_MISMATCH', 'HIGH', context, 'entitlement released', 'entitlement consumed but cancelled', now));
      }
    }

    if (context.fundingReservationId) {
      const fundRes = this.solvency.getFundingReservations().getReservation(context.fundingReservationId);
      if (fundRes?.status === 'CONSUMED' && context.status === 'CANCELLED') {
        issues.push(
          this.issue('FUNDING_MISMATCH', 'HIGH', context, 'funding released', 'funding consumed but cancelled', now),
        );
      }
      if (fundRes?.status === 'RESERVED' && context.status === 'SETTLED') {
        const poolBalance = this.solvency.getFundingPoolBalance(
          context.fundingPoolId!,
          context.quote?.currency ?? 'USD',
          now,
        );
        if (poolBalance.capturedSettlement < (context.quote?.accessPoolContributionMinorUnits ?? 0n)) {
          issues.push(
            this.issue('FUNDING_MISMATCH', 'MEDIUM', context, 'funding captured', 'settled without funding capture', now),
          );
        }
      }
    }

    if (context.refundedAmountMinorUnits > context.capturedAmountMinorUnits) {
      issues.push(
        this.issue('REFUND_MISMATCH', 'CRITICAL', context, 'refund <= capture', 'refund exceeds capture', now),
      );
    }

    if (context.providerBookingReference) {
      const dupBookings = [...this.store.listAll()].filter(
        (row) =>
          row.transactionId !== context.transactionId &&
          row.providerBookingReference === context.providerBookingReference,
      );
      if (dupBookings.length > 0) {
        issues.push(
          this.issue('DUPLICATE_BOOKING', 'CRITICAL', context, 'unique booking', 'duplicate provider booking id', now),
        );
      }
    }

    if (settlement?.status === 'CAPTURED' && context.capturedAmountMinorUnits === 0n) {
      issues.push(this.issue('DUPLICATE_PAYMENT', 'HIGH', context, 'single capture', 'capture without amount', now));
    }

    if (context.status === 'BOOKED' && !booked && context.providerReservationReference) {
      issues.push(
        this.issue('STALE_BOOKING_STATE', 'MEDIUM', context, 'confirmed booking', 'stale booking state', now),
      );
    }

    if (context.status === 'RECONCILIATION_REQUIRED' && this.provider && context.providerReservationReference) {
      const status = this.provider.getBookingStatus({
        reservationId: context.providerReservationReference,
        idempotencyKey: context.idempotencyKeys['book'] ?? undefined,
      });
      if (status.ok && status.value.state === 'CONFIRMED') {
        autoResolved.push(transactionId);
      } else if (!status.ok) {
        issues.push(this.issue('UNKNOWN_PROVIDER_STATE', 'MEDIUM', context, 'known booking', status.message, now));
        escalated.push(transactionId);
      }
    }

    if (issues.some((row) => row.severity === 'CRITICAL' || row.severity === 'HIGH')) {
      if (!escalated.includes(transactionId)) {
        escalated.push(transactionId);
      }
    }

    return Object.freeze({
      issues: Object.freeze(issues),
      autoResolved: Object.freeze(autoResolved),
      escalated: Object.freeze(escalated),
    });
  }

  detectStaleReservations(now: UtcInstant): readonly string[] {
    const expired = this.solvency.expireFundingReservations(now);
    return Object.freeze(expired.map((row) => row.accessTransactionId));
  }

  private issue(
    type: AccessReconciliationIssue['type'],
    severity: AccessReconciliationIssue['severity'],
    context: AccessTransactionContext,
    expected: string,
    actual: string,
    now: UtcInstant,
  ): AccessReconciliationIssue {
    return Object.freeze({
      issueId: `ari_${randomUUID()}`,
      type,
      severity,
      transactionId: context.transactionId,
      providerId: context.providerId,
      detectedAt: now,
      expectedState: expected,
      actualState: actual,
      resolutionStatus: 'OPEN',
      evidenceReference: accessEvidenceRefFor(`reconcile:${context.transactionId}:${type}`),
    });
  }
}
