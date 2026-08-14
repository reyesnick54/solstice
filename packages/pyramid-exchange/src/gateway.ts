import {
  asActionIntentId,
  asIdempotencyKey,
  err,
  ok,
  type Actor,
  type Result,
  type UtcInstant,
} from '@solstice/domain';
import {
  freezeIntent,
  type ActionIntent,
  type ComplianceKernel,
  type KernelDecision,
} from '@solstice/kernel';
import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import { mintClearedOrder, type ClearedOrder } from './cleared-order.ts';
import type { KillSwitchBoard } from './kill-switch.ts';
import type { JurisdictionalAssetRegistry } from './registry.ts';
import type { EligibleCustomer, Order, OrderSide, OrderType, TimeInForce } from './types.ts';
import { PYR_USD } from './types.ts';

export type OrderRequest = {
  readonly id: string;
  readonly customerId: EligibleCustomer['customerId'];
  readonly pair?: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly quantity: bigint;
  readonly price?: bigint;
  readonly timeInForce?: TimeInForce;
  readonly actor: Actor;
  readonly occurredAt: UtcInstant;
  readonly coordinationGroup?: string;
  readonly sequence?: number;
};

export type GatewayRefusal = {
  readonly outcome: 'REFUSED';
  readonly reasons: readonly string[];
  readonly decision?: KernelDecision;
  readonly evidenceId?: string;
  readonly order: Order;
};

export type GatewayClearance = {
  readonly outcome: 'CLEARED';
  readonly cleared: ClearedOrder;
  readonly decision: KernelDecision;
};

/**
 * Every order is screened here BEFORE the book. A refusal never mints
 * a ClearedOrder, so the matching engine cannot accept it.
 */
export class ComplianceGateway {
  readonly #kernel: ComplianceKernel;
  readonly #registry: JurisdictionalAssetRegistry;
  readonly #kills: KillSwitchBoard;
  readonly #traders = new Map<string, EligibleCustomer>();
  readonly #dailyNotional = new Map<string, bigint>();

  constructor(kernel: ComplianceKernel, registry: JurisdictionalAssetRegistry, kills: KillSwitchBoard) {
    this.#kernel = kernel;
    this.#registry = registry;
    this.#kills = kills;
  }

  registerCustomer(customer: EligibleCustomer): void {
    this.#traders.set(customer.customerId, customer);
  }

  getCustomer(id: string): EligibleCustomer | undefined {
    return this.#traders.get(id);
  }

