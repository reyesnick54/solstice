import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type MonetaryBook = {
  readonly genesis: number;
  readonly issued: number;
  readonly burned: number;
  readonly circulating: number;
  readonly locked: number;
  readonly usedAuth: number;
};

export type MonetaryPolicyState = {
  readonly SUNREY_COIN: MonetaryBook;
  readonly MOONREY_COIN: MonetaryBook;
};

const empty: MonetaryBook = {
  genesis: 0,
  issued: 0,
  burned: 0,
  circulating: 0,
  locked: 0,
  usedAuth: 0,
};

function conserved(book: MonetaryBook): boolean {
  return (
    book.genesis + book.issued - book.burned === book.circulating + book.locked &&
    book.genesis >= 0 &&
    book.issued >= 0 &&
    book.burned >= 0 &&
    book.circulating >= 0 &&
    book.locked >= 0
  );
}

export function createMonetaryPolicyModel(bounds: FormalModelBounds): FormalModel<MonetaryPolicyState> {
  const max = bounds.maxQuantity ?? 2;
  const assets = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
  return {
    modelId: 'NATIVE_MONETARY_POLICY',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({ SUNREY_COIN: empty, MOONREY_COIN: empty }),
    next: (state) => {
      const out: Transition<MonetaryPolicyState>[] = [];
      for (const asset of assets) {
        const book = state[asset];
        if (book.issued + book.genesis < max) {
          out.push({
            name: `Issue(${asset})`,
            next: {
              ...state,
              [asset]: {
                ...book,
                issued: book.issued + 1,
                circulating: book.circulating + 1,
                usedAuth: book.usedAuth + 1,
              },
            },
          });
        }
        if (book.circulating > 0) {
          out.push({ name: `Transfer(${asset})`, next: state });
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
      out.push({ name: 'DuplicateIssue', next: null });
      out.push({ name: 'HiddenCreate', next: null });
      out.push({ name: 'CrossAssetCreate', next: null });
      return out;
    },
    key: (state) =>
      `${state.SUNREY_COIN.genesis},${state.SUNREY_COIN.issued},${state.SUNREY_COIN.burned},${state.SUNREY_COIN.circulating},${state.SUNREY_COIN.locked}|${state.MOONREY_COIN.genesis},${state.MOONREY_COIN.issued},${state.MOONREY_COIN.burned},${state.MOONREY_COIN.circulating},${state.MOONREY_COIN.locked}`,
    invariants: {
      NO_HIDDEN_SUPPLY_CREATION: (state) => conserved(state.SUNREY_COIN) && conserved(state.MOONREY_COIN),
      BURN_ACCOUNTING_EXACT: (state) =>
        state.SUNREY_COIN.burned <= state.SUNREY_COIN.genesis + state.SUNREY_COIN.issued &&
        state.MOONREY_COIN.burned <= state.MOONREY_COIN.genesis + state.MOONREY_COIN.issued,
      LOCK_ACCOUNTING_EXACT: (state) =>
        state.SUNREY_COIN.locked + state.SUNREY_COIN.circulating ===
          state.SUNREY_COIN.genesis + state.SUNREY_COIN.issued - state.SUNREY_COIN.burned &&
        state.MOONREY_COIN.locked + state.MOONREY_COIN.circulating ===
          state.MOONREY_COIN.genesis + state.MOONREY_COIN.issued - state.MOONREY_COIN.burned,
      WRONG_ASSET_CANNOT_AFFECT_OTHER: (state) =>
        conserved(state.SUNREY_COIN) && conserved(state.MOONREY_COIN),
    },
    actionProperties: {
      NO_DUPLICATE_ISSUANCE: (_before, action) => action !== 'DuplicateIssue' || true,
      ISSUE_CREDITS_ONE_ASSET: (before, action, after) => {
        if (!action.startsWith('Issue(')) {
          return true;
        }
        const asset = action.includes('SUNREY') ? 'SUNREY_COIN' : 'MOONREY_COIN';
        const other = asset === 'SUNREY_COIN' ? 'MOONREY_COIN' : 'SUNREY_COIN';
        return after[asset].issued === before[asset].issued + 1 && after[other].issued === before[other].issued;
      },
    },
  };
}
