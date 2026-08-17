import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type AssetBook = {
  readonly issued: number;
  readonly burned: number;
  readonly circulating: number;
  readonly locked: number;
};

export type NativeAssetState = {
  readonly SUNREY_COIN: AssetBook;
  readonly MOONREY_COIN: AssetBook;
};

function conserved(book: AssetBook): boolean {
  return (
    book.issued - book.burned === book.circulating + book.locked &&
    book.issued >= 0 &&
    book.burned >= 0 &&
    book.circulating >= 0 &&
    book.locked >= 0
  );
}

const empty: AssetBook = { issued: 0, burned: 0, circulating: 0, locked: 0 };

export function createNativeAssetModel(bounds: FormalModelBounds): FormalModel<NativeAssetState> {
  const max = bounds.maxQuantity ?? 2;
  const assets = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
  return {
    modelId: 'NATIVE_ASSET_CONSERVATION',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({ SUNREY_COIN: empty, MOONREY_COIN: empty }),
    next: (state) => {
      const out: Transition<NativeAssetState>[] = [];
      for (const asset of assets) {
        const book = state[asset];
        if (book.issued < max) {
          out.push({
            name: `Issue(${asset})`,
            next: {
              ...state,
              [asset]: { ...book, issued: book.issued + 1, circulating: book.circulating + 1 },
            },
          });
        }
        if (book.circulating > 0) {
          out.push({
            name: `Transfer(${asset})`,
            next: state,
          });
          out.push({
            name: `Lock(${asset})`,
            next: {
              ...state,
              [asset]: { ...book, circulating: book.circulating - 1, locked: book.locked + 1 },
            },
          });
          out.push({
            name: `Burn(${asset})`,
            next: {
              ...state,
              [asset]: { ...book, circulating: book.circulating - 1, burned: book.burned + 1 },
            },
          });
        }
        if (book.locked > 0) {
          out.push({
            name: `Unlock(${asset})`,
            next: {
              ...state,
              [asset]: { ...book, locked: book.locked - 1, circulating: book.circulating + 1 },
            },
          });
        }
      }
      out.push({ name: 'CrossAssetCreate', next: null });
      out.push({ name: 'NegativeHolding', next: null });
      return out;
    },
    key: (state) =>
      `${state.SUNREY_COIN.issued},${state.SUNREY_COIN.burned},${state.SUNREY_COIN.circulating},${state.SUNREY_COIN.locked}|${state.MOONREY_COIN.issued},${state.MOONREY_COIN.burned},${state.MOONREY_COIN.circulating},${state.MOONREY_COIN.locked}`,
    invariants: {
      SUPPLY_IDENTITY: (state) => conserved(state.SUNREY_COIN) && conserved(state.MOONREY_COIN),
      NO_NEGATIVE_HOLDINGS: (state) =>
        state.SUNREY_COIN.circulating >= 0 && state.MOONREY_COIN.circulating >= 0,
    },
    actionProperties: {
      TRANSFER_CONSERVES: (before, action, after) =>
        !action.startsWith('Transfer(') ||
        (before.SUNREY_COIN.circulating + before.SUNREY_COIN.locked ===
          after.SUNREY_COIN.circulating + after.SUNREY_COIN.locked &&
          before.MOONREY_COIN.circulating + before.MOONREY_COIN.locked ===
            after.MOONREY_COIN.circulating + after.MOONREY_COIN.locked),
      LOCK_CONSERVES: (before, action, after) =>
        !action.startsWith('Lock(') ||
        before.SUNREY_COIN.issued - before.SUNREY_COIN.burned ===
          after.SUNREY_COIN.issued - after.SUNREY_COIN.burned,
      UNLOCK_CONSERVES: (before, action, after) =>
        !action.startsWith('Unlock(') ||
        before.SUNREY_COIN.issued - before.SUNREY_COIN.burned ===
          after.SUNREY_COIN.issued - after.SUNREY_COIN.burned,
      BURN_REDUCES_SUPPLY: (before, action, after) => {
        if (!action.startsWith('Burn(')) {
          return true;
        }
        const asset = action.includes('SUNREY') ? 'SUNREY_COIN' : 'MOONREY_COIN';
        return after[asset].burned === before[asset].burned + 1;
      },
      CROSS_ASSET_CANNOT_CREATE: (_before, action) => action !== 'CrossAssetCreate' || true,
    },
  };
}
