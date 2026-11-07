import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import {
  aggressiveLimitPriceMinor,
  assessChildWithRisk,
  childWithinParentIdentity,
  clampLimitToBounds,
  limitWithinAuthorizedBounds,
  notionalWithinAuthorization,
  parentFromInput,
  participationWithinCeiling,
  passiveLimitPriceMinor,
  referencePriceMinor,
  validateParentRegistration,
  withinValidityEnvelope,
} from './bounds.ts';
import { childOrderIdFor, parentOrderIdFor } from './ids.ts';
import { algorithmKindUsesLimit, buildExecutionSchedule } from './schedule.ts';
import type { ExecutionAlgorithmViolationCode, MarketDataUntrustedPolicy } from './taxonomy.ts';
import type { ExecutionSchedule } from './types.ts';
import type {
  AlgorithmMarketContext,
  AlgorithmRiskPort,
  AlgorithmTickResult,
  ApplyFillInput,
  ChildOrder,
  ExecutionAlgorithmState,
  ParentOrder,
  RegisterParentOrderInput,
  RegisterParentResult,
  ReplaceChildInput,
  ReplaceChildResult,
} from './types.ts';
import type { ExecutionAlgorithmStore } from './store.ts';

const defaultUntrustedPolicy: MarketDataUntrustedPolicy = 'CANCEL_OPEN_CHILDREN';

export const HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS = 'HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS' as const;

export type BoundedExecutionAlgorithmEngineOptions = {
  readonly store: ExecutionAlgorithmStore;
  readonly untrustedPolicy?: MarketDataUntrustedPolicy;
};

function initialState(
  parent: ParentOrder,
  schedule: ExecutionSchedule,
  now: UtcInstant,
  policy: MarketDataUntrustedPolicy,
): ExecutionAlgorithmState {
  const scheduledQuantityUnits = schedule.slices.reduce((acc, row) => acc + row.quantityUnits, 0n);
  return Object.freeze({
    parentOrderId: parent.parentOrderId,
    scheduleId: schedule.scheduleId,
    algorithmKind: parent.algorithmKind,
    mode: 'ACTIVE',
    filledQuantityUnits: 0n,
    remainingQuantityUnits: parent.authorizedQuantityUnits,
    scheduledQuantityUnits,
    workingChildCount: 0,
    openChildOrderIds: Object.freeze([]),
    marketDataTrust: 'TRUSTED',
    untrustedPolicy: policy,
    updatedAt: now,
    grantsExecutionAuthority: false,
  });
}

function limitForChild(parent: ParentOrder, market: AlgorithmMarketContext): bigint | null {
  switch (parent.algorithmKind) {
    case 'MARKET':
      return null;
    case 'LIMIT':
      return clampLimitToBounds(parent, referencePriceMinor(parent, market));
    case 'PASSIVE_LIMIT': {
      const passive = passiveLimitPriceMinor(parent, market);
      return passive != null ? clampLimitToBounds(parent, passive) : null;
    }
    case 'AGGRESSIVE_LIMIT': {
      const aggressive = aggressiveLimitPriceMinor(parent, market);
      return aggressive != null ? clampLimitToBounds(parent, aggressive) : null;
    }
    default:
      return clampLimitToBounds(parent, referencePriceMinor(parent, market));
  }
}

function filledNotionalMinor(parent: ParentOrder, state: ExecutionAlgorithmState, children: readonly ChildOrder[]): bigint {
  let total = 0n;
  const scale = 10n ** BigInt(parent.quantityScale);
  for (const child of children) {
    if (child.filledQuantityUnits <= 0n) {
      continue;
    }
    const price = child.limitPriceMinor ?? parent.limitConstraints.referenceArrivalPriceMinor;
    total += (price * child.filledQuantityUnits) / scale;
  }
  if (state.filledQuantityUnits > 0n && total === 0n) {
    total =
      (parent.limitConstraints.referenceArrivalPriceMinor * state.filledQuantityUnits) / scale;
  }
  return total;
}

function validateLivePosture(): RegisterParentResult | null {
  if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
    return {
      ok: false,
      code: 'PARENT_NOT_GOVERNED',
      message: 'bounded execution algorithms remain simulation-gated',
    };
  }
  return null;
}

export class BoundedExecutionAlgorithmEngine {
  readonly #store: ExecutionAlgorithmStore;
  readonly #untrustedPolicy: MarketDataUntrustedPolicy;

  constructor(options: BoundedExecutionAlgorithmEngineOptions) {
    this.#store = options.store;
    this.#untrustedPolicy = options.untrustedPolicy ?? defaultUntrustedPolicy;
  }