  submit(request: OrderRequest): Result<GatewayClearance, GatewayRefusal> {
    if (LIVE_EXCHANGE_ENABLED !== false) {
      throw new Error('LIVE_EXCHANGE_ENABLED must stay false');
    }
    const customer = this.#traders.get(request.customerId);
    const pair = request.pair ?? PYR_USD.symbol;
    const jurisdiction = customer?.jurisdiction ?? 'US';
    const order: Order = Object.freeze({
      id: request.id,
      customerId: request.customerId,
      customerName: customer?.name ?? 'UNKNOWN',
      jurisdiction,
      pair: PYR_USD,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      remaining: request.quantity,
      price: request.price,
      timeInForce: request.timeInForce ?? 'GTC',
      state: 'NEW',
      createdAt: request.occurredAt,
      updatedAt: request.occurredAt,
      sequence: request.sequence ?? 0,
      ...(request.coordinationGroup === undefined ? {} : { coordinationGroup: request.coordinationGroup }),
    });

    const checks: string[] = [];
    const refuse = (reasons: string[], decision?: KernelDecision): Result<GatewayClearance, GatewayRefusal> => {
      const refused: Order = Object.freeze({ ...order, state: 'REFUSED' as const });
      return err({
        outcome: 'REFUSED',
        reasons: Object.freeze(reasons),
        ...(decision === undefined ? {} : { decision }),
        ...(decision && 'evidence' in decision ? { evidenceId: String(decision.evidence.id) } : {}),
        order: refused,
      });
    };

    const halt = this.#kills.tradingHalted({
      pair,
      customerId: request.customerId,
      jurisdiction,
    });
    if (halt.halted) {
      return refuse([halt.reason]);
    }
    checks.push('kill_switch_clear');

    if (!customer || !customer.eligible) {
      return refuse(['customer is not eligible to trade']);
    }
    checks.push('customer_eligible');

    if (!this.#registry.isPairTradeable(jurisdiction, pair)) {
      const entry = this.#registry.getEntry(jurisdiction, pair);
      return refuse([
        `jurisdiction ${jurisdiction} does not have a recorded listing approval for ${pair} (status=${entry?.listingStatus ?? 'absent'})`,
      ]);
    }
    checks.push('registry_listed');

    if (request.quantity <= 0n) {
      return refuse(['quantity must be a positive bigint']);
    }
    if (request.type === 'LIMIT' && (request.price === undefined || request.price <= 0n)) {
      return refuse(['limit order requires a positive integer price']);
    }
    if (request.quantity > customer.perOrderLimit) {
      return refuse([`quantity ${request.quantity.toString()} exceeds per-order limit ${customer.perOrderLimit.toString()}`]);
    }
    checks.push('limits');

    const intent = this.#placeIntent(request, customer, pair);
    const evaluated = this.#kernel.evaluate(intent);
    if (!evaluated.ok) {
      return refuse([evaluated.error.message]);
    }
    if (evaluated.value.outcome !== 'AUTHORIZED') {
      const sealed = this.#kernel.vault.seal(
        {
          kind: 'exchange.order_refused',
          orderId: request.id,
          customerId: request.customerId,
          pair,
          reasons: evaluated.value.outcome === 'REFUSED' ? evaluated.value.reasons : ['kernel did not authorize'],
          posture: evaluated.value.posture,
        },
        request.occurredAt,
      );
      return err({
        outcome: 'REFUSED',
        reasons: Object.freeze(
          evaluated.value.outcome === 'REFUSED'
            ? evaluated.value.reasons.slice()
            : ['kernel did not authorize the order'],
        ),
        decision: evaluated.value,
        evidenceId: sealed.id,
        order: Object.freeze({ ...order, state: 'REFUSED' as const }),
      });
    }
    checks.push('kernel_authorized');
    checks.push('sanctions_screened');

    const cleared = mintClearedOrder(order, {
        clearanceId: `clr_${request.id}`,
        evidenceId: String(evaluated.value.evidence.id),
        authorization: evaluated.value.authorization,
        checks,
      },
    );
    return ok({
      outcome: 'CLEARED',
      cleared,
      decision: evaluated.value,
    });
  }

  #placeIntent(request: OrderRequest, customer: EligibleCustomer, pair: string): ActionIntent {
    const kind = request.type === 'CANCEL' ? 'CANCEL_ORDER' : 'PLACE_ORDER';
    if (kind === 'CANCEL_ORDER') {
      return freezeIntent({
        id: asActionIntentId(`int_${request.id}`),
        kind: 'CANCEL_ORDER',
        actor: request.actor,
        payload: {
          orderId: request.id,
          customerId: request.customerId,
          pair,
          jurisdiction: customer.jurisdiction,
        },
        idempotencyKey: asIdempotencyKey(`ord_${request.id}`),
        occurredAt: request.occurredAt,
        sourceJurisdiction: customer.jurisdiction,
      });
    }
    return freezeIntent({
      id: asActionIntentId(`int_${request.id}`),
      kind: 'PLACE_ORDER',
      actor: request.actor,
      payload: {
        orderId: request.id,
        customerId: request.customerId,
        pair,
        side: request.side,
        type: request.type === 'CANCEL' ? 'LIMIT' : request.type,
        quantity: request.quantity,
        ...(request.price === undefined ? {} : { price: request.price }),
        timeInForce: request.timeInForce ?? 'GTC',
        customerName: customer.name,
        jurisdiction: customer.jurisdiction,
      },
      idempotencyKey: asIdempotencyKey(`ord_${request.id}`),
      occurredAt: request.occurredAt,
      sourceJurisdiction: customer.jurisdiction,
    });
  }
}
