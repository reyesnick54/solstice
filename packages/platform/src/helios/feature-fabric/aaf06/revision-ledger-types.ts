/**
 * AAF06 — append-only revision ledger for macro and fundamental vintages.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const REVISION_SENSITIVE_SERIES_KINDS = [
  'GDP',
  'CPI',
  'EMPLOYMENT',
  'COMPANY_FUNDAMENTAL',
  'CORPORATE_FILING',
  'RESTATEMENT',
  'PROVIDER_CORRECTION',
] as const;
export type RevisionSensitiveSeriesKind = (typeof REVISION_SENSITIVE_SERIES_KINDS)[number];

export const REVISION_RECORD_KINDS = [
  'INITIAL_RELEASE',
  'REVISION',
  'PROVIDER_CORRECTION',
  'RESTATEMENT',
] as const;
export type RevisionRecordKind = (typeof REVISION_RECORD_KINDS)[number];

export type RevisionLedgerLineage = {
  readonly lineageId: string;
  readonly parentLineageIds: readonly string[];
  readonly contentFingerprint: string;
};

export type RevisionLedgerValue = {
  readonly decimal: string;
  readonly unit: string | null;
};

export type RevisionLedgerRecord = {
  readonly revisionRecordId: string;
  readonly seriesId: string;
  readonly seriesKind: RevisionSensitiveSeriesKind;
  readonly eventPeriod: string;
  readonly originalPublicationTime: UtcInstant;
  readonly revisionPublicationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly supersedesRevisionRecordId: string | null;
  readonly value: RevisionLedgerValue;
  readonly source: string;
  readonly evidence: string;
  readonly provider: string;
  readonly lineage: RevisionLedgerLineage;
  readonly revisionKind: RevisionRecordKind;
};

export type RevisionLedgerStoreSnapshot = {
  readonly records: readonly RevisionLedgerRecord[];
};
