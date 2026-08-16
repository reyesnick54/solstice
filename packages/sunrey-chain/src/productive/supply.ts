/**
 * MoonRey development supply. Integrates the Chunk 41 invariant:
 * issued − burned = current protocol holdings / locked supply.
 *
 * These are protocol-native simulation units. Ticker remains NOT_ASSIGNED.
 * This is not a second fiat ledger and not a customer-journal path.
 */

export type NativeAssetSupplyState = {
  readonly assetId: 'MOONREY_COIN';
  readonly issued: bigint;
  readonly burned: bigint;
  readonly locked: bigint;
  readonly holdings: bigint;
};

export function emptyMoonReySupply(): NativeAssetSupplyState {
  return Object.freeze({
    assetId: 'MOONREY_COIN',
    issued: 0n,
    burned: 0n,
    locked: 0n,
    holdings: 0n,
  });
}

export function applyIssuance(state: NativeAssetSupplyState, quantity: bigint): NativeAssetSupplyState {
  if (quantity <= 0n) {
    throw new TypeError('issuance quantity must be positive');
  }
  const issued = state.issued + quantity;
  const holdings = issued - state.burned;
  return Object.freeze({
    assetId: 'MOONREY_COIN',
    issued,
    burned: state.burned,
    locked: state.locked,
    holdings,
  });
}

export function applyBurn(state: NativeAssetSupplyState, quantity: bigint): NativeAssetSupplyState {
  if (quantity <= 0n || quantity > state.holdings) {
    throw new TypeError('burn quantity is outside holdings');
  }
  const burned = state.burned + quantity;
  return Object.freeze({
    assetId: 'MOONREY_COIN',
    issued: state.issued,
    burned,
    locked: state.locked,
    holdings: state.issued - burned,
  });
}

export function supplyReconciles(state: NativeAssetSupplyState): boolean {
  return state.holdings === state.issued - state.burned && state.locked <= state.holdings;
}
