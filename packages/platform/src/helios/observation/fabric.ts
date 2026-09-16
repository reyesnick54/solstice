/**
 * HELIOS market observation fabric — ingest, enrich, and seal observation envelopes.
 * Integrates with External Data Trust Engine when trust results are supplied.
 * Never invents synthetic fallback values.
 */

import type { Clock } from '../../../../config/src/clock.ts';
import { buildObservationEntitlement } from './entitlement.ts';
import { checkDuplicate } from './deduplication.ts';
import { assessHeliosFreshness } from './freshness-policies.ts';
import { buildInformationTime } from './information-time.ts';
import { assessSourceIndependence, buildLineageRecord } from './lineage.ts';
import { detectSequenceGap, runQualityChecks } from './quality.ts';
import { buildTrustRef } from './trust-integration.ts';
import type { HeliosObservationStore } from './store.ts';
import {
  HELIOS_MARKET_OBSERVATION_SCHEMA,
  type HeliosMarketObservationEnvelope,
  type IngestObservationInput,
  type IngestObservationResult,
  type OutlierState,
} from './types.ts';

export type HeliosObservationFabricOptions = {
  readonly clock: Clock;
  readonly store: HeliosObservationStore;
};

export class HeliosObservationFabric {
  readonly #clock: Clock;
  readonly #store: HeliosObservationStore;

  constructor(options: HeliosObservationFabricOptions) {
    this.#clock = options.clock;
    this.#store = options.store;
  }

  store(): HeliosObservationStore {
    return this.#store;
  }

  ingest<T>(input: IngestObservationInput<T>): IngestObservationResult<T> {
    const nowUtc = this.#clock.now();
    const observation = input.observation;

    if (!observation.observationId) {
      return { ok: false, code: 'OBSERVATION_ID_REQUIRED', message: 'observationId is required' };
    }
    if (!input.canonicalInstrumentId?.trim()) {
      return { ok: false, code: 'INSTRUMENT_REQUIRED', message: 'canonicalInstrumentId is required' };
    }

    const informationTime = buildInformationTime({
      observation,
      sourceEventTime: input.informationTime?.sourceEventTime,
      sourcePublishedTime: input.informationTime?.sourcePublishedTime,
      providerAvailabilityTime: input.informationTime?.providerAvailabilityTime,
      sunreyArrivalTime: input.informationTime?.sunreyArrivalTime,
      ingestionTime: input.informationTime?.ingestionTime ?? nowUtc,
    });

    const lineage = buildLineageRecord({
      observation,
      upstreamSourceRef: input.lineage?.upstreamSourceRef,
      sourceFamily: input.lineage?.sourceFamily,
      parentLineageIds: input.lineage?.parentLineageIds,
      duplicateEventKey: input.lineage?.duplicateEventKey,
    });

    const duplicate = checkDuplicate(
      observation,
      this.#store.deduplicationState(),
      lineage.duplicateEventKey,
    );

    const sourceIndependence = assessSourceIndependence(
      lineage,
      this.#store.duplicateEventKeys(),
      this.#store.upstreamRefs(),
    );

    const entitlement = buildObservationEntitlement({
      observation,
      entitlementClass: input.entitlement?.entitlementClass,
      feedDelayClassification:
        input.entitlement?.feedDelayClassification ?? input.feedDelayClassification,
    });

    const freshness = assessHeliosFreshness({
      observationType: input.observationType,
      referenceTimestamp: informationTime.sourceEventTime,
      nowUtc,
    });

    const priorSequence = this.#store.lastSequenceFor(input.canonicalInstrumentId);
    const priorSourceEventTime = this.#store.lastSourceEventTimeFor(input.canonicalInstrumentId);
    const sequence = input.sequence ?? null;
    const gapDetected = detectSequenceGap(sequence, priorSequence);

    const outlierState: OutlierState =
      input.trustResult?.outlierStatus === 'OUTLIER'
        ? 'OUTLIER'
        : input.trustResult?.outlierStatus === 'SUSPECTED_OUTLIER'
          ? 'SUSPECTED'
          : 'NONE';

    const contradictory =
      input.trustResult?.status === 'CONFLICTED' ||
      (input.trustResult?.conflictingObservationIds.length ?? 0) > 0;

    const providerUnavailable = input.trustResult?.status === 'UNAVAILABLE';

    const quality = runQualityChecks({
      observation,
      informationTime,
      entitlement,
      freshness,
      canonicalInstrumentId: input.canonicalInstrumentId,
      sequence,
      priorSourceEventTime,
      priorSequence,
      isDuplicate: duplicate,
      gapDetected,
      outlierState,
      contradictory,
      providerUnavailable,
      sourceIndependence,
    });

    const envelope: HeliosMarketObservationEnvelope = Object.freeze({
      schemaVersion: HELIOS_MARKET_OBSERVATION_SCHEMA,
      observationId: observation.observationId,
      providerId: observation.providerId,
      sourceId: input.sourceId,
      canonicalInstrumentId: input.canonicalInstrumentId,
      venue: input.venue ?? null,
      observationType: input.observationType,
      observation,
      informationTime,
      sequence,
      version: input.version ?? null,
      lineage,
      entitlement,
      freshness,
      qualityState: quality.qualityState,
      gapState: quality.gapState,
      outlierState,
      corroborationRefs: Object.freeze([...(input.corroborationRefs ?? [])]),
      sourceIndependence,
      qualityFlags: quality.qualityFlags,
      trustRef: buildTrustRef(input.trustResult),
    });

    if (!duplicate && quality.qualityState !== 'UNAVAILABLE') {
      this.#store.put(envelope);
      if (sequence !== null) {
        this.#store.recordSequence(input.canonicalInstrumentId, sequence);
      }
      if (informationTime.sourceEventTime) {
        this.#store.recordSourceEventTime(input.canonicalInstrumentId, informationTime.sourceEventTime);
      }
    }

    return Object.freeze({ ok: true, envelope, duplicate });
  }
}
