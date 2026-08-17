import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type FeeState = {
  readonly reservedTotal: number;
  readonly outstanding: number;
  readonly charged: number;
  readonly released: number;
  readonly burned: number;
  readonly sink: number;
  readonly rewards: number;
  readonly treasury: number;
};

export function createFeeModel(bounds: FormalModelBounds): FormalModel<FeeState> {
  const max = bounds.maxQuantity ?? 2;
  return {
    modelId: 'FEE_CONSERVATION',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({
      reservedTotal: 0,
      outstanding: 0,
      charged: 0,
      released: 0,
      burned: 0,
      sink: 0,
      rewards: 0,
      treasury: 0,
    }),
    next: (state) => {
      const out: Transition<FeeState>[] = [];
      if (state.reservedTotal < max) {
        out.push({
          name: 'Reserve',
          next: { ...state, reservedTotal: state.reservedTotal + 1, outstanding: state.outstanding + 1 },
        });
      }
      if (state.outstanding > 0) {
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
          name: 'ChargeSink',
          next: {
            ...state,
            outstanding: state.outstanding - 1,
            charged: state.charged + 1,
            sink: state.sink + 1,
          },
        });
        out.push({
          name: 'ChargeReward',
          next: {
            ...state,
            outstanding: state.outstanding - 1,
            charged: state.charged + 1,
            rewards: state.rewards + 1,
          },
        });
        out.push({
          name: 'Release',
          next: { ...state, outstanding: state.outstanding - 1, released: state.released + 1 },
        });
      }
      out.push({ name: 'CreateFeeQuantity', next: null });
      return out;
    },
    key: (state) =>
      `${state.reservedTotal},${state.outstanding},${state.charged},${state.released},${state.burned},${state.sink},${state.rewards}`,
    invariants: {
      RESERVED_EQUALS_CHARGED_PLUS_RELEASED: (state) =>
        state.outstanding + state.charged + state.released === state.reservedTotal,
      FEE_IDENTITY: (state) =>
        state.charged === state.burned + state.sink + state.rewards + state.treasury,
      NO_CREATED_QUANTITY: (state) =>
        state.burned + state.sink + state.rewards + state.treasury === state.charged,
    },
  };
}
