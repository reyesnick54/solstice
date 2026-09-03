/**
 * ACCESS-17 — Canonical access redemption orchestrator.
 *
 * Application orchestration only. Coordinates existing canonical owners without
 * creating a parallel domain, ledger, Kernel, Exchange, or chain.
 */

import { authorizeCapacityIntent } from '../../access-fabric/src/authorize.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asExchangeAccountId } from '../../sunrey-exchange/src/ids.ts';
import { fiatConsiderationFor } from '../../sunrey-exchange/src/access-fabric/offers.ts';
import { CAPACITY_ACCESS_MARKET_ID } from '../../sunrey-exchange/src/access-fabric/sandbox.ts';
import {
  accessRightRequest,
  reservationRequest,
} from '../../sunrey-chain/src/access/fixtures.ts';
import {
  SIMULATION_DIGITAL_CUSTODY_GB,
  SIMULATION_SOLSTICE_UK,
} from '../../sunrey-coin/src/simulation-catalog.ts';
import {
  accessRegistryIntentIdFor,
  capacityRefFor,
} from '../../access-economy/src/registry-ids.ts';
import type { AccessProviderGateway } from '../../access-economy/src/providers/gateway.ts';
import {
  RedemptionFundingRouter,
  type FundingIntentPort,
} from '../../access-economy/src/providers/funding-router.ts';
import { EntitlementHoldStore } from '../../access-economy/src/providers/redemption/entitlement-store.ts';
import { evaluateRedemption } from '../../access-economy/src/providers/redemption/engine.ts';
import {
  CANONICAL_REDEMPTION_NOW,
  createCanonicalRedemptionSimulationWorld,
  type CanonicalRedemptionSimulationWorld,
} from './canonical-redemption-world.ts';
import type {
  BundleFailurePolicy,
  ExperienceBundleComponent,
  ExperienceBundleRedemption,
  RedemptionRecord,
  RedemptionRequest,
  RedemptionStatus,
} from '../../access-economy/src/providers/redemption/types.ts';
import type { ProviderQuote } from '../../access-economy/src/providers/types.ts';

export const CANONICAL_REDEMPTION_PIPELINE = [
  'QUOTE',
  'ELIGIBILITY',
  'ENTITLEMENT_HOLD',
  'CAPACITY_HOLD',
  'FINANCIAL_HOLD',
  'HUMAN_CONFIRMATION',
  'EXECUTION_AUTHORITY',
  'PROVIDER_RESERVATION',
  'CLEARING_COMMITMENT',
  'CHAIN_COMMITMENT',
  'FULFILLMENT',
  'DELIVERY_PROOF',
  'SETTLEMENT_CAPTURE',
  'ENTITLEMENT_CONSUMPTION',
  'COMPLETION',
] as const;

export type CanonicalRedemptionPipelineStep = (typeof CANONICAL_REDEMPTION_PIPELINE)[number];

export type CanonicalRedemptionTrace = Readonly<{
  readonly redemptionId: string;
  readonly idempotencyKey: string;
  readonly completedSteps: readonly CanonicalRedemptionPipelineStep[];
  readonly domainIntentId: string | null;
  readonly capacityReservationId: string | null;
  readonly kernelEvidenceId: string | null;
  readonly clearingReservationId: string | null;
  readonly chainCommitmentKey: string | null;
  readonly deliveryEvidenceId: string | null;
  readonly settlementEvidenceId: string | null;
  readonly compensatingIntents: readonly string[];
}>;

export type CanonicalRedemptionPorts = {
  readonly world: CanonicalRedemptionSimulationWorld;
  readonly gateway: AccessProviderGateway;
  readonly funding: FundingIntentPort;
};

export type CanonicalRedemptionOrchestratorOptions = {
  readonly ports?: CanonicalRedemptionPorts;
};

type WorkflowOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

type RedemptionDecisionView = {
  readonly decision: import('../../access-economy/src/providers/redemption/types.ts').RedemptionDecision;
};

