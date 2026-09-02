/**
 * Supply reconciliation for canonical protocol state.
 */

import { nativeAssetConstitution } from '../economics/constitution.ts';
import { authorizeIssuance } from '../economics/issuance.ts';
import { enforceSupplyInvariants } from '../native-assets/economic-controls.ts';
import { booksFromCanonicalSupplies } from './books.ts';
import type { CanonicalProtocolState, SupplyReconciliationFailure, SupplyReconciliationReport } from './types.ts';

function expectedTotal(book: {
  readonly genesisAllocated: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
}): bigint {
  return book.genesisAllocated + book.issuedPostGenesis - book.burned;
}

function observedTotal(book: {
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
}): bigint {
  return book.circulating + book.locked + book.escrowed + book.feeReserved;
}

export function reconcileCanonicalState(state: CanonicalProtocolState): SupplyReconciliationReport {
  const failures: SupplyReconciliationFailure[] = [];
  const books = booksFromCanonicalSupplies(state.supplies);
  const invariantReport = enforceSupplyInvariants([books.SUNREY_COIN, books.MOONREY_COIN]);
  if (!invariantReport.ok) {
    failures.push('POSITION_MISMATCH');
  }
  for (const supply of state.supplies) {
    const total = expectedTotal(supply);
    if (total < 0n || supply.burned < 0n) {
      failures.push('NEGATIVE_SUPPLY');
    }
    if (observedTotal(supply) > total) {
      failures.push('CIRCULATING_EXCEEDS_TOTAL');
    }
    let heldCirculating = 0n;
    let heldLocked = 0n;
    let heldEscrowed = 0n;
    let heldReserved = 0n;
    for (const position of supply.positions) {
      if (position.assetId !== supply.assetId) {
        failures.push('ASSET_CROSS_CONTAMINATION');
      }
      heldCirculating += position.circulating;
      heldLocked += position.locked;
      heldEscrowed += position.escrowed;
      heldReserved += position.feeReserved;
    }
    if (
      heldCirculating !== supply.circulating ||
      heldLocked !== supply.locked ||
      heldEscrowed !== supply.escrowed ||
      heldReserved !== supply.feeReserved
    ) {
      failures.push('POSITION_MISMATCH');
    }
    const replaySet = new Set<string>();
    for (const replayId of supply.usedReplayIds) {
      if (replaySet.has(replayId)) {
        failures.push('REPLAY_ID_COLLISION');
      }
      replaySet.add(replayId);
    }
  }
  const nonceAccounts = new Set<string>();
  for (const entry of state.accountNonces) {
    if (nonceAccounts.has(entry.account)) {
      failures.push('NONCE_REGRESSION');
    }
    nonceAccounts.add(entry.account);
    if (entry.nonce < 0n) {
      failures.push('NONCE_REGRESSION');
    }
  }
  const txSet = new Set(state.executedTransactionIds);
  if (txSet.size !== state.executedTransactionIds.length) {
    failures.push('REPLAY_ID_COLLISION');
  }
  const issuanceSet = new Set(state.executedIssuanceAuthorizationIds);
  if (issuanceSet.size !== state.executedIssuanceAuthorizationIds.length) {
    failures.push('REPLAY_ID_COLLISION');
  }
  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures),
  });
}

export function assertCanonicalStateReconciles(state: CanonicalProtocolState): void {
  const report = reconcileCanonicalState(state);
  if (!report.ok) {
    throw new TypeError(`canonical state reconciliation failed: ${report.failures.join(',')}`);
  }
}

/** Dry-run issuance against canonical state without mutating it. */
export function canAuthorizeIssuance(
  state: CanonicalProtocolState,
  authority: Parameters<typeof authorizeIssuance>[2],
): boolean {
  const books = booksFromCanonicalSupplies(state.supplies);
  const constitution = nativeAssetConstitution(state.policyState);
  const result = authorizeIssuance(constitution, books[authority.assetId], authority);
  return result.ok;
}
