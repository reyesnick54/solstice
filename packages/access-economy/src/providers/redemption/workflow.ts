/**
 * ACCESS-14 — Redemption execution workflow / saga orchestrator.
 */

import type { AccessProviderGateway } from '../gateway.ts';
import { RedemptionFundingRouter, type FundingIntentPort } from '../funding-router.ts';
import type { ProviderQuote } from '../types.ts';
import { EntitlementHoldStore } from './entitlement-store.ts';
import { evaluateRedemption } from './engine.ts';
import type {
  BundleFailurePolicy,
  ExperienceBundleComponent,
  ExperienceBundleRedemption,
  RedemptionRecord,
  RedemptionRequest,
  RedemptionStatus,
} from './types.ts';

const SIMULATION_NOW = '2026-08-23T12:00:00.000Z';

export type RedemptionWorkflowPorts = {
  readonly funding: FundingIntentPort;
};

export class RedemptionWorkflow {
  private readonly records = new Map<string, RedemptionRecord>();
  private readonly idempotency = new Map<string, string>();
  readonly entitlements: EntitlementHoldStore;
  private readonly fundingRouter: RedemptionFundingRouter;
  private readonly gateway: AccessProviderGateway;

  constructor(gateway: AccessProviderGateway, ports: RedemptionWorkflowPorts) {
    this.gateway = gateway;
    this.entitlements = new EntitlementHoldStore();
    this.fundingRouter = new RedemptionFundingRouter(ports.funding);
  }

  preview(request: RedemptionRequest): RedemptionDecisionView {
    return Object.freeze({ decision: evaluateRedemption(request) });
  }

  start(request: RedemptionRequest, idempotencyKey: string): WorkflowOutcome<RedemptionRecord> {
    const prior = this.idempotency.get(idempotencyKey);
    if (prior) {
      const record = this.records.get(prior);
      if (record) {
        return ok(record);
      }
    }
    const decision = evaluateRedemption(request);
    if (!['READY_FOR_APPROVAL', 'USER_CONTRIBUTION_REQUIRED', 'FULLY_COVERED', 'PARTIALLY_COVERED'].includes(decision.status)) {
      return fail(decision.status, decision.explanation.join('; '));
    }
    const hold = this.entitlements.hold({
      entitlementId: request.entitlement.entitlementId,
      redemptionId: request.redemptionId,
      units: decision.entitlementUnitsHeld,
      idempotencyKey,
    });
    if ('code' in hold) {
      if (hold.code === 'IDEMPOTENT') {
        const record = this.records.get(request.redemptionId);
        if (record) {
          return ok(record);
        }
      }
      return fail('ENTITLEMENT_INSUFFICIENT', 'unable to hold entitlement units');
    }
    const record: RedemptionRecord = Object.freeze({
      redemptionId: request.redemptionId,
      subjectRef: request.subjectRef,
      status: decision.status,
      providerId: request.providerId,
      providerQuoteId: request.providerQuote.quoteId,
      providerBookingId: null,
      accessRightRef: null,
      rightKind: null,
      decision,
      funding: null,
      entitlementHoldState: 'HELD',
      createdAt: SIMULATION_NOW,
      updatedAt: SIMULATION_NOW,
    });
    this.records.set(request.redemptionId, record);
    this.idempotency.set(idempotencyKey, request.redemptionId);
    return ok(record);
  }

  confirm(redemptionId: string, input?: { readonly userApproved?: boolean; readonly userFiatMinorUnits?: bigint }): WorkflowOutcome<RedemptionRecord> {
    const record = this.records.get(redemptionId);
    if (!record) {
      return fail('NOT_FOUND', 'redemption not found');
    }
    if (record.status === 'REDEEMED') {
      return ok(record);
    }
    if (record.status === 'USER_CONTRIBUTION_REQUIRED' && input?.userApproved !== true) {
      return fail('AUTHORIZATION_REQUIRED', 'user approval required for partial coverage');
    }
    const userFiat = input?.userFiatMinorUnits ?? record.decision.userContributionMinorUnits;
    const funding = this.fundingRouter.route({
      redemptionId,
      currency: 'USD',
      providerSettlementMinorUnits: record.decision.providerPriceMinorUnits,
      entitlementCoverageMinorUnits: record.decision.coverage?.appliedCoverageMinorUnits ?? 0n,
      userFiatMinorUnits: userFiat,
      createdAt: SIMULATION_NOW,
    });
    const reserve = this.gateway.reserve({
      requestId: `rsv_${redemptionId}`,
      providerId: record.providerId,
      quoteId: record.providerQuoteId,
      subjectRef: record.subjectRef,
      idempotencyKey: `reserve_${redemptionId}`,
    });
    if (!reserve.ok) {
      const held = this.entitlements.findByRedemptionId(redemptionId);
      if (held) {
        this.entitlements.release(held.entitlementId, record.decision.entitlementUnitsHeld);
      }
      this.compensate(record, 'provider reservation failed');
      return fail('PROVIDER_UNAVAILABLE', reserve.message);
    }
    const booking = this.gateway.book({
      requestId: `book_${redemptionId}`,
      providerId: record.providerId,
      reservationId: reserve.value.reservationId,
      subjectRef: record.subjectRef,
      idempotencyKey: `book_${redemptionId}`,
    });
    if (!booking.ok) {
      this.gateway.cancel({
        requestId: `cancel_${redemptionId}`,
        providerId: record.providerId,
        bookingId: reserve.value.reservationId,
        reason: 'booking_failed',
        idempotencyKey: `cancel_${redemptionId}`,
      });
      const held = this.entitlements.findByRedemptionId(redemptionId);
      if (held) {
        this.entitlements.release(held.entitlementId, record.decision.entitlementUnitsHeld);
      }
      return fail('FAILED', booking.message);
    }
    const heldForConsume = this.entitlements.findByRedemptionId(redemptionId);
    if (heldForConsume) {
      this.entitlements.consume(heldForConsume.entitlementId, record.decision.entitlementUnitsHeld);
    }
    const redeemed: RedemptionRecord = Object.freeze({
      ...record,
      status: 'REDEEMED',
      providerBookingId: booking.value.bookingId,
      accessRightRef: booking.value.accessRightRef,
      rightKind: booking.value.rightKind,
      funding,
      entitlementHoldState: 'CONSUMED',
      updatedAt: SIMULATION_NOW,
    });
    this.records.set(redemptionId, redeemed);
    return ok(redeemed);
  }

