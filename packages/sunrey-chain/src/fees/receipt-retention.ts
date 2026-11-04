import { commitCanonical } from '../hash.ts';
import { FEE_RECEIPT_DOMAIN, type FeeReceipt } from './types.ts';

export const DEFAULT_FEE_RECEIPT_RETENTION = Object.freeze({
  maxInMemoryReceipts: 8_192,
  maxPriceHistoryEntries: 4_096,
});

export type FeeReceiptRetentionStats = {
  readonly inMemoryReceipts: number;
  readonly sealedReceipts: number;
  readonly uniqueTransactionIds: number;
  readonly sealedChainHead: string;
};

/**
 * Retains recent fee receipts in memory and seals evicted receipts into a hash chain.
 * Full receipts belong in durable storage; this store is the hot window only.
 */
export class FeeReceiptRetentionStore {
  private readonly maxInMemory: number;
  private readonly order: string[] = [];
  private readonly map = new Map<string, FeeReceipt>();
  private readonly recentlySealedIds: string[] = [];
  private totalRecorded = 0;
  private duplicateDetected = false;
  private sealedReceipts = 0;
  private sealedChainHead = '';

  constructor(maxInMemory = DEFAULT_FEE_RECEIPT_RETENTION.maxInMemoryReceipts) {
    this.maxInMemory = maxInMemory;
  }

  record(receipt: FeeReceipt): void {
    const id = receipt.transactionId;
    if (this.map.has(id)) {
      this.map.set(id, receipt);
      return;
    }
    if (this.recentlySealedIds.includes(id)) {
      this.duplicateDetected = true;
    }
    this.totalRecorded += 1;
    while (this.order.length >= this.maxInMemory) {
      const evictId = this.order.shift();
      if (!evictId) {
        break;
      }
      const evicted = this.map.get(evictId);
      this.map.delete(evictId);
      if (evicted) {
        this.seal(evicted);
      }
    }
    this.order.push(id);
    this.map.set(id, receipt);
  }

  get(transactionId: string): FeeReceipt | undefined {
    return this.map.get(transactionId);
  }

  inMemorySize(): number {
    return this.map.size;
  }

  uniqueTransactionCount(): number {
    return this.totalRecorded;
  }

  hasUniqueTransactionIds(): boolean {
    return !this.duplicateDetected && this.totalRecorded === this.sealedReceipts + this.map.size;
  }

  stats(): FeeReceiptRetentionStats {
    return Object.freeze({
      inMemoryReceipts: this.map.size,
      sealedReceipts: this.sealedReceipts,
      uniqueTransactionIds: this.totalRecorded,
      sealedChainHead: this.sealedChainHead,
    });
  }

  inMemoryView(): ReadonlyMap<string, FeeReceipt> {
    return this.map;
  }

  values(): IterableIterator<FeeReceipt> {
    return this.map.values();
  }

  entries(): IterableIterator<[string, FeeReceipt]> {
    return this.map.entries();
  }

  private seal(receipt: FeeReceipt): void {
    this.recentlySealedIds.push(receipt.transactionId);
    if (this.recentlySealedIds.length > this.maxInMemory) {
      this.recentlySealedIds.shift();
    }
    const digest = commitCanonical({
      domain: FEE_RECEIPT_DOMAIN,
      transactionId: receipt.transactionId,
      payer: receipt.payer,
      asset: receipt.asset,
      actualFee: receipt.actualFee.toString(),
      blockHeight: receipt.blockHeight,
      blockId: receipt.blockId,
      outcome: receipt.outcome,
    });
    this.sealedChainHead = commitCanonical({ prev: this.sealedChainHead, digest });
    this.sealedReceipts += 1;
  }
}

export function trimPriceHistory<T>(history: T[], maxEntries: number): void {
  if (history.length <= maxEntries) {
    return;
  }
  history.splice(0, history.length - maxEntries);
}
