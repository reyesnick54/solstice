// @ts-nocheck
/**
 * Canonical deterministic state transition boundary.
 *
 * applyTransaction(previousState, validatedTransaction) → nextState
 *
 * Invalid transactions fail closed with zero mutation to the input state.
 */

import { nativeAssetConstitution } from '../economics/constitution.ts';
import { authorizeIssuance } from '../economics/issuance.ts';
import { transfer } from '../economics/operations.ts';
import type { NativeMonetaryAssetId } from '../economics/types.ts';
import {
  authorizedBurn,
  refuseForbiddenMutator,
  type AuthorizedBurnRequest,
} from '../native-assets/economic-controls.ts';
import { booksFromCanonicalSupplies, bookToCanonical, canonicalSuppliesFromBooks } from './books.ts';
import { cloneCanonicalState } from './genesis.ts';
import { assertCanonicalStateReconciles } from './reconcile.ts';
import type {
  CanonicalAccountNonce,
  CanonicalProtocolState,
  StateTransitionRejection,
  StateTransitionResult,
  ValidatedNativeTransaction,
} from './types.ts';

function compareNonce(left: CanonicalAccountNonce, right: CanonicalAccountNonce): number {
  return left.account < right.account ? -1 : left.account > right.account ? 1 : 0;
}

function accountNonce(state: CanonicalProtocolState, account: string): bigint {
  const entry = state.accountNonces.find((row) => row.account === account);
  return entry?.nonce ?? 0n;
}

function withNonce(
  state: CanonicalProtocolState,
  account: string,
  nonce: bigint,
): readonly CanonicalAccountNonce[] {
  const next = state.accountNonces.filter((row) => row.account !== account);
  next.push(Object.freeze({ account, nonce }));
  next.sort(compareNonce);
  return Object.freeze(next);
}

function replaceSupply(
  state: CanonicalProtocolState,
  assetId: NativeMonetaryAssetId,
  book: ReturnType<typeof booksFromCanonicalSupplies>[NativeMonetaryAssetId],
): readonly [typeof state.supplies[0], typeof state.supplies[1]] {
  const canonical = bookToCanonical(book);
  if (assetId === 'SUNREY_COIN') {
    return Object.freeze([canonical, state.supplies[1]]);
  }
  return Object.freeze([state.supplies[0], canonical]);
}

function reject(code: StateTransitionRejection, detail?: string): StateTransitionResult {
  return Object.freeze({ ok: false as const, code, detail });
}

function accept(state: CanonicalProtocolState): StateTransitionResult {
  try {
    assertCanonicalStateReconciles(state);
  } catch (error) {
    return reject('RECONCILIATION_FAILED', error instanceof Error ? error.message : 'reconcile failed');
  }
  return Object.freeze({ ok: true as const, next: state });
}

