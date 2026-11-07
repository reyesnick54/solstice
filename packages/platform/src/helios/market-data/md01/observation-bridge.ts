/**
 * Bind MD01 events to H08 observation fabric (tick/quote ingestion).
 */

import type { Clock } from '@solstice/config';
import { asUtcInstant } from '@solstice/domain';
import {
  buildExternalObservation,
  MARKET_PRICE_FRESHNESS_POLICY,
  type CanonicalMarketDataEvent,
} from '@solstice/provider-sdk';
import {
  HeliosObservationFabric,
  createHeliosObservationStore,
  type HeliosMarketObservationEnvelope,
} from '../../observation/index.ts';
import { MARKET_DATA_EVENT_SCHEMA_VERSION } from './taxonomy.ts';

export type Md01ObservationBridgeResult =
  | { readonly ok: true; readonly envelope: HeliosMarketObservationEnvelope; readonly marketEvent: CanonicalMarketDataEvent }
  | { readonly ok: false; readonly code: string; readonly message: string };

function observationTypeFor(
  event: CanonicalMarketDataEvent,
): 'tick' | 'quote' | 'daily_price' | 'reference_metadata' {
  if (event.eventKind === 'MarketTradeEvent') return 'tick';
  if (event.eventKind === 'MarketQuoteEvent') return 'quote';
  if (event.eventKind === 'ReferencePriceEvent' || event.eventKind === 'SettlementPriceEvent') {
    return 'reference_metadata';
  }
  return 'quote';
}

export class Md01ObservationBridge {
  readonly #clock: Clock;
  readonly #fabric: HeliosObservationFabric;

  constructor(clock: Clock) {
    this.#clock = clock;
    this.#fabric = new HeliosObservationFabric({
      clock,
      store: createHeliosObservationStore(),
    });
  }

  fabric(): HeliosObservationFabric {
    return this.#fabric;
  }

  seal(event: CanonicalMarketDataEvent): Md01ObservationBridgeResult {
    const observationType = observationTypeFor(event);
    const arrival = asUtcInstant(event.sunreyReceiveTime);
    const sourceTimestamp = asUtcInstant(event.eventTime);
    const built = buildExternalObservation({
      observationId: event.eventId,
      providerId: event.providerId,
      providerCategory: 'markets',
      capability: 'md01.market_data_event',
      data: event,
      source: {
        provider: event.providerId,
        dataset: event.sourceFeedId,
        sourceUrl: null,
      },
      time: {
        retrievedAt: arrival,
        sourceTimestamp,
        effectiveAt: event.providerPublishTime ? asUtcInstant(event.providerPublishTime) : null,
      },
      authorityClass: 'reference_data',
      provenance: {
        rawPayload: JSON.stringify(event, (_key, entry) =>
          typeof entry === 'bigint' ? entry.toString() : entry,
        ),
        providerSchemaVersion: MARKET_DATA_EVENT_SCHEMA_VERSION,
      },
      licensing: {
        commercialUseStatus: 'permitted',
        redistributionStatus: 'restricted',
      },
      freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
      validationStatus: 'valid',
    });
    if (!built.ok) {
      return { ok: false, code: built.code, message: built.message };
    }

    const ingestResult = this.#fabric.ingest({
      observation: built.value,
      sourceId: event.sourceFeedId,
      canonicalInstrumentId: event.instrumentId,
      venue: event.venueId,
      observationType,
      informationTime: {
        sourceEventTime: sourceTimestamp,
        sourcePublishedTime: event.providerPublishTime ? asUtcInstant(event.providerPublishTime) : null,
        providerAvailabilityTime: event.providerPublishTime ? asUtcInstant(event.providerPublishTime) : null,
        sunreyArrivalTime: arrival,
        ingestionTime: asUtcInstant(event.normalizedTime),
      },
      sequence: event.sourceSequence === null ? null : Number(event.sourceSequence),
      lineage: {
        upstreamSourceRef: event.sourceRef,
        sourceFamily: 'md01_market_data_event',
      },
      entitlement: {
        entitlementClass: 'sandbox_test',
        feedDelayClassification: 'unknown',
      },
    });

    if (!ingestResult.ok) {
      return { ok: false, code: ingestResult.code, message: ingestResult.message };
    }
    return { ok: true, envelope: ingestResult.envelope, marketEvent: event };
  }
}