  cancel(redemptionId: string): WorkflowOutcome<RedemptionRecord> {
    const record = this.records.get(redemptionId);
    if (!record) {
      return fail('NOT_FOUND', 'redemption not found');
    }
    if (record.providerBookingId) {
      this.gateway.cancel({
        requestId: `cancel_${redemptionId}`,
        providerId: record.providerId,
        bookingId: record.providerBookingId,
        reason: 'user_cancelled',
        idempotencyKey: `cancel_${redemptionId}`,
      });
    }
    const heldForRelease = this.entitlements.findByRedemptionId(redemptionId);
    if (heldForRelease && record.entitlementHoldState === 'HELD') {
      this.entitlements.release(heldForRelease.entitlementId, record.decision.entitlementUnitsHeld);
    }
    const cancelled: RedemptionRecord = Object.freeze({
      ...record,
      status: 'CANCELLED',
      entitlementHoldState: 'RELEASED',
      updatedAt: SIMULATION_NOW,
    });
    this.records.set(redemptionId, cancelled);
    return ok(cancelled);
  }

  get(redemptionId: string): RedemptionRecord | null {
    return this.records.get(redemptionId) ?? null;
  }

  orchestrateBundle(input: {
    readonly bundleId: string;
    readonly subjectRef: string;
    readonly failurePolicy: BundleFailurePolicy;
    readonly components: readonly { readonly componentId: string; readonly providerId: import('../types.ts').AccessProviderId; readonly category: string; readonly quote: ProviderQuote }[];
  }): ExperienceBundleRedemption {
    const results: ExperienceBundleComponent[] = [];
    let failed = false;
    for (const component of input.components) {
      const redemptionId = `${input.bundleId}_${component.componentId}`;
      const request: RedemptionRequest = {
        redemptionId,
        subjectRef: input.subjectRef,
        intentId: null,
        category: component.category,
        providerId: component.providerId,
        providerQuote: component.quote,
        entitlement: {
          entitlementId: `ent_${component.componentId}`,
          entitlementClass: component.category === 'FOOD' ? 'FOOD_STANDARD' : component.category === 'HOTEL' ? 'STAY_STANDARD' : 'MOBILITY_STANDARD',
          availableUnits: component.quote.quantity,
          canonicalUnit: component.quote.canonicalUnit,
        },
        requestedQuantity: component.quote.quantity,
        jurisdiction: 'SIMULATION',
        maxUserContributionMinorUnits: 1_000_000n,
        policyContext: {
          benefitSource: 'SIMULATION_BUNDLE',
          geographicZone: null,
          serviceLevel: 'STANDARD',
        },
      };
      const started = this.start(request, `bundle_${input.bundleId}_${component.componentId}`);
      const status: RedemptionStatus = started.ok ? started.value.status : 'FAILED';
      if (!started.ok) {
        failed = true;
      }
      results.push(
        Object.freeze({
          componentId: component.componentId,
          providerId: component.providerId,
          category: component.category,
          quoteId: component.quote.quoteId,
          status,
        }),
      );
      if (failed && input.failurePolicy === 'ALL_OR_NOTHING') {
        break;
      }
    }
    if (failed && input.failurePolicy === 'ALL_OR_NOTHING') {
      for (const row of results) {
        const redemptionId = `${input.bundleId}_${row.componentId}`;
        this.cancel(redemptionId);
      }
      return Object.freeze({
        bundleId: input.bundleId,
        subjectRef: input.subjectRef,
        failurePolicy: input.failurePolicy,
        components: Object.freeze(results),
        status: 'FAILED',
      });
    }
    return Object.freeze({
      bundleId: input.bundleId,
      subjectRef: input.subjectRef,
      failurePolicy: input.failurePolicy,
      components: Object.freeze(results),
      status: failed ? 'PARTIALLY_COVERED' : 'READY_FOR_APPROVAL',
    });
  }

  private compensate(record: RedemptionRecord, reason: string): void {
    const failed: RedemptionRecord = Object.freeze({
      ...record,
      status: 'FAILED',
      entitlementHoldState: 'RELEASED',
      updatedAt: SIMULATION_NOW,
      decision: Object.freeze({
        ...record.decision,
        explanation: Object.freeze([...record.decision.explanation, reason]),
      }),
    });
    this.records.set(record.redemptionId, failed);
  }
}

type WorkflowOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: string; readonly message: string };
type RedemptionDecisionView = { readonly decision: import('./types.ts').RedemptionDecision };

function ok<T>(value: T): WorkflowOutcome<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: string, message: string): WorkflowOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}
