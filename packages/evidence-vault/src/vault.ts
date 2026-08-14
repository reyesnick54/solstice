import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/permissions';

export const GENESIS_PREV_SHA256 = '0'.repeat(64);

export interface EvidenceRecord {
  readonly seq: string;
  readonly evidenceId: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly payloadSha256: string;
  readonly prevRecordSha256: string;
  readonly recordSha256: string;
  readonly sealedAt: string;
}

/**
 * Append-only evidence hash chain. Every kernel decision — approval or
 * refusal — seals a record. A broken chain is a hard failure.
 *
 * Hash formula matches the in-process vault used by the ledger path:
 * recordSha256 = SHA-256(seq || kind || payloadSha256 || prev || sealedAt)
 * genesis prev = 64 zero hex chars.
 */
export class EvidenceVault {
  private readonly records: EvidenceRecord[] = [];
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  seal(kind: string, payload: unknown): EvidenceRecord {
    const seq = BigInt(this.records.length) + 1n;
    const sealedAt = this.clock.now().toISOString();
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
        throw new Error(
          `evidence chain broken at seq ${record.seq}: prev hash mismatch`,
        );
      }
      const payloadSha256 = sha256Hex(canonicalJson(record.payload));
      if (payloadSha256 !== record.payloadSha256) {
        throw new Error(
          `evidence chain broken at seq ${record.seq}: payload hash mismatch`,
        );
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
        throw new Error(
          `evidence chain broken at seq ${record.seq}: record hash mismatch`,
        );
      }
      prev = record.recordSha256;
    }
    return { ok: true, length: this.records.length };
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
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
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}
