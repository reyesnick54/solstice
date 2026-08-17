import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export const MODEL_INTEROP_ASSET = 'DEV_INTEROP_TEST_ASSET' as const;

export type InteropAssetState = {
  readonly assetId: typeof MODEL_INTEROP_ASSET;
  readonly circulating: number;
  readonly escrowed: number;
  readonly authorizedRemote: number;
  readonly definedTotal: number;
};

export function createInteropAssetModel(bounds: FormalModelBounds): FormalModel<InteropAssetState> {
  const total = Math.min(bounds.maxQuantity ?? 3, 3);
  return {
    modelId: 'INTEROP_ASSET_CONSERVATION',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: total },
    init: () => ({
      assetId: MODEL_INTEROP_ASSET,
      circulating: total,
      escrowed: 0,
      authorizedRemote: 0,
      definedTotal: total,
    }),
    next: (state) => {
      const out: Transition<InteropAssetState>[] = [];
      if (state.circulating > 0) {
        out.push({
          name: 'EscrowOutbound',
          next: {
            ...state,
            circulating: state.circulating - 1,
            escrowed: state.escrowed + 1,
          },
        });
      }
      if (state.escrowed > 0) {
        out.push({
          name: 'AuthorizeRemote',
          next: {
            ...state,
            escrowed: state.escrowed - 1,
            authorizedRemote: state.authorizedRemote + 1,
          },
        });
        out.push({
          name: 'RefundEscrow',
          next: {
            ...state,
            escrowed: state.escrowed - 1,
            circulating: state.circulating + 1,
          },
        });
      }
      if (state.authorizedRemote > 0) {
        out.push({
          name: 'RedeemRemote',
          next: {
            ...state,
            authorizedRemote: state.authorizedRemote - 1,
            circulating: state.circulating + 1,
          },
        });
      }
      out.push({ name: 'ActivateSunReyBridge', next: null });
      out.push({ name: 'ActivateMoonReyBridge', next: null });
      out.push({ name: 'ActivateFiatBridge', next: null });
      return out;
    },
    key: (state) => `${state.circulating},${state.escrowed},${state.authorizedRemote}`,
    invariants: {
      ACCOUNTING_BOUNDARY: (state) =>
        state.circulating + state.escrowed + state.authorizedRemote === state.definedTotal,
      DEV_ASSET_ONLY: (state) => state.assetId === MODEL_INTEROP_ASSET,
      NO_PRODUCTION_BRIDGE: () => true,
    },
  };
}
