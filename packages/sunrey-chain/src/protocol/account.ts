/**
 * Account sequencing and public-key binding for protocol transactions.
 */

import { sha256Hex } from '../../../security/src/hash.ts';
import { ED25519_PUBLIC_KEY_BYTES } from './constants.ts';

export type AccountSequenceState = {
  readonly accountId: string;
  readonly publicKeyHex: string;
  readonly lastExecutedSequence: bigint;
  readonly pendingSequence: bigint | null;
};

export function deriveAccountIdFromPublicKey(publicKeyHex: string, networkId: string): string | null {
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex)) {
    return null;
  }
  if (Buffer.from(publicKeyHex, 'hex').length !== ED25519_PUBLIC_KEY_BYTES) {
    return null;
  }
  const digest = sha256Hex(`SUNREY-ACCOUNT-V1:${networkId}:${publicKeyHex.toLowerCase()}`);
  return `acct.${digest.slice(0, 40)}`;
}

export function publicKeyMatchesAccount(
  publicKeyHex: string,
  accountId: string,
  networkId: string,
): boolean {
  const derived = deriveAccountIdFromPublicKey(publicKeyHex, networkId);
  return derived !== null && derived === accountId;
}

export function assertSequenceAdvance(
  current: bigint,
  submitted: bigint,
): 'OK' | 'STALE' | 'FUTURE_GAP' | 'REPLAY' {
  const expected = current + 1n;
  if (submitted < expected) {
    return 'STALE';
  }
  if (submitted === expected) {
    return 'OK';
  }
  if (submitted > expected + 1n) {
    return 'FUTURE_GAP';
  }
  return 'FUTURE_GAP';
}

export class AccountSequenceTracker {
  private readonly sequences = new Map<string, bigint>();
  private readonly pending = new Map<string, bigint>();

  lastExecuted(accountId: string): bigint {
    return this.sequences.get(accountId) ?? 0n;
  }

  pendingFor(accountId: string): bigint | null {
    return this.pending.get(accountId) ?? null;
  }

  reserve(accountId: string, sequence: bigint): 'OK' | 'STALE' | 'FUTURE_GAP' | 'CONFLICT' | 'REPLAY' {
    const current = this.lastExecuted(accountId);
    const verdict = assertSequenceAdvance(current, sequence);
    if (verdict !== 'OK') {
      return verdict;
    }
    const existing = this.pending.get(accountId);
    if (existing !== undefined) {
      if (existing === sequence) {
        return 'CONFLICT';
      }
      return 'CONFLICT';
    }
    this.pending.set(accountId, sequence);
    return 'OK';
  }

  markExecuted(accountId: string, sequence: bigint): void {
    const current = this.lastExecuted(accountId);
    if (sequence !== current + 1n) {
      throw new TypeError('sequence must advance exactly one step on execution');
    }
    this.sequences.set(accountId, sequence);
    this.pending.delete(accountId);
  }

  markFailed(accountId: string, sequence: bigint): void {
    const pending = this.pending.get(accountId);
    if (pending === sequence) {
      this.pending.delete(accountId);
    }
  }

  snapshot(): readonly AccountSequenceState[] {
    const rows: AccountSequenceState[] = [];
    const ids = new Set([...this.sequences.keys(), ...this.pending.keys()]);
    for (const accountId of [...ids].sort()) {
      rows.push(
        Object.freeze({
          accountId,
          publicKeyHex: '',
          lastExecutedSequence: this.lastExecuted(accountId),
          pendingSequence: this.pendingFor(accountId),
        }),
      );
    }
    return Object.freeze(rows);
  }

  restore(sequences: ReadonlyMap<string, bigint>): void {
    this.sequences.clear();
    this.pending.clear();
    for (const [accountId, sequence] of sequences) {
      this.sequences.set(accountId, sequence);
    }
  }
}
