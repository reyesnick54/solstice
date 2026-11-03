/**
 * AAF10 point-in-time macro feature plane — research and strategy inputs only.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { filterKnowableObservations } from '../compiler/as-of.ts';
import type { RevisionPolicy, TemporalObservation } from '../temporal-types.ts';
import { createRevisionLedgerStore, type RevisionLedgerStore } from '../revision-ledger/store.ts';
import { computeMacroFeatures } from './features.ts';
import {
  detectConflictingOfficialSources,
  macroReadingToRevisionLedgerEntry,
  macroReadingToTemporalObservation,
  upsertReleaseEventFromReading,
} from './ingest.ts';
import { macroReleaseToM14IngestInput } from './m14-bridge.ts';
import type { MacroEventIntelligenceFabric } from '../../multi-asset/event-intelligence/fabric.ts';
import type {
  Aaf10MacroFeaturePlane,
  CertifiedExpectationInput,
  MacroIntelligenceStoreSnapshot,
  MacroSeriesReadingInput,
} from './types.ts';

export type PointInTimeMacroIntelligenceFabricOptions = {
  readonly revisionLedger?: RevisionLedgerStore;
  readonly macroEventFabric?: MacroEventIntelligenceFabric;
  readonly syncM14OnIngest?: boolean;
};

function collapseMacroObservations(
  observations: readonly TemporalObservation[],
  revisionPolicy: RevisionPolicy,
): readonly TemporalObservation[] {
  const byKey = new Map<string, TemporalObservation>();
  for (const row of observations) {
    if (revisionPolicy === 'INITIAL_PUBLICATION_ONLY' && row.revisionSequence !== 0) {
      continue;
    }
    const key = `${row.metadata.seriesKey ?? ''}|${row.periodEnd ?? row.sourceEventTime}`;
    const existing = byKey.get(key);
    if (!existing || row.revisionSequence >= existing.revisionSequence) {
      byKey.set(key, row);
    }
  }
  return Object.freeze([...byKey.values()]);
}

export type IngestMacroReadingResult =
  | {
      readonly ok: true;
      readonly conflicts: readonly { readonly seriesKey: string; readonly providers: readonly string[] }[];
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class PointInTimeMacroIntelligenceFabric {
  readonly #ledger: RevisionLedgerStore;
  readonly #macroEventFabric: MacroEventIntelligenceFabric | null;
  readonly #syncM14: boolean;
  readonly #observations: MacroSeriesReadingInput[] = [];
  readonly #releaseEvents = new Map<string, import('./types.ts').MacroOfficialReleaseEvent>();

  constructor(options: PointInTimeMacroIntelligenceFabricOptions = {}) {
    this.#ledger = options.revisionLedger ?? createRevisionLedgerStore();
    this.#macroEventFabric = options.macroEventFabric ?? null;
    this.#syncM14 = options.syncM14OnIngest ?? false;
  }

  revisionLedger(): RevisionLedgerStore {
    return this.#ledger;
  }

  ingestReading(reading: MacroSeriesReadingInput): IngestMacroReadingResult {
    try {
      this.#observations.push(reading);
      const chain = this.#ledger.listChain(reading.revisionChainId);
      const prior = chain
        .filter((row) => row.revisionSequence < reading.revisionSequence)
        .sort((a, b) => b.revisionSequence - a.revisionSequence)[0];
      const originalPublicationTime =
        chain.find((row) => row.revisionSequence === 0)?.knowableAt ?? reading.knowableAt;
      this.#ledger.append(
        macroReadingToRevisionLedgerEntry(reading, {
          supersedesObservationRef: prior?.observationRef ?? null,
          originalPublicationTime,
        }),
      );
      const eventKey = `${reading.seriesKey}|${reading.periodEnd}`;
      const existing = this.#releaseEvents.get(eventKey);
      const event = upsertReleaseEventFromReading(existing, reading);
      this.#releaseEvents.set(eventKey, event);

      if (this.#syncM14 && this.#macroEventFabric) {
        const ingestInput = macroReleaseToM14IngestInput(event, reading.knowableAt);
        this.#macroEventFabric.ingest(ingestInput, reading.sunreyArrivalTime);
      }

      const conflicts = detectConflictingOfficialSources(this.#observations);
      return Object.freeze({ ok: true, conflicts });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INGEST_FAILED';
      if (message.startsWith('DUPLICATE_OBSERVATION_REF')) {
        return Object.freeze({ ok: false, code: 'DUPLICATE_OBSERVATION', message });
      }
      return Object.freeze({ ok: false, code: 'INGEST_FAILED', message });
    }
  }

  compileFeaturePlane(input: {
    readonly evaluationTime: UtcInstant;
    readonly revisionPolicy?: RevisionPolicy;
    readonly certifiedExpectation?: CertifiedExpectationInput | null;
  }): Aaf10MacroFeaturePlane {
    const revisionPolicy = input.revisionPolicy ?? 'LATEST_KNOWABLE_REVISION';
    const temporal = this.#observations.map((row) => macroReadingToTemporalObservation(row));
    const visible = collapseMacroObservations(
      filterKnowableObservations(temporal, input.evaluationTime),
      revisionPolicy,
    );
    const releaseEvents = [...this.#releaseEvents.values()].filter(
      (row) => Date.parse(row.knowableAt) <= Date.parse(input.evaluationTime),
    );
    const features = computeMacroFeatures({
      evaluationTime: input.evaluationTime,
      revisionPolicy,
      observations: visible,
      releaseEvents,
      certifiedExpectation: input.certifiedExpectation ?? null,
    });
    return Object.freeze({
      evaluationTime: input.evaluationTime,
      revisionPolicy,
      features,
      observations: visible,
      releaseEvents: Object.freeze(releaseEvents),
      grantsExecutionAuthority: false,
    });
  }

  snapshot(): MacroIntelligenceStoreSnapshot {
    const temporal = this.#observations.map((row) => macroReadingToTemporalObservation(row));
    return Object.freeze({
      observations: Object.freeze(temporal),
      releaseEvents: Object.freeze([...this.#releaseEvents.values()]),
    });
  }

  restore(snapshot: MacroIntelligenceStoreSnapshot): void {
    this.#observations.length = 0;
    this.#releaseEvents.clear();
    this.#ledger.restore({ entries: Object.freeze([]) });
    for (const event of snapshot.releaseEvents) {
      const key = `${event.seriesKey}|${event.periodRepresented}`;
      this.#releaseEvents.set(key, event);
    }
  }
}

export function createPointInTimeMacroIntelligenceFabric(
  options?: PointInTimeMacroIntelligenceFabricOptions,
): PointInTimeMacroIntelligenceFabric {
  return new PointInTimeMacroIntelligenceFabric(options);
}