  registerParent(input: RegisterParentOrderInput): RegisterParentResult {
    const live = validateLivePosture();
    if (live != null) {
      return live;
    }
    const violation = validateParentRegistration(input);
    if (violation != null) {
      return { ok: false, code: violation, message: violation };
    }
    const parentOrderId = parentOrderIdFor(`${input.requestId}:${input.instrumentId}:${input.side}`);
    const parent = parentFromInput(input, parentOrderId);
    const schedule = buildExecutionSchedule({
      parent,
      createdAt: input.now,
      intervalVolumeUnits: 0n,
    });
    const state = initialState(parent, schedule, input.now, this.#untrustedPolicy);
    const workingParent: ParentOrder = Object.freeze({ ...parent, status: 'WORKING' });
    this.#store.putParent(workingParent);
    this.#store.putSchedule(schedule);
    this.#store.putState(state);
    return { ok: true, parent: workingParent, schedule, state };
  }

  handleMarketTrustChange(
    parentOrderId: ParentOrder['parentOrderId'],
    trust: AlgorithmMarketContext['authoritativeTrust'],
    now: UtcInstant,
  ): AlgorithmTickResult {
    const parent = this.#store.getParent(parentOrderId);
    const state = this.#store.getState(parentOrderId);
    if (parent == null || state == null) {
      throw new Error('parent not registered');
    }
    if (trust === 'TRUSTED') {
      const nextState: ExecutionAlgorithmState = Object.freeze({
        ...state,
        marketDataTrust: 'TRUSTED',
        mode: state.mode === 'CANCEL_ONLY' ? 'CANCEL_ONLY' : 'ACTIVE',
        updatedAt: now,
      });
      this.#store.putState(nextState);
      return { state: nextState, releasedChildren: Object.freeze([]), canceledChildren: Object.freeze([]), violations: Object.freeze([]) };
    }
    let canceledChildren: ChildOrder[] = [];
    let mode: ExecutionAlgorithmState['mode'] = 'PAUSED_CHILD_GENERATION';
    let parentStatus: ParentOrder['status'] = 'PAUSED';
    if (state.untrustedPolicy === 'CANCEL_OPEN_CHILDREN') {
      const children = this.#store.listChildren(parentOrderId).filter(
        (row) => row.status === 'WORKING' || row.status === 'PARTIAL' || row.status === 'SCHEDULED',
      );
      canceledChildren = children.map((row) =>
        Object.freeze({
          ...row,
          status: 'CANCELED' as const,
          canceledAt: now,
        }),
      );
      for (const row of canceledChildren) {
        this.#store.putChild(row);
      }
      parentStatus = 'PAUSED';
    } else {
      mode = 'CANCEL_ONLY';
      parentStatus = 'CANCEL_ONLY';
    }
    const nextState: ExecutionAlgorithmState = Object.freeze({
      ...state,
      marketDataTrust: 'UNTRUSTED',
      mode,
      workingChildCount: 0,
      openChildOrderIds: Object.freeze([]),
      updatedAt: now,
    });
    this.#store.putState(nextState);
    this.#store.putParent(Object.freeze({ ...parent, status: parentStatus }));
    return {
      state: nextState,
      releasedChildren: Object.freeze([]),
      canceledChildren: Object.freeze(canceledChildren),
      violations: Object.freeze(['CHILD_GENERATION_PAUSED']),
    };
  }

