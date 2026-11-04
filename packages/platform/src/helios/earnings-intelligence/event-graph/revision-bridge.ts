/**
 * Bind SEC earnings filings into the HELIOS AAF revision ledger (append-only).
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import type { EarningsExternalObservation } from '../../../../../external-data/src/earnings/types.ts';
import {
  createRevisionLedgerStore,
  type RevisionLedgerStore,
} from '../../feature-fabric/revision-ledger/store.ts';
import {
  HELIOS_AAF06_REVISION_LEDGER_SCHEMA,
  type RevisionLedgerEntry,
} from '../../feature-fabric/revision-ledger/types.ts';

export function earningsObservationToRevisionEntry(
  observation: EarningsExternalObservation,
  revisionSequence: number,
  options: {
    readonly supersedesObservationRef?: string | null;
    readonly originalPublicationTime?: import('../../../../../domain/src/time.ts').UtcInstant;
  } = {},
): RevisionLedgerEntry {
  if (!observation.filingId) {
    throw new Error('EARNINGS_REVISION_REQUIRES_FILING_ID');
  }
  const revisionChainId = observation.lineageRootId;
  const supersedesObservationRef = options.supersedesObservationRef ?? observation.supersedesObservationId;
  const originalPublicationTime = options.originalPublicationTime ?? observation.times.knowableAt;
  const lineageId = `lineage.${revisionChainId}.${revisionSequence}`;
  const revisionKind =
    revisionSequence === 0
      ? 'INITIAL_RELEASE'
      : observation.secForm?.endsWith('/A')
        ? 'RESTATEMENT'
        : 'REVISION';

  return Object.freeze({
    schemaVersion: HELIOS_AAF06_REVISION_LEDGER_SCHEMA,
    revisionChainId,
    observationRef: observation.observationId,
    revisionSequence,
    eventPeriod: observation.fiscal.reportPeriod.slice(0, 7),
    periodEnd: asUtcInstant(`${observation.fiscal.reportPeriod}T00:00:00.000Z`),
    originalPublicationTime,
    revisionPublicationTime: observation.times.knowableAt,
    knowableAt: observation.times.knowableAt,
    supersedesObservationRef,
    supersededByObservationRef: null,
    valueMinor: 0n,
    valueDecimal: '0.0000',
    source: observation.provenance.providerId,
    evidence: observation.provenance.evidenceRef,
    provider: observation.provenance.providerId,
    lineage: Object.freeze({
      lineageId,
      parentLineageIds: Object.freeze(supersedesObservationRef ? [supersedesObservationRef] : []),
      contentFingerprint: observation.provenance.rawPayloadHash,
    }),
    revisionKind,
    evidenceRef: observation.provenance.evidenceRef,
    sourceProvider: observation.provenance.providerId,
    grantsExecutionAuthority: false,
  });
}

export function appendEarningsSecRevisionIfAbsent(
  observation: EarningsExternalObservation,
  store: RevisionLedgerStore,
): void {
  if (observation.provenance.providerKind !== 'SEC_EDGAR' || !observation.filingId) {
    return;
  }
  if (store.list().some((row) => row.observationRef === observation.observationId)) {
    return;
  }
  const chain = store.listChain(observation.lineageRootId);
  const originalPublicationTime = chain[0]?.originalPublicationTime ?? observation.times.knowableAt;
  const entry = earningsObservationToRevisionEntry(observation, chain.length, {
    supersedesObservationRef: chain.length > 0 ? chain[chain.length - 1]!.observationRef : null,
    originalPublicationTime,
  });
  store.append(entry);
}

export function bindEarningsSecRevisions(
  observations: readonly EarningsExternalObservation[],
  store: RevisionLedgerStore = createRevisionLedgerStore(),
): RevisionLedgerStore {
  const secRows = observations
    .filter((row) => row.provenance.providerKind === 'SEC_EDGAR' && row.filingId)
    .sort((a, b) => Date.parse(a.times.knowableAt) - Date.parse(b.times.knowableAt));

  for (const row of secRows) {
    appendEarningsSecRevisionIfAbsent(row, store);
  }
  return store;
}
