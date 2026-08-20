/**
 * Finished-goods output semantics.
 *
 * CREATED / REJECTED / RETURNED / DESTROYED do not authorize GOODS_OUTPUT.
 * Only policy-eligible realized states (ACCEPTED, AVAILABLE, FULFILLED)
 * may support productive goods output. Item counts are not converted
 * into mass without explicit product-specific evidence.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  isGoodsOutputEligible,
  isGoodsUnit,
  PAYMENT_EQUALS_PRODUCTIVE_OUTPUT,
  type GoodsRefusal,
  type GoodsSourceObservation,
} from './types.ts';

export function evaluateGoodsOutput(observation: GoodsSourceObservation): Result<{ readonly mantissa: bigint }, GoodsRefusal> {
  if (observation.factType !== 'GOODS_OUTPUT') {
    return err({ code: 'UNKNOWN_FACT_TYPE', detail: 'GOODS_OUTPUT evaluation requires GOODS_OUTPUT' });
  }
  if (observation.commercial.mapsRevenueToMoonRey || observation.commercial.mapsRevenueToGpuv) {
    return err({
      code: 'PRICE_IS_NOT_QUANTITY',
      detail: 'sales price and revenue are not productive quantity',
    });
  }
  if (observation.commercial.paymentPresent && !isGoodsOutputEligible(observation.goodsState)) {
    return err({
      code: 'PAYMENT_IS_NOT_OUTPUT',
      detail: 'payment authorization or settlement does not prove goods creation',
    });
  }
  if (observation.commercial.invoicePresent && !isGoodsOutputEligible(observation.goodsState)) {
    return err({
      code: 'INVOICE_IS_NOT_OUTPUT',
      detail: 'invoice issuance does not prove goods creation',
    });
  }
  if (!isGoodsOutputEligible(observation.goodsState)) {
    return err({
      code: 'GOODS_STATE_NOT_REALIZED',
      detail: `goods state ${observation.goodsState} is not a policy-eligible realized output state`,
    });
  }
  if (!isGoodsUnit(observation.unit)) {
    return err({ code: 'WRONG_UNIT', detail: `unit ${observation.unit} is not a goods unit` });
  }
  if ((observation.unit === 'kg' || observation.unit === 'tonne') === false && observation.productSpecificMassEvidence) {
    return err({
      code: 'ITEM_COUNT_TO_MASS_FORBIDDEN',
      detail: 'item counts cannot become mass without an explicit mass unit',
    });
  }
  if ((observation.unit === 'units_produced' || observation.unit === 'UNIT') && observation.extras?.massEquivalent) {
    return err({
      code: 'ITEM_COUNT_TO_MASS_FORBIDDEN',
      detail: 'do not convert item counts into mass without explicit product-specific evidence',
    });
  }
  const mantissa = /^[0-9]+$/.test(observation.numericValue) ? BigInt(observation.numericValue) : null;
  if (mantissa === null) {
    return err({ code: 'FLOAT_QUANTITY_FORBIDDEN', detail: 'goods quantity must be an integer mantissa' });
  }
  return ok({ mantissa });
}

export function paymentEqualsProductiveOutput(): false {
  return PAYMENT_EQUALS_PRODUCTIVE_OUTPUT;
}
