import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED, type Clock } from '@solstice/config';
import { err, ok, type CustomerId, type Result, type UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { HeliosCapitalPort, HeliosOrderValidationPorts } from '../../order-lifecycle/types.ts';
import {
  HeliosOrderLifecycleService,
  type CreateHeliosOrderInput,
} from '../../order-lifecycle/service.ts';
import type { HeliosProviderOrderPort, ProviderFillEvent } from '../../order-lifecycle/provider-port.ts';
import type { HeliosOrder, HeliosFill } from '../../order-lifecycle/types.ts';
import { executionPlanIdFor, exitPlanIdFor, providerPayloadHash } from './ids.ts';
import { computeMultiAssetCashAvailability } from './cash-availability.ts';
import { reconcileMultiAssetAccount } from './reconciliation.ts';
import {
  ASSET_CLASS_SETTLEMENT_RULES,
  expectedSettlementDate,
  resolveAssetClass,
  settlementEligible,
} from './settlement-semantics.ts';
import { InMemoryMultiAssetExecutionStore } from './store.ts';
import { mapH23StatusToM24, type M24ExitKind, type M24OrderLifecycleState } from './taxonomy.ts';
import type {
  AuthorizeExitInput,
  MultiAssetCashAvailability,
  MultiAssetExecutionFailure,
  MultiAssetExitPlan,
  MultiAssetFillRecord,
  MultiAssetOrderRecord,
  MultiAssetReconciliationRun,
  SubmitMultiAssetOrderInput,
} from './types.ts';

export const HELIOS_MULTI_ASSET_M24_EXECUTION = 'HELIOS_MULTI_ASSET_M24_EXECUTION' as const;

function fail(code: MultiAssetExecutionFailure['code'], message: string): Result<never, MultiAssetExecutionFailure> {
  return err({ code, message });
}

function mapExitKindToH24Reason(exitKind: M24ExitKind): import('../../capital-lifecycle/taxonomy.ts').ExitReason {
  switch (exitKind) {
    case 'STRATEGY_EXIT':
      return 'STRATEGY_EXIT';
    case 'USER_CLOSE':
      return 'USER_REQUEST';
    case 'RISK_CLOSE':
      return 'RISK_REDUCTION';
    case 'EMERGENCY_CLOSE':
      return 'SYSTEM_CLOSE_POLICY';
    case 'FUTURES_ROLL':
      return 'EXPIRY';
    case 'PROVIDER_LIQUIDATION':
      return 'PROVIDER_RESTRICTION';
  }
}

/**
 * HELIOS Multi-Asset M24 — orchestrates H23 order lifecycle and H24 capital semantics
 * across equities, crypto, futures, and FX without a second accounting system.
 */
export class MultiAssetExecutionService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly provider: HeliosProviderOrderPort;
  readonly orderLifecycle: HeliosOrderLifecycleService;
  readonly store: InMemoryMultiAssetExecutionStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly provider: HeliosProviderOrderPort;
    readonly validation: HeliosOrderValidationPorts;
    readonly capital: HeliosCapitalPort;
    readonly orderLifecycle?: HeliosOrderLifecycleService;
    readonly store?: InMemoryMultiAssetExecutionStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.provider = input.provider;
    this.orderLifecycle = input.orderLifecycle ?? new HeliosOrderLifecycleService(input);
    this.store = input.store ?? new InMemoryMultiAssetExecutionStore();
  }

  submitOrder(input: SubmitMultiAssetOrderInput): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
      return fail('LIVE_GATE_BLOCKED', 'live execution gates must remain explicit and disabled');
    }

    const executionPlanId = executionPlanIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
    const existing = this.store.getOrderByPlan(executionPlanId);
    if (existing) {
      return ok(existing);
    }

    const now = this.clock.now();
    const assetClass = resolveAssetClass(input.instrumentId);
    const h23Input: CreateHeliosOrderInput = Object.freeze({
      customerId: input.customerId,
      providerAccountId: input.accountId,
      workOrderId: input.workOrderId as EconomicWorkOrderId,
      strategyCapsuleRef: input.strategyCapsuleRef ?? null,
      proposalId: input.proposalId,
      envelopeId: input.envelopeId ?? null,
      instrumentId: input.instrumentId,
      side: input.side,
      quantityUnits: input.quantityUnits,
      notionalMinorUnits: input.notionalMinorUnits,
      orderType: input.orderType,
      limitPriceMinorUnits: input.limitPriceMinorUnits ?? null,
      timeInForce: 'DAY',
      currency: input.currency,
      providerRoute: input.providerRoute,
      environment: 'SANDBOX',
      idempotencyKey: input.idempotencyKey,
      now,
    });

    const created = this.orderLifecycle.createOrder(h23Input);
    if (!created.ok) {
      return fail(mapH23Failure(created.error.code), created.error.message);
    }

    const authorized = this.orderLifecycle.authorizeOrder(created.value.orderId, input.customerId);
    if (!authorized.ok) {
      return fail(mapH23Failure(authorized.error.code), authorized.error.message);
    }

    const submitted = this.orderLifecycle.submitOrder(created.value.orderId, input.customerId);
    if (!submitted.ok) {
      if (submitted.error.code === 'TIMEOUT_REQUIRES_RECONCILIATION') {
        const record = this.projectOrder(created.value.orderId, executionPlanId, input, 'UNKNOWN_PROVIDER_STATE', now);
        this.store.putOrder(record);
        this.seal('M24_ORDER_TIMEOUT', record);
        return fail('TIMEOUT_REQUIRES_RECONCILIATION', submitted.error.message);
      }
      if (submitted.error.code === 'PROVIDER_REJECTED') {
        const record = this.projectOrder(created.value.orderId, executionPlanId, input, 'REJECTED', now);
        this.store.putOrder(record);
        return fail('PROVIDER_REJECTED', submitted.error.message);
      }
      return fail(mapH23Failure(submitted.error.code), submitted.error.message);
    }

    const h23Order = submitted.value;
    const state = mapH23StatusToM24(h23Order.status);
    const record = this.projectOrder(created.value.orderId, executionPlanId, input, state, now, h23Order);
    this.store.putOrder(record);
    this.seal('M24_ORDER_SUBMITTED', record);
    return ok(record);
  }

  processFill(
    orderId: MultiAssetOrderRecord['orderId'],
    customerId: CustomerId,
    fillEvent: ProviderFillEvent,
    evidenceRef: string | null,
  ): Result<{ readonly order: MultiAssetOrderRecord; readonly fill: MultiAssetFillRecord; readonly duplicate: boolean }, MultiAssetExecutionFailure> {
    const m24Order = this.store.getOrder(orderId);
    if (!m24Order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (m24Order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');

    const result = this.orderLifecycle.processFill(orderId, customerId, fillEvent, evidenceRef);
    if (!result.ok) {
      return fail(mapH23Failure(result.error.code), result.error.message);
    }

    const h23Fill = result.value.fill;
    const fillRecord = this.projectFill(m24Order, h23Fill, fillEvent, evidenceRef);
    const isNew = this.store.putFill(fillRecord);

    const h23Order = result.value.order;
    let state = mapH23StatusToM24(h23Order.status);
    const now = this.clock.now();
    let settlementPendingAt = m24Order.settlementPendingAt;
    let filledAt = m24Order.filledAt ?? (state === 'FILLED' || state === 'PARTIALLY_FILLED' ? now : null);

    if (state === 'FILLED') {
      state = 'SETTLEMENT_PENDING';
      settlementPendingAt = now;
    } else if (state === 'PARTIALLY_FILLED') {
      state = 'PARTIALLY_FILLED';
    }

    const updated = Object.freeze({
      ...m24Order,
      currentState: state,
      updatedAt: now,
      filledAt,
      settlementPendingAt,
      evidenceRefs: Object.freeze([...m24Order.evidenceRefs, ...(evidenceRef ? [evidenceRef] : [])]),
    });
    this.store.putOrder(updated);
    this.seal('M24_FILL_RECORDED', { order: updated, fill: fillRecord });
    return ok({ order: updated, fill: fillRecord, duplicate: !isNew });
  }

  advanceSettlement(orderId: MultiAssetOrderRecord['orderId'], customerId: CustomerId): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const m24Order = this.store.getOrder(orderId);
    if (!m24Order) return fail('ORDER_NOT_FOUND', 'order not found');
    if (m24Order.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    if (m24Order.currentState !== 'SETTLEMENT_PENDING' && m24Order.currentState !== 'FILLED') {
      return fail('INVALID_TRANSITION', `cannot settle from ${m24Order.currentState}`);
    }

    const now = this.clock.now();
    const tradeDate = m24Order.filledAt ?? now;
    if (!settlementEligible(tradeDate, m24Order.assetClass, now)) {
      return ok(m24Order);
    }

    const settled = this.orderLifecycle.settleOrder(orderId, customerId);
    if (!settled.ok) {
      return fail(mapH23Failure(settled.error.code), settled.error.message);
    }

    const updated = Object.freeze({
      ...m24Order,
      currentState: 'SETTLED' as M24OrderLifecycleState,
      settledAt: now,
      updatedAt: now,
    });
    this.store.putOrder(updated);
    this.seal('M24_SETTLEMENT_COMPLETE', updated);
    return ok(updated);
  }

  reconcileOrder(orderId: MultiAssetOrderRecord['orderId'], customerId: CustomerId): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const m24Order = this.store.getOrder(orderId);
    if (!m24Order) return fail('ORDER_NOT_FOUND', 'order not found');

    const result = this.orderLifecycle.reconcileOrder(orderId, customerId);
    if (!result.ok) {
      return fail(mapH23Failure(result.error.code), result.error.message);
    }

    const now = this.clock.now();
    const h23Fills = this.orderLifecycle.store.getFills(orderId);
    for (const h23Fill of h23Fills) {
      if (this.store.getFills(orderId).some((row) => row.fillId === h23Fill.fillId)) {
        continue;
      }
      const fillEvent: ProviderFillEvent = Object.freeze({
        providerFillId: h23Fill.providerFillId,
        instrumentId: h23Fill.instrumentId,
        quantityUnits: h23Fill.quantityUnits,
        priceMinorUnits: h23Fill.priceMinorUnits,
        feeMinorUnits: h23Fill.feeMinorUnits,
        currency: h23Fill.currency,
        venue: h23Fill.venue,
        liquidityRole: h23Fill.liquidityRole,
        providerTimestamp: h23Fill.providerTimestamp,
      });
      this.store.putFill(this.projectFill(m24Order, h23Fill, fillEvent, h23Fill.evidenceRef));
    }

    let state = mapH23StatusToM24(result.value.status);
    if (state === 'FILLED') {
      state = 'SETTLEMENT_PENDING';
    }
    if (state === 'SETTLED') {
      state = 'RECONCILED';
    }
    if (state === 'AVAILABLE') {
      // keep AVAILABLE
    } else if (result.value.status === 'UNKNOWN') {
      state = 'UNKNOWN_PROVIDER_STATE';
    }

    const updated = Object.freeze({
      ...m24Order,
      currentState: state,
      providerOrderId: result.value.providerOrderId,
      updatedAt: now,
      filledAt: result.value.filledAt ?? m24Order.filledAt,
      settlementPendingAt: state === 'SETTLEMENT_PENDING' ? now : m24Order.settlementPendingAt,
      reconciledAt: state === 'RECONCILED' || state === 'AVAILABLE' ? now : m24Order.reconciledAt,
      availableAt: state === 'AVAILABLE' ? now : m24Order.availableAt,
    });
    this.store.putOrder(updated);
    this.seal('M24_ORDER_RECONCILED', updated);
    return ok(updated);
  }

  markAvailable(orderId: MultiAssetOrderRecord['orderId'], customerId: CustomerId): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const m24Order = this.store.getOrder(orderId);
    if (!m24Order) return fail('ORDER_NOT_FOUND', 'order not found');

    const result = this.orderLifecycle.markAvailable(orderId, customerId);
    if (!result.ok) {
      return fail(mapH23Failure(result.error.code), result.error.message);
    }

    const now = this.clock.now();
    const updated = Object.freeze({
      ...m24Order,
      currentState: 'AVAILABLE' as M24OrderLifecycleState,
      availableAt: now,
      updatedAt: now,
    });
    this.store.putOrder(updated);
    return ok(updated);
  }

  requestCancellation(orderId: MultiAssetOrderRecord['orderId'], customerId: CustomerId): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const m24Order = this.store.getOrder(orderId);
    if (!m24Order) return fail('ORDER_NOT_FOUND', 'order not found');

    const result = this.orderLifecycle.requestCancellation(orderId, customerId);
    if (!result.ok) {
      return fail(mapH23Failure(result.error.code), result.error.message);
    }

    const now = this.clock.now();
    const state = mapH23StatusToM24(result.value.status);
    const updated = Object.freeze({
      ...m24Order,
      currentState: state === 'PARTIALLY_FILLED' ? 'PARTIALLY_FILLED' : state,
      updatedAt: now,
    });
    this.store.putOrder(updated);
    return ok(updated);
  }

  authorizeExit(input: AuthorizeExitInput): Result<MultiAssetExitPlan, MultiAssetExecutionFailure> {
    const exitPlanId = exitPlanIdFor(String(input.customerId), input.instrumentId, input.idempotencyKey);
    const existing = this.store.getExitPlan(exitPlanId);
    if (existing) {
      return ok(existing);
    }

    const now = this.clock.now();
    const assetClass = resolveAssetClass(input.instrumentId);
    const plan: MultiAssetExitPlan = Object.freeze({
      exitPlanId,
      customerId: input.customerId,
      accountId: input.accountId,
      instrumentId: input.instrumentId,
      assetClass,
      exitKind: input.exitKind,
      quantityUnits: input.quantityUnits,
      executionPlanId: null,
      orderId: null,
      authorized: true,
      authorityReference: input.authorityReference,
      evidenceRefs: Object.freeze([`ev_exit_${exitPlanId}`]),
      createdAt: now,
      updatedAt: now,
    });
    this.store.putExitPlan(plan);
    this.seal('M24_EXIT_AUTHORIZED', { plan, h24Reason: mapExitKindToH24Reason(input.exitKind) });
    return ok(plan);
  }

  executeExitPlan(
    exitPlanId: MultiAssetExitPlan['exitPlanId'],
    input: Omit<SubmitMultiAssetOrderInput, 'side' | 'instrumentId' | 'quantityUnits'> & {
      readonly quantityUnits: string;
      readonly instrumentId: string;
    },
  ): Result<{ readonly exitPlan: MultiAssetExitPlan; readonly order: MultiAssetOrderRecord }, MultiAssetExecutionFailure> {
    const plan = this.store.getExitPlan(exitPlanId);
    if (!plan) return fail('ORDER_NOT_FOUND', 'exit plan not found');
    if (!plan.authorized) return fail('INVALID_TRANSITION', 'exit plan not authorized');

    const orderResult = this.submitOrder({
      ...input,
      customerId: plan.customerId,
      accountId: plan.accountId,
      instrumentId: input.instrumentId,
      side: 'SELL',
      quantityUnits: input.quantityUnits,
      idempotencyKey: `exit:${plan.exitPlanId}:${input.idempotencyKey}`,
    });
    if (!orderResult.ok) {
      return orderResult;
    }

    const now = this.clock.now();
    const updatedPlan = Object.freeze({
      ...plan,
      executionPlanId: orderResult.value.executionPlanId,
      orderId: orderResult.value.orderId,
      updatedAt: now,
    });
    this.store.putExitPlan(updatedPlan);
    return ok({ exitPlan: updatedPlan, order: orderResult.value });
  }

  reconcileAccount(input: {
    readonly customerId: CustomerId;
    readonly accountId: string;
    readonly providerCashMinor: string | null;
    readonly canonicalCashMinor: string;
    readonly providerPositions: Readonly<Record<string, string>> | null;
    readonly canonicalPositions: Readonly<Record<string, string>>;
  }): MultiAssetReconciliationRun {
    const now = this.clock.now();
    const run = reconcileMultiAssetAccount({
      customerId: input.customerId,
      accountId: input.accountId,
      orders: this.store.forCustomer(input.customerId),
      fills: this.store.snapshot().fills,
      orderLifecycle: this.orderLifecycle,
      provider: this.provider,
      providerCashMinor: input.providerCashMinor,
      canonicalCashMinor: input.canonicalCashMinor,
      providerPositions: input.providerPositions,
      canonicalPositions: input.canonicalPositions,
      now,
    });
    this.store.putReconciliationRun(run);
    for (const exception of run.exceptions) {
      this.store.putException(exception);
      this.seal('M24_RECONCILIATION_EXCEPTION', exception);
    }
    this.seal('M24_RECONCILIATION_RUN', run);
    return run;
  }

  cashAvailability(input: {
    readonly customerId: CustomerId;
    readonly accountId: string;
    readonly currency: string;
    readonly ledgerSettledMinor: string;
    readonly reservedMinor: string;
    readonly positionMarketValueMinor: string;
    readonly positionCostBasisMinor: string;
    readonly realizedPnlMinor: string;
  }): MultiAssetCashAvailability {
    const latest = this.store.latestReconciliation(input.accountId);
    const reconciliationBlocks = latest !== null && !latest.matched;
    return computeMultiAssetCashAvailability({
      customerId: input.customerId,
      accountId: input.accountId,
      currency: input.currency,
      ledgerSettledMinor: input.ledgerSettledMinor,
      reservedMinor: input.reservedMinor,
      positionMarketValueMinor: input.positionMarketValueMinor,
      positionCostBasisMinor: input.positionCostBasisMinor,
      realizedPnlMinor: input.realizedPnlMinor,
      orders: this.store.forCustomer(input.customerId),
      fills: this.store.snapshot().fills,
      reconciliationBlocks,
      asOf: this.clock.now(),
    });
  }

  runFullLifecycle(
    input: SubmitMultiAssetOrderInput,
    fillEvent: ProviderFillEvent,
  ): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const submitted = this.submitOrder(input);
    if (!submitted.ok) {
      if (submitted.error.code === 'TIMEOUT_REQUIRES_RECONCILIATION') {
        const plan = executionPlanIdFor(input.workOrderId, input.proposalId, input.idempotencyKey);
        const order = this.store.getOrderByPlan(plan);
        if (order) {
          const reconciled = this.reconcileOrder(order.orderId, input.customerId);
          if (reconciled.ok && reconciled.value.currentState !== 'UNKNOWN_PROVIDER_STATE') {
            return this.continueAfterReconcile(reconciled.value, input.customerId, fillEvent);
          }
        }
      }
      return submitted;
    }

    return this.continueAfterSubmit(submitted.value, input.customerId, fillEvent);
  }

  private continueAfterSubmit(
    order: MultiAssetOrderRecord,
    customerId: CustomerId,
    fillEvent: ProviderFillEvent,
  ): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    const filled = this.processFill(order.orderId, customerId, fillEvent, 'ev_lifecycle_fill');
    if (!filled.ok) return filled;

    const assetClass = order.assetClass;
    const rule = ASSET_CLASS_SETTLEMENT_RULES[assetClass];
    if (rule.immediateCashEffect) {
      const settled = this.advanceSettlement(filled.value.order.orderId, customerId);
      if (!settled.ok) return settled;
      const reconciled = this.reconcileOrder(settled.value.orderId, customerId);
      if (!reconciled.ok) return reconciled;
      if (reconciled.value.currentState === 'RECONCILED') {
        return this.markAvailable(reconciled.value.orderId, customerId);
      }
      return reconciled;
    }

    const now = this.clock.now();
    const tradeDate = filled.value.order.filledAt ?? now;
    if (settlementEligible(tradeDate, assetClass, now)) {
      const settled = this.advanceSettlement(filled.value.order.orderId, customerId);
      if (!settled.ok) return settled;
    }

    const reconciled = this.reconcileOrder(filled.value.order.orderId, customerId);
    if (!reconciled.ok) return reconciled;
    if (reconciled.value.currentState === 'RECONCILED' || reconciled.value.currentState === 'AVAILABLE') {
      return this.markAvailable(reconciled.value.orderId, customerId);
    }
    return reconciled;
  }

  private continueAfterReconcile(
    order: MultiAssetOrderRecord,
    customerId: CustomerId,
    fillEvent: ProviderFillEvent,
  ): Result<MultiAssetOrderRecord, MultiAssetExecutionFailure> {
    return this.continueAfterSubmit(order, customerId, fillEvent);
  }

  private projectOrder(
    orderId: HeliosOrder['orderId'],
    executionPlanId: ReturnType<typeof executionPlanIdFor>,
    input: SubmitMultiAssetOrderInput,
    state: M24OrderLifecycleState,
    now: UtcInstant,
    h23Order?: HeliosOrder,
  ): MultiAssetOrderRecord {
    const assetClass = resolveAssetClass(input.instrumentId);
    const rule = ASSET_CLASS_SETTLEMENT_RULES[assetClass];
    const payloadRef = h23Order?.providerOrderId
      ? providerPayloadHash(`${h23Order.providerOrderId}:${h23Order.externalOperationId}`)
      : null;

    return Object.freeze({
      executionPlanId,
      orderId,
      provider: input.providerRoute,
      providerOrderId: h23Order?.providerOrderId ?? null,
      instrumentId: input.instrumentId,
      assetClass,
      side: input.side,
      orderType: input.orderType,
      quantityUnits: input.quantityUnits,
      submittedPriceMinorUnits: input.submittedPriceMinorUnits ?? input.limitPriceMinorUnits ?? null,
      limitPriceMinorUnits: input.limitPriceMinorUnits ?? null,
      venue: input.venue,
      accountId: input.accountId,
      customerId: input.customerId,
      providerPayloadRef: payloadRef,
      currentState: state,
      settlementCycle: rule.cycle,
      evidenceRefs: Object.freeze(h23Order?.providerOrderId ? [`ev_ack_${h23Order.providerOrderId}`] : []),
      createdAt: h23Order?.createdAt ?? now,
      updatedAt: now,
      submittedAt: h23Order?.submittedAt ?? null,
      acknowledgedAt: h23Order?.acknowledgedAt ?? null,
      filledAt: h23Order?.filledAt ?? null,
      settlementPendingAt: null,
      settledAt: h23Order?.settledAt ?? null,
      reconciledAt: h23Order?.reconciledAt ?? null,
      availableAt: h23Order?.availableAt ?? null,
      simulation: true,
      liveExecution: false,
    });
  }

  private projectFill(
    order: MultiAssetOrderRecord,
    h23Fill: HeliosFill,
    fillEvent: ProviderFillEvent,
    evidenceRef: string | null,
  ): MultiAssetFillRecord {
    const limit = order.limitPriceMinorUnits ? BigInt(order.limitPriceMinorUnits) : null;
    const fillPrice = BigInt(fillEvent.priceMinorUnits);
    let slippage: string | null = null;
    let improvement: string | null = null;
    if (limit !== null) {
      if (order.side === 'BUY' && fillPrice > limit) {
        slippage = (fillPrice - limit).toString();
      } else if (order.side === 'BUY' && fillPrice < limit) {
        improvement = (limit - fillPrice).toString();
      } else if (order.side === 'SELL' && fillPrice < limit) {
        slippage = (limit - fillPrice).toString();
      } else if (order.side === 'SELL' && fillPrice > limit) {
        improvement = (fillPrice - limit).toString();
      }
    }

    return Object.freeze({
      fillId: h23Fill.fillId,
      providerFillId: h23Fill.providerFillId,
      orderId: order.orderId,
      executionPlanId: order.executionPlanId,
      quantityUnits: h23Fill.quantityUnits,
      priceMinorUnits: h23Fill.priceMinorUnits,
      feeMinorUnits: h23Fill.feeMinorUnits,
      feeCurrency: h23Fill.currency,
      liquidityRole: h23Fill.liquidityRole,
      slippageMinorUnits: slippage,
      priceImprovementMinorUnits: improvement,
      timestamp: h23Fill.providerTimestamp,
      venue: h23Fill.venue,
      evidenceRef,
      simulation: true,
    });
  }

  private seal(kind: string, payload: unknown): void {
    if (!this.evidence) return;
    this.evidence.seal(kind, payload);
  }
}

function mapH23Failure(code: string): MultiAssetExecutionFailure['code'] {
  switch (code) {
    case 'TIMEOUT_REQUIRES_RECONCILIATION':
      return 'TIMEOUT_REQUIRES_RECONCILIATION';
    case 'PROVIDER_REJECTED':
      return 'PROVIDER_REJECTED';
    case 'PROVIDER_UNAVAILABLE':
      return 'PROVIDER_UNAVAILABLE';
    case 'DUPLICATE_SUBMISSION':
      return 'DUPLICATE_SUBMISSION';
    case 'CUSTOMER_MISMATCH':
      return 'CUSTOMER_MISMATCH';
    case 'ORDER_NOT_FOUND':
      return 'ORDER_NOT_FOUND';
    case 'INSUFFICIENT_CAPITAL':
      return 'INSUFFICIENT_CAPITAL';
    case 'LIVE_GATE_BLOCKED':
      return 'LIVE_GATE_BLOCKED';
    default:
      return 'INVALID_TRANSITION';
  }
}

export { expectedSettlementDate, resolveAssetClass, ASSET_CLASS_SETTLEMENT_RULES };