  tick(
    parentOrderId: ParentOrder['parentOrderId'],
    market: AlgorithmMarketContext,
    risk: AlgorithmRiskPort,
  ): AlgorithmTickResult {
    const parent = this.#store.getParent(parentOrderId);
    const schedule = this.#store.getScheduleForParent(parentOrderId);
    let state = this.#store.getState(parentOrderId);
    if (parent == null || schedule == null || state == null) {
      throw new Error('parent not registered');
    }
    if (market.authoritativeTrust === 'UNTRUSTED' && state.marketDataTrust !== 'UNTRUSTED') {
      return this.handleMarketTrustChange(parentOrderId, 'UNTRUSTED', market.now);
    }
    const violations: ExecutionAlgorithmViolationCode[] = [];
    if (state.mode === 'PAUSED_CHILD_GENERATION') {
      return {
        state,
        releasedChildren: Object.freeze([]),
        canceledChildren: Object.freeze([]),
        violations: Object.freeze(['CHILD_GENERATION_PAUSED']),
      };
    }
    if (state.mode === 'CANCEL_ONLY') {
      return {
        state,
        releasedChildren: Object.freeze([]),
        canceledChildren: Object.freeze([]),
        violations: Object.freeze(['CANCEL_ONLY_MODE']),
      };
    }
    if (!withinValidityEnvelope(parent, market.now)) {
      const halted: ExecutionAlgorithmState = Object.freeze({
        ...state,
        mode: 'CANCEL_ONLY',
        updatedAt: market.now,
      });
      this.#store.putState(halted);
      this.#store.putParent(Object.freeze({ ...parent, status: 'HALTED' }));
      return {
        state: halted,
        releasedChildren: Object.freeze([]),
        canceledChildren: Object.freeze([]),
        violations: Object.freeze(['VALIDITY_ENVELOPE_EXCEEDED']),
      };
    }

    const existingChildren = this.#store.listChildren(parentOrderId);
    const released: ChildOrder[] = [];
    for (const slice of schedule.slices) {
      if (Date.parse(market.now) < Date.parse(slice.releaseAt)) {
        continue;
      }
      const already = existingChildren.some(
        (row) => row.sliceIndex === slice.sliceIndex && row.status !== 'CANCELED' && row.status !== 'REPLACED',
      );
      if (already) {
        continue;
      }
      if (state.remainingQuantityUnits <= 0n) {
        break;
      }
      const qty = slice.quantityUnits > state.remainingQuantityUnits ? state.remainingQuantityUnits : slice.quantityUnits;
      const identityViolation = childWithinParentIdentity(parent, {
        side: parent.side,
        instrumentId: parent.instrumentId,
        customerId: parent.customerId,
        quantityUnits: qty,
      }, state.filledQuantityUnits);
      if (identityViolation != null) {
        violations.push(identityViolation);
        continue;
      }
      const limitPrice = limitForChild(parent, market);
      const limitViolation = limitWithinAuthorizedBounds(parent, limitPrice);
      if (limitViolation != null) {
        violations.push(limitViolation);
        continue;
      }
      const participation = participationWithinCeiling(parent, qty, market.intervalVolumeUnits);
      if (!participation.ok) {
        violations.push(participation.code);
        continue;
      }
      const riskViolation = assessChildWithRisk(parent, qty, market.intervalVolumeUnits, participation.participationBps, risk);
      if (riskViolation != null) {
        violations.push(riskViolation);
        continue;
      }
      const priceForNotional = limitPrice ?? parent.limitConstraints.referenceArrivalPriceMinor;
      const notionalViolation = notionalWithinAuthorization(
        parent,
        priceForNotional,
        qty,
        filledNotionalMinor(parent, state, existingChildren),
      );
      if (notionalViolation != null) {
        violations.push(notionalViolation);
        continue;
      }

      const childId = childOrderIdFor(`${parent.parentOrderId}:${slice.sliceIndex}:${qty}`);
      const child: ChildOrder = Object.freeze({
        childOrderId: childId,
        parentOrderId: parent.parentOrderId,
        scheduleId: schedule.scheduleId,
        sliceIndex: slice.sliceIndex,
        side: parent.side,
        instrumentId: parent.instrumentId,
        customerId: parent.customerId,
        quantityUnits: qty,
        limitPriceMinor: limitPrice,
        orderType: algorithmKindUsesLimit(parent.algorithmKind) ? 'LIMIT' : 'MARKET',
        status: 'WORKING',
        releaseAt: slice.releaseAt,
        workingAt: market.now,
        canceledAt: null,
        filledQuantityUnits: 0n,
        replacedByChildOrderId: null,
        grantsExecutionAuthority: false,
      });
      this.#store.putChild(child);
      released.push(child);
      state = Object.freeze({
        ...state,
        remainingQuantityUnits: state.remainingQuantityUnits - qty,
        scheduledQuantityUnits: state.scheduledQuantityUnits - qty,
        workingChildCount: state.workingChildCount + 1,
        openChildOrderIds: Object.freeze([...state.openChildOrderIds, child.childOrderId]),
        updatedAt: market.now,
      });
    }
    if (state.remainingQuantityUnits === 0n && state.workingChildCount === 0) {
      this.#store.putParent(Object.freeze({ ...parent, status: 'COMPLETED' }));
    }
    this.#store.putState(state);
    return {
      state,
      releasedChildren: Object.freeze(released),
      canceledChildren: Object.freeze([]),
      violations: Object.freeze(violations),
    };
  }

