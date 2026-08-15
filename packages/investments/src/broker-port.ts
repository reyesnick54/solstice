import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { PaperOrder } from './order.ts';
import type { PaperFill } from './fill.ts';
import type { InstrumentPrice } from './price.ts';
import { notionalMoney } from './price.ts';
import { freezePaperFill } from './fill.ts';
import { asFillId } from './ids.ts';
import { Money } from '../../money/src/money.ts';

export type BrokerFailure = {
  readonly code:
    | 'ORDER_NOT_FOUND'
    | 'CANNOT_CANCEL'
    | 'UNKNOWN_INSTRUMENT'
    | 'BROKER_REJECTED'
    | 'AUTHORITY_FORBIDDEN';
  readonly message: string;
};

/**
 * Provider-neutral paper broker. Cannot issue Execution Authority.
 * No real broker SDK.
 */
export interface BrokerExecutionProvider {
  submitPaperOrder(order: PaperOrder): Result<PaperOrder, BrokerFailure>;
  cancelPaperOrder(order: PaperOrder): Result<PaperOrder, BrokerFailure>;
  queryPaperOrder(orderId: string): Result<PaperOrder, BrokerFailure>;
  produceDeterministicFill(input: {
    readonly order: PaperOrder;
    readonly price: InstrumentPrice;
    readonly fee: Money;
    readonly filledAt: UtcInstant;
  }): Result<PaperFill, BrokerFailure>;
}

export class PaperBrokerProvider implements BrokerExecutionProvider {
  private readonly orders = new Map<string, PaperOrder>();

  submitPaperOrder(order: PaperOrder): Result<PaperOrder, BrokerFailure> {
    if (order.simulation !== true) {
      return err({ code: 'BROKER_REJECTED', message: 'paper broker rejects non-simulation orders' });
    }
    this.orders.set(order.orderId, order);
    return ok(order);
  }

  cancelPaperOrder(order: PaperOrder): Result<PaperOrder, BrokerFailure> {
    const existing = this.orders.get(order.orderId);
    if (!existing) {
      return err({ code: 'ORDER_NOT_FOUND', message: 'paper order is unknown to the broker' });
    }
    if (existing.status === 'FILLED' || existing.status === 'CANCELLED' || existing.status === 'REJECTED') {
      return err({ code: 'CANNOT_CANCEL', message: `cannot cancel a ${existing.status} order` });
    }
    this.orders.set(order.orderId, order);
    return ok(order);
  }

  queryPaperOrder(orderId: string): Result<PaperOrder, BrokerFailure> {
    const existing = this.orders.get(orderId);
    if (!existing) {
      return err({ code: 'ORDER_NOT_FOUND', message: 'paper order is unknown to the broker' });
    }
    return ok(existing);
  }

  produceDeterministicFill(input: {
    readonly order: PaperOrder;
    readonly price: InstrumentPrice;
    readonly fee: Money;
    readonly filledAt: UtcInstant;
  }): Result<PaperFill, BrokerFailure> {
    const notional = notionalMoney(input.order.quantity, input.price);
    if (!notional.ok) {
      return err({ code: 'BROKER_REJECTED', message: notional.error.message });
    }
    const fill = freezePaperFill({
      fillId: asFillId(`fill_${input.order.orderId}`),
      orderId: input.order.orderId,
      instrumentId: input.order.instrumentId,
      side: input.order.side,
      quantity: input.order.quantity,
      price: input.price,
      grossNotional: notional.value,
      explicitFee: input.fee,
      filledAt: input.filledAt,
      providerFillRef: `paper:${input.order.orderId}`,
      simulation: true,
    });
    return ok(fill);
  }
}