export function applyTransaction(
  previousState: CanonicalProtocolState,
  transaction: ValidatedNativeTransaction,
): StateTransitionResult {
  if (transaction.quantity <= 0n) {
    return reject('NEGATIVE_QUANTITY');
  }
  if (previousState.executedTransactionIds.includes(transaction.transactionId)) {
    return reject('REPLAY_TRANSACTION');
  }
  const expectedNonce = accountNonce(previousState, transaction.account) + 1n;
  if (transaction.nonce !== expectedNonce) {
    return reject('INVALID_NONCE');
  }

  const working = cloneCanonicalState(previousState);
  const books = booksFromCanonicalSupplies(working.supplies);
  let nextIssuanceIds = working.executedIssuanceAuthorizationIds;

  if (transaction.operation === 'TRANSFER') {
    if (!transaction.counterparty) {
      return reject('MISSING_COUNTERPARTY');
    }
    if (transaction.account === transaction.counterparty) {
      return reject('SELF_TRANSFER');
    }
    const book = books[transaction.assetId];
    if (book.assetId !== transaction.assetId) {
      return reject('ASSET_MISMATCH');
    }
    try {
      const nextBook = transfer(book, transaction.account, transaction.counterparty, transaction.quantity);
      books[transaction.assetId] = nextBook;
    } catch {
      return reject('INSUFFICIENT_BALANCE');
    }
  } else if (transaction.operation === 'ISSUE') {
    if (!transaction.issuanceAuthority) {
      return reject('MISSING_ISSUANCE_AUTHORITY');
    }
    if (transaction.issuanceAuthority.assetId !== transaction.assetId) {
      return reject('ASSET_MISMATCH');
    }
    if (transaction.issuanceAuthority.quantity !== transaction.quantity) {
      return reject('ISSUANCE_REJECTED', 'authority quantity mismatch');
    }
    const actor = transaction.actor ?? 'PROTOCOL';
    const actorRefusal = refuseForbiddenMutator(actor);
    if (actorRefusal) {
      return reject('UNAUTHORIZED_ACTOR');
    }
    if (working.executedIssuanceAuthorizationIds.includes(transaction.issuanceAuthority.authorityId)) {
      return reject('REPLAY_ISSUANCE');
    }
    const constitution = nativeAssetConstitution(working.policyState);
    const result = authorizeIssuance(constitution, books[transaction.assetId], transaction.issuanceAuthority);
    if (!result.ok) {
      return reject('ISSUANCE_REJECTED', result.code);
    }
    books[transaction.assetId] = result.book;
    nextIssuanceIds = Object.freeze(
      [...working.executedIssuanceAuthorizationIds, transaction.issuanceAuthority.authorityId].sort(),
    );
  } else if (transaction.operation === 'BURN') {
    if (!transaction.burnClass || !transaction.replayIdentifier) {
      return reject('MISSING_BURN_CLASS');
    }
    const actor = transaction.actor ?? 'PROTOCOL';
    const actorRefusal = refuseForbiddenMutator(actor);
    if (actorRefusal) {
      return reject('UNAUTHORIZED_ACTOR');
    }
    const request: AuthorizedBurnRequest = {
      assetId: transaction.assetId,
      account: transaction.account,
      quantity: transaction.quantity,
      burnClass: transaction.burnClass,
      authorizedSource:
        transaction.authorizedSource ??
        (transaction.burnClass === 'FEE_BURN'
          ? 'FEE_MARKET'
          : transaction.burnClass === 'PROTOCOL_ECONOMIC_PENALTY'
            ? 'PROTOCOL_PENALTY'
            : 'VOLUNTARY_USER'),
      replayIdentifier: transaction.replayIdentifier,
      network: transaction.network ?? 'DEVELOPMENT',
      actor,
    };
    const result = authorizedBurn(books[transaction.assetId], request);
    if (!result.ok) {
      return reject('BURN_REJECTED', result.code);
    }
    books[transaction.assetId] = result.book;
  } else {
    return reject('INVALID_OPERATION');
  }

  const nextState = Object.freeze({
    ...working,
    height: working.height + 1n,
    supplies: canonicalSuppliesFromBooks(books),
    accountNonces: withNonce(working, transaction.account, transaction.nonce),
    executedTransactionIds: Object.freeze(
      [...working.executedTransactionIds, transaction.transactionId].sort(),
    ),
    executedIssuanceAuthorizationIds: nextIssuanceIds,
  });
  return accept(nextState);
}

export function applyTransactions(
  genesis: CanonicalProtocolState,
  transactions: readonly ValidatedNativeTransaction[],
): StateTransitionResult {
  let current = genesis;
  for (const transaction of transactions) {
    const result = applyTransaction(current, transaction);
    if (!result.ok) {
      return result;
    }
    current = result.next;
  }
  return Object.freeze({ ok: true as const, next: current });
}

export function applyTransactionWithoutMutationCheck(
  previousState: CanonicalProtocolState,
  transaction: ValidatedNativeTransaction,
): StateTransitionResult {
  const snapshot = cloneCanonicalState(previousState);
  const result = applyTransaction(previousState, transaction);
  if (!result.ok) {
    const unchanged = encodeStateEquality(previousState, snapshot);
    if (!unchanged) {
      return reject('RECONCILIATION_FAILED', 'input state mutated on failure');
    }
  }
  return result;
}

function encodeStateEquality(left: CanonicalProtocolState, right: CanonicalProtocolState): boolean {
  return JSON.stringify(left, (_, value) => (typeof value === 'bigint' ? value.toString() : value)) ===
    JSON.stringify(right, (_, value) => (typeof value === 'bigint' ? value.toString() : value));
}
