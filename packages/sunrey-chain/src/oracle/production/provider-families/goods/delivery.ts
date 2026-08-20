/**
 * Merchant goods delivery completion.
 *
 * PICKED, PACKED, SHIPPED, and IN_TRANSIT are not final goods delivery.
 * Governed completion requires DELIVERED, RECEIVED, or ACCEPTED.
 *
 * A merchant GOODS_DELIVERY and a carrier DELIVERY_COMPLETION may refer
 * to the same physical delivery. They are not automatically both
 * full-credited. Independently measured transport can remain distinct.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  CARRIER_PLUS_GOODS_DELIVERY_DOUBLE_COUNT,
  isGoodsDeliveryCompleted,
  type GoodsRefusal,
  type GoodsSourceObservation,
} from './types.ts';

export type GoodsDeliveryDecision = {
  readonly completed: true;
  readonly fulfillmentState: NonNullable<GoodsSourceObservation['fulfillmentState']>;
  readonly carrierPlusGoodsDoubleCount: false;
};

export function evaluateGoodsDelivery(
  observation: GoodsSourceObservation,
): Result<GoodsDeliveryDecision, GoodsRefusal> {
  if (observation.factType !== 'GOODS_DELIVERY') {
    return err({ code: 'UNKNOWN_FACT_TYPE', detail: 'GOODS_DELIVERY evaluation requires GOODS_DELIVERY' });
  }
  if (observation.commercial.paymentPresent && !isGoodsDeliveryCompleted(observation.fulfillmentState)) {
    return err({
      code: 'PAYMENT_IS_NOT_OUTPUT',
      detail: 'payment does not prove delivery by itself',
    });
  }
  if (!isGoodsDeliveryCompleted(observation.fulfillmentState)) {
    return err({
      code: 'DELIVERY_NOT_COMPLETED',
      detail: `fulfillment state ${observation.fulfillmentState ?? 'missing'} is not DELIVERED, RECEIVED, or ACCEPTED`,
    });
  }
  return ok(
    Object.freeze({
      completed: true as const,
      fulfillmentState: observation.fulfillmentState!,
      carrierPlusGoodsDoubleCount: CARRIER_PLUS_GOODS_DELIVERY_DOUBLE_COUNT,
    }),
  );
}

export function inTransitIsNotGoodsDelivery(state: NonNullable<GoodsSourceObservation['fulfillmentState']>): boolean {
  return state === 'PICKED' || state === 'PACKED' || state === 'SHIPPED' || state === 'IN_TRANSIT';
}

export function carrierPlusGoodsDeliveryDoubleCount(): false {
  return CARRIER_PLUS_GOODS_DELIVERY_DOUBLE_COUNT;
}
