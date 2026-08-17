/**
 * BASE_PRICE_FORMULA_V1 — bounded proportional control.
 *
 * Next price depends only on the previous finalized base price, the
 * previous finalized weighted resource usage, the governed target, and
 * the governed adjustment denominator / bounds.
 *
 *   target T = (L * targetUtilizationBps) / 10_000
 *   if U >= T:
 *     raw = (P * (U - T)) / (T * D)
 *     adj = min(raw, A)
 *     P' = min(P + adj, Pmax)
 *   else:
 *     raw = (P * (T - U)) / (T * D)
 *     adj = min(raw, A)
 *     P' = max(P - adj, Pmin)
 *
 * Inputs that are forbidden: external APIs, AI output, local clocks,
 * validator-local load, off-chain price feeds, wall-clock duration.
 */

import { commitCanonical } from '../../hash.ts';
import {
  checkedDiv,
  checkedMul,
  clampBig,
  minBig,
  UTILIZATION_BPS_DENOMINATOR,
} from './arithmetic.ts';
import { BASE_PRICE_DOMAIN, type AdaptivePriceBounds, type BaseResourcePriceState } from './types.ts';

export function targetUsage(bounds: AdaptivePriceBounds): bigint {
  return checkedDiv(
    checkedMul(bounds.blockResourceLimit, bounds.targetUtilizationBps, 'targetUsage'),
    UTILIZATION_BPS_DENOMINATOR,
    'targetUsage',
  );
}

export function utilizationBps(used: bigint, limit: bigint): bigint {
  if (limit === 0n) {
    return 0n;
  }
  return checkedDiv(checkedMul(used, UTILIZATION_BPS_DENOMINATOR, 'utilization'), limit, 'utilization');
}

export function validateAdaptivePriceBounds(bounds: AdaptivePriceBounds): string | null {
  if (bounds.minBasePrice <= 0n || bounds.maxBasePrice < bounds.minBasePrice) {
    return 'base price bounds are invalid';
  }
  if (bounds.maxOneBlockAdjustment <= 0n) {
    return 'max one-block adjustment must be positive';
  }
  if (bounds.adjustmentDenominator <= 0n) {
    return 'adjustment denominator must be positive';
  }
  if (bounds.targetUtilizationBps <= 0n || bounds.targetUtilizationBps > UTILIZATION_BPS_DENOMINATOR) {
    return 'target utilization must be in (0, 10000] bps';
  }
  if (bounds.blockResourceLimit <= 0n) {
    return 'block resource limit must be positive';
  }
  if (targetUsage(bounds) === 0n) {
    return 'target usage must be positive';
  }
  return null;
}

export function initialBaseResourcePriceState(
  bounds: AdaptivePriceBounds,
  initialPrice: bigint,
  height = 0,
): BaseResourcePriceState {
  const price = clampBig(initialPrice, bounds.minBasePrice, bounds.maxBasePrice);
  return Object.freeze({
    formulaVersion: 'BASE_PRICE_FORMULA_V1',
    height,
    baseResourcePrice: price,
    previousBaseResourcePrice: price,
    previousFinalizedUsage: 0n,
    targetUsage: targetUsage(bounds),
    utilizationBps: 0n,
    adjustment: 0n,
    pinnedToMinimum: price === bounds.minBasePrice,
    pinnedToMaximum: price === bounds.maxBasePrice,
  });
}

/**
 * Deterministic next-block base resource price.
 */
export function nextBaseResourcePrice(
  previous: BaseResourcePriceState,
  previousFinalizedUsage: bigint,
  bounds: AdaptivePriceBounds,
  nextHeight: number,
): BaseResourcePriceState {
  const invalid = validateAdaptivePriceBounds(bounds);
  if (invalid) {
    throw new TypeError(invalid);
  }
  if (previousFinalizedUsage < 0n) {
    throw new TypeError('previous finalized usage must be unsigned');
  }
  const T = targetUsage(bounds);
  const P = previous.baseResourcePrice;
  const U = previousFinalizedUsage;
  let nextPrice: bigint;
  let adjustment: bigint;
  if (U >= T) {
    const raw = checkedDiv(
      checkedMul(P, U - T, 'priceUp'),
      checkedMul(T, bounds.adjustmentDenominator, 'priceUpDenom'),
      'priceUp',
    );
    adjustment = minBig(raw, bounds.maxOneBlockAdjustment);
    nextPrice = P + adjustment > bounds.maxBasePrice ? bounds.maxBasePrice : P + adjustment;
  } else {
    const raw = checkedDiv(
      checkedMul(P, T - U, 'priceDown'),
      checkedMul(T, bounds.adjustmentDenominator, 'priceDownDenom'),
      'priceDown',
    );
    adjustment = minBig(raw, bounds.maxOneBlockAdjustment);
    nextPrice = P > adjustment ? P - adjustment : bounds.minBasePrice;
    if (nextPrice < bounds.minBasePrice) {
      nextPrice = bounds.minBasePrice;
    }
  }
  nextPrice = clampBig(nextPrice, bounds.minBasePrice, bounds.maxBasePrice);
  return Object.freeze({
    formulaVersion: 'BASE_PRICE_FORMULA_V1',
    height: nextHeight,
    baseResourcePrice: nextPrice,
    previousBaseResourcePrice: P,
    previousFinalizedUsage: U,
    targetUsage: T,
    utilizationBps: utilizationBps(U, bounds.blockResourceLimit),
    adjustment: nextPrice >= P ? nextPrice - P : P - nextPrice,
    pinnedToMinimum: nextPrice === bounds.minBasePrice,
    pinnedToMaximum: nextPrice === bounds.maxBasePrice,
  });
}

export function hashBaseResourcePriceState(state: BaseResourcePriceState): string {
  return commitCanonical({
    domain: BASE_PRICE_DOMAIN,
    formulaVersion: state.formulaVersion,
    height: state.height,
    baseResourcePrice: state.baseResourcePrice.toString(),
    previousBaseResourcePrice: state.previousBaseResourcePrice.toString(),
    previousFinalizedUsage: state.previousFinalizedUsage.toString(),
    targetUsage: state.targetUsage.toString(),
    utilizationBps: state.utilizationBps.toString(),
    adjustment: state.adjustment.toString(),
  });
}
