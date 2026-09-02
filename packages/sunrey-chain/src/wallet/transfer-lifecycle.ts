/**
 * Wave 8 — native transfer lifecycle.
 *
 * Transfers are not complete before finality. Replay of finalized
 * client transaction ids is rejected.
 */

import type { BuiltTransaction, WalletTransactionRecord } from './types.ts';
import { isWalletRejection } from './types.ts';
import type { WalletEngine } from './engine.ts';

export const NATIVE_TRANSFER_LIFECYCLE_STATES = [
  'AUTHORIZATION_PENDING',
  'POLICY_CHECKED',
  'TRANSACTION_BUILT',
  'SIGNED',
  'SUBMITTED',
  'PENDING_INCLUSION',
  'FINALIZED',
  'FAILED',
  'REJECTED',
] as const;
export type NativeTransferLifecycleState = (typeof NATIVE_TRANSFER_LIFECYCLE_STATES)[number];

export type NativeTransferReceipt = {
  readonly schema: 'sunrey.native-transfer.receipt.v1';
  readonly clientTxId: string;
  readonly txId: string | null;
  readonly state: NativeTransferLifecycleState;
  readonly assetId: string;
  readonly amountMinorUnits: string;
  readonly finalized: boolean;
  readonly simulation: true;
  readonly productionMoneyMovement: false;
};

export type NativeTransferAttempt = {
  readonly walletId: string;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly keyIds: readonly string[];
};

const finalizedClientIdsByEngine = new WeakMap<WalletEngine, Set<string>>();

function finalizedIds(engine: WalletEngine): Set<string> {
  let ids = finalizedClientIdsByEngine.get(engine);
  if (!ids) {
    ids = new Set<string>();
    finalizedClientIdsByEngine.set(engine, ids);
  }
  return ids;
}

export function rejectReplay(engine: WalletEngine, clientTxId: string): boolean {
  return finalizedIds(engine).has(clientTxId);
}

export function recordFinalizedClientTx(engine: WalletEngine, clientTxId: string): void {
  finalizedIds(engine).add(clientTxId);
}

export function transferIsComplete(state: NativeTransferLifecycleState): boolean {
  return state === 'FINALIZED';
}

export function transferIsTerminal(state: NativeTransferLifecycleState): boolean {
  return state === 'FINALIZED' || state === 'FAILED' || state === 'REJECTED';
}

export function rejectCrossAssetTransfer(assetId: string, allowed: readonly string[]): boolean {
  return !allowed.includes(assetId);
}

export function executeNativeTransferLifecycle(
  engine: WalletEngine,
  attempt: NativeTransferAttempt,
): NativeTransferReceipt | { readonly ok: false; readonly code: string; readonly detail: string } {
  const assetId = attempt.assetId ?? 'SUNREY_COIN';
  if (rejectCrossAssetTransfer(assetId, ['SUNREY_COIN', 'MOONREY_COIN'])) {
    return { ok: false, code: 'UNSUPPORTED_ASSET', detail: 'asset is not a canonical native asset' };
  }

  const built = engine.buildTransfer({
    walletId: attempt.walletId,
    toAccountId: attempt.toAccountId,
    toAddressText: attempt.toAddressText,
    amount: attempt.amount,
    maxFee: attempt.maxFee,
    assetId,
  });
  if (isWalletRejection(built)) {
    return { ok: false, code: built.code, detail: built.detail };
  }
  if (rejectReplay(engine, built.clientTxId)) {
    return { ok: false, code: 'DUPLICATE_CLIENT_TX', detail: 'finalized client transaction id replay rejected' };
  }

  const signed = engine.sign({ walletId: attempt.walletId, built, keyIds: attempt.keyIds });
  if (isWalletRejection(signed)) {
    return { ok: false, code: signed.code, detail: signed.detail };
  }

  const submitted = engine.submit({
    walletId: attempt.walletId,
    built,
    signatures: signed.signatures,
  });
  if (isWalletRejection(submitted)) {
    return receiptFrom(built, null, 'REJECTED', assetId, attempt.amount);
  }

  recordFinalizedClientTx(engine, built.clientTxId);
  return receiptFrom(built, submitted.txId, 'FINALIZED', assetId, attempt.amount);
}

function receiptFrom(
  built: BuiltTransaction,
  txId: string | null,
  state: NativeTransferLifecycleState,
  assetId: string,
  amount: bigint,
): NativeTransferReceipt {
  return Object.freeze({
    schema: 'sunrey.native-transfer.receipt.v1',
    clientTxId: built.clientTxId,
    txId,
    state,
    assetId,
    amountMinorUnits: amount.toString(),
    finalized: transferIsComplete(state),
    simulation: true,
    productionMoneyMovement: false,
  });
}

export function lifecycleStateFromRecord(record: WalletTransactionRecord): NativeTransferLifecycleState {
  switch (record.state) {
    case 'PENDING_LOCAL':
      return 'TRANSACTION_BUILT';
    case 'SUBMITTED':
      return 'PENDING_INCLUSION';
    case 'FINALIZED':
      return 'FINALIZED';
    case 'REJECTED':
      return 'REJECTED';
    case 'EXPIRED':
      return 'FAILED';
    default:
      return 'FAILED';
  }
}
