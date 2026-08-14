import { randomUUID } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import { sha256Hex } from '../../security/src/hash.ts';

export const GENESIS_PREV_SHA256 = '0'.repeat(64);

export type EvidenceRecord = {
  readonly seq: string;
  readonly evidenceId: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly payloadSha256: string;
  readonly prevRecordSha256: string;
  readonly recordSha256: string;
  readonly sealedAt: string;
};

export type EvidencePersistSink = {
  appendEvidence(record: EvidenceRecord): void;
};

/**
 * Append-only evidence hash chain. Every kernel decision — approval and
 * refusal — seals a record. A broken chain is a hard failure.
 */
export class EvidenceVault {
  private readonly records: EvidenceRecord[] = [];
  private readonly clock: Clock;
  private readonly persist: EvidencePersistSink | undefined;

  constructor(clock: Clock, persist?: EvidencePersistSink) {
    this.clock = clock;
    this.persist = persist;
  }

  /**
   * Reconstruct the chain from durable rows after restart.
   * Empty-vault only. Does not re-seal and does not write.
   */
  hydrateFromPersisted(records: readonly EvidenceRecord[]): void {
    if (this.records.length !== 0) {
      throw new Error('cannot hydrate an evidence vault that already has records');
    }
    for (const record of records) {
      this.records.push(Object.freeze({ ...record, payload: deepFreeze(record.payload) }));
    }
  }

  /**
   * Replace in-memory records from durable bytes under a chain lock.
   * Used so concurrent appenders see the committed tip before sealing.
   */
  reloadFromPersisted(records: readonly EvidenceRecord[]): void {
    this.records.length = 0;
    for (const record of records) {
      this.records.push(Object.freeze({ ...record, payload: deepFreeze(record.payload) }));
    }
  }

  seal(kind: string, payload: unknown): EvidenceRecord {
    const seq = BigInt(this.records.length) + 1n;
    const sealedAt = this.clock.now();
    const payloadSha256 = sha256Hex(canonicalJson(payload));
    const prevRecordSha256 =
      this.records.length === 0
        ? GENESIS_PREV_SHA256
        : this.records[this.records.length - 1]!.recordSha256;
    const recordSha256 = sha256Hex(
      [seq.toString(), kind, payloadSha256, prevRecordSha256, sealedAt].join('\n'),
    );
    const record: EvidenceRecord = Object.freeze({
      seq: seq.toString(),
      evidenceId: randomUUID(),
      kind,
      payload: deepFreeze(payload),
      payloadSha256,
      prevRecordSha256,
      recordSha256,
      sealedAt,
    });
    this.records.push(record);
    this.persist?.appendEvidence(record);
    return record;
  }

  list(): readonly EvidenceRecord[] {
    return this.records.slice();
  }

  count(): number {
    return this.records.length;
  }

  verifyChain(): { ok: true; length: number } {
    let prev = GENESIS_PREV_SHA256;
    for (let i = 0; i < this.records.length; i += 1) {
      const record = this.records[i]!;
      const expectedSeq = (BigInt(i) + 1n).toString();
      if (record.seq !== expectedSeq) {
        throw new Error(`evidence chain broken: seq ${record.seq} != ${expectedSeq}`);
      }
      if (record.prevRecordSha256 !== prev) {
        throw new Error(`evidence chain broken at seq ${record.seq}: prev hash mismatch`);
      }
      const payloadSha256 = sha256Hex(canonicalJson(record.payload));
      if (payloadSha256 !== record.payloadSha256) {
        throw new Error(`evidence chain broken at seq ${record.seq}: payload hash mismatch`);
      }
      const recordSha256 = sha256Hex(
        [
          record.seq,
          record.kind,
          record.payloadSha256,
          record.prevRecordSha256,
          record.sealedAt,
        ].join('\n'),
      );
      if (recordSha256 !== record.recordSha256) {
        throw new Error(`evidence chain broken at seq ${record.seq}: record hash mismatch`);
      }
      prev = record.recordSha256;
    }
    return { ok: true, length: this.records.length };
  }
}

export { sha256Hex } from '../../security/src/hash.ts';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value === 'bigint' || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}
