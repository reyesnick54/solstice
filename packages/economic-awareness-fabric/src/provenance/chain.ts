import { createHash } from 'node:crypto';

export type ProvenanceRecord = {
  readonly provenanceId: string;
  readonly sourceId: string;
  readonly method: string;
  readonly collectedAtUtc: string;
  readonly parentProvenanceId: string | null;
  readonly digest: string;
};

export type ProvenanceChain = {
  append(record: Omit<ProvenanceRecord, 'digest'>): ProvenanceRecord;
  get(provenanceId: string): ProvenanceRecord | undefined;
  lineage(provenanceId: string): readonly ProvenanceRecord[];
  verify(provenanceId: string): boolean;
};

function digestOf(record: Omit<ProvenanceRecord, 'digest'>): string {
  const payload = JSON.stringify({
    provenanceId: record.provenanceId,
    sourceId: record.sourceId,
    method: record.method,
    collectedAtUtc: record.collectedAtUtc,
    parentProvenanceId: record.parentProvenanceId,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function createProvenanceChain(): ProvenanceChain {
  const records = new Map<string, ProvenanceRecord>();

  return {
    append(record) {
      const sealed: ProvenanceRecord = Object.freeze({
        ...record,
        digest: digestOf(record),
      });
      records.set(sealed.provenanceId, sealed);
      return sealed;
    },
    get(provenanceId) {
      return records.get(provenanceId);
    },
    lineage(provenanceId) {
      const chain: ProvenanceRecord[] = [];
      let current = records.get(provenanceId);
      while (current) {
        chain.push(current);
        current = current.parentProvenanceId ? records.get(current.parentProvenanceId) : undefined;
      }
      return Object.freeze(chain.reverse());
    },
    verify(provenanceId) {
      const record = records.get(provenanceId);
      if (!record) return false;
      return record.digest === digestOf(record);
    },
  };
}
