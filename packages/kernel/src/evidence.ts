import { createHash } from 'node:crypto';

import {
  asEvidenceId,
  asUtcInstant,
  type EvidenceId,
  type UtcInstant,
} from '@solstice/domain';

export type EvidencePayload = {
  readonly kind: string;
  readonly [key: string]: unknown;
};

export type SealedEvidence = {
  readonly id: EvidenceId;
  readonly seq: number;
  readonly payload: EvidencePayload;
  readonly payloadSha256: string;
  readonly prevRecordSha256: string;
  readonly recordSha256: string;
  readonly sealedAt: UtcInstant;
};

const GENESIS = '00'.repeat(32);

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const out: Record<string, unknown> = {};
  for (const [key, nested] of entries) {
    out[key] = sortValue(nested);
  }
  return out;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Append-only in-process evidence vault. Sealing is the only write.
 * Records are never edited. Hash chain is re-verifiable from genesis.
 */
export class EvidenceVault {
  readonly #records: SealedEvidence[] = [];

  get size(): number {
    return this.#records.length;
  }

  seal(payload: EvidencePayload, sealedAt: UtcInstant): SealedEvidence {
    const seq = this.#records.length + 1;
    const payloadSha256 = sha256Hex(canonicalJson(payload));
    const prevRecordSha256 = this.#records.at(-1)?.recordSha256 ?? GENESIS;
    const recordSha256 = sha256Hex(
      canonicalJson({
        seq,
        payloadSha256,
        prevRecordSha256,
        sealedAt,
      }),
    );
    const record: SealedEvidence = Object.freeze({
      id: asEvidenceId(`ev_${seq.toString().padStart(8, '0')}_${recordSha256.slice(0, 12)}`),
      seq,
      payload: Object.freeze({ ...payload }),
      payloadSha256,
      prevRecordSha256,
      recordSha256,
      sealedAt: asUtcInstant(sealedAt),
    });
    this.#records.push(record);
    return record;
  }

  list(): readonly SealedEvidence[] {
    return this.#records.slice();
  }

  getById(id: EvidenceId): SealedEvidence | undefined {
    return this.#records.find((record) => record.id === id);
  }

  verifyChain(): { readonly ok: true } | { readonly ok: false; readonly atSeq: number } {
    let prev = GENESIS;
    for (const record of this.#records) {
      const payloadSha256 = sha256Hex(canonicalJson(record.payload));
      if (payloadSha256 !== record.payloadSha256) {
        return { ok: false, atSeq: record.seq };
      }
      if (record.prevRecordSha256 !== prev) {
        return { ok: false, atSeq: record.seq };
      }
      const expected = sha256Hex(
        canonicalJson({
          seq: record.seq,
          payloadSha256: record.payloadSha256,
          prevRecordSha256: record.prevRecordSha256,
          sealedAt: record.sealedAt,
        }),
      );
      if (expected !== record.recordSha256) {
        return { ok: false, atSeq: record.seq };
      }
      prev = record.recordSha256;
    }
    return { ok: true };
  }
}
