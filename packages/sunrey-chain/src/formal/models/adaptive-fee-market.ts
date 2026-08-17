import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type AdaptiveFeeState = {
  readonly price: number;
  readonly usage: number;
  readonly reserved: number;
  readonly outstanding: number;
  readonly charged: number;
  readonly released: number;
  readonly validator: number;
  readonly burned: number;
  readonly treasury: number;
  readonly policyVersion: number;
};

const MIN_PRICE = 1;
const MAX_PRICE = 3;
const TARGET = 1;
const DENOM = 2;
const MAX_ADJ = 1;

function nextPrice(price: number, usage: number): number {
  if (usage >= TARGET) {
    const raw = Math.floor((price * (usage - TARGET)) / (TARGET * DENOM));
    const adj = Math.min(raw, MAX_ADJ);
    return Math.min(price + adj, MAX_PRICE);
  }
  const raw = Math.floor((price * (TARGET - usage)) / (TARGET * DENOM));
  const adj = Math.min(raw, MAX_ADJ);
  return Math.max(price - adj, MIN_PRICE);
}

export function createAdaptiveFeeMarketModel(bounds: FormalModelBounds): FormalModel<AdaptiveFeeState> {
  const max = Math.min(bounds.maxQuantity ?? 2, 2);
  return {
    modelId: 'ADAPTIVE_FEE_MARKET',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({
      price: 2,
      usage: TARGET,
      reserved: 0,
      outstanding: 0,
      charged: 0,
      released: 0,
      validator: 0,
      burned: 0,
      treasury: 0,
      policyVersion: 2,
    }),
    next: (state) => {
      const out: Transition<AdaptiveFeeState>[] = [];
      if (state.usage !== 0) {
        out.push({
          name: 'UpdatePriceLow',
          next: { ...state, usage: 0, price: nextPrice(state.price, 0) },
        });
      }
      if (state.usage !== TARGET) {
        out.push({
          name: 'UpdatePriceTarget',
          next: { ...state, usage: TARGET, price: nextPrice(state.price, TARGET) },
        });
      }
      if (state.usage !== max) {
        out.push({
          name: 'UpdatePriceHigh',
          next: { ...state, usage: max, price: nextPrice(state.price, max) },
        });
      }
      if (state.reserved < max) {
        out.push({
          name: 'Reserve',
          next: { ...state, reserved: state.reserved + 1, outstanding: state.outstanding + 1 },
        });
      }
      if (state.outstanding > 0) {
        out.push({
          name: 'ChargeWithinMax',
          next: {
            ...state,
            outstanding: state.outstanding - 1,
            charged: state.charged + 1,
            validator: state.validator + 1,
          },
        });
        out.push({
          name: 'ChargeBurn',
          next: {
            ...state,
            outstanding: state.outstanding - 1,
            charged: state.charged + 1,
            burned: state.burned + 1,
          },
        });
        out.push({
          name: 'ChargeTreasury',
          next: {
            ...state,
            outstanding: state.outstanding - 1,
            charged: state.charged + 1,
            treasury: state.treasury + 1,
          },
        });
        out.push({
          name: 'Release',
          next: { ...state, outstanding: state.outstanding - 1, released: state.released + 1 },
        });
        out.push({
          name: 'RejectAboveMax',
          next: { ...state, outstanding: state.outstanding - 1, released: state.released + 1 },
        });
      }
      out.push({ name: 'CreateFeeQuantity', next: null });
      out.push({ name: 'DowngradePolicy', next: null });
      return out;
    },
    key: (state) =>
      `${state.price},${state.usage},${state.reserved},${state.outstanding},${state.charged},${state.released},${state.validator},${state.burned},${state.treasury},${state.policyVersion}`,
    invariants: {
      PRICE_WITHIN_BOUNDS: (state) => state.price >= MIN_PRICE && state.price <= MAX_PRICE,
      RESERVED_EQUALS_CHARGED_PLUS_RELEASED: (state) =>
        state.outstanding + state.charged + state.released === state.reserved,
      FEE_CONSERVATION: (state) =>
        state.charged === state.validator + state.burned + state.treasury,
      DISPOSITION_CONSERVATION: (state) =>
        state.validator + state.burned + state.treasury === state.charged,
      MAX_FEE_AUTHORIZATION: (state) => state.charged <= state.reserved,
      NO_CREATED_QUANTITY: (state) =>
        state.validator + state.burned + state.treasury === state.charged,
      POLICY_VERSION_DETERMINISTIC: (state) => state.policyVersion === 2,
    },
    actionProperties: {
      DETERMINISTIC_UPDATE: (before, action, after) => {
        if (!action.startsWith('UpdatePrice')) {
          return true;
        }
        return after.price === nextPrice(before.price, after.usage);
      },
    },
  };
}
