/**
 * AAF06 — append-only revision ledger for macro and temporal observations.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const HELIOS_AAF06_REVISION_LEDGER_SCHEMA = 'sunrey.helios.aaf06.revision-ledger.v1' as const;

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

export type RevisionLedgerEntry = {
  readonly schemaVersion: typeof HELIOS_AAF06_REVISION_LEDGER_SCHEMA;
  readonly revisionChainId: string;
  readonly observationRef: string;
  readonly revisionSequence: number;
  readonly eventPeriod: string;
  readonly periodEnd: UtcInstant | null;
  readonly originalPublicationTime: UtcInstant;
  readonly revisionPublicationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly supersedesObservationRef: string | null;
  readonly supersededByObservationRef: string | null;
  readonly valueMinor: bigint;
  readonly valueDecimal: string;
  readonly source: string;
  readonly evidence: string;
  readonly provider: string;
  readonly lineage: RevisionLedgerLineage;
  readonly revisionKind: RevisionRecordKind;
  readonly evidenceRef: string | null;
  readonly sourceProvider: string;
  readonly grantsExecutionAuthority: false;
};

export type RevisionLedgerSnapshot = {
  readonly entries: readonly RevisionLedgerEntry[];
};
