/**
 * Wave 2 deterministic canonical protocol state machine.
 */

export {
  CANONICAL_STATE_SCHEMA_VERSION,
  NATIVE_MONETARY_OPERATIONS,
} from './types.ts';
export type {
  CanonicalAccountNonce,
  CanonicalAccountPosition,
  CanonicalProtocolState,
  CanonicalSupplyBook,
  NativeMonetaryOperation,
  StateTransitionRejection,
  StateTransitionResult,
  SupplyReconciliationFailure,
  SupplyReconciliationReport,
  ValidatedNativeTransaction,
} from './types.ts';

export { bookFromCanonical, bookToCanonical, booksFromCanonicalSupplies, canonicalSuppliesFromBooks } from './books.ts';
export { decodeCanonicalState, encodeCanonicalState } from './serialization.ts';
export {
  MONETARY_STATE_HASH_DOMAIN,
  monetaryStateRoot,
  monetaryStateRootWithContext,
  simulationMonetaryStateRoot,
  stateFingerprint,
  verifyMonetaryStateRoot,
} from './hash.ts';
export { cloneCanonicalState, createGenesisState } from './genesis.ts';
export type { GenesisStateInput } from './genesis.ts';
export { assertCanonicalStateReconciles, canAuthorizeIssuance, reconcileCanonicalState } from './reconcile.ts';
export {
  applyTransaction,
  applyTransactions,
  applyTransactionWithoutMutationCheck,
} from './transition.ts';
