/**
 * Safe nonce / sequence management.
 *
 * Local increment is never sufficient by itself. The manager checks
 * chain state, tracks pending/finalized/rejected nonces, and supports
 * a same-nonce replacement when the replacement max_fee is higher.
 */

export type NonceRecord = {
  readonly nonce: bigint;
  readonly txId: string;
  readonly state: 'PENDING' | 'SUBMITTED' | 'FINALIZED' | 'REJECTED' | 'REPLACED';
  readonly maxFee: bigint;
};

export class NonceManager {
  private readonly chainNonce = new Map<string, bigint>();
  private readonly local = new Map<string, NonceRecord[]>();

  observeChain(accountId: string, nonce: bigint): void {
    this.chainNonce.set(accountId, nonce);
  }

  next(accountId: string): bigint {
    const chain = this.chainNonce.get(accountId) ?? 0n;
    const pending = (this.local.get(accountId) ?? []).filter(
      (record) => record.state === 'PENDING' || record.state === 'SUBMITTED',
    );
    const highestLocal = pending.reduce((max, record) => (record.nonce > max ? record.nonce : max), chain);
    return highestLocal + 1n;
  }

  reserve(accountId: string, txId: string, maxFee: bigint): bigint {
    const nonce = this.next(accountId);
    const records = this.local.get(accountId) ?? [];
    records.push({ nonce, txId, state: 'PENDING', maxFee });
    this.local.set(accountId, records);
    return nonce;
  }

  markSubmitted(accountId: string, txId: string): void {
    this.update(accountId, txId, 'SUBMITTED');
  }

  markFinalized(accountId: string, txId: string, chainNonce: bigint): void {
    this.update(accountId, txId, 'FINALIZED');
    this.chainNonce.set(accountId, chainNonce);
  }

  markRejected(accountId: string, txId: string): void {
    this.update(accountId, txId, 'REJECTED');
  }

  replace(accountId: string, previousTxId: string, nextTxId: string, nextMaxFee: bigint): bigint | null {
    const records = this.local.get(accountId) ?? [];
    const previous = records.find((record) => record.txId === previousTxId);
    if (!previous || (previous.state !== 'PENDING' && previous.state !== 'SUBMITTED')) {
      return null;
    }
    if (nextMaxFee <= previous.maxFee) {
      return null;
    }
    this.update(accountId, previousTxId, 'REPLACED');
    records.push({ nonce: previous.nonce, txId: nextTxId, state: 'PENDING', maxFee: nextMaxFee });
    this.local.set(accountId, records);
    return previous.nonce;
  }

  private update(accountId: string, txId: string, state: NonceRecord['state']): void {
    const records = this.local.get(accountId) ?? [];
    this.local.set(
      accountId,
      records.map((record) => (record.txId === txId ? { ...record, state } : record)),
    );
  }
}
