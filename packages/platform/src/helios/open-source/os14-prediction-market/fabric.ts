/**
 * Observation Fabric integration for OS14 prediction-market research.
 */

import type { Clock } from '@solstice/config';
import type { EvidenceVault } from '@solstice/evidence';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '@solstice/provider-sdk';
import { computeKnowableAt } from '../../observation/information-time.ts';
import { HeliosObservationFabric } from '../../observation/fabric.ts';
import { createHeliosObservationStore } from '../../observation/store.ts';
import { buildPredictionMarketFeatureSnapshot } from './features.ts';
import { computeMicrostructureMetrics } from './order-book.ts';
import {
  OS14_UPSTREAM_LICENSE,
  OS14_UPSTREAM_REFERENCE_SHA,
  OS14_UPSTREAM_REPOSITORY,
} from './upstream.ts';
import {
  buildProbabilityEdgeObservation,
  evaluateResearchSignals,
  type Os14ResearchSignalConfig,
} from './research-signals.ts';
import {
  sealOs14FeatureSnapshot,
  sealOs14PredictionMarketObservation,
  sealOs14ProbabilityEdgeObservation,
} from './evidence.ts';
import { createPredictionMarketResearchStore, type PredictionMarketResearchStore } from './store.ts';
import type {
  IngestPredictionMarketObservationInput,
  IngestPredictionMarketObservationResult,
  PredictionMarketObservation,
  PredictionMarketState,
  ProbabilityEdgeObservation,
} from './types.ts';
import {
  HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
  HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
} from './taxonomy.ts';

export type PredictionMarketResearchFabricOptions = {
  readonly clock: Clock;
  readonly evidence?: EvidenceVault;
  readonly store?: PredictionMarketResearchStore;
  readonly researchPriorPpmByInstrument?: Readonly<Record<string, bigint>>;
  readonly signalConfig?: Os14ResearchSignalConfig;
};

export class PredictionMarketResearchFabric {
  readonly #clock: Clock;
  readonly #observationFabric: HeliosObservationFabric;
  readonly #store: PredictionMarketResearchStore;
  readonly #evidence: EvidenceVault | undefined;
  readonly #researchPriorPpmByInstrument: Readonly<Record<string, bigint>>;
  readonly #signalConfig: Os14ResearchSignalConfig | undefined;

