import type { Clock } from '../../../../config/src/clock.ts';
import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../../../../config/src/flags.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import {
  aggregateFills,
  deriveOrderStatusFromAggregation,
} from './aggregation.ts';
import {
  asHeliosProviderEventId,
  externalOperationIdFor,
  fillIdFor,
  operationIdFor,
  orderIdFor,
  settlementIdFor,
} from './ids.ts';
import type {
  HeliosProviderOrderPort,
  ProviderFillEvent,
  ProviderWebhookPayload,
} from './provider-port.ts';
import { providerFillToHeliosFill } from './provider-port.ts';
import { InMemoryHeliosOrderLifecycleStore } from './store.ts';
import {
  canTransitionHeliosOrder,
  type HeliosOrderStatus,
} from './taxonomy.ts';
import type {
  CreateHeliosOrderInput,
  HeliosCapitalPort,
  HeliosFill,
  HeliosOrder,
  HeliosOrderFailure,
  HeliosOrderValidationPorts,
  HeliosReconciliationRecord,
  HeliosSettlement,
} from './types.ts';

export const HELIOS_H23_ORDER_LIFECYCLE = 'HELIOS_H23_ORDER_LIFECYCLE' as const;

function fail(code: HeliosOrderFailure['code'], message: string): Result<never, HeliosOrderFailure> {
  return err({ code, message });
}

function transitionOrder(order: HeliosOrder, next: HeliosOrderStatus, extras: Partial<HeliosOrder> = {}): HeliosOrder {
  if (!canTransitionHeliosOrder(order.status, next)) {
    throw new Error(`illegal order transition ${order.status} → ${next}`);
  }
  return Object.freeze({ ...order, ...extras, status: next });
}

/**
 * Canonical HELIOS provider-backed order / fill / settlement lifecycle coordinator.
 * One operation identity → at most one intended financial effect.
 * Does not issue Execution Authority or post journals directly.
 */
