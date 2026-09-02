/**
 * Deterministic mempool boundary.
 *
 * The mempool is not canonical state. It holds valid candidate transactions
 * but cannot mutate supply or balances.
 */

import { MAX_ENVELOPE_BYTES } from './constants.ts';
import { decode, validateAuthentication, validateEnvelope, validateReplay, validateStateless } from './validation.ts';
import type { ProtocolExecutionContext, ProtocolState } from './state.ts';
import type { ProtocolRejection } from './rejection.ts';
import { transactionIdOf } from './hash.ts';
import type { EnvelopeV1 } from './envelope.ts';

export type MempoolPolicy = {
  readonly maxCount: number;
  readonly maxBytes: number;
  readonly maxPerActor: number;
  readonly ttlMs: number;
  readonly preferHigherFee: true;
};

export const DEFAULT_PROTOCOL_MEMPOOL_POLICY: MempoolPolicy = Object.freeze({
  maxCount: 1024,
  maxBytes: 2_000_000,
  maxPerActor: 16,
  ttlMs: 60_000,
  preferHigherFee: true,
});

export function contextNowMs(context: ProtocolExecutionContext): number {
  return Number(context.blockTimeUnixSeconds) * 1000;
}

export type MempoolEntry = {
  readonly txId: string;
  readonly envelope: EnvelopeV1;
  readonly bytes: Uint8Array;
  readonly actorId: string;
  readonly sequence: bigint;
  readonly fee: bigint;
  readonly admittedAtMs: number;
  readonly expiresAtMs: number | null;
};

export type MempoolAdmissionResult =
  | { readonly ok: true; readonly entry: MempoolEntry }
  | { readonly ok: false; readonly reason: ProtocolRejection['code'] | 'DUPLICATE' | 'CAPACITY' | 'SPAM' | 'OVERSIZED' | 'EXPIRED' };

export class ProtocolMempool {
  private readonly entries = new Map<string, MempoolEntry>();
  private totalBytes = 0;
  private readonly perActor = new Map<string, number>();
  readonly policy: MempoolPolicy;

  constructor(policy: MempoolPolicy = DEFAULT_PROTOCOL_MEMPOOL_POLICY) {
    this.policy = policy;
  }

  size(): number {
    return this.entries.size;
  }

  has(txId: string): boolean {
    return this.entries.has(txId);
  }

  get(txId: string): MempoolEntry | undefined {
    return this.entries.get(txId);
  }

  admit(
    bytes: Uint8Array,
    state: ProtocolState,
    context: ProtocolExecutionContext,
    nowMs: number,
  ): MempoolAdmissionResult {
    if (bytes.length > MAX_ENVELOPE_BYTES) {
      return { ok: false, reason: 'OVERSIZED' };
    }
    const decoded = decode(bytes);
    if (!decoded.ok) {
      return { ok: false, reason: decoded.error.code };
    }
    const enveloped = validateEnvelope(decoded.value, context);
    if (!enveloped.ok) {
      return { ok: false, reason: enveloped.error.code };
    }
    const stateless = validateStateless(enveloped.value);
    if (!stateless.ok) {
      return { ok: false, reason: stateless.error.code };
    }
    const authenticated = validateAuthentication(stateless.value);
    if (!authenticated.ok) {
      return { ok: false, reason: authenticated.error.code };
    }
    const replay = validateReplay(authenticated.value, state, context);
    if (!replay.ok) {
      return { ok: false, reason: replay.error.code };
    }

    const envelope = replay.value;
    const txId = transactionIdOf(envelope);
    if (this.entries.has(txId)) {
      return { ok: false, reason: 'DUPLICATE' };
    }
    const actorId = envelope.body.header.actor.actorId;
    const actorCount = this.perActor.get(actorId) ?? 0;
    if (actorCount >= this.policy.maxPerActor) {
      return { ok: false, reason: 'SPAM' };
    }
    if (this.entries.size >= this.policy.maxCount || this.totalBytes + bytes.length > this.policy.maxBytes) {
      return { ok: false, reason: 'CAPACITY' };
    }

    const fee =
      envelope.body.family === 'NATIVE_ASSET' && envelope.body.fee
        ? envelope.body.fee.scaledUnits
        : 0n;
    const expiresAtMs =
      envelope.body.header.expirationUnixSeconds > 0n
        ? Number(envelope.body.header.expirationUnixSeconds) * 1000
        : null;
    const now = nowMs;
    if (expiresAtMs !== null && expiresAtMs <= now) {
      return { ok: false, reason: 'EXPIRED' };
    }

    const entry: MempoolEntry = Object.freeze({
      txId,
      envelope,
      bytes: new Uint8Array(bytes),
      actorId,
      sequence: envelope.body.header.sequence,
      fee,
      admittedAtMs: now,
      expiresAtMs,
    });
    this.entries.set(txId, entry);
    this.totalBytes += bytes.length;
    this.perActor.set(actorId, actorCount + 1);
    return { ok: true, entry };
  }

  evictExpired(nowMs: number): readonly string[] {
    const now = nowMs;
    const removed: string[] = [];
    for (const [txId, entry] of this.entries) {
      if (entry.expiresAtMs !== null && entry.expiresAtMs <= now) {
        this.remove(txId);
        removed.push(txId);
      }
    }
    return Object.freeze(removed);
  }

  remove(txId: string): boolean {
    const entry = this.entries.get(txId);
    if (!entry) {
      return false;
    }
    this.entries.delete(txId);
    this.totalBytes -= entry.bytes.length;
    const actorCount = this.perActor.get(entry.actorId) ?? 0;
    if (actorCount <= 1) {
      this.perActor.delete(entry.actorId);
    } else {
      this.perActor.set(entry.actorId, actorCount - 1);
    }
    return true;
  }

  selectForBlock(limit: number): readonly MempoolEntry[] {
    const candidates = [...this.entries.values()].sort((left, right) => {
      if (left.fee === right.fee) {
        return left.txId < right.txId ? -1 : 1;
      }
      return left.fee > right.fee ? -1 : 1;
    });
    return Object.freeze(candidates.slice(0, limit));
  }

  snapshot(): readonly MempoolEntry[] {
    return Object.freeze([...this.entries.values()].sort((a, b) => (a.txId < b.txId ? -1 : 1)));
  }

  restore(entries: readonly MempoolEntry[]): void {
    this.entries.clear();
    this.perActor.clear();
    this.totalBytes = 0;
    for (const entry of entries) {
      this.entries.set(entry.txId, entry);
      this.totalBytes += entry.bytes.length;
      this.perActor.set(entry.actorId, (this.perActor.get(entry.actorId) ?? 0) + 1);
    }
  }
}