  constructor(options: PredictionMarketResearchFabricOptions) {
    this.#clock = options.clock;
    this.#observationFabric = new HeliosObservationFabric({
      clock: options.clock,
      store: createHeliosObservationStore(),
    });
    this.#store = options.store ?? createPredictionMarketResearchStore();
    this.#evidence = options.evidence;
    this.#researchPriorPpmByInstrument = options.researchPriorPpmByInstrument ?? {};
    this.#signalConfig = options.signalConfig;
  }

  observationFabric(): HeliosObservationFabric {
    return this.#observationFabric;
  }

  researchStore(): PredictionMarketResearchStore {
    return this.#store;
  }

  ingest(input: IngestPredictionMarketObservationInput): IngestPredictionMarketObservationResult {
    const { instrument, orderBook } = input;
    if (orderBook.instrumentId !== instrument.instrumentId) {
      return { ok: false, code: 'INSTRUMENT_MISMATCH', message: 'order book instrument mismatch' };
    }
    if (instrument.permitsLiveWagering) {
      return { ok: false, code: 'LIVE_WAGERING_FORBIDDEN', message: 'OS14 forbids live wagering' };
    }

    let micro;
    try {
      micro = computeMicrostructureMetrics(orderBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MICROSTRUCTURE_FAILED';
      return { ok: false, code: 'MALFORMED_ORDER_BOOK', message };
    }

    const ingestionTime = this.#clock.now();
    const knowableAt = computeKnowableAt({
      providerAvailabilityTime: null,
      sunreyArrivalTime: orderBook.arrivalTimestamp,
      ingestionTime,
    });

    const provenance = Object.freeze({
      ...input.provenance,
      upstreamRepository: OS14_UPSTREAM_REPOSITORY,
      upstreamReferenceSha: OS14_UPSTREAM_REFERENCE_SHA,
      upstreamLicense: OS14_UPSTREAM_LICENSE,
    });

    const observationId = input.provenance.observationId;
    const observation: PredictionMarketObservation = Object.freeze({
      schema: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
      authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
      observationKind: 'order_book_snapshot',
      observationId,
      instrumentId: instrument.instrumentId,
      marketSlug: instrument.marketSlug,
      sourceTimestamp: orderBook.sourceTimestamp,
      arrivalTimestamp: orderBook.arrivalTimestamp,
      knowableAt,
      provenance,
      impliedMarketMidPpm: micro.impliedMarketMidPpm,
      volumeUsdcMinor: input.volumeUsdcMinor ?? null,
      orderBook,
      microstructure: micro,
    });

    const built = buildExternalObservation({
      observationId,
      providerId: provenance.providerId,
      providerCategory: 'markets',
      capability: 'prediction_market_clob_research',
      data: observation,
      source: {
        provider: provenance.providerId,
        dataset: instrument.instrumentId,
      },
      time: {
        retrievedAt: orderBook.arrivalTimestamp,
        sourceTimestamp: orderBook.sourceTimestamp,
      },
      authorityClass: 'reference_data',
      provenance: {
        rawPayload: JSON.stringify(observation, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        providerSchemaVersion: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
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

    const envelopeResult = this.#observationFabric.ingest({
      observation: built.value,
      sourceId: provenance.sourceId,
      canonicalInstrumentId: instrument.instrumentId,
      venue: instrument.venueId,
      observationType: 'other',
      informationTime: {
        sourceEventTime: orderBook.sourceTimestamp,
        sunreyArrivalTime: orderBook.arrivalTimestamp,
        ingestionTime,
      },
      lineage: {
        upstreamSourceRef: provenance.upstreamSourceRef,
        sourceFamily: 'PREDICTION_MARKET_CLOB',
      },
      entitlement: {
        entitlementClass: 'sandbox_test',
        feedDelayClassification: 'unknown',
        unavailable: false,
        commercialUseStatus: 'permitted',
        redistributionStatus: 'restricted',
      },
    });

    if (!envelopeResult.ok) {
      return {
        ok: false,
        code: envelopeResult.code,
        message: envelopeResult.message,
      };
    }

    this.#store.appendObservation(observation);

    const state: PredictionMarketState = Object.freeze({
      schema: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
      authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
      instrument,
      asOfKnowableAt: knowableAt,
      latestObservation: observation,
      orderBook,
      microstructure: micro,
      relatedMarketInstrumentIds: Object.freeze([...(input.relatedMarketInstrumentIds ?? [])]),
    });
    this.#store.putState(state);

    const researchPrior = this.#researchPriorPpmByInstrument[instrument.instrumentId] ?? null;
    const signals = evaluateResearchSignals({
      book: orderBook,
      micro,
      researchPriorPpm: researchPrior,
      ...(this.#signalConfig !== undefined ? { config: this.#signalConfig } : {}),
    });

    let probabilityEdge: ProbabilityEdgeObservation | null = null;
    const probSignal = signals.find((signal) => signal.kind === 'PROB_EDGE');
    if (probSignal && researchPrior !== null) {
      probabilityEdge = buildProbabilityEdgeObservation({
        observationId: `${observationId}:prob_edge`,
        instrumentId: instrument.instrumentId,
        marketSlug: instrument.marketSlug,
        computedAt: this.#clock.now(),
        knowableAt,
        impliedMarketMidPpm: micro.impliedMarketMidPpm,
        researchPriorPpm: researchPrior,
        provenance,
        signal: probSignal,
        ...(this.#signalConfig !== undefined ? { config: this.#signalConfig } : {}),
      });
    }

    const features = buildPredictionMarketFeatureSnapshot({
      instrumentId: instrument.instrumentId,
      knowableAt,
      micro,
      feeAdjustedEdgePpm: probabilityEdge?.feeAdjustedEdgePpm ?? null,
    });

    const obsEvidence = sealOs14PredictionMarketObservation(this.#evidence, observation);
    if (probabilityEdge) {
      sealOs14ProbabilityEdgeObservation(this.#evidence, probabilityEdge);
    }
    sealOs14FeatureSnapshot(this.#evidence, features);

    return Object.freeze({
      ok: true,
      sealed: Object.freeze({
        observation,
        envelopeObservationId: observationId,
        sealedAt: this.#clock.now(),
      }),
      state,
      features,
      probabilityEdge,
      evidenceId: obsEvidence,
    });
  }
}

export function createPredictionMarketResearchFabric(
  options: PredictionMarketResearchFabricOptions,
): PredictionMarketResearchFabric {
  return new PredictionMarketResearchFabric(options);
}
