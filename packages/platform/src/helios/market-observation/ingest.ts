/**
 * M02 ingest bridge — validates market observations and seals through H08 fabric.
 */

import type { Clock } from '../../../../config/src/clock.ts';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '../../../../provider-sdk/src/index.ts';
import { computeKnowableAt } from '../observation/information-time.ts';
import { HeliosObservationFabric } from '../observation/fabric.ts';
import { createHeliosObservationStore } from '../observation/store.ts';
import { createMarketTimeSeriesStore, type MarketTimeSeriesStore } from './time-series-store.ts';
import type {
  CanonicalMarketObservation,
  IngestMarketObservationResult,
  MarketQualityMetadata,
  SealedMarketObservation,
} from './types.ts';
import { HELIOS_MARKET_TIME_SERIES_SCHEMA } from './types.ts';
import {
  barDedupeKey,
  detectSequenceRegression,
  validateMarketObservation,
} from './validation.ts';
import { resolveMarketInstrument } from './instrument-registry.ts';

export type HeliosMarketObservationFabricOptions = {
  readonly clock: Clock;
};

function stringifyMarketObservation(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry));
}

function mapObservationTypeToEnvelope(type: CanonicalMarketObservation['observationType']): 'quote' | 'tick' | 'daily_price' | 'reference_metadata' | 'other' {
  switch (type) {
    case 'quote':
    case 'best_bid_offer':
    case 'reference_price':
      return 'quote';
    case 'trade':
      return 'tick';
    case 'ohlcv_bar':
      return 'daily_price';
    case 'market_status':
      return 'reference_metadata';
    case 'order_book_snapshot':
      return 'other';
    default:
      return 'other';
  }
}

function defaultQuality(quarantined: boolean, reason: string | null): MarketQualityMetadata {
  return Object.freeze({
    qualityState: quarantined ? 'DEGRADED_MALFORMED' : 'VALID',
    staleState: quarantined ? 'STALE' : 'FRESH',
    quarantined,
    quarantineReason: reason as MarketQualityMetadata['quarantineReason'],
  });
}

export class HeliosMarketObservationFabric {
  readonly #clock: Clock;
  readonly #observationFabric: HeliosObservationFabric;
  readonly #timeSeriesStore: MarketTimeSeriesStore;