function ok<T>(value: T): WorkflowOutcome<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: string, message: string): WorkflowOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}

function appendStep(
  trace: CanonicalRedemptionTrace,
  step: CanonicalRedemptionPipelineStep,
): CanonicalRedemptionTrace {
  if (trace.completedSteps.includes(step)) {
    return trace;
  }
  return Object.freeze({
    ...trace,
    completedSteps: Object.freeze([...trace.completedSteps, step]),
  });
}

export class CanonicalAccessRedemptionOrchestrator {
  private readonly world: CanonicalRedemptionSimulationWorld;
  readonly gateway: AccessProviderGateway;
  private readonly fundingRouter: RedemptionFundingRouter;
  readonly entitlements: EntitlementHoldStore;
  private readonly records = new Map<string, RedemptionRecord>();
  private readonly traces = new Map<string, CanonicalRedemptionTrace>();
  private readonly idempotency = new Map<string, string>();

  constructor(options: CanonicalRedemptionOrchestratorOptions = {}) {
    const world = options.ports?.world ?? createCanonicalRedemptionSimulationWorld();
    this.world = world;
    this.gateway = options.ports?.gateway ?? world.gateway;
    this.entitlements = new EntitlementHoldStore();
    this.fundingRouter = new RedemptionFundingRouter(options.ports?.funding ?? world.funding);
  }

