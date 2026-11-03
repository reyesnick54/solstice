/**
 * AAF09 observation fabric — ingest venue and reference crypto market data (no execution).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { CoingeckoReferenceAdapter } from './adapters/coingecko-reference.ts';
import type { CryptoVenueMarketDataAdapter } from './adapters/types.ts';
import { assessMultiSourceDisagreement } from './multi-source.ts';
import type { Aaf09ObservationStore } from './store.ts';
import type { IngestCryptoObservationResult, MultiSourceDisagreementReport, NormalizedCryptoMarketObservation } from './types.ts';
import {
  applyValidationHealth,
  detectCrossedMarket,
  detectSequenceGap,
  detectStaleFeed,
} from './validation.ts';

export type Aaf09ExternalCryptoFabricOptions = {
  readonly store: Aaf09ObservationStore;
  readonly venueAdapter: CryptoVenueMarketDataAdapter;
  readonly referenceAdapter: CoingeckoReferenceAdapter;
  readonly staleThresholdMs: number;
};

export class Aaf09ExternalCryptoObservationFabric {
  readonly #store: Aaf09ObservationStore;
  readonly #venueAdapter: CryptoVenueMarketDataAdapter;
  readonly #referenceAdapter: CoingeckoReferenceAdapter;
  readonly #staleThresholdMs: number;

  constructor(options: Aaf09ExternalCryptoFabricOptions) {
    this.#store = options.store;
    this.#venueAdapter = options.venueAdapter;
    this.#referenceAdapter = options.referenceAdapter;
    this.#staleThresholdMs = options.staleThresholdMs;
  }

  store(): Aaf09ObservationStore {
    return this.#store;
  }

  ingestObservation(observation: NormalizedCryptoMarketObservation, nowUtc: UtcInstant): IngestCryptoObservationResult {
    const issues = [
      detectCrossedMarket(observation),
      detectSequenceGap(observation.sequenceId, this.#store.lastSequenceFor(observation.instrumentId)),
      detectStaleFeed({
        providerEventTime: observation.providerEventTime,
        nowUtc,
        maxAgeMs: this.#staleThresholdMs,
      }),
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    const sealed = applyValidationHealth(observation, issues);
    this.#store.append(sealed);
    return Object.freeze({ ok: true, observation: sealed });
  }

  async pullVenueBestBidOffer(
    instrumentId: string,
    nowUtc: UtcInstant,
  ): Promise<IngestCryptoObservationResult> {
    const fetched = await this.#venueAdapter.fetchBestBidOffer({ instrumentId, nowUtc });
    if (!fetched.ok) {
      return Object.freeze({ ok: false, code: fetched.code, message: fetched.message });
    }
    const observation = fetched.observations[0];
    if (!observation) {
      return Object.freeze({ ok: false, code: 'EMPTY_RESULT', message: 'venue adapter returned no observations' });
    }
    return this.ingestObservation(observation, nowUtc);
  }

  async pullReferenceQuote(instrumentId: string, nowUtc: UtcInstant): Promise<IngestCryptoObservationResult> {
    const fetched = await this.#referenceAdapter.fetchReferenceQuote({ instrumentId, nowUtc });
    if (!fetched.ok) {
      return Object.freeze({ ok: false, code: fetched.code, message: fetched.message });
    }
    const observation = fetched.observations[0];
    if (!observation) {
      return Object.freeze({ ok: false, code: 'EMPTY_RESULT', message: 'reference adapter returned no observations' });
    }
    return this.ingestObservation(observation, nowUtc);
  }

  assessInstrument(
    instrumentId: string,
    evaluationTime: UtcInstant,
  ): MultiSourceDisagreementReport {
    const observations = this.#store.listByInstrument(instrumentId);
    return assessMultiSourceDisagreement({
      instrumentId,
      evaluationTime,
      observations,
    });
  }

  markProviderOutage(instrumentId: string, providerId: string, nowUtc: UtcInstant): void {
    const prior = this.#store.listByInstrument(instrumentId).filter((row) => row.providerId === providerId);
    const template = prior[prior.length - 1];
    if (!template) return;
    const outage = Object.freeze({
      ...template,
      observationId: `${template.observationId}.outage`,
      sunreyArrivalTime: nowUtc,
      knowableAt: nowUtc,
      sourceHealth: 'OUTAGE' as const,
    });
    this.#store.append(outage);
  }
}
