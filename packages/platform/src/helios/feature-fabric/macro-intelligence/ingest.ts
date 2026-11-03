import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { RevisionLedgerRecord, RevisionRecordKind } from '../aaf06/revision-ledger-types.ts';
import {
  HELIOS_AAF06_REVISION_LEDGER_SCHEMA,
  type RevisionLedgerEntry,
} from '../revision-ledger/types.ts';
import type { TemporalObservation } from '../temporal-types.ts';
import { US_MACRO_SERIES_CATALOG } from './series-catalog.ts';
import { HELIOS_AAF10_MACRO_INTELLIGENCE_SCHEMA } from './taxonomy.ts';
import type {
  MacroOfficialReleaseEvent,
  MacroSeriesReadingInput,
  MacroValueRevision,
} from './types.ts';

export function macroReadingToTemporalObservation(
  reading: MacroSeriesReadingInput,
): TemporalObservation {
  const catalog = US_MACRO_SERIES_CATALOG[reading.seriesKey];
  return Object.freeze({
    observationRef: reading.observationRef,
    kind: 'MACRO_RELEASE',
    entityId: 'entity.jurisdiction.US',
    instrumentId: null,
    sourceEventTime: reading.periodEnd,
    knowableAt: reading.knowableAt,
    validUntil: null,
    revisionSequence: reading.revisionSequence,
    periodEnd: reading.periodEnd,
    publishedKnowableAt: reading.knowableAt,
    valueMinor: reading.valueMinor,
    metadata: Object.freeze({
      seriesKey: reading.seriesKey,
      releaseType: reading.releaseType ?? catalog.defaultReleaseType,
      providerId: reading.source.providerId,
      providerSeriesId: reading.source.seriesId,
      revisionChainId: reading.revisionChainId,
    }),
  });
}

function revisionKindFor(reading: MacroSeriesReadingInput): RevisionRecordKind {
  if (reading.revisionSequence === 0) {
    return 'INITIAL_RELEASE';
  }
  return 'REVISION';
}

function seriesKindFor(reading: MacroSeriesReadingInput): RevisionLedgerRecord['seriesKind'] {
  switch (reading.seriesKey) {
    case 'cpi':
      return 'CPI';
    case 'gdp':
      return 'GDP';
    case 'unemployment':
    case 'payroll':
      return 'EMPLOYMENT';
    default:
      return 'GDP';
  }
}

export function macroReadingToRevisionLedgerRecord(reading: MacroSeriesReadingInput): RevisionLedgerRecord {
  const eventPeriod = reading.periodEnd.slice(0, 7);
  const lineageId = `lineage.${reading.revisionChainId}.${reading.revisionSequence}`;
  const prior =
    reading.revisionSequence > 0
      ? `obs.${reading.revisionChainId}.v${reading.revisionSequence - 1}`
      : null;
  return Object.freeze({
    revisionRecordId: reading.observationRef,
    seriesId: reading.source.seriesId,
    seriesKind: seriesKindFor(reading),
    eventPeriod,
    originalPublicationTime: reading.knowableAt,
    revisionPublicationTime: reading.actualPublicationTime ?? reading.knowableAt,
    knowableAt: reading.knowableAt,
    supersedesRevisionRecordId: prior,
    value: Object.freeze({
      decimal: (Number(reading.valueMinor) / 100).toFixed(4),
      unit: reading.seriesKey,
    }),
    source: reading.source.providerId,
    evidence: reading.evidenceRef ?? `evidence:${reading.observationRef}`,
    provider: reading.source.providerId,
    lineage: Object.freeze({
      lineageId,
      parentLineageIds: Object.freeze(prior ? [prior] : []),
      contentFingerprint: lineageId,
    }),
    revisionKind: revisionKindFor(reading),
  });
}

export type MacroRevisionLedgerChainOptions = {
  readonly supersedesObservationRef?: string | null;
  readonly originalPublicationTime?: UtcInstant;
};

