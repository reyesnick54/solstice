/**
 * Order lifecycle is commercial intent, not goods production.
 *
 * QUOTE, CART, ORDER_CREATED, ORDER_ACCEPTED, BACKORDER, and SCHEDULED
 * do not prove that goods were produced.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  ORDER_EQUALS_OUTPUT,
  ORDER_LIFECYCLE_STATES,
  type GoodsRefusal,
  type GoodsSourceObservation,
  type OrderLifecycleState,
} from './types.ts';

export function isOrderLifecycleState(value: string): value is OrderLifecycleState {
  return (ORDER_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export function orderIsNotGoodsOutput(observation: GoodsSourceObservation): Result<true, GoodsRefusal> {
  if (observation.orderState !== null && observation.factType === 'GOODS_OUTPUT') {
    const realized = observation.goodsState === 'ACCEPTED' || observation.goodsState === 'AVAILABLE' || observation.goodsState === 'FULFILLED';
    if (!realized) {
      return err({
        code: 'ORDER_IS_NOT_OUTPUT',
        detail: `order state ${observation.orderState} does not prove goods were produced`,
      });
    }
  }
  if (observation.cancelled && !observation.cancelledAfterRealization) {
    return err({
      code: 'CANCELLED_BEFORE_REALIZATION',
      detail: 'cancelled unfulfilled orders create no completed goods event',
    });
  }
  return ok(true);
}

export function orderEqualsOutput(): false {
  return ORDER_EQUALS_OUTPUT;
}
