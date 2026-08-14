import type { Actor, UtcInstant } from '@solstice/domain';
import { assertKernelAuthorization, type KernelAuthorization } from '@solstice/kernel';
import type { Fill, Order } from './types.ts';

export const ALERT_TYPES = [
  'WASH_TRADING',
  'SPOOFING',
  'LAYERING',
  'SELF_TRADING',
  'ABNORMAL_VOLUME',
  'COORDINATED_ACCOUNTS',
  'PRICE_MANIPULATION',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export type SurveillanceAlert = {
  readonly id: string;
  readonly type: AlertType;
  readonly explanation: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly orderIds: readonly string[];
  readonly customerIds: readonly string[];
};

export type HumanEnforcementDecision = {
  readonly alertId: string;
  readonly reasonCode: string;
  readonly action: 'WARN' | 'SUSPEND' | 'REFER' | 'NO_ACTION';
  readonly decidedBy: string;
  readonly actorType: Actor['type'];
  readonly decidedAt: UtcInstant;
  readonly authorizationHash: string;
};

export type InvestigationNote = {
  readonly alertId: string;
  readonly note: string;
  readonly assistant: 'AI_ASSIST';
  readonly irreversible: false;
};

function samePriceQty(a: Fill, b: Fill): boolean {
  return a.price === b.price && a.quantity === b.quantity;
}

export function detectWashTrading(fills: readonly Fill[], groups: Readonly<Record<string, string>>): SurveillanceAlert[] {
  const alerts: SurveillanceAlert[] = [];
  for (let i = 0; i < fills.length; i += 1) {
    const a = fills[i]!;
    for (let j = i + 1; j < fills.length; j += 1) {
      const b = fills[j]!;
      const reversed =
        a.buyCustomerId === b.sellCustomerId && a.sellCustomerId === b.buyCustomerId && samePriceQty(a, b);
      const grouped =
        groups[a.buyCustomerId] !== undefined &&
        groups[a.buyCustomerId] === groups[a.sellCustomerId];
      if (reversed || grouped) {
        alerts.push(
          Object.freeze({
            id: `alert_wash_${a.id}_${b.id}`,
            type: 'WASH_TRADING',
            explanation:
              'Opposite fills between the same pair of accounts at the same price and quantity, or a shared coordination group on both sides',
            evidence: Object.freeze({
              fillA: a.id,
              fillB: b.id,
              price: a.price.toString(),
              quantity: a.quantity.toString(),
              reversed,
              coordinationGroup: groups[a.buyCustomerId],
            }),
            orderIds: Object.freeze([a.buyOrderId, a.sellOrderId, b.buyOrderId, b.sellOrderId]),
            customerIds: Object.freeze([a.buyCustomerId, a.sellCustomerId]),
          }),
        );
      }
    }
  }
  return alerts;
}

export function detectSpoofing(orders: readonly Order[], fills: readonly Fill[]): SurveillanceAlert[] {
  const alerts: SurveillanceAlert[] = [];
  const cancelled = orders.filter((order) => order.state === 'CANCELLED' && order.type === 'LIMIT');
  for (const spoof of cancelled) {
    if (spoof.quantity < 500n) continue;
    const later = fills.find(
      (fill) =>
        fill.sequence > 0 &&
        fill.occurredAt >= spoof.createdAt &&
        (fill.buyCustomerId === spoof.customerId || fill.sellCustomerId === spoof.customerId) &&
        ((spoof.side === 'SELL' && fill.buyCustomerId === spoof.customerId) ||
          (spoof.side === 'BUY' && fill.sellCustomerId === spoof.customerId)),
    );
    if (later) {
      alerts.push(
        Object.freeze({
          id: `alert_spoof_${spoof.id}`,
          type: 'SPOOFING',
          explanation:
            'A large limit order was cancelled unfilled, then the same customer traded aggressively on the opposite side',
          evidence: Object.freeze({
            cancelledOrderId: spoof.id,
            cancelledSide: spoof.side,
            cancelledQuantity: spoof.quantity.toString(),
            subsequentFillId: later.id,
            subsequentTaker: later.takerOrderId,
          }),
          orderIds: Object.freeze([spoof.id, later.takerOrderId]),
          customerIds: Object.freeze([spoof.customerId]),
        }),
      );
    }
  }
  return alerts;
}

export function detectLayering(orders: readonly Order[], fills: readonly Fill[]): SurveillanceAlert[] {
  const alerts: SurveillanceAlert[] = [];
  const byCustomer = new Map<string, Order[]>();
  for (const order of orders) {
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  }
  for (const [customerId, list] of byCustomer) {
    const cancelledSameSide = list.filter((order) => order.state === 'CANCELLED' && order.type === 'LIMIT');
    if (cancelledSameSide.length < 3) continue;
    const side = cancelledSameSide[0]!.side;
    if (!cancelledSameSide.every((order) => order.side === side)) continue;
    const aggressive = fills.find(
      (fill) =>
        (side === 'BUY' && fill.sellCustomerId === customerId) ||
        (side === 'SELL' && fill.buyCustomerId === customerId),
    );
    if (aggressive) {
      alerts.push(
        Object.freeze({
          id: `alert_layer_${customerId}`,
          type: 'LAYERING',
          explanation:
            'Three or more same-side limit orders were cancelled, then the customer took liquidity on the opposite side',
          evidence: Object.freeze({
            cancelledOrderIds: cancelledSameSide.map((order) => order.id),
            layeredSide: side,
            oppositeFillId: aggressive.id,
          }),
          orderIds: Object.freeze([...cancelledSameSide.map((order) => order.id), aggressive.takerOrderId]),
          customerIds: Object.freeze([customerId]),
        }),
      );
    }
  }
  return alerts;
}

export function detectSelfTrading(fills: readonly Fill[]): SurveillanceAlert[] {
  return fills
    .filter((fill) => fill.buyCustomerId === fill.sellCustomerId)
    .map((fill) =>
      Object.freeze({
        id: `alert_self_${fill.id}`,
        type: 'SELF_TRADING' as const,
        explanation: 'A print has the same customer on both sides',
        evidence: Object.freeze({ fillId: fill.id, customerId: fill.buyCustomerId }),
        orderIds: Object.freeze([fill.buyOrderId, fill.sellOrderId]),
        customerIds: Object.freeze([fill.buyCustomerId]),
      }),
    );
}

export function detectAbnormalVolume(fills: readonly Fill[]): SurveillanceAlert[] {
  if (fills.length === 0) return [];
  const volumes = fills.map((fill) => fill.quantity).slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = volumes[Math.floor(volumes.length / 2)]!;
  const alerts: SurveillanceAlert[] = [];
  for (const fill of fills) {
    if (median > 0n && fill.quantity >= median * 10n) {
      alerts.push(
        Object.freeze({
          id: `alert_vol_${fill.id}`,
          type: 'ABNORMAL_VOLUME',
          explanation: 'Fill quantity is at least ten times the median print size in this series',
          evidence: Object.freeze({
            fillId: fill.id,
            quantity: fill.quantity.toString(),
            median: median.toString(),
          }),
          orderIds: Object.freeze([fill.buyOrderId, fill.sellOrderId]),
          customerIds: Object.freeze([fill.buyCustomerId, fill.sellCustomerId]),
        }),
      );
    }
  }
  return alerts;
}

export function detectCoordinatedAccounts(
  fills: readonly Fill[],
  groups: Readonly<Record<string, string>>,
): SurveillanceAlert[] {
  const alerts: SurveillanceAlert[] = [];
  for (const fill of fills) {
    const gBuy = groups[fill.buyCustomerId];
    const gSell = groups[fill.sellCustomerId];
    if (gBuy && gBuy === gSell) {
      alerts.push(
        Object.freeze({
          id: `alert_coord_${fill.id}`,
          type: 'COORDINATED_ACCOUNTS',
          explanation: 'Both sides of the print belong to the same recorded coordination group',
          evidence: Object.freeze({
            fillId: fill.id,
            group: gBuy,
            buyCustomerId: fill.buyCustomerId,
            sellCustomerId: fill.sellCustomerId,
          }),
          orderIds: Object.freeze([fill.buyOrderId, fill.sellOrderId]),
          customerIds: Object.freeze([fill.buyCustomerId, fill.sellCustomerId]),
        }),
      );
    }
  }
  return alerts;
}

export function detectPriceManipulation(fills: readonly Fill[]): SurveillanceAlert[] {
  if (fills.length < 3) return [];
  const alerts: SurveillanceAlert[] = [];
  const first = fills[0]!;
  const mid = fills[Math.floor(fills.length / 2)]!;
  const last = fills[fills.length - 1]!;
  const up = mid.price > first.price && last.price <= first.price;
  const down = mid.price < first.price && last.price >= first.price;
  if (up || down) {
    alerts.push(
      Object.freeze({
        id: `alert_px_${first.id}_${last.id}`,
        type: 'PRICE_MANIPULATION',
        explanation:
          'A deterministic price pulse: prints moved the price then reversed toward the starting print',
        evidence: Object.freeze({
          startPrice: first.price.toString(),
          peakPrice: mid.price.toString(),
          endPrice: last.price.toString(),
          direction: up ? 'UP_THEN_REVERT' : 'DOWN_THEN_REVERT',
        }),
        orderIds: Object.freeze(fills.map((fill) => fill.takerOrderId)),
        customerIds: Object.freeze([...new Set(fills.flatMap((fill) => [fill.buyCustomerId, fill.sellCustomerId]))]),
      }),
    );
  }
  return alerts;
}

export function runAllDetectors(
  orders: readonly Order[],
  fills: readonly Fill[],
  groups: Readonly<Record<string, string>> = {},
): readonly SurveillanceAlert[] {
  return Object.freeze([
    ...detectWashTrading(fills, groups),
    ...detectSpoofing(orders, fills),
    ...detectLayering(orders, fills),
    ...detectSelfTrading(fills),
    ...detectAbnormalVolume(fills),
    ...detectCoordinatedAccounts(fills, groups),
    ...detectPriceManipulation(fills),
  ]);
}

export class SurveillanceDesk {
  readonly #decisions: HumanEnforcementDecision[] = [];
  readonly #notes: InvestigationNote[] = [];

  /**
   * AI may draft a note. It cannot record enforcement.
   */
  draftInvestigationNote(alertId: string, note: string): InvestigationNote {
    const drafted: InvestigationNote = Object.freeze({
      alertId,
      note,
      assistant: 'AI_ASSIST',
      irreversible: false,
    });
    this.#notes.push(drafted);
    return drafted;
  }

  /**
   * @kernelGated
   * Irreversible enforcement requires a recorded human decision and a reason code.
   */
  recordEnforcementDecision(
    authorization: KernelAuthorization,
    actor: Actor,
    input: {
      readonly alertId: string;
      readonly reasonCode: string;
      readonly action: HumanEnforcementDecision['action'];
      readonly decidedAt: UtcInstant;
    },
  ): HumanEnforcementDecision {
    assertKernelAuthorization(authorization, 'RECORD_SURVEILLANCE_ENFORCEMENT');
    if (actor.type === 'AGENT') {
      throw new Error('AI alone must never take an irreversible enforcement action');
    }
    if (input.reasonCode.trim().length === 0) {
      throw new Error('Enforcement requires a recorded reason code');
    }
    const decision: HumanEnforcementDecision = Object.freeze({
      alertId: input.alertId,
      reasonCode: input.reasonCode,
      action: input.action,
      decidedBy: actor.id,
      actorType: actor.type,
      decidedAt: input.decidedAt,
      authorizationHash: authorization.permitHash,
    });
    this.#decisions.push(decision);
    return decision;
  }

  listDecisions(): readonly HumanEnforcementDecision[] {
    return this.#decisions.slice();
  }

  listNotes(): readonly InvestigationNote[] {
    return this.#notes.slice();
  }
}
