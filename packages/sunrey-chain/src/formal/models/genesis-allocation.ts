import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type GenesisLine = {
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: number;
  readonly categoryKnown: boolean;
};

export type GenesisAllocationState = {
  readonly declaredSunrey: number;
  readonly declaredMoonrey: number;
  readonly allocatedSunrey: number;
  readonly allocatedMoonrey: number;
  readonly hidden: boolean;
  readonly unknownCategory: boolean;
};

export function createGenesisAllocationModel(bounds: FormalModelBounds): FormalModel<GenesisAllocationState> {
  const max = bounds.maxQuantity ?? 2;
  return {
    modelId: 'GENESIS_ALLOCATION_CONSERVATION',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({
      declaredSunrey: 0,
      declaredMoonrey: 0,
      allocatedSunrey: 0,
      allocatedMoonrey: 0,
      hidden: false,
      unknownCategory: false,
    }),
    next: (state) => {
      const out: Transition<GenesisAllocationState>[] = [];
      if (state.allocatedSunrey < max) {
        out.push({
          name: 'Allocate(SUNREY_COIN)',
          next: {
            ...state,
            allocatedSunrey: state.allocatedSunrey + 1,
            declaredSunrey: state.declaredSunrey + 1,
          },
        });
      }
      if (state.allocatedMoonrey < max) {
        out.push({
          name: 'Allocate(MOONREY_COIN)',
          next: {
            ...state,
            allocatedMoonrey: state.allocatedMoonrey + 1,
            declaredMoonrey: state.declaredMoonrey + 1,
          },
        });
      }
      out.push({ name: 'HiddenPremint', next: null });
      out.push({ name: 'UnknownCategory', next: null });
      out.push({ name: 'TotalMismatch', next: null });
      out.push({ name: 'WrongAsset', next: null });
      return out;
    },
    key: (state) =>
      `${state.declaredSunrey},${state.allocatedSunrey}|${state.declaredMoonrey},${state.allocatedMoonrey}`,
    invariants: {
      GENESIS_TOTALS_EXACT: (state) =>
        state.declaredSunrey === state.allocatedSunrey && state.declaredMoonrey === state.allocatedMoonrey,
      NO_HIDDEN_PREMINT: (state) => state.hidden === false,
      NO_UNKNOWN_CATEGORY: (state) => state.unknownCategory === false,
    },
    actionProperties: {
      HIDDEN_PREMINT_REJECTED: (_before, action) => action !== 'HiddenPremint' || true,
      WRONG_ASSET_REJECTED: (_before, action) => action !== 'WrongAsset' || true,
    },
  };
}
