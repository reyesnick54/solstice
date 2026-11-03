import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { RevisionLedgerRecord, RevisionLedgerStoreSnapshot } from './revision-ledger-types.ts';

export type RevisionLedgerStore = {
  readonly append: (record: RevisionLedgerRecord) => 'APPENDED' | 'DUPLICATE';
  readonly list: () => readonly RevisionLedgerRecord[];
  readonly listForSeries: (seriesId: string, eventPeriod: string) => readonly RevisionLedgerRecord[];
  readonly valueKnowableAt: (
    seriesId: string,
    eventPeriod: string,
    asOfKnowableAt: UtcInstant,
  ) => RevisionLedgerRecord | null;
  readonly latestValue: (seriesId: string, eventPeriod: string) => RevisionLedgerRecord | null;
  readonly snapshot: () => RevisionLedgerStoreSnapshot;
  readonly restore: (snapshot: RevisionLedgerStoreSnapshot) => void;
};

function seriesKey(seriesId: string, eventPeriod: string): string {
  return `${seriesId}|${eventPeriod}`;
}

function compareRevisionRecords(a: RevisionLedgerRecord, b: RevisionLedgerRecord): number {
  const knowableDelta = Date.parse(a.knowableAt) - Date.parse(b.knowableAt);
  if (knowableDelta !== 0) {
    return knowableDelta;
  }
  return a.revisionRecordId.localeCompare(b.revisionRecordId);
}

export function createRevisionLedgerRecordStore(): RevisionLedgerStore {
  const byId = new Map<string, RevisionLedgerRecord>();
  const bySeries = new Map<string, RevisionLedgerRecord[]>();

  function indexRecord(record: RevisionLedgerRecord): void {
    const key = seriesKey(record.seriesId, record.eventPeriod);
    const list = bySeries.get(key) ?? [];
    list.push(record);
    list.sort(compareRevisionRecords);
    bySeries.set(key, list);
  }

  return Object.freeze({
    append(record: RevisionLedgerRecord) {
      if (byId.has(record.revisionRecordId)) {
        return 'DUPLICATE';
      }
      byId.set(record.revisionRecordId, record);
      indexRecord(record);
      return 'APPENDED';
    },
    list() {
      return Object.freeze([...byId.values()].sort(compareRevisionRecords));
    },
    listForSeries(seriesId: string, eventPeriod: string) {
      return Object.freeze([...(bySeries.get(seriesKey(seriesId, eventPeriod)) ?? [])]);
    },
    valueKnowableAt(seriesId: string, eventPeriod: string, asOfKnowableAt: UtcInstant) {
      const cutoff = Date.parse(asOfKnowableAt);
      const rows = bySeries.get(seriesKey(seriesId, eventPeriod)) ?? [];
      let selected: RevisionLedgerRecord | null = null;
      for (const row of rows) {
        if (Date.parse(row.knowableAt) <= cutoff) {
          selected = row;
        }
      }
      return selected;
    },
    latestValue(seriesId: string, eventPeriod: string) {
      const rows = bySeries.get(seriesKey(seriesId, eventPeriod)) ?? [];
      return rows.at(-1) ?? null;
    },
    snapshot() {
      return Object.freeze({
        records: Object.freeze([...byId.values()].sort(compareRevisionRecords)),
      });
    },
    restore(snapshot: RevisionLedgerStoreSnapshot) {
      byId.clear();
      bySeries.clear();
      for (const record of snapshot.records) {
        byId.set(record.revisionRecordId, record);
        indexRecord(record);
      }
    },
  });
}
