/**
 * ALT01 alternative-data intelligence plane — research inputs only.
 */

import type { UtcInstant } from '@solstice/domain';
import type { RevisionPolicy } from '../feature-fabric/temporal-types.ts';
import {
  assertNoBackfillBeforeHistoricalAvailability,
  filterKnowableAlternativeDataObservations,
} from './knowable-at.ts';
import { computeAlternativeDataFeatures } from './features.ts';
import { buildAlternativeDataCoverageState } from './coverage.ts';
import { ALT01_REFERENCE_AND_RESEARCH_ONLY } from './authority.ts';
import { HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA } from './taxonomy.ts';
import type {
  AlternativeDataIntelligencePlane,
  AlternativeDataIntelligenceStoreSnapshot,
  AlternativeDataObservation,
  AlternativeDataObservationInput,
  AlternativeDataSeries,
  AlternativeDataSourceManifest,
} from './types.ts';

export type AlternativeDataIntelligenceFabricOptions = {
  readonly initialSnapshot?: AlternativeDataIntelligenceStoreSnapshot;
};

export class AlternativeDataIntelligenceFabric {
  readonly #manifests = new Map<string, AlternativeDataSourceManifest>();
  readonly #series = new Map<string, AlternativeDataSeries>();
  readonly #observations: AlternativeDataObservation[] = [];

  constructor(options: AlternativeDataIntelligenceFabricOptions = {}) {
    for (const manifest of options.initialSnapshot?.manifests ?? []) {
      this.#manifests.set(manifest.manifestId, manifest);
    }
    for (const row of options.initialSnapshot?.series ?? []) {
      this.#series.set(row.seriesId, row);
    }
    this.#observations.push(...(options.initialSnapshot?.observations ?? []));
  }

  registerManifest(manifest: AlternativeDataSourceManifest): void {
    this.#manifests.set(manifest.manifestId, manifest);
  }

  registerSeries(series: AlternativeDataSeries): void {
    this.#series.set(series.seriesId, series);
  }

  ingestObservation(input: AlternativeDataObservationInput): AlternativeDataObservation {
    const observation: AlternativeDataObservation = Object.freeze({
      ...input,
      schema: HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
      grantsExecutionAuthority: false,
    });
    const backfill = assertNoBackfillBeforeHistoricalAvailability(observation);
    if (!backfill.ok) {
      throw new Error(`${backfill.code}:${backfill.message}`);
    }
    this.#observations.push(observation);
    return observation;
  }

  snapshot(): AlternativeDataIntelligenceStoreSnapshot {
    return Object.freeze({
      manifests: Object.freeze([...this.#manifests.values()]),
      series: Object.freeze([...this.#series.values()]),
      observations: Object.freeze([...this.#observations]),
    });
  }

  compilePlane(input: {
    readonly evaluationTime: UtcInstant;
    readonly revisionPolicy?: RevisionPolicy;
  }): AlternativeDataIntelligencePlane {
    const revisionPolicy = input.revisionPolicy ?? 'LATEST_KNOWABLE_REVISION';
    const visible = filterKnowableAlternativeDataObservations(this.#observations, input.evaluationTime);
    const features = computeAlternativeDataFeatures(visible);
    const coverageKeys = new Map<string, { family: AlternativeDataObservation['signalFamily']; providerId: string }>();
    for (const row of visible) {
      coverageKeys.set(`${row.signalFamily}|${row.providerId}`, {
        family: row.signalFamily,
        providerId: row.providerId,
      });
    }
    const coverageStates = Object.freeze(
      [...coverageKeys.values()].map((key) =>
        buildAlternativeDataCoverageState({
          signalFamily: key.family,
          providerId: key.providerId,
          observations: visible,
        }),
      ),
    );
    const temporalObservations = Object.freeze(
      visible.map((row) =>
        Object.freeze({
          observationRef: row.observationId,
          kind: 'ALT_DATA' as const,
          entityId: row.entityLink.canonicalEntityId ?? 'entity.unresolved',
          instrumentId: row.entityLink.canonicalInstrumentId,
          sourceEventTime: row.eventTime ?? row.knowableAt,
          knowableAt: row.knowableAt,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: row.eventTime,
          publishedKnowableAt: row.knowableAt,
          valueMinor: row.valueMinor ?? 0n,
          metadata: Object.freeze({
            signalFamily: row.signalFamily,
            providerId: row.providerId,
            revisionId: row.revisionId,
            providerSurface: row.providerId,
            entitlementRef: row.entitlementRef,
            licenseClass: row.licenseClass,
            qualityState: row.qualityState,
          }),
        }),
      ),
    );
    return Object.freeze({
      evaluationTime: input.evaluationTime,
      revisionPolicy,
      authorityClass: ALT01_REFERENCE_AND_RESEARCH_ONLY,
      observations: visible,
      features,
      temporalObservations,
      coverageStates,
      grantsExecutionAuthority: false,
    });
  }
}

export function createAlternativeDataIntelligenceFabric(
  options?: AlternativeDataIntelligenceFabricOptions,
): AlternativeDataIntelligenceFabric {
  return new AlternativeDataIntelligenceFabric(options);
}
