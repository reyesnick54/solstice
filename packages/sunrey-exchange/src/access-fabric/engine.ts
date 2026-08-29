import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import type { ExchangeAccountId, ExchangeMarketId, OrderId } from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type { EligibilityContext, ExchangeInstrument } from '../types-universal.ts';
import { DualEconomyClearingAdapter, type DualEconomyClearingPorts } from './clearing.ts';
import { CapacityDiscoveryIndex } from './discovery.ts';
import { evaluateCapacityAccess, type CapacityAccessDecision } from './policy.ts';
import {
  cancellationIntentFor,
  refundSettlementIntent,
  splitConsiderationForPartialDelivery,
} from './refunds.ts';
import {
  capacityDeliveryEvidence,
  deliveryEvidenceAccepted,
  openCapacityReservation,
  transitionReservation,
  undeliveredQuantity,
} from './reservations.ts';
import { considerationTerms } from './consideration.ts';
import type {
  CapacityAccessTerms,
  CapacityClearingReceipt,
  CapacityDeliveryEvidence,
  CapacityMarketConfiguration,
  CapacityReservation,
  ConsiderationLeg,
  ConsiderationTerms,
  RefundSettlementIntent,
} from './types.ts';
import type {
  CapacityTradeMechanism,
  DeliveryEvidenceQuality,
  RefundReason,
} from './taxonomy.ts';

/**
 * Capacity access market engine.
 *
 * Orchestration only. Discovery, offers, RFQ, auctions, and queue allocation all
 * run on canonical Exchange primitives; consideration is routed by the
 * dual-economy clearing adapter to the canonical Ledger, custody, chain, or the
 * entitlement and reward owners. The engine stores reservations, delivery
 * evidence, receipts, and refund intents. It stores no balance.
 */
export type CapacityReservationRequest = {
  readonly reservationId: string;
  readonly marketId: ExchangeMarketId;
  readonly mechanism: CapacityTradeMechanism;
  readonly instrument: ExchangeInstrument;
  readonly terms: CapacityAccessTerms;
  readonly buyerAccountId: ExchangeAccountId;
  readonly providerAccountId: ExchangeAccountId;
  readonly reservedQuantity: bigint;
  readonly unitPrice: ExchangePrice;
  readonly consideration: readonly ConsiderationLeg[];
  readonly actor: EligibilityContext;
  readonly counterparty?: EligibilityContext;
  readonly height: bigint;
  readonly authority: ExecutionAuthority | null;
  readonly listingId?: string;
  readonly sourceOrderId?: OrderId | null;
  readonly at: UtcInstant;
};

export type CapacityReservationResult = {
  readonly reservation: CapacityReservation;
  readonly decision: CapacityAccessDecision;
  readonly receipt: CapacityClearingReceipt | null;
};

export type CapacityDeliveryResult = {
  readonly reservation: CapacityReservation;
  readonly captureReceipt: CapacityClearingReceipt | null;
  readonly refundIntent: RefundSettlementIntent | null;
  readonly refundReceipt: CapacityClearingReceipt | null;
  readonly rejectedReasons: readonly string[];
};

export type CapacityRefundResult = {
  readonly reservation: CapacityReservation;
  readonly intent: RefundSettlementIntent;
  readonly receipt: CapacityClearingReceipt;
};

export class CapacityAccessMarketEngine {
  readonly discovery = new CapacityDiscoveryIndex();
  readonly clearing: DualEconomyClearingAdapter;
  private readonly configurations = new Map<string, CapacityMarketConfiguration>();
  private readonly reservations = new Map<string, CapacityReservation>();
  private readonly evidence = new Map<string, CapacityDeliveryEvidence[]>();
  private readonly receipts: CapacityClearingReceipt[] = [];
  private readonly refundIntents: RefundSettlementIntent[] = [];

  constructor(ports: DualEconomyClearingPorts) {
    this.clearing = new DualEconomyClearingAdapter(ports);
  }

  configureMarket(configuration: CapacityMarketConfiguration): void {
    this.configurations.set(String(configuration.marketId), configuration);
  }

  configurationFor(marketId: ExchangeMarketId): CapacityMarketConfiguration | null {
    return this.configurations.get(String(marketId)) ?? null;
  }

  reservationFor(reservationId: string): CapacityReservation | null {
    return this.reservations.get(reservationId) ?? null;
  }

