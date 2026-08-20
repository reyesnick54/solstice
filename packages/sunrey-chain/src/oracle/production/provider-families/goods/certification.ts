/**
 * Goods / commerce certification fixtures.
 *
 * Valid cases satisfy admission-shaped engineering checks.
 * Invalid cases stay refused. Certification does not mint.
 */

import { ingestGoodsObservation } from './adapter.ts';
import { evaluateLogisticsGoodsDeliveryAttribution, evaluateManufacturingGoodsAttribution } from './lineage.ts';
import {
  AGRICULTURE_GOODS_BATCH,
  CUSTOMER_PII_LEAK,
  FLOAT_QUANTITY,
  FORBIDDEN_REVENUE_FACT,
  IN_TRANSIT_DELIVERY,
  ITEM_COUNT_AS_MASS,
  ORDER_AS_OUTPUT,
  PAYMENT_AS_OUTPUT,
  PAYMENT_CARD_LEAK,
  SAME_CONTROLLER_QUORUM,
  SANDBOX_CARRIER_EVENT,
  SANDBOX_MFG_EVENT,
  SCHEMA_DRIFT,
  VALID_FINISHED_GOODS_BATCH,
  VALID_GOODS_DELIVERY,
} from './fixtures.ts';
import type { GoodsRefusal, GoodsSourceObservation } from './types.ts';

export type GoodsCertificationCase = {
  readonly caseId: string;
  readonly valid: boolean;
  readonly observation?: GoodsSourceObservation;
  readonly evaluate: () => { readonly ok: boolean; readonly code?: GoodsRefusal['code'] };
};

function fromIngest(observation: GoodsSourceObservation) {
  return () => {
    const result = ingestGoodsObservation(observation);
    return result.ok ? { ok: true } : { ok: false, code: result.error.code };
  };
}

export const VALID_GOODS_CERTIFICATION_CASES: readonly GoodsCertificationCase[] = Object.freeze([
  {
    caseId: 'finished-goods-batch',
    valid: true,
    observation: VALID_FINISHED_GOODS_BATCH,
    evaluate: fromIngest(VALID_FINISHED_GOODS_BATCH),
  },
  {
    caseId: 'goods-delivery',
    valid: true,
    observation: VALID_GOODS_DELIVERY,
    evaluate: fromIngest(VALID_GOODS_DELIVERY),
  },
  {
    caseId: 'agriculture-goods-batch',
    valid: true,
    observation: AGRICULTURE_GOODS_BATCH,
    evaluate: fromIngest(AGRICULTURE_GOODS_BATCH),
  },
]);

export const INVALID_GOODS_CERTIFICATION_CASES: readonly GoodsCertificationCase[] = Object.freeze([
  {
    caseId: 'order-treated-as-output',
    valid: false,
    observation: ORDER_AS_OUTPUT,
    evaluate: fromIngest(ORDER_AS_OUTPUT),
  },
  {
    caseId: 'payment-treated-as-output',
    valid: false,
    observation: PAYMENT_AS_OUTPUT,
    evaluate: fromIngest(PAYMENT_AS_OUTPUT),
  },
  {
    caseId: 'manufacturing-plus-goods-double-count',
    valid: false,
    evaluate: () => {
      const result = evaluateManufacturingGoodsAttribution(SANDBOX_MFG_EVENT, VALID_FINISHED_GOODS_BATCH);
      if (!result.ok) {
        return { ok: false, code: result.error.code };
      }
      const full = result.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
      return full > 1
        ? { ok: true }
        : { ok: false, code: 'MANUFACTURING_GOODS_DOUBLE_COUNT' };
    },
  },
  {
    caseId: 'carrier-plus-goods-delivery-double-count',
    valid: false,
    evaluate: () => {
      const result = evaluateLogisticsGoodsDeliveryAttribution(SANDBOX_CARRIER_EVENT, VALID_GOODS_DELIVERY, false);
      if (!result.ok) {
        return { ok: false, code: result.error.code };
      }
      const full = result.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
      return full > 1
        ? { ok: true }
        : { ok: false, code: 'CARRIER_GOODS_DELIVERY_DOUBLE_COUNT' };
    },
  },
  {
    caseId: 'in-transit-as-delivery',
    valid: false,
    observation: IN_TRANSIT_DELIVERY,
    evaluate: fromIngest(IN_TRANSIT_DELIVERY),
  },
  {
    caseId: 'customer-pii-leaked',
    valid: false,
    observation: CUSTOMER_PII_LEAK,
    evaluate: fromIngest(CUSTOMER_PII_LEAK),
  },
  {
    caseId: 'payment-credentials-leaked',
    valid: false,
    observation: PAYMENT_CARD_LEAK,
    evaluate: fromIngest(PAYMENT_CARD_LEAK),
  },
  {
    caseId: 'same-controller-fake-quorum',
    valid: false,
    observation: SAME_CONTROLLER_QUORUM,
    evaluate: fromIngest(SAME_CONTROLLER_QUORUM),
  },
  {
    caseId: 'float-quantity',
    valid: false,
    observation: FLOAT_QUANTITY,
    evaluate: fromIngest(FLOAT_QUANTITY),
  },
  {
    caseId: 'schema-drift',
    valid: false,
    observation: SCHEMA_DRIFT,
    evaluate: fromIngest(SCHEMA_DRIFT),
  },
  {
    caseId: 'item-count-as-mass',
    valid: false,
    observation: ITEM_COUNT_AS_MASS,
    evaluate: fromIngest(ITEM_COUNT_AS_MASS),
  },
  {
    caseId: 'revenue-fact',
    valid: false,
    observation: FORBIDDEN_REVENUE_FACT,
    evaluate: fromIngest(FORBIDDEN_REVENUE_FACT),
  },
]);

export function evaluateGoodsCertificationCase(caseId: string): { readonly ok: boolean; readonly code?: string } {
  const found = [...VALID_GOODS_CERTIFICATION_CASES, ...INVALID_GOODS_CERTIFICATION_CASES].find(
    (row) => row.caseId === caseId,
  );
  if (!found) {
    return { ok: false, code: 'SCHEMA_DRIFT' };
  }
  return found.evaluate();
}

export function certificationDoesNotMint(): false {
  return false;
}
