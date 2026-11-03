/**
 * AAF revision ledger — append-only amendment / restatement lineage for observations.
 * Restatements are never overwritten; effective views are computed at query time.
 */

import { createHash } from 'node:crypto';

export type RevisionRecord = {
  readonly revisionId: string;
  readonly filingId: string;
  readonly rootFilingId: string;
  readonly revisionNumber: number;
  readonly knowableAtUtc: string;
  readonly amendmentKind: 'original' | 'amendment' | 'restatement';
  readonly supersedesFilingId: string | null;
  readonly evidenceRef: string;
  readonly payloadDigest: string;
};

export type AppendRevisionInput = {
  readonly filingId: string;
  readonly rootFilingId: string;
  readonly knowableAtUtc: string;
  readonly amendmentKind: 'original' | 'amendment' | 'restatement';
  readonly supersedesFilingId?: string | null;
  readonly evidenceRef: string;
  readonly payloadMaterial: readonly string[];
};

export type AafRevisionLedger = {
  append(input: AppendRevisionInput): RevisionRecord;
  get(filingId: string): RevisionRecord | undefined;
  listByRoot(rootFilingId: string): readonly RevisionRecord[];
  all(): readonly RevisionRecord[];
  effectiveFilingIdsAt(rootFilingId: string, evaluationTimeUtc: string): readonly string[];
};

function digest(material: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function revisionIdFor(filingId: string, revisionNumber: number): string {
  return `aaf-rev:${filingId}:r${revisionNumber}`;
}

export function createAafRevisionLedger(): AafRevisionLedger {
  const byFilingId = new Map<string, RevisionRecord>();
  const byRoot = new Map<string, RevisionRecord[]>();
  const revisionCounter = new Map<string, number>();

  return {
    append(input) {
      if (byFilingId.has(input.filingId)) {
        throw new Error(`AAF revision ledger: filingId already sealed: ${input.filingId}`);
      }
      const next = (revisionCounter.get(input.rootFilingId) ?? 0) + 1;
      revisionCounter.set(input.rootFilingId, next);
      const record: RevisionRecord = Object.freeze({
        revisionId: revisionIdFor(input.filingId, next),
        filingId: input.filingId,
        rootFilingId: input.rootFilingId,
        revisionNumber: next,
        knowableAtUtc: input.knowableAtUtc,
        amendmentKind: input.amendmentKind,
        supersedesFilingId: input.supersedesFilingId ?? null,
        evidenceRef: input.evidenceRef,
        payloadDigest: digest(input.payloadMaterial),
      });
      byFilingId.set(record.filingId, record);
      const rootList = byRoot.get(input.rootFilingId) ?? [];
      rootList.push(record);
      byRoot.set(input.rootFilingId, rootList);
      return record;
    },
    get(filingId) {
      return byFilingId.get(filingId);
    },
    listByRoot(rootFilingId) {
      return Object.freeze([...(byRoot.get(rootFilingId) ?? [])]);
    },
    all() {
      return Object.freeze([...byFilingId.values()]);
    },
    effectiveFilingIdsAt(rootFilingId, evaluationTimeUtc) {
      const evalMs = Date.parse(evaluationTimeUtc);
      if (!Number.isFinite(evalMs)) {
        return Object.freeze([]);
      }
      const rows = (byRoot.get(rootFilingId) ?? []).filter((row) => {
        const knowMs = Date.parse(row.knowableAtUtc);
        return Number.isFinite(knowMs) && knowMs <= evalMs;
      });
      rows.sort((a, b) => a.revisionNumber - b.revisionNumber);
      return Object.freeze(rows.map((row) => row.filingId));
    },
  };
}