  evidenceFor(reservationId: string): readonly CapacityDeliveryEvidence[] {
    return Object.freeze([...(this.evidence.get(reservationId) ?? [])]);
  }

  receiptsFor(reservationId: string): readonly CapacityClearingReceipt[] {
    return Object.freeze(this.receipts.filter((receipt) => receipt.reservationId === reservationId));
  }

  refundIntentsFor(reservationId: string): readonly RefundSettlementIntent[] {
    return Object.freeze(
      this.refundIntents.filter((intent) => intent.reservationId === reservationId),
    );
  }

  /**
   * Reserve capacity. The policy gate runs first and its refusal is returned
   * unchanged: a refused reservation reserves no consideration, posts no
   * journal, moves no asset, and consumes no entitlement.
   */
  reserveCapacity(request: CapacityReservationRequest): CapacityReservationResult {
    const configuration = this.configurationFor(request.marketId);
    if (!configuration) {
      throw new TypeError(`capacity market ${String(request.marketId)} is not configured`);
    }
    const consideration = considerationTerms({
      legs: request.consideration,
      semantics: request.terms.deliveryRequirements.semantics,
    });

    const reservation = openCapacityReservation({
      reservationId: request.reservationId,
      marketId: request.marketId,
      mechanism: request.mechanism,
      buyerAccountId: request.buyerAccountId,
      providerAccountId: request.providerAccountId,
      terms: request.terms,
      reservedQuantity: request.reservedQuantity,
      unitPrice: request.unitPrice,
      consideration,
      sourceOrderId: request.sourceOrderId ?? null,
      at: request.at,
    });

    const decision = evaluateCapacityAccess({
      configuration,
      instrument: request.instrument,
      terms: request.terms,
      mechanism: request.mechanism,
      consideration,
      actor: request.actor,
      ...(request.counterparty ? { counterparty: request.counterparty } : {}),
      height: request.height,
      authority: request.authority,
    });

    if (!decision.permitted) {
      const refused = transitionReservation(reservation, 'POLICY_REFUSED', request.at);
      this.reservations.set(refused.reservationId, refused);
      return { reservation: refused, decision, receipt: null };
    }

    const receipt = this.clearing.reserveConsideration({
      reservationId: reservation.reservationId,
      consideration,
      authority: request.authority,
      actorId: String(request.buyerAccountId),
      at: request.at,
    });
    this.receipts.push(receipt);

    const next =
      receipt.outcome === 'CLEARED'
        ? transitionReservation(
            transitionReservation(reservation, 'CONSIDERATION_RESERVED', request.at),
            'CONFIRMED',
            request.at,
          )
        : receipt.outcome === 'REQUIRES_COMPENSATION'
          ? transitionReservation(reservation, 'FAILED', request.at)
          : transitionReservation(reservation, 'FAILED', request.at);
    this.reservations.set(next.reservationId, next);
    for (const compensation of receipt.compensations) {
      this.refundIntents.push(compensation);
    }
    if (receipt.outcome === 'CLEARED' && request.listingId) {
      this.discovery.commit(request.listingId, request.reservedQuantity);
    }
    return { reservation: next, decision, receipt };
  }

