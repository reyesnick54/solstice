import type { UtcInstant } from '../../domain/src/time.ts';
import type { InvestmentAccountId, InstrumentId, PaperOrderId } from './ids.ts';
import type { InvestmentQuantity } from './quantity.ts';
import type { InstrumentPrice } from './price.ts';
import { canTransitionOrder, type OrderSide, type PaperOrderStatus, type PaperOrderType } from './types.ts';

export type PaperOrder = {
  readonly orderId: PaperOrderId;
  readonly investmentAccountId: InvestmentAccountId;
  readonly instrumentId: InstrumentId;
  readonly side: OrderSide;
  readonly quantity: InvestmentQuantity;
  readonly filledQuantity: InvestmentQuantity;
  readonly orderType: PaperOrderType;
  readonly limitPrice: InstrumentPrice | null;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly status: PaperOrderStatus;
  readonly source: 'CUSTOMER' | 'GROWTH_MATERIALIZED' | 'AGENT_PROPOSAL_REFUSED';
  readonly idempotencyKey: string;
  readonly intentId: string;
  readonly simulation: true;
};

export function freezePaperOrder(order: PaperOrder): PaperOrder {
  if (order.side !== 'BUY' && order.side !== 'SELL') {
    throw new Error('only BUY and SELL are permitted; shorting is forbidden');
  }
  if (order.simulation !== true) {
    throw new Error('live orders are forbidden');
  }
  return Object.freeze({ ...order });
}

export function transitionPaperOrder(
  order: PaperOrder,
  next: PaperOrderStatus,
): PaperOrder {
  if (!canTransitionOrder(order.status, next)) {
    throw new Error(`illegal paper-order transition ${order.status} → ${next}`);
  }
  return freezePaperOrder({ ...order, status: next });
}
