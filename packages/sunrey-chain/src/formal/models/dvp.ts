import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type DvpState = {
  readonly buyerSunreyReserved: number;
  readonly sellerMoonreyReserved: number;
  readonly buyerSunrey: number;
  readonly sellerSunrey: number;
  readonly buyerMoonrey: number;
  readonly sellerMoonrey: number;
  readonly feeBurned: number;
  readonly settled: boolean;
  readonly cancelled: boolean;
  readonly authorized: boolean;
};

export function createDvpModel(bounds: FormalModelBounds): FormalModel<DvpState> {
  const qty = Math.min(bounds.maxQuantity ?? 2, 2);
  return {
    modelId: 'EXCHANGE_ATOMIC_DVP',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: qty, maxOrders: 1 },
    init: () => ({
      buyerSunreyReserved: qty,
      sellerMoonreyReserved: qty,
      buyerSunrey: 0,
      sellerSunrey: 0,
      buyerMoonrey: 0,
      sellerMoonrey: 0,
      feeBurned: 0,
      settled: false,
      cancelled: false,
      authorized: true,
    }),
    next: (state) => {
      const out: Transition<DvpState>[] = [];
      if (state.authorized && !state.settled && !state.cancelled) {
        out.push({
          name: 'SettleAllLegs',
          next: {
            ...state,
            buyerSunreyReserved: 0,
            sellerMoonreyReserved: 0,
            sellerSunrey: state.buyerSunreyReserved,
            buyerMoonrey: state.sellerMoonreyReserved,
            settled: true,
            authorized: false,
          },
        });
        out.push({
          name: 'CancelRemainder',
          next: {
            ...state,
            buyerSunrey: state.buyerSunrey + state.buyerSunreyReserved,
            sellerMoonrey: state.sellerMoonrey + state.sellerMoonreyReserved,
            buyerSunreyReserved: 0,
            sellerMoonreyReserved: 0,
            cancelled: true,
            authorized: false,
          },
        });
        out.push({ name: 'SettleOneLegOnly', next: null });
      }
      if (state.settled || state.cancelled) {
        out.push({ name: 'SettleTwice', next: null });
        out.push({ name: 'SettleCancelledWithoutAuth', next: null });
      }
      return out;
    },
    key: (state) =>
      `${state.settled}|${state.cancelled}|${state.buyerSunreyReserved}|${state.sellerMoonreyReserved}|${state.sellerSunrey}|${state.buyerMoonrey}`,
    invariants: {
      ATOMIC_LEGS: (state) =>
        !state.settled ||
        (state.buyerSunreyReserved === 0 &&
          state.sellerMoonreyReserved === 0 &&
          state.sellerSunrey > 0 &&
          state.buyerMoonrey > 0),
      NO_DOUBLE_SETTLE: (state) => !(state.settled && state.cancelled),
      SETTLED_NOT_EXCEED_RESERVED: (state) =>
        state.sellerSunrey <= qty && state.buyerMoonrey <= qty,
      CANCELLED_REQUIRES_NEW_AUTH: (state) => !state.cancelled || !state.authorized,
      TOTAL_CONSERVED: (state) =>
        state.buyerSunreyReserved +
          state.sellerSunrey +
          state.buyerSunrey +
          state.feeBurned ===
          qty &&
        state.sellerMoonreyReserved + state.buyerMoonrey + state.sellerMoonrey === qty,
    },
  };
}