  /**
   * Record attested delivery and settle. Consideration for the delivered part
   * is captured; any undelivered remainder produces a refund intent that the
   * clearing adapter executes as a compensating movement.
   */
  recordDelivery(input: {
    readonly reservationId: string;
    readonly evidenceId: string;
    readonly deliveredQuantity: bigint;
    readonly quality: DeliveryEvidenceQuality;
    readonly oracleFactIds?: readonly string[];
    readonly productiveClaimId?: string | null;
    readonly authority: ExecutionAuthority | null;
    readonly at: UtcInstant;
  }): CapacityDeliveryResult {
    const reservation = this.reservations.get(input.reservationId);
    if (!reservation) {
      throw new TypeError(`unknown capacity reservation ${input.reservationId}`);
    }

    const attested = capacityDeliveryEvidence({
      evidenceId: input.evidenceId,
      reservationId: input.reservationId,
      deliveredQuantity: input.deliveredQuantity,
      unit: reservation.terms.unit,
      quality: input.quality,
      oracleFactIds: input.oracleFactIds ?? [],
      productiveClaimId: input.productiveClaimId ?? null,
      at: input.at,
    });
    const acceptance = deliveryEvidenceAccepted(reservation, attested);
    if (!acceptance.accepted) {
      return {
        reservation,
        captureReceipt: null,
        refundIntent: null,
        refundReceipt: null,
        rejectedReasons: acceptance.reasons,
      };
    }

    const list = this.evidence.get(input.reservationId) ?? [];
    list.push(attested);
    this.evidence.set(input.reservationId, list);

    const totalDelivered = reservation.deliveredQuantity + attested.deliveredQuantity;
    const split = splitConsiderationForPartialDelivery({
      legs: reservation.consideration.legs,
      reservedQuantity: reservation.reservedQuantity,
      deliveredQuantity: totalDelivered,
    });

    const captureConsideration: ConsiderationTerms = considerationTerms({
      legs: split.captured,
      semantics: reservation.consideration.semantics,
    });
    const captureReceipt = this.clearing.settleDelivery({
      reservationId: reservation.reservationId,
      consideration: captureConsideration,
      authority: input.authority,
      actorId: String(reservation.buyerAccountId),
      at: input.at,
      reservedQuantity: reservation.reservedQuantity,
      deliveredQuantity: totalDelivered,
      deliveryAttested: true,
    });
    this.receipts.push(captureReceipt);

    if (captureReceipt.outcome !== 'CLEARED') {
      const failed = transitionReservation(
        reservation,
        captureReceipt.outcome === 'REQUIRES_COMPENSATION' ? 'REQUIRES_COMPENSATION' : 'FAILED',
        input.at,
      );
      this.reservations.set(failed.reservationId, failed);
      for (const compensation of captureReceipt.compensations) {
        this.refundIntents.push(compensation);
      }
      return {
        reservation: failed,
        captureReceipt,
        refundIntent: null,
        refundReceipt: null,
        rejectedReasons: [],
      };
    }

    const delivered = transitionReservation(
      reservation,
      totalDelivered === reservation.reservedQuantity ? 'DELIVERED' : 'PARTIALLY_DELIVERED',
      input.at,
      { deliveredQuantity: totalDelivered },
    );
    this.reservations.set(delivered.reservationId, delivered);

    if (split.remainder.length === 0 || undeliveredQuantity(delivered) === 0n) {
      return {
        reservation: delivered,
        captureReceipt,
        refundIntent: null,
        refundReceipt: null,
        rejectedReasons: [],
      };
    }

    const intent = refundSettlementIntent({
      reservationId: delivered.reservationId,
      reason: 'UNDELIVERED_REMAINDER',
      legs: split.remainder,
      at: input.at,
    });
    this.refundIntents.push(intent);
    const refundReceipt = this.clearing.refund({
      reservationId: delivered.reservationId,
      consideration: delivered.consideration,
      authority: input.authority,
      actorId: String(delivered.buyerAccountId),
      at: input.at,
      intent,
    });
    this.receipts.push(refundReceipt);
    const refunded =
      refundReceipt.outcome === 'CLEARED'
        ? transitionReservation(delivered, 'REFUNDED', input.at)
        : delivered;
    this.reservations.set(refunded.reservationId, refunded);

    return {
      reservation: refunded,
      captureReceipt,
      refundIntent: intent,
      refundReceipt,
      rejectedReasons: [],
    };
  }

  /** Cancel a reservation before delivery and return the whole consideration. */
  cancelReservation(input: {
    readonly reservationId: string;
    readonly reason: RefundReason;
    readonly authority: ExecutionAuthority | null;
    readonly at: UtcInstant;
  }): CapacityRefundResult {
    const reservation = this.reservations.get(input.reservationId);
    if (!reservation) {
      throw new TypeError(`unknown capacity reservation ${input.reservationId}`);
    }
    const cancelled = transitionReservation(
      reservation,
      input.reason === 'RESERVATION_EXPIRED' ? 'EXPIRED' : 'CANCELLED',
      input.at,
    );
    const intent = cancellationIntentFor({
      reservation: cancelled,
      reason: input.reason,
      at: input.at,
    });
    this.refundIntents.push(intent);
    const receipt = this.clearing.refund({
      reservationId: cancelled.reservationId,
      consideration: cancelled.consideration,
      authority: input.authority,
      actorId: String(cancelled.buyerAccountId),
      at: input.at,
      intent,
    });
    this.receipts.push(receipt);
    const next =
      receipt.outcome === 'CLEARED'
        ? transitionReservation(cancelled, 'REFUNDED', input.at)
        : cancelled;
    this.reservations.set(next.reservationId, next);
    return { reservation: next, intent, receipt };
  }
}
