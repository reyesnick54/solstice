/**
 * ALT01 point-in-time alternative-data feature slice inside canonical Feature Fabric.
 */

import type { UtcInstant } from '@solstice/domain';
import { createAlternativeDataIntelligenceFabric } from '../../alternative-data-intelligence/service.ts';
import type {
  AlternativeDataObservation,
  AlternativeDataObservationInput,
} from '../../alternative-data-intelligence/types.ts';
import { assertNoBackfillBeforeHistoricalAvailability } from '../../alternative-data-intelligence/knowable-at.ts';
import { createRevisionLedgerStore, type RevisionLedgerStore } from '../revision-ledger/store.ts';
import type { RevisionPolicy } from '../temporal-types.ts';
import {
  alternativeDataObservationToRevisionLedgerEntry,
  alternativeDataObservationToTemporalObservation,
} from './ingest.ts';
import { HELIOS_ALT01_FEATURE_FABRIC_SCHEMA } from './taxonomy.ts';
import type { PointInTimeAlternativeDataFeaturePlane } from './types.ts';

export type PointInTimeAlternativeDataFabricOptions = {
  readonly revisionLedger?: RevisionLedgerStore;
};

export type IngestAlternativeDataResult =
  | { readonly ok: true; readonly observationId: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class PointInTimeAlternativeDataFabric {
  readonly #intelligence = createAlternativeDataIntelligenceFabric();
  readonly #ledger: RevisionLedgerStore;

  constructor(options: PointInTimeAlternativeDataFabricOptions = {}) {
    this.#ledger = options.revisionLedger ?? createRevisionLedgerStore();
  }

  revisionLedger(): RevisionLedgerStore {
    return this.#ledger;
  }

  ingestObservation(input: AlternativeDataObservationInput): IngestAlternativeDataResult {
    let observation: AlternativeDataObservation;
    try {
      observation = this.#intelligence.ingestObservation(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const colon = message.indexOf(':');
      const code = colon >= 0 ? message.slice(0, colon) : 'INGEST_REJECTED';
      const detail = colon >= 0 ? message.slice(colon + 1) : message;
      return Object.freeze({ ok: false, code, message: detail });
    }
    const backfill = assertNoBackfillBeforeHistoricalAvailability(observation);
    if (!backfill.ok) {
      return backfill;
    }
    this.#ledger.append(alternativeDataObservationToRevisionLedgerEntry(observation));
    return Object.freeze({ ok: true, observationId: observation.observationId });
  }

  compileFeaturePlane(input: {
    readonly evaluationTime: UtcInstant;
    readonly revisionPolicy?: RevisionPolicy;
  }): PointInTimeAlternativeDataFeaturePlane {
    const plane = this.#intelligence.compilePlane(input);
    const temporalObservations = Object.freeze(
      plane.observations.map((row) => alternativeDataObservationToTemporalObservation(row)),
    );
    return Object.freeze({
      schema: HELIOS_ALT01_FEATURE_FABRIC_SCHEMA,
      evaluationTime: input.evaluationTime,
      revisionPolicy: input.revisionPolicy ?? 'LATEST_KNOWABLE_REVISION',
      observations: plane.observations,
      features: plane.features,
      temporalObservations,
      coverageStates: plane.coverageStates,
      grantsExecutionAuthority: false,
    });
  }
}

export function createPointInTimeAlternativeDataFabric(
  options?: PointInTimeAlternativeDataFabricOptions,
): PointInTimeAlternativeDataFabric {
  return new PointInTimeAlternativeDataFabric(options);
}
