/**
 * ACCESS Wave 3 — saga compensation helpers.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import type { AccessTransactionContext } from './types.ts';
import { AccessPaymentRail } from './payment-rail.ts';

export type CompensationResult = {
  readonly releasedEntitlement: boolean;
  readonly releasedFunding: boolean;
  readonly voidedUserPayment: boolean;
  readonly voidedProviderPayment: boolean;
  readonly cancelledProviderBooking: boolean;
  readonly evidenceReferences: readonly string[];
};

export async function compensateTransaction(
  context: AccessTransactionContext,
  deps: {
    readonly solvency: AccessSolvencyService;
    readonly paymentRail: AccessPaymentRail;
    readonly cancelProviderBooking?: (bookingId: string) => void;
    readonly now: UtcInstant;
    readonly evidencePrefix: string;
  },
): Promise<CompensationResult> {
  const evidence: string[] = [];
  let releasedEntitlement = false;
  let releasedFunding = false;
  let voidedUserPayment = false;
  let voidedProviderPayment = false;
  let cancelledProviderBooking = false;

  if (context.entitlementReservationId) {
    const result = await deps.solvency.getEntitlementReservations().release({
      entitlementReservationId: context.entitlementReservationId,
      evidenceReference: `${deps.evidencePrefix}:entitlement-release`,
      idempotencyKey: `release-ent:${context.transactionId}`,
      now: deps.now,
    });
    if (result) {
      releasedEntitlement = true;
      evidence.push(`${deps.evidencePrefix}:entitlement-release`);
    }
  }

  if (context.fundingReservationId) {
    const result = await deps.solvency.releaseFunding({
      fundingReservationId: context.fundingReservationId,
      evidenceReference: `${deps.evidencePrefix}:funding-release`,
      idempotencyKey: `release-fund:${context.transactionId}`,
      now: deps.now,
    });
    if (result) {
      releasedFunding = true;
      evidence.push(`${deps.evidencePrefix}:funding-release`);
    }
  }

  if (context.userPaymentAuthorizationId) {
    const auth = deps.paymentRail.getAuthorization(context.userPaymentAuthorizationId);
    if (auth && !auth.captured && !auth.voided) {
      const voided = deps.paymentRail.void({
        authorizationId: context.userPaymentAuthorizationId,
        idempotencyKey: `void-user:${context.transactionId}`,
        now: deps.now,
      });
      if (voided.ok) {
        voidedUserPayment = true;
        evidence.push(`${deps.evidencePrefix}:user-void`);
      }
    }
  }

  if (context.providerPaymentAuthorizationId) {
    const auth = deps.paymentRail.getAuthorization(context.providerPaymentAuthorizationId);
    if (auth && !auth.captured && !auth.voided) {
      const voided = deps.paymentRail.void({
        authorizationId: context.providerPaymentAuthorizationId,
        idempotencyKey: `void-provider:${context.transactionId}`,
        now: deps.now,
      });
      if (voided.ok) {
        voidedProviderPayment = true;
        evidence.push(`${deps.evidencePrefix}:provider-void`);
      }
    }
  }

  if (context.providerBookingReference && deps.cancelProviderBooking) {
    deps.cancelProviderBooking(context.providerBookingReference);
    cancelledProviderBooking = true;
    evidence.push(`${deps.evidencePrefix}:provider-cancel`);
  }

  return Object.freeze({
    releasedEntitlement,
    releasedFunding,
    voidedUserPayment,
    voidedProviderPayment,
    cancelledProviderBooking,
    evidenceReferences: Object.freeze(evidence),
  });
}