export class HeliosOrderLifecycleService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly provider: HeliosProviderOrderPort;
  private readonly validation: HeliosOrderValidationPorts;
  private readonly capital: HeliosCapitalPort;
  readonly store: InMemoryHeliosOrderLifecycleStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly provider: HeliosProviderOrderPort;
    readonly validation: HeliosOrderValidationPorts;
    readonly capital: HeliosCapitalPort;
    readonly store?: InMemoryHeliosOrderLifecycleStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.provider = input.provider;
    this.validation = input.validation;
    this.capital = input.capital;
    this.store = input.store ?? new InMemoryHeliosOrderLifecycleStore();
  }

  createOrder(input: CreateHeliosOrderInput): Result<HeliosOrder, HeliosOrderFailure> {
    if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
      return fail('LIVE_GATE_BLOCKED', 'live execution gates must remain explicit and disabled');
    }
    if (input.environment !== 'SIMULATION' && input.environment !== 'SANDBOX' && input.environment !== 'PAPER') {
      return fail('NOT_SIMULATION', 'only simulation/sandbox/paper environments are permitted');
    }

    const operationId = operationIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
    const existing = this.store.getOrderByOperationId(operationId);
    if (existing) {
      return ok(existing);
    }

    const order: HeliosOrder = Object.freeze({
      orderId: orderIdFor(operationId),
      operationId,
      externalOperationId: externalOperationIdFor(operationId),
      customerId: input.customerId,
      providerAccountId: input.providerAccountId,
      workOrderId: input.workOrderId,
      strategyCapsuleRef: input.strategyCapsuleRef,
      proposalId: input.proposalId,
      envelopeId: input.envelopeId,
      authorityReference: null,
      instrumentId: input.instrumentId,
      side: input.side,
      quantityUnits: input.quantityUnits,
      notionalMinorUnits: input.notionalMinorUnits,
      orderType: input.orderType,
      limitPriceMinorUnits: input.limitPriceMinorUnits ?? null,
      timeInForce: input.timeInForce,
      currency: input.currency,
      providerRoute: input.providerRoute,
      environment: input.environment,
      status: 'PROPOSED',
      cancelStatus: null,
      providerOrderId: null,
      reservationId: null,
      capitalReservedMinorUnits: '0',
      idempotencyKey: input.idempotencyKey,
      createdAt: input.now,
      updatedAt: input.now,
      submittedAt: null,
      acknowledgedAt: null,
      filledAt: null,
      settledAt: null,
      reconciledAt: null,
      availableAt: null,
      liveExecution: false,
      productionAuthorized: false,
      grantsFinancialEffect: false,
    });

    this.store.putOrder(order);
    return ok(order);
  }

  authorizeOrder(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer cannot access this order');

    const now = this.clock.now();
    if (!this.validation.envelopeValid(order.envelopeId, now)) {
      return fail('ENVELOPE_INVALID', 'Decision-Validity Envelope is not valid');
    }
    if (!this.validation.mandateActive(order.workOrderId, customerId)) {
      return fail('MANDATE_REVOKED', 'mandate is not active');
    }

    const kernel = this.validation.kernelPermits({
      customerId,
      workOrderId: order.workOrderId,
      proposalId: order.proposalId,
    });
    if (!kernel.permitted) {
      return fail('ENVELOPE_INVALID', 'Compliance Kernel has not permitted this order');
    }

    const authorized = transitionOrder(order, 'AUTHORIZED', {
      authorityReference: kernel.authorityReference,
      updatedAt: now,
    });
    this.store.updateOrder(authorized);
    return ok(authorized);
  }

  submitOrder(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer cannot submit into another account');

    const now = this.clock.now();

    if (order.status === 'SUBMITTED' || order.status === 'ACKNOWLEDGED') {
      return ok(order);
    }
    if (order.status === 'UNKNOWN' || order.status === 'RECONCILIATION_REQUIRED') {
      return this.reconcileOrder(orderId, customerId);
    }
    if (order.status !== 'AUTHORIZED' && order.status !== 'PROPOSED') {
      return fail('INVALID_TRANSITION', `cannot submit from status ${order.status}`);
    }

    const revalidation = this.revalidateBeforeSubmit(order, now);
    if (!revalidation.ok) return revalidation;

    const reserved = this.capital.reserve({
      orderId: order.orderId,
      customerId,
      accountId: order.providerAccountId,
      amountMinorUnits: order.notionalMinorUnits,
      currency: order.currency,
      idempotencyKey: `reserve:${order.operationId}`,
    });
    if (!reserved.ok) {
      return fail('INSUFFICIENT_CAPITAL', reserved.message);
    }

    let current = order;
    if (current.status === 'PROPOSED') {
      current = transitionOrder(current, 'AUTHORIZED', {
        authorityReference: this.validation.kernelPermits({
          customerId,
          workOrderId: order.workOrderId,
          proposalId: order.proposalId,
        }).authorityReference,
        updatedAt: now,
      });
    }
    current = Object.freeze({
      ...current,
      reservationId: reserved.reservationId,
      capitalReservedMinorUnits: order.notionalMinorUnits,
      updatedAt: now,
    });

    const submitted = transitionOrder(current, 'SUBMITTED', { submittedAt: now, updatedAt: now });
    this.store.updateOrder(submitted);

    const result = this.provider.submit({
      externalOperationId: submitted.externalOperationId,
      operationId: submitted.operationId,
      orderId: submitted.orderId,
      instrumentId: submitted.instrumentId,
      side: submitted.side,
      quantityUnits: submitted.quantityUnits,
      orderType: submitted.orderType,
      limitPriceMinorUnits: submitted.limitPriceMinorUnits,
      currency: submitted.currency,
      timeInForce: submitted.timeInForce,
    });

    if (result.outcome === 'UNAVAILABLE') {
      const failed = transitionOrder(submitted, 'FAILED', { updatedAt: now });
      this.store.updateOrder(failed);
      return fail('PROVIDER_UNAVAILABLE', result.message);
    }

    if (result.outcome === 'TIMEOUT') {
      const unknown = transitionOrder(submitted, 'UNKNOWN', { updatedAt: now });
      this.store.updateOrder(unknown);
      return fail('TIMEOUT_REQUIRES_RECONCILIATION', 'timeout after submission requires reconciliation before retry');
    }

    if (result.outcome === 'REJECTED') {
      const rejected = transitionOrder(submitted, 'REJECTED', {
        providerOrderId: result.providerOrderId,
        updatedAt: now,
      });
      this.store.updateOrder(rejected);
      if (rejected.reservationId) {
        this.capital.release({ reservationId: rejected.reservationId, reason: 'provider rejected' });
      }
      return fail('PROVIDER_REJECTED', 'provider rejected the order');
    }

    const nextStatus: HeliosOrderStatus =
      result.outcome === 'PENDING' ? 'SUBMITTED' : 'ACKNOWLEDGED';
    const acknowledged = transitionOrder(submitted, nextStatus, {
      providerOrderId: result.providerOrderId,
      acknowledgedAt: result.outcome === 'ACKNOWLEDGED' ? now : null,
      updatedAt: now,
    });
    this.store.updateOrder(acknowledged);
    return ok(acknowledged);
  }

  processFill(
    orderId: HeliosOrder['orderId'],
    customerId: CustomerId,
    fillEvent: ProviderFillEvent,
    evidenceRef: string | null,
  ): Result<{ readonly order: HeliosOrder; readonly fill: HeliosFill; readonly duplicate: boolean }, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer cannot ingest another customer fill');

    const now = this.clock.now();
    const fill = providerFillToHeliosFill(order, fillEvent, now, evidenceRef);
    const isNew = this.store.putFill(fill);
    if (!isNew) {
      return ok({ order, fill, duplicate: true });
    }

    const fills = this.store.getFills(orderId);
    const aggregation = aggregateFills(fills, order.quantityUnits, order.currency);
    const nextStatus = deriveOrderStatusFromAggregation(aggregation, order.quantityUnits, order.cancelStatus);
    const updated = transitionOrder(order, nextStatus, {
      filledAt: nextStatus === 'FILLED' || nextStatus === 'PARTIALLY_FILLED' ? now : order.filledAt,
      updatedAt: now,
    });
    this.store.updateOrder(updated);
    return ok({ order: updated, fill, duplicate: false });
  }

  ingestWebhook(
    customerId: CustomerId,
    payload: ProviderWebhookPayload,
  ): Result<{ readonly processed: boolean; readonly order: HeliosOrder | null }, HeliosOrderFailure> {
    const verification = this.provider.verifyWebhook(payload);
    const now = this.clock.now();
    const eventId = asHeliosProviderEventId(payload.eventId);

    if (this.store.isEventProcessed(eventId)) {
      return fail('WEBHOOK_REPLAY', 'duplicate webhook event rejected');
    }

    if (!verification.verified) {
      const reason = verification.reason === 'INVALID_SIGNATURE' ? 'WEBHOOK_INVALID' : verification.reason === 'REPLAY' ? 'WEBHOOK_REPLAY' : 'WEBHOOK_INVALID';
      return fail(reason as HeliosOrderFailure['code'], `webhook verification failed: ${verification.reason}`);
    }

    const parsed = verification.payload;
    let order: HeliosOrder | null = null;

    if (parsed.externalOperationId) {
      for (const candidate of this.store.forCustomer(customerId)) {
        if (candidate.externalOperationId === parsed.externalOperationId) {
          order = candidate;
          break;
        }
      }
    }

    if (!order && parsed.providerOrderId) {
      for (const candidate of this.store.forCustomer(customerId)) {
        if (candidate.providerOrderId === parsed.providerOrderId) {
          order = candidate;
          break;
        }
      }
    }

    if (!order) {
      return fail('ORDER_NOT_FOUND', 'webhook does not link to a known order for this customer');
    }
    if (order.customerId !== customerId) {
      return fail('CUSTOMER_MISMATCH', 'webhook account ownership validation failed');
    }

    this.store.putProviderEvent(
      Object.freeze({
        eventId,
        orderId: order.orderId,
        operationId: order.operationId,
        customerId,
        eventKind: parsed.kind,
        rawPayload: payload.rawBody,
        verification: 'VERIFIED',
        processedAt: now,
        deduplicated: false,
      }),
    );

    if (parsed.fill) {
      const result = this.processFill(order.orderId, customerId, parsed.fill, `webhook:${eventId}`);
      if (!result.ok) return result;
      order = result.value.order;
    }

    return ok({ processed: true, order });
  }

  requestCancellation(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer cannot cancel another customer order');
    if (!order.providerOrderId) return fail('CANNOT_CANCEL', 'order has not been acknowledged by provider');

    const now = this.clock.now();
    const pending = transitionOrder(order, 'CANCEL_PENDING', {
      cancelStatus: 'CANCEL_REQUESTED',
      updatedAt: now,
    });
    this.store.updateOrder(pending);

    const result = this.provider.cancel(order.providerOrderId, order.externalOperationId);
    if (result.outcome === 'UNAVAILABLE') {
      return fail('PROVIDER_UNAVAILABLE', result.message);
    }

    if (result.outcome === 'CANCEL_REJECTED') {
      const restored = transitionOrder(pending, order.status === 'PARTIALLY_FILLED' ? 'PARTIALLY_FILLED' : 'ACKNOWLEDGED', {
        cancelStatus: 'CANCEL_REJECTED',
        updatedAt: now,
      });
      this.store.updateOrder(restored);
      return fail('CANNOT_CANCEL', 'provider rejected cancellation');
    }

    const query = this.provider.query(order.externalOperationId);
    if (query.found) {
      for (const fillEvent of query.fills) {
        this.processFill(orderId, customerId, fillEvent, result.evidenceRef);
      }
    }

    const fills = this.store.getFills(orderId);
    const aggregation = aggregateFills(fills, order.quantityUnits, order.currency);
    const hasFills = BigInt(aggregation.filledQuantityUnits) > 0n;
    const fullyCancelled = !hasFills;
    const partialThenCancelled =
      hasFills && BigInt(aggregation.filledQuantityUnits) < BigInt(order.quantityUnits);

    const nextStatus: HeliosOrderStatus = partialThenCancelled
      ? 'PARTIALLY_FILLED_THEN_CANCELLED'
      : hasFills
        ? deriveOrderStatusFromAggregation(aggregation, order.quantityUnits, 'CANCEL_ACKNOWLEDGED')
        : 'CANCELLED';

    const cancelled = transitionOrder(pending, nextStatus, {
      cancelStatus: partialThenCancelled ? 'PARTIALLY_FILLED_THEN_CANCELLED' : hasFills ? 'CANCELLED' : 'CANCELLED',
      updatedAt: now,
    });
    this.store.updateOrder(cancelled);

    if (fullyCancelled && cancelled.reservationId) {
      this.capital.release({ reservationId: cancelled.reservationId, reason: 'cancelled before fill' });
    }

    return ok(cancelled);
  }

  settleOrder(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosSettlement, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    if (order.status !== 'FILLED' && order.status !== 'PARTIALLY_FILLED_THEN_CANCELLED') {
      return fail('INVALID_TRANSITION', 'settlement requires filled order');
    }

    const now = this.clock.now();
    const fills = this.store.getFills(orderId);
    if (fills.length === 0) {
      return fail('INVALID_TRANSITION', 'no fills to settle');
    }

    const settlements: HeliosSettlement[] = [];
    for (const fill of fills) {
      const existing = this.store.getSettlements(orderId).find((s) => s.fillId === fill.fillId);
      if (existing) {
        settlements.push(existing);
        continue;
      }
      const settlement: HeliosSettlement = Object.freeze({
        settlementId: settlementIdFor(orderId, fill.fillId),
        orderId,
        fillId: fill.fillId,
        assetLeg: Object.freeze({ instrumentId: fill.instrumentId, quantityUnits: fill.quantityUnits }),
        cashLeg: Object.freeze({ minorUnits: fill.notionalMinorUnits, currency: fill.currency }),
        expectedSettlementDate: now,
        actualSettlementDate: now,
        status: 'SETTLED',
        feeAdjustmentMinorUnits: fill.feeMinorUnits,
        custodyState: 'SANDBOX_CUSTODY',
        evidenceRef: fill.evidenceRef,
        ledgerJournalRef: null,
        simulation: true,
      });
      this.store.putSettlement(settlement);
      settlements.push(settlement);
    }

    const settled = transitionOrder(order, 'SETTLED', { settledAt: now, updatedAt: now });
    this.store.updateOrder(settled);
    return ok(settlements[0]!);
  }

  reconcileOrder(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');

    const now = this.clock.now();
    const query = this.provider.query(order.externalOperationId);

    if (!query.found) {
      const unknown =
        order.status === 'UNKNOWN'
          ? order
          : transitionOrder(order, 'UNKNOWN', { updatedAt: now });
      this.store.updateOrder(unknown);
      const record: HeliosReconciliationRecord = Object.freeze({
        orderId,
        operationId: order.operationId,
        status: 'UNKNOWN',
        providerStatus: null,
        canonicalStatus: 'UNKNOWN',
        discrepancyNotes: Object.freeze(['provider query returned not found']),
        reconciledAt: now,
        evidenceRef: query.evidenceRef,
      });
      this.store.putReconciliation(record);
      return ok(unknown);
    }

    let current = order;
    if (query.status === 'REJECTED') {
      current = transitionOrder(current, 'REJECTED', { updatedAt: now });
    } else if (query.status === 'CANCELLED') {
      current = transitionOrder(current, 'CANCELLED', { updatedAt: now });
    } else if (query.status === 'ACKNOWLEDGED' || query.status === 'PENDING') {
      if (current.status === 'UNKNOWN' || current.status === 'SUBMITTED') {
        current = transitionOrder(current, 'ACKNOWLEDGED', {
          providerOrderId: query.providerOrderId,
          acknowledgedAt: now,
          updatedAt: now,
        });
      }
    }

    for (const fillEvent of query.fills) {
      const fillResult = this.processFill(orderId, customerId, fillEvent, query.evidenceRef);
      if (fillResult.ok) {
        current = fillResult.value.order;
      }
    }

    if (query.status === 'FILL' && current.status !== 'FILLED') {
      current = transitionOrder(current, 'FILLED', { filledAt: now, updatedAt: now });
      this.store.updateOrder(current);
    }

    const record: HeliosReconciliationRecord = Object.freeze({
      orderId,
      operationId: order.operationId,
      status: 'MATCHED',
      providerStatus: query.status,
      canonicalStatus: current.status,
      discrepancyNotes: Object.freeze([]),
      reconciledAt: now,
      evidenceRef: query.evidenceRef,
    });
    this.store.putReconciliation(record);

    if (current.status === 'FILLED') {
      current = transitionOrder(current, 'SETTLED', { settledAt: now, updatedAt: now });
      current = transitionOrder(current, 'RECONCILED', { reconciledAt: now, updatedAt: now });
      current = transitionOrder(current, 'AVAILABLE', { availableAt: now, updatedAt: now });
      this.store.updateOrder(current);
      if (current.reservationId) {
        this.capital.release({ reservationId: current.reservationId, reason: 'order available' });
      }
      return ok(current);
    }

    this.store.updateOrder(current);
    return ok(current);
  }

  markAvailable(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');

    const now = this.clock.now();
    let current = order;
    if (current.status === 'SETTLED') {
      current = transitionOrder(current, 'RECONCILED', { reconciledAt: now, updatedAt: now });
    }
    const available = transitionOrder(current, 'AVAILABLE', { availableAt: now, updatedAt: now });
    this.store.updateOrder(available);
    if (available.reservationId) {
      this.capital.release({ reservationId: available.reservationId, reason: 'position available' });
    }
    return ok(available);
  }

  getOrder(orderId: HeliosOrder['orderId'], customerId: CustomerId): Result<HeliosOrder, HeliosOrderFailure> {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer cannot view another customer order');
    return ok(order);
  }

  getOrderAggregation(orderId: HeliosOrder['orderId'], customerId: CustomerId) {
    const order = this.store.getOrder(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    const fills = this.store.getFills(orderId);
    return ok(aggregateFills(fills, order.quantityUnits, order.currency));
  }

  restoreFromSnapshot(): void {
    // Called externally via store.restore
  }

  private revalidateBeforeSubmit(order: HeliosOrder, now: ReturnType<Clock['now']>): Result<true, HeliosOrderFailure> {
    if (!this.validation.envelopeValid(order.envelopeId, now)) {
      return fail('ENVELOPE_INVALID', 'Decision-Validity Envelope expired or invalid');
    }
    if (!this.validation.mandateActive(order.workOrderId, order.customerId)) {
      return fail('MANDATE_REVOKED', 'mandate no longer active');
    }
    if (!this.validation.accountOwned(order.customerId, order.providerAccountId)) {
      return fail('CUSTOMER_MISMATCH', 'account ownership validation failed');
    }
    if (
      !this.validation.capitalAvailable(
        order.customerId,
        order.providerAccountId,
        order.notionalMinorUnits,
        order.currency,
      )
    ) {
      return fail('INSUFFICIENT_CAPITAL', 'insufficient available capital');
    }
    if (!this.validation.providerCapable(order.providerRoute, order.instrumentId)) {
      return fail('PROVIDER_UNAVAILABLE', 'provider does not support instrument');
    }
    if (!this.validation.marketOpen(order.instrumentId)) {
      return fail('PROVIDER_UNAVAILABLE', 'market session closed');
    }
    if (
      !this.validation.riskPermits({
        customerId: order.customerId,
        instrumentId: order.instrumentId,
        notionalMinorUnits: order.notionalMinorUnits,
        side: order.side,
      })
    ) {
      return fail('ENVELOPE_INVALID', 'Risk Engine refused');
    }
    const kernel = this.validation.kernelPermits({
      customerId: order.customerId,
      workOrderId: order.workOrderId,
      proposalId: order.proposalId,
    });
    if (!kernel.permitted) {
      return fail('ENVELOPE_INVALID', 'Compliance Kernel refused');
    }
    return ok(true);
  }
}