  preview(request: RedemptionRequest): RedemptionDecisionView {
    this.registerDomainIntent(request);
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

    let trace = this.emptyTrace(request.redemptionId, idempotencyKey);
    const decision = evaluateRedemption(request);
    trace = appendStep(trace, 'QUOTE');
    trace = appendStep(trace, 'ELIGIBILITY');

    if (
      !['READY_FOR_APPROVAL', 'USER_CONTRIBUTION_REQUIRED', 'FULLY_COVERED', 'PARTIALLY_COVERED'].includes(
        decision.status,
      )
    ) {
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
    trace = appendStep(trace, 'ENTITLEMENT_HOLD');

    const capacityHold = this.placeCapacityHold(request);
    if (!capacityHold.ok) {
      this.entitlements.release(request.entitlement.entitlementId, decision.entitlementUnitsHeld);
      return fail(capacityHold.code, capacityHold.message);
    }
    trace = Object.freeze({
      ...appendStep(trace, 'CAPACITY_HOLD'),
      capacityReservationId: capacityHold.reservationId,
      domainIntentId: capacityHold.domainIntentId,
    });

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
      createdAt: CANONICAL_REDEMPTION_NOW,
      updatedAt: CANONICAL_REDEMPTION_NOW,
    });
    this.records.set(request.redemptionId, record);
    this.traces.set(request.redemptionId, trace);
    this.idempotency.set(idempotencyKey, request.redemptionId);
    this.world.evidence.seal('access.redemption.started', {
      redemptionId: request.redemptionId,
      idempotencyKey,
      trace,
    });
    return ok(record);
  }

  confirm(
    redemptionId: string,
    input?: { readonly userApproved?: boolean; readonly userFiatMinorUnits?: bigint; readonly idempotencyKey?: string },
  ): WorkflowOutcome<RedemptionRecord> {
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

    let trace = this.traces.get(redemptionId) ?? this.emptyTrace(redemptionId, input?.idempotencyKey ?? redemptionId);
    trace = appendStep(trace, 'HUMAN_CONFIRMATION');

    const authority = this.obtainExecutionAuthority(redemptionId, record);
    if (!authority.ok) {
      return this.compensateFrom(redemptionId, record, trace, authority.code, authority.message);
    }
    trace = Object.freeze({
      ...appendStep(trace, 'EXECUTION_AUTHORITY'),
      kernelEvidenceId: authority.evidenceId,
    });

    const userFiat = input?.userFiatMinorUnits ?? record.decision.userContributionMinorUnits;
    const financialHold = this.placeFinancialHold(redemptionId, record, userFiat, authority.verified);
    if (!financialHold.ok) {
      return this.compensateFrom(redemptionId, record, trace, financialHold.code, financialHold.message);
    }
    trace = Object.freeze({
      ...appendStep(trace, 'FINANCIAL_HOLD'),
      clearingReservationId: financialHold.reservationId,
    });

    const reserve = this.gateway.reserve({
      requestId: `rsv_${redemptionId}`,
      providerId: record.providerId,
      quoteId: record.providerQuoteId,
      subjectRef: record.subjectRef,
      idempotencyKey: `reserve_${redemptionId}`,
    });
    if (!reserve.ok) {
      return this.compensateFrom(redemptionId, record, trace, 'PROVIDER_UNAVAILABLE', reserve.message, [
        'release_financial_hold',
      ]);
    }
    trace = appendStep(trace, 'PROVIDER_RESERVATION');

    const clearingCommit = this.commitClearing(redemptionId, financialHold.reservationId);
    if (!clearingCommit.ok) {
      this.gateway.cancel({
        requestId: `cancel_${redemptionId}`,
        providerId: record.providerId,
        bookingId: reserve.value.reservationId,
        reason: 'clearing_failed',
        idempotencyKey: `cancel_clearing_${redemptionId}`,
      });
      return this.compensateFrom(redemptionId, record, trace, clearingCommit.code, clearingCommit.message, [
        'release_financial_hold',
        'cancel_provider_reservation',
      ]);
    }
    trace = appendStep(trace, 'CLEARING_COMMITMENT');

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
        idempotencyKey: `cancel_booking_${redemptionId}`,
      });
      return this.compensateFrom(redemptionId, record, trace, 'FAILED', booking.message, [
        'release_financial_hold',
        'compensate_clearing',
        'cancel_provider_reservation',
      ]);
    }
    trace = appendStep(trace, 'FULFILLMENT');

    const chainCommit = this.commitChainAccess(redemptionId, booking.value.accessRightRef, booking.value.bookingId);
    if (chainCommit.ok) {
      trace = Object.freeze({
        ...appendStep(trace, 'CHAIN_COMMITMENT'),
        chainCommitmentKey: chainCommit.commitmentKey,
      });
    }

    const deliveryEvidenceId = this.recordDeliveryProof(redemptionId, booking.value.bookingId);
    trace = Object.freeze({
      ...appendStep(trace, 'DELIVERY_PROOF'),
      deliveryEvidenceId,
    });

    const settlementEvidenceId = this.captureSettlement(redemptionId, record, userFiat, financialHold.reservationId);
    trace = Object.freeze({
      ...appendStep(trace, 'SETTLEMENT_CAPTURE'),
      settlementEvidenceId,
    });

    const funding = this.fundingRouter.route({
      redemptionId,
      currency: 'USD',
      providerSettlementMinorUnits: record.decision.providerPriceMinorUnits,
      entitlementCoverageMinorUnits: record.decision.coverage?.appliedCoverageMinorUnits ?? 0n,
      userFiatMinorUnits: userFiat,
      createdAt: CANONICAL_REDEMPTION_NOW,
    });

    const heldForConsume = this.entitlements.findByRedemptionId(redemptionId);
    if (heldForConsume) {
      this.entitlements.consume(heldForConsume.entitlementId, record.decision.entitlementUnitsHeld);
    }
    trace = appendStep(trace, 'ENTITLEMENT_CONSUMPTION');

    const redeemed: RedemptionRecord = Object.freeze({
      ...record,
      status: 'REDEEMED',
      providerBookingId: booking.value.bookingId,
      accessRightRef: booking.value.accessRightRef,
      rightKind: booking.value.rightKind,
      funding,
      entitlementHoldState: 'CONSUMED',
      updatedAt: CANONICAL_REDEMPTION_NOW,
    });
    this.records.set(redemptionId, redeemed);
    trace = appendStep(trace, 'COMPLETION');
    this.traces.set(redemptionId, trace);
    this.world.evidence.seal('access.redemption.completed', {
      redemptionId,
      trace,
      bookingId: booking.value.bookingId,
    });
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
    const trace = this.traces.get(redemptionId);
    if (trace?.clearingReservationId && !trace.clearingReservationId.endsWith('_entitlement_only')) {
      this.world.exchange.engine.cancelReservation({
        reservationId: trace.clearingReservationId,
        reason: 'BUYER_CANCELLED',
        at: this.world.clock.now(),
        authority: null,
      });
    }
    const cancelled: RedemptionRecord = Object.freeze({
      ...record,
      status: 'CANCELLED',
      entitlementHoldState: 'RELEASED',
      updatedAt: CANONICAL_REDEMPTION_NOW,
    });
    this.records.set(redemptionId, cancelled);
    this.world.evidence.seal('access.redemption.cancelled', { redemptionId });
    return ok(cancelled);
  }

  get(redemptionId: string): RedemptionRecord | null {
    return this.records.get(redemptionId) ?? null;
  }

  traceFor(redemptionId: string): CanonicalRedemptionTrace | null {
    return this.traces.get(redemptionId) ?? null;
  }

  orchestrateBundle(input: {
    readonly bundleId: string;
    readonly subjectRef: string;
    readonly failurePolicy: BundleFailurePolicy;
    readonly components: readonly {
      readonly componentId: string;
      readonly providerId: import('../../access-economy/src/providers/types.ts').AccessProviderId;
      readonly category: string;
      readonly quote: ProviderQuote;
    }[];
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
          entitlementClass:
            component.category === 'FOOD'
              ? 'FOOD_STANDARD'
              : component.category === 'HOTEL' ||
                  component.category === 'STAY_HOUSING' ||
                  component.category === 'HOUSING_ROOM_NIGHTS'
                ? 'STAY_STANDARD'
                : 'MOBILITY_STANDARD',
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
      this.entitlements.seed(request.entitlement.entitlementId, input.subjectRef, component.quote.quantity);
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
        this.cancel(`${input.bundleId}_${row.componentId}`);
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

  confirmBundle(input: {
    readonly bundleId: string;
    readonly failurePolicy: BundleFailurePolicy;
    readonly userApproved?: boolean;
  }): WorkflowOutcome<ExperienceBundleRedemption> {
    const prefix = `${input.bundleId}_`;
    const redemptionIds = [...this.records.keys()].filter((id) => id.startsWith(prefix));
    const components: ExperienceBundleComponent[] = [];
    let failed = false;
    for (const redemptionId of redemptionIds) {
      const record = this.records.get(redemptionId);
      if (!record) {
        continue;
      }
      const confirmed = this.confirm(redemptionId, {
        ...(input.userApproved !== undefined ? { userApproved: input.userApproved } : {}),
      });
      const componentId = redemptionId.slice(prefix.length);
      if (!confirmed.ok) {
        failed = true;
        components.push(
          Object.freeze({
            componentId,
            providerId: record.providerId,
            category: record.decision.status,
            quoteId: record.providerQuoteId,
            status: 'FAILED',
          }),
        );
        if (input.failurePolicy === 'ALL_OR_NOTHING') {
          for (const otherId of redemptionIds) {
            if (otherId !== redemptionId) {
              this.cancel(otherId);
            }
          }
          return ok(
            Object.freeze({
              bundleId: input.bundleId,
              subjectRef: record.subjectRef,
              failurePolicy: input.failurePolicy,
              components: Object.freeze(components),
              status: 'FAILED',
            }),
          );
        }
        continue;
      }
      components.push(
        Object.freeze({
          componentId,
          providerId: confirmed.value.providerId,
          category: 'CONFIRMED',
          quoteId: confirmed.value.providerQuoteId,
          status: confirmed.value.status,
        }),
      );
    }
    const subjectRef = this.records.get(redemptionIds[0] ?? '')?.subjectRef ?? 'unknown';
    return ok(
      Object.freeze({
        bundleId: input.bundleId,
        subjectRef,
        failurePolicy: input.failurePolicy,
        components: Object.freeze(components),
        status: failed ? 'PARTIALLY_COVERED' : 'REDEEMED',
      }),
    );
  }

  private emptyTrace(redemptionId: string, idempotencyKey: string): CanonicalRedemptionTrace {
    return Object.freeze({
      redemptionId,
      idempotencyKey,
      completedSteps: Object.freeze([]),
      domainIntentId: null,
      capacityReservationId: null,
      kernelEvidenceId: null,
      clearingReservationId: null,
      chainCommitmentKey: null,
      deliveryEvidenceId: null,
      settlementEvidenceId: null,
      compensatingIntents: Object.freeze([]),
    });
  }

  private registerDomainIntent(request: RedemptionRequest): string {
    const intentId = accessRegistryIntentIdFor(request.redemptionId);
    this.world.domain.proposeIntent({
      id: intentId,
      kind: 'REQUEST',
      subjectRef: request.subjectRef,
      capacityRef: capacityRefFor(`${request.category}-${request.providerId}`),
      category:
        request.category === 'MOBILITY' || request.category === 'VEHICLE_HOURS'
          ? 'VEHICLE_HOURS'
          : request.category === 'FOOD'
            ? 'FOOD'
            : request.category === 'STAY_HOUSING' || request.category === 'HOTEL'
              ? 'HOUSING_ROOM_NIGHTS'
              : 'EXPERIENCES',
      bounds: [
        {
          kind: 'TIME',
          notBefore: CANONICAL_REDEMPTION_NOW,
          notAfter: request.providerQuote.expiresAt as import('../../domain/src/time.ts').UtcInstant,
        },
      ],
      purposeRef: 'access_redemption',
      proposedAt: CANONICAL_REDEMPTION_NOW,
    });
    return intentId;
  }

  private placeCapacityHold(request: RedemptionRequest): { readonly ok: true; readonly reservationId: string; readonly domainIntentId: string } | { readonly ok: false; readonly code: string; readonly message: string } {
    const domainIntentId = this.registerDomainIntent(request);
    const capacity = this.world.scarcity.buildCapacity({
      resourceId: `sim-${request.category}-${request.providerId}` as never,
      availableUnits: request.requestedQuantity,
      totalUnits: request.requestedQuantity * 2n,
      evidenceRefs: ['simulation-provider-quote'],
      locationCode: request.policyContext.geographicZone ?? 'SIMULATION',
      qualityTier: 'STANDARD',
    });
    const allocation = this.world.scarcity.quoteAndAllocate({
      request: {
        requestId: `req_${request.redemptionId}`,
        subjectRef: request.subjectRef,
        resourceId: capacity.resourceId,
        requestedUnits: request.requestedQuantity,
        jurisdiction: request.jurisdiction,
        productCode: `ACCESS_${request.category}`,
      },
      capacity,
    });
    if (!allocation.ok) {
      return { ok: false, code: 'CAPACITY_UNAVAILABLE', message: 'scarcity allocation refused' };
    }
    return {
      ok: true,
      reservationId: `cap_hold_${request.redemptionId}`,
      domainIntentId,
    };
  }

  private obtainExecutionAuthority(
    redemptionId: string,
    record: RedemptionRecord,
  ): { readonly ok: true; readonly evidenceId: string; readonly verified: import('../../permissions/src/execution-authority.ts').VerifiedExecutionAuthority } | { readonly ok: false; readonly code: string; readonly message: string } {
    const intent = Object.freeze({
      id: asIntentId(`intent_confirm_${redemptionId}`),
      actionType: ACTION_TYPES.CONFIRM_CAPACITY_RESERVATION,
      payload: Object.freeze({
        reservationId: `cap_hold_${redemptionId}`,
        accountId: record.subjectRef,
        poolId: 'pool_simulation',
        units: 1,
      }),
      idempotencyKey: `ea_${redemptionId}`,
      actorId: 'actor_access_consumer',
      requestedAt: CANONICAL_REDEMPTION_NOW,
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    });
    const authorized = authorizeCapacityIntent(
      {
        kernel: this.world.kernel,
        issuer: this.world.issuer,
        evidence: this.world.evidence,
        events: this.world.events,
        clock: this.world.clock,
        identity: this.world.identity.service,
      },
      intent,
      {
        jurisdiction: asJurisdiction('GB'),
        legalEntity: SIMULATION_SOLSTICE_UK,
        product: SIMULATION_DIGITAL_CUSTODY_GB,
      },
    );
    if (authorized.outcome !== 'ALLOWED') {
      const evidence = this.world.evidence.seal('access.redemption.kernel_refused', {
        redemptionId,
        outcome: authorized.outcome,
      });
      return {
        ok: false,
        code: 'KERNEL_REFUSED',
        message: `kernel refused: ${authorized.outcome}`,
      };
    }
    const evidence = this.world.evidence.seal('access.redemption.execution_authority', {
      redemptionId,
      authorityId: authorized.decision.executionAuthority?.authorityId ?? null,
    });
    return { ok: true, evidenceId: evidence.evidenceId, verified: authorized.verified };
  }

  private placeFinancialHold(
    redemptionId: string,
    record: RedemptionRecord,
    userFiatMinorUnits: bigint,
    authority: import('../../permissions/src/execution-authority.ts').VerifiedExecutionAuthority,
  ): { readonly ok: true; readonly reservationId: string } | { readonly ok: false; readonly code: string; readonly message: string } {
    if (userFiatMinorUnits === 0n && (record.decision.coverage?.appliedCoverageMinorUnits ?? 0n) > 0n) {
      return { ok: true, reservationId: `clr_${redemptionId}_entitlement_only` };
    }
    const reservationId = `clr_${redemptionId}`;
    const terms = this.world.exchange.terms({ termsId: `terms:${reservationId}` });
    const unitPrice = this.world.exchange.unitPrice({ priceUnits: 100n });
    const quantity = userFiatMinorUnits > 0n ? 1n : 1n;
    const due = fiatConsiderationFor({
      unitPrice,
      quantity,
      unit: terms.unit,
      currency: 'USD',
    });
    const result = this.world.exchange.engine.reserveCapacity({
      reservationId,
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: this.world.exchange.capacityListing,
      terms,
      buyerAccountId: asExchangeAccountId('xacct_buyer_capacity'),
      providerAccountId: asExchangeAccountId('xacct_provider_capacity'),
      reservedQuantity: quantity,
      unitPrice,
      consideration: [
        {
          kind: 'FIAT',
          amount: due,
          payerCashAccountId: 'acct_buyer_usd',
          payerOwnerId: 'owner_buyer',
          payeeCashAccountId: 'acct_provider_usd',
          payeeOwnerId: 'owner_provider',
          reservationCashAccountId: 'acct_reservation_pending_usd',
        },
      ],
      actor: this.world.exchange.actorContext(),
      height: 100n,
      authority,
      at: this.world.clock.now(),
    });
    if (!result.receipt) {
      return { ok: false, code: 'FINANCIAL_HOLD_FAILED', message: 'exchange clearing did not produce a receipt' };
    }
    return { ok: true, reservationId };
  }

  private commitClearing(redemptionId: string, reservationId: string): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    if (reservationId.endsWith('_entitlement_only')) {
      return { ok: true };
    }
    const evidence = this.world.evidence.seal('access.redemption.clearing_committed', {
      redemptionId,
      reservationId,
    });
    if (!evidence.evidenceId) {
      return { ok: false, code: 'CLEARING_FAILED', message: 'clearing commitment evidence missing' };
    }
    return { ok: true };
  }

  private commitChainAccess(
    redemptionId: string,
    accessRightRef: string | null,
    bookingId: string,
  ): { readonly ok: true; readonly commitmentKey: string } | { readonly ok: false; readonly code: string; readonly message: string } {
    if (!accessRightRef) {
      return { ok: false, code: 'CHAIN_SKIPPED', message: 'no access right to commit' };
    }
    const rightId = `arg_${bookingId}`;
    const right = this.world.chain.access.commitAccessRight(
      accessRightRequest({
        rightId,
        target: {
          productiveObjectId: 'peo_transit_fleet_north',
          capacityUnit: 'vehicle_day',
          capacityQuantity: 1n,
          geographyRef: 'grid_ne_01',
        },
        holder: {
          rawSubjectId: redemptionId,
          recipientContext: 'sunrey-access-redemption',
          purpose: 'sunrey.access.right.hold',
          jurisdictionCell: 'GB-NE',
          keyVersion: 1,
        },
      }),
    );
    if (!right.ok) {
      return { ok: false, code: right.error.code, message: right.error.message };
    }
    const reservation = this.world.chain.access.commitReservation(
      reservationRequest({
        rightId,
        reservationId: `ars_${bookingId}`,
        quantity: 1n,
      }),
    );
    if (!reservation.ok) {
      return { ok: false, code: reservation.error.code, message: reservation.error.message };
    }
    return { ok: true, commitmentKey: reservation.value.commitmentKey };
  }

  private recordDeliveryProof(redemptionId: string, bookingId: string): string {
    const evidence = this.world.evidence.seal('access.redemption.delivery_proof', {
      redemptionId,
      bookingId,
      attestedAt: CANONICAL_REDEMPTION_NOW,
    });
    return evidence.evidenceId;
  }

  private captureSettlement(
    redemptionId: string,
    record: RedemptionRecord,
    userFiatMinorUnits: bigint,
    clearingReservationId: string,
  ): string {
    const evidence = this.world.evidence.seal('access.redemption.settlement_capture', {
      redemptionId,
      providerPriceMinorUnits: record.decision.providerPriceMinorUnits.toString(),
      userFiatMinorUnits: userFiatMinorUnits.toString(),
      clearingReservationId,
    });
    return evidence.evidenceId;
  }

  private compensateFrom(
    redemptionId: string,
    record: RedemptionRecord,
    trace: CanonicalRedemptionTrace,
    code: string,
    message: string,
    compensations: readonly string[] = [],
  ): WorkflowOutcome<RedemptionRecord> {
    const held = this.entitlements.findByRedemptionId(redemptionId);
    if (held && record.entitlementHoldState === 'HELD') {
      this.entitlements.release(held.entitlementId, record.decision.entitlementUnitsHeld);
    }
    if (trace.clearingReservationId && !trace.clearingReservationId.endsWith('_entitlement_only')) {
      this.world.exchange.engine.cancelReservation({
        reservationId: trace.clearingReservationId,
        reason: 'CLEARING_COMPENSATION',
        at: this.world.clock.now(),
        authority: null,
      });
    }
    const compensatingIntents = Object.freeze([
      ...trace.compensatingIntents,
      ...compensations.map((kind) => `compensate:${kind}:${redemptionId}`),
    ]);
    const failed: RedemptionRecord = Object.freeze({
      ...record,
      status: 'FAILED',
      entitlementHoldState: 'RELEASED',
      updatedAt: CANONICAL_REDEMPTION_NOW,
      decision: Object.freeze({
        ...record.decision,
        explanation: Object.freeze([...record.decision.explanation, message]),
      }),
    });
    this.records.set(redemptionId, failed);
    this.traces.set(
      redemptionId,
      Object.freeze({
        ...trace,
        compensatingIntents,
      }),
    );
    this.world.evidence.seal('access.redemption.compensated', {
      redemptionId,
      code,
      message,
      compensatingIntents,
    });
    return fail(code, message);
  }
}

export function createCanonicalAccessRedemptionOrchestrator(
  options: CanonicalRedemptionOrchestratorOptions = {},
): CanonicalAccessRedemptionOrchestrator {
  return new CanonicalAccessRedemptionOrchestrator(options);
}
