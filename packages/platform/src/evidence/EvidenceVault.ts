import { createHash, randomUUID } from 'node:crypto';
import type { Clock } from '../clock.ts';

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

export class EvidenceVault {
  private readonly records: EvidenceRecord[] = [];
  readonly #clock: Clock;

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  seal(kind: string, payload: unknown): EvidenceRecord {
    const seq = BigInt(this.records.length) + 1n;
    const sealedAt = this.#clock.now();
    const payloadSha256 = sha256Hex(JSON.stringify(payload));
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
      payload,
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
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