/** Chain-store entry for AAF06 revision-ledger (observation-ref keyed). */
export function macroReadingToRevisionLedgerEntry(
  reading: MacroSeriesReadingInput,
  options: MacroRevisionLedgerChainOptions = {},
): RevisionLedgerEntry {
  const eventPeriod = reading.periodEnd.slice(0, 7);
  const lineageId = `lineage.${reading.revisionChainId}.${reading.revisionSequence}`;
  const supersedesObservationRef =
    options.supersedesObservationRef ??
    (reading.revisionSequence > 0 ? `obs.${reading.revisionChainId}.v${reading.revisionSequence - 1}` : null);
  const originalPublicationTime = options.originalPublicationTime ?? reading.knowableAt;
  return Object.freeze({
    schemaVersion: HELIOS_AAF06_REVISION_LEDGER_SCHEMA,
    revisionChainId: reading.revisionChainId,
    observationRef: reading.observationRef,
    revisionSequence: reading.revisionSequence,
    eventPeriod,
    periodEnd: reading.periodEnd,
    originalPublicationTime,
    revisionPublicationTime: reading.actualPublicationTime ?? reading.knowableAt,
    knowableAt: reading.knowableAt,
    supersedesObservationRef,
    supersededByObservationRef: null,
    valueMinor: reading.valueMinor,
    valueDecimal: (Number(reading.valueMinor) / 100).toFixed(4),
    source: reading.source.providerId,
    evidence: reading.evidenceRef ?? `evidence:${reading.observationRef}`,
    provider: reading.source.providerId,
    lineage: Object.freeze({
      lineageId,
      parentLineageIds: Object.freeze(supersedesObservationRef ? [supersedesObservationRef] : []),
      contentFingerprint: lineageId,
    }),
    revisionKind: revisionKindFor(reading),
    evidenceRef: reading.evidenceRef ?? null,
    sourceProvider: reading.source.providerId,
    grantsExecutionAuthority: false as const,
  });
}

function toValueRevision(reading: MacroSeriesReadingInput): MacroValueRevision {
  return Object.freeze({
    revisionSequence: reading.revisionSequence,
    valueMinor: reading.valueMinor,
    knowableAt: reading.knowableAt,
    providerAvailabilityTime: reading.providerAvailabilityTime,
    sunreyArrivalTime: reading.sunreyArrivalTime,
    evidenceRef: reading.evidenceRef ?? null,
  });
}

export function upsertReleaseEventFromReading(
  existing: MacroOfficialReleaseEvent | undefined,
  reading: MacroSeriesReadingInput,
): MacroOfficialReleaseEvent {
  const catalog = US_MACRO_SERIES_CATALOG[reading.seriesKey];
  const revision = toValueRevision(reading);
  if (!existing) {
    return Object.freeze({
      schema: HELIOS_AAF10_MACRO_INTELLIGENCE_SCHEMA,
      eventId: `aaf10.release.${reading.seriesKey}.${reading.periodEnd}`,
      releaseType: reading.releaseType ?? catalog.defaultReleaseType,
      seriesKey: reading.seriesKey,
      periodRepresented: reading.periodEnd.slice(0, 7),
      scheduledReleaseTime: reading.scheduledReleaseTime ?? null,
      actualPublicationTime: reading.actualPublicationTime ?? reading.knowableAt,
      providerAvailabilityTime: reading.providerAvailabilityTime,
      sunreyArrivalTime: reading.sunreyArrivalTime,
      knowableAt: reading.knowableAt,
      initialReportedValue: revision.revisionSequence === 0 ? revision : revision,
      revisions: Object.freeze(reading.revisionSequence === 0 ? [] : [revision]),
      revisionChainId: reading.revisionChainId,
      evidenceRefs: Object.freeze(reading.evidenceRef ? [reading.evidenceRef] : []),
      source: reading.source,
      entitlement: reading.entitlement,
      grantsExecutionAuthority: false,
    });
  }

  const initial =
    existing.initialReportedValue.revisionSequence === 0
      ? existing.initialReportedValue
      : existing.initialReportedValue;
  const revisions = [...existing.revisions];
  if (reading.revisionSequence > 0) {
    revisions.push(revision);
  }
  const knowableAt = maxInstant(existing.knowableAt, reading.knowableAt);
  return Object.freeze({
    ...existing,
    actualPublicationTime: reading.actualPublicationTime ?? existing.actualPublicationTime,
    providerAvailabilityTime: reading.providerAvailabilityTime,
    sunreyArrivalTime: reading.sunreyArrivalTime,
    knowableAt,
    initialReportedValue: reading.revisionSequence === 0 ? revision : initial,
    revisions: Object.freeze(revisions),
    evidenceRefs: Object.freeze([
      ...existing.evidenceRefs,
      ...(reading.evidenceRef ? [reading.evidenceRef] : []),
    ]),
  });
}

function maxInstant(a: UtcInstant, b: UtcInstant): UtcInstant {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function detectConflictingOfficialSources(
  readings: readonly MacroSeriesReadingInput[],
): readonly { readonly seriesKey: string; readonly providers: readonly string[] }[] {
  const byKey = new Map<string, Set<string>>();
  for (const row of readings) {
    if (row.revisionSequence !== 0) {
      continue;
    }
    const key = `${row.seriesKey}|${row.periodEnd}`;
    const set = byKey.get(key) ?? new Set<string>();
    set.add(row.source.providerId);
    byKey.set(key, set);
  }
  const conflicts: { seriesKey: string; providers: readonly string[] }[] = [];
  for (const [key, providers] of byKey.entries()) {
    if (providers.size > 1) {
      conflicts.push(
        Object.freeze({
          seriesKey: key,
          providers: Object.freeze([...providers].sort()),
        }),
      );
    }
  }
  return Object.freeze(conflicts);
}
