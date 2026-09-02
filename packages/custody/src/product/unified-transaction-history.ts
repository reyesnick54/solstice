/**
 * Wave 8 — unified user-facing transaction history projection.
 *
 * Combines native transfers, issuance receipts, burns, exchange settlements,
 * and fiat sandbox activities while preserving underlying source types.
 */

import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { WalletTransaction } from './types.ts';

export const UNIFIED_HISTORY_SOURCE_TYPES = [
  'NATIVE_TRANSFER',
  'NATIVE_ISSUANCE',
  'NATIVE_BURN',
  'EXCHANGE_SETTLEMENT',
  'FIAT_SANDBOX',
  'CUSTODY_DEPOSIT',
  'CUSTODY_WITHDRAWAL',
] as const;
export type UnifiedHistorySourceType = (typeof UNIFIED_HISTORY_SOURCE_TYPES)[number];

export type UnifiedTransactionHistoryItem = {
  readonly schema: 'sunrey.unified-transaction-history.v1';
  readonly itemId: string;
  readonly customerId: string;
  readonly sourceType: UnifiedHistorySourceType;
  readonly assetId: string;
  readonly amountMinorUnits: string;
  readonly direction: 'CREDIT' | 'DEBIT' | 'NEUTRAL';
  readonly finality: 'PENDING' | 'FINALIZED' | 'FAILED';
  readonly reference: string;
  readonly underlyingRef: string | null;
  readonly sandboxSimulation: true;
  readonly productionMoneyMovement: false;
  readonly occurredAt: string;
};

export function fromWalletTransaction(
  customerId: string,
  tx: WalletTransaction,
): UnifiedTransactionHistoryItem {
  const direction =
    tx.kind === 'DEPOSIT' ? 'CREDIT' : tx.kind === 'WITHDRAWAL' ? 'DEBIT' : 'NEUTRAL';
  const finality =
    tx.finality === 'FINALIZED' ? 'FINALIZED' : tx.finality === 'FAILED' ? 'FAILED' : 'PENDING';
  return Object.freeze({
    schema: 'sunrey.unified-transaction-history.v1',
    itemId: `uth_${tx.transactionId}`,
    customerId,
    sourceType: tx.kind === 'DEPOSIT' ? 'CUSTODY_DEPOSIT' : tx.kind === 'WITHDRAWAL' ? 'CUSTODY_WITHDRAWAL' : 'NATIVE_TRANSFER',
    assetId: tx.assetId,
    amountMinorUnits: tx.amountMinorUnits,
    direction,
    finality,
    reference: tx.transactionId,
    underlyingRef: tx.txRef,
    sandboxSimulation: true,
    productionMoneyMovement: false,
    occurredAt: tx.createdAt,
  });
}

export function fromNativeTransfer(input: {
  readonly customerId: string;
  readonly txId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly amountMinorUnits: bigint;
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly finalized: boolean;
  readonly occurredAt: string;
}): UnifiedTransactionHistoryItem {
  return Object.freeze({
    schema: 'sunrey.unified-transaction-history.v1',
    itemId: `uth_native_${input.txId}`,
    customerId: input.customerId,
    sourceType: 'NATIVE_TRANSFER',
    assetId: input.assetId,
    amountMinorUnits: input.amountMinorUnits.toString(),
    direction: input.direction,
    finality: input.finalized ? 'FINALIZED' : 'PENDING',
    reference: input.txId,
    underlyingRef: input.txId,
    sandboxSimulation: true,
    productionMoneyMovement: false,
    occurredAt: input.occurredAt,
  });
}

export function fromExchangeSettlement(input: {
  readonly customerId: string;
  readonly settlementId: string;
  readonly tradeId: string;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly amountMinorUnits: bigint;
  readonly finalized: boolean;
  readonly chainTxRef: string | null;
  readonly occurredAt: string;
}): UnifiedTransactionHistoryItem {
  return Object.freeze({
    schema: 'sunrey.unified-transaction-history.v1',
    itemId: `uth_xset_${input.settlementId}`,
    customerId: input.customerId,
    sourceType: 'EXCHANGE_SETTLEMENT',
    assetId: input.baseAssetId,
    amountMinorUnits: input.amountMinorUnits.toString(),
    direction: 'NEUTRAL',
    finality: input.finalized ? 'FINALIZED' : 'PENDING',
    reference: input.settlementId,
    underlyingRef: input.chainTxRef ?? input.tradeId,
    sandboxSimulation: true,
    productionMoneyMovement: false,
    occurredAt: input.occurredAt,
  });
}

export function mergeUnifiedHistory(
  items: readonly UnifiedTransactionHistoryItem[],
): readonly UnifiedTransactionHistoryItem[] {
  return Object.freeze(
    [...items].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  );
}
