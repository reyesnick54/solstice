import { commitCanonical } from '../hash.ts';
import type { MoonReyIssuanceReceipt } from './issuance.ts';

export const DEFAULT_MOONREY_RECEIPT_RETENTION = Object.freeze({
  maxInMemoryReceipts: 2_048,
});

export class MoonReyReceiptRetentionStore {
  private readonly maxInMemory: number;
  private readonly order: string[] = [];
  private readonly map = new Map<string, MoonReyIssuanceReceipt>();
  private readonly recentlySealedFingerprints: string[] = [];
  private totalIssued = 0;
  private duplicateFingerprint = false;
  private sealedReceipts = 0;
  private sealedChainHead = '';

  constructor(maxInMemory = DEFAULT_MOONREY_RECEIPT_RETENTION.maxInMemoryReceipts) {
    this.maxInMemory = maxInMemory;
  }

  record(receipt: MoonReyIssuanceReceipt): void {
    if (this.map.has(receipt.issuanceId)) {
      this.map.set(receipt.issuanceId, receipt);
      return;
    }
    if (this.recentlySealedFingerprints.includes(receipt.fingerprint)) {
      this.duplicateFingerprint = true;
    }
    this.totalIssued += 1;
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
    this.order.push(receipt.issuanceId);
    this.map.set(receipt.issuanceId, receipt);
  }

  get(issuanceId: string): MoonReyIssuanceReceipt | undefined {
    return this.map.get(issuanceId);
  }

  inMemoryView(): ReadonlyMap<string, MoonReyIssuanceReceipt> {
    return this.map;
  }

  issuedFingerprintCount(): number {
    return this.totalIssued;
  }

  hasUniqueFingerprints(): boolean {
    return !this.duplicateFingerprint && this.totalIssued === this.sealedReceipts + this.map.size;
  }

  inMemoryCount(): number {
    return this.map.size;
  }

  sealedCount(): number {
    return this.sealedReceipts;
  }

  clear(): void {
    this.order.length = 0;
    this.map.clear();
    this.recentlySealedFingerprints.length = 0;
    this.totalIssued = 0;
    this.duplicateFingerprint = false;
    this.sealedReceipts = 0;
    this.sealedChainHead = '';
  }

  restore(receipts: readonly MoonReyIssuanceReceipt[]): void {
    this.clear();
    for (const receipt of receipts) {
      this.record(receipt);
    }
  }

  values(): readonly MoonReyIssuanceReceipt[] {
    return [...this.map.values()].sort((left, right) => left.issuanceId.localeCompare(right.issuanceId));
  }

  private seal(receipt: MoonReyIssuanceReceipt): void {
    this.recentlySealedFingerprints.push(receipt.fingerprint);
    if (this.recentlySealedFingerprints.length > this.maxInMemory) {
      this.recentlySealedFingerprints.shift();
    }
    const digest = commitCanonical({
      domain: 'moonrey.issuance.receipt',
      issuanceId: receipt.issuanceId,
      fingerprint: receipt.fingerprint,
      moonreyQuantity: receipt.moonreyQuantity.toString(),
      category: receipt.category,
    });
    this.sealedChainHead = commitCanonical({ prev: this.sealedChainHead, digest });
    this.sealedReceipts += 1;
  }
}