  constructor(options: HeliosMarketObservationFabricOptions) {
    const observationStore = createHeliosObservationStore();
    this.#clock = options.clock;
    this.#observationFabric = new HeliosObservationFabric({ clock: options.clock, store: observationStore });
    this.#timeSeriesStore = createMarketTimeSeriesStore(
      () => this.#observationFabric.store().snapshot(),
      (snapshot) => this.#observationFabric.store().restore(snapshot),
    );
  }

  timeSeriesStore(): MarketTimeSeriesStore {
    return this.#timeSeriesStore;
  }

  observationFabric(): HeliosObservationFabric {
    return this.#observationFabric;
  }

  ingest(observation: CanonicalMarketObservation): IngestMarketObservationResult {
    const instrument = resolveMarketInstrument(observation.instrumentId);
    if (!instrument) {
      return { ok: false, code: 'INVALID_INSTRUMENT', message: `unknown instrument ${observation.instrumentId}` };
    }

    const validation = validateMarketObservation(observation);
    if (!validation.ok) {
      return { ok: false, code: validation.code, message: validation.message };
    }

    if (observation.observationType === 'ohlcv_bar' && this.#timeSeriesStore.hasBar(observation)) {
      return { ok: false, code: 'DUPLICATE_BAR', message: `duplicate bar ${barDedupeKey(observation)}` };
    }

    const sequence = 'sequence' in observation ? observation.sequence : null;
    const priorSequence = this.#timeSeriesStore.lastSequenceFor(observation.instrumentId);
    if (detectSequenceRegression(sequence, priorSequence)) {
      return { ok: false, code: 'SEQUENCE_REGRESSION', message: 'sequence regressed for instrument feed' };
    }

    const nowUtc = this.#clock.now();
    const availabilityTimestamp =
      'availabilityTimestamp' in observation ? observation.availabilityTimestamp : null;
    const sourceTimestamp =
      observation.observationType === 'market_status'
        ? observation.sourceTimestamp
        : observation.observationType === 'order_book_snapshot'
          ? observation.orderBook.sourceTimestamp
          : observation.sourceTimestamp;
    const arrivalTimestamp =
      observation.observationType === 'order_book_snapshot'
        ? observation.orderBook.arrivalTimestamp
        : observation.arrivalTimestamp;

    const knowableAt = computeKnowableAt({
      providerAvailabilityTime: availabilityTimestamp,
      sunreyArrivalTime: arrivalTimestamp,
      ingestionTime: nowUtc,
    });

    const built = buildExternalObservation({
      observationId: observation.provenance.observationId,
      providerId: observation.providerId,
      providerCategory: 'markets',
      capability: observation.provenance.capability,
      data: observation,
      source: {
        provider: observation.providerId,
        dataset: observation.instrumentId,
      },
      time: {
        retrievedAt: arrivalTimestamp,
        sourceTimestamp,
      },
      authorityClass: 'reference_data',
      provenance: {
        rawPayload: stringifyMarketObservation(observation),
        providerSchemaVersion: HELIOS_MARKET_TIME_SERIES_SCHEMA,
      },
      licensing: {
        commercialUseStatus: observation.entitlement.commercialRestricted ? 'restricted' : 'permitted',
        redistributionStatus: observation.entitlement.redistributionRestricted ? 'restricted' : 'permitted',
      },
      freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
      validationStatus: 'valid',
    });
    if (!built.ok) {
      return { ok: false, code: built.code, message: built.message };
    }
    const external = built.value;

    const envelopeType = mapObservationTypeToEnvelope(observation.observationType);
    const ingestResult = this.#observationFabric.ingest({
      observation: external,
      sourceId: observation.provenance.sourceId,
      canonicalInstrumentId: observation.instrumentId,
      venue: observation.venue,
      observationType: envelopeType,
      informationTime: {
        sourceEventTime: sourceTimestamp,
        providerAvailabilityTime: availabilityTimestamp,
        sunreyArrivalTime: arrivalTimestamp,
        ingestionTime: nowUtc,
      },
      sequence: sequence !== null ? Number(sequence) : null,
      entitlement: {
        entitlementClass: observation.entitlement.entitlementClass,
        feedDelayClassification: observation.entitlement.feedDelayClassification,
        unavailable: observation.entitlement.unavailable,
        commercialUseStatus: observation.entitlement.commercialRestricted ? 'restricted' : 'permitted',
        redistributionStatus: observation.entitlement.redistributionRestricted ? 'restricted' : 'permitted',
      },
      lineage: {
        upstreamSourceRef: observation.provenance.upstreamSourceRef,
        duplicateEventKey:
          observation.observationType === 'ohlcv_bar' ? barDedupeKey(observation) : null,
      },
    });

    if (!ingestResult.ok) {
      return { ok: false, code: ingestResult.code, message: ingestResult.message };
    }

    const quarantined =
      ingestResult.envelope.qualityState !== 'VALID' ||
      ingestResult.envelope.freshness.status === 'stale' ||
      ingestResult.envelope.freshness.status === 'expired';

    const sealed: SealedMarketObservation = Object.freeze({
      marketObservation: Object.freeze({
        ...observation,
        quality: defaultQuality(
          quarantined,
          quarantined ? 'STALE_OBSERVATION' : null,
        ),
      }),
      envelope: ingestResult.envelope,
      informationTime: ingestResult.envelope.informationTime,
      knowableAt: ingestResult.envelope.informationTime.knowableAt,
    });

    if (!ingestResult.duplicate && !quarantined) {
      this.#timeSeriesStore.put(sealed);
      if (sequence !== null) {
        this.#timeSeriesStore.recordSequence(observation.instrumentId, sequence);
      }
    }

    return Object.freeze({
      ok: true,
      sealed,
      duplicate: ingestResult.duplicate,
      quarantined,
    });
  }
}