  replaceChild(input: ReplaceChildInput): ReplaceChildResult {
    const parent = this.#store.getParent(input.parentOrderId);
    const state = this.#store.getState(input.parentOrderId);
    const existing = this.#store.getChild(input.childOrderId);
    if (parent == null || state == null || existing == null) {
      return { ok: false, code: 'PARENT_NOT_GOVERNED', message: 'missing parent or child' };
    }
    if (state.mode === 'CANCEL_ONLY') {
      return { ok: false, code: 'CANCEL_ONLY_MODE', message: 'cancel-only mode active' };
    }
    const identityViolation = childWithinParentIdentity(
      parent,
      {
        side: existing.side,
        instrumentId: existing.instrumentId,
        customerId: existing.customerId,
        quantityUnits: input.newQuantityUnits,
      },
      state.filledQuantityUnits,
    );
    if (identityViolation != null) {
      return { ok: false, code: identityViolation, message: identityViolation };
    }
    const limitViolation = limitWithinAuthorizedBounds(parent, input.newLimitPriceMinor);
    if (limitViolation != null) {
      return { ok: false, code: limitViolation, message: limitViolation };
    }
    const participation = participationWithinCeiling(parent, input.newQuantityUnits, input.market.intervalVolumeUnits);
    if (!participation.ok) {
      return { ok: false, code: participation.code, message: participation.code };
    }
    const riskViolation = assessChildWithRisk(
      parent,
      input.newQuantityUnits,
      input.market.intervalVolumeUnits,
      participation.participationBps,
      input.risk,
    );
    if (riskViolation != null) {
      return { ok: false, code: riskViolation, message: riskViolation };
    }

    const replacementId = childOrderIdFor(`${existing.childOrderId}:replace:${input.now}`);
    const replacement: ChildOrder = Object.freeze({
      ...existing,
      childOrderId: replacementId,
      quantityUnits: input.newQuantityUnits,
      limitPriceMinor: input.newLimitPriceMinor,
      status: 'WORKING',
      workingAt: input.now,
      canceledAt: null,
      filledQuantityUnits: 0n,
      replacedByChildOrderId: null,
    });
    const replaced: ChildOrder = Object.freeze({
      ...existing,
      status: 'REPLACED',
      canceledAt: input.now,
      replacedByChildOrderId: replacementId,
    });
    this.#store.putChild(replaced);
    this.#store.putChild(replacement);
    const nextState: ExecutionAlgorithmState = Object.freeze({
      ...state,
      openChildOrderIds: Object.freeze([
        ...state.openChildOrderIds.filter((id) => id !== existing.childOrderId),
        replacementId,
      ]),
      updatedAt: input.now,
    });
    this.#store.putState(nextState);
    return { ok: true, replaced, replacement, state: nextState };
  }

  applyFill(input: ApplyFillInput): ExecutionAlgorithmState {
    const parent = this.#store.getParent(input.parentOrderId);
    const state = this.#store.getState(input.parentOrderId);
    const child = this.#store.getChild(input.childOrderId);
    if (parent == null || state == null || child == null) {
      throw new Error('missing parent, state, or child');
    }
    if (input.fillQuantityUnits > child.quantityUnits) {
      throw new Error('fill exceeds child quantity');
    }
    if (state.filledQuantityUnits + input.fillQuantityUnits > parent.authorizedQuantityUnits) {
      throw new Error('fill would exceed authorized parent quantity');
    }
    const filledChild: ChildOrder = Object.freeze({
      ...child,
      filledQuantityUnits: input.fillQuantityUnits,
      status: input.fillQuantityUnits === child.quantityUnits ? 'FILLED' : 'PARTIAL',
    });
    this.#store.putChild(filledChild);
    const open = state.openChildOrderIds.filter((id) => id !== child.childOrderId);
    const workingChildCount = filledChild.status === 'FILLED' ? state.workingChildCount - 1 : state.workingChildCount;
    const nextState: ExecutionAlgorithmState = Object.freeze({
      ...state,
      filledQuantityUnits: state.filledQuantityUnits + input.fillQuantityUnits,
      // Quantity was reserved from remaining at child release; fills only move parent filled, not remaining again.
      remainingQuantityUnits: state.remainingQuantityUnits,
      workingChildCount: workingChildCount < 0 ? 0 : workingChildCount,
      openChildOrderIds: Object.freeze(open),
      updatedAt: input.now,
    });
    this.#store.putState(nextState);
    if (nextState.remainingQuantityUnits === 0n && nextState.workingChildCount === 0) {
      this.#store.putParent(Object.freeze({ ...parent, status: 'COMPLETED' }));
    }
    return nextState;
  }
}

export function permissiveAlgorithmRiskPort(): AlgorithmRiskPort {
  return {
    assessParticipation() {
      return { ok: true };
    },
  };
}

export function refusingAlgorithmRiskPort(): AlgorithmRiskPort {
  return {
    assessParticipation() {
      return { ok: false, code: 'RISK_REFUSED', reason: 'participation refused by risk' };
    },
  };
}
