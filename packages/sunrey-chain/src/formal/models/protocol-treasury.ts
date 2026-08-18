import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type ProtocolTreasuryState = {
  readonly supply: number;
  readonly available: number;
  readonly reserved: number;
  readonly authorized: number;
  readonly disbursed: number;
  readonly customer: number;
  readonly governance: number;
};

export function createProtocolTreasuryModel(bounds: FormalModelBounds): FormalModel<ProtocolTreasuryState> {
  const max = Math.min(bounds.maxQuantity ?? 2, 2);
  return {
    modelId: 'PROTOCOL_TREASURY',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({
      supply: max,
      available: max,
      reserved: 0,
      authorized: max,
      disbursed: 0,
      customer: max,
      governance: 1,
    }),
    next: (state) => {
      const out: Transition<ProtocolTreasuryState>[] = [];
      if (state.governance === 1 && state.authorized > state.reserved + state.disbursed && state.available > 0) {
        out.push({
          name: 'Reserve',
          next: {
            ...state,
            available: state.available - 1,
            reserved: state.reserved + 1,
          },
        });
      }
      if (state.governance === 1 && state.reserved > 0) {
        out.push({
          name: 'Finalize',
          next: {
            ...state,
            reserved: state.reserved - 1,
            disbursed: state.disbursed + 1,
          },
        });
        out.push({
          name: 'CancelReservation',
          next: {
            ...state,
            reserved: state.reserved - 1,
            available: state.available + 1,
          },
        });
      }
      out.push({ name: 'TreasuryMint', next: null });
      out.push({ name: 'DoubleSpendReserved', next: null });
      out.push({ name: 'UnauthorizedSpend', next: null });
      out.push({ name: 'TouchCustomerAssets', next: null });
      return out;
    },
    key: (state) =>
      `${state.supply},${state.available},${state.reserved},${state.authorized},${state.disbursed},${state.customer},${state.governance}`,
    invariants: {
      TREASURY_CANNOT_CREATE_NATIVE_SUPPLY: (state) =>
        state.available + state.reserved + state.disbursed === state.supply && state.supply === max,
      RESERVED_QUANTITY_CANNOT_BE_DOUBLE_SPENT: (state) =>
        state.reserved >= 0 && state.available >= 0 && state.disbursed >= 0,
      FINALIZED_DISBURSEMENT_LEQ_AUTHORIZED: (state) => state.disbursed <= state.authorized,
      CANCELLED_RESERVATION_RELEASES: (state) =>
        state.available + state.reserved + state.disbursed === state.supply,
      CUSTOMER_ASSETS_UNAFFECTED: (state) => state.customer === max,
      UNAUTHORIZED_GOVERNANCE_CANNOT_SPEND: (state) => state.governance === 1,
    },
    actionProperties: {
      RESERVE_MOVES_ONE: (before, action, after) => {
        if (action !== 'Reserve') {
          return true;
        }
        return after.reserved === before.reserved + 1 && after.available === before.available - 1;
      },
      CANCEL_RELEASES_ONE: (before, action, after) => {
        if (action !== 'CancelReservation') {
          return true;
        }
        return after.available === before.available + 1 && after.reserved === before.reserved - 1;
      },
    },
  };
}
