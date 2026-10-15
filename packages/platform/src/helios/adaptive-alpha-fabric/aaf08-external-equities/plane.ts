/**
 * AAF08 observation plane — adapter → trust → M02 fabric → optional AAF02 features.
 */

import type { Clock } from '../../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../../evidence/src/vault.ts';
import { resolveProviderSymbol } from '../../feature-fabric/entity-resolution/resolver.ts';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { HeliosMarketObservationFabric } from '../../market-observation/ingest.ts';
import type { BarTimeframe } from '../../market-observation/types.ts';
import { createStrategyMarketDataApi } from '../../market-observation/strategy-api.ts';
import { detectMislabeledRealtimeFeed, toMarketQuoteObservation, toMarketStatusObservation, toOhlcvBar } from './normalize.ts';
import { assessEquitiesQuoteTrust, createAaf08TrustEngine, type Aaf08TrustEngine } from './trust.ts';
import { sealAaf08IngestFailure, sealAaf08SourceStateEvidence } from './evidence.ts';
import { isAaf08UniverseInstrument } from './universe.ts';
import { requireAaf07Certification } from '../aaf07/certification.ts';
import type {
  ExternalEquitiesHistoricalRange,
  ExternalEquitiesIngestOutcome,
  ExternalEquitiesProviderHealth,
} from './types.ts';
import type { ExternalEquitiesProviderPort } from './provider-port.ts';

export type HeliosExternalEquitiesObservationPlaneOptions = {
  readonly clock: Clock;
  readonly marketFabric: HeliosMarketObservationFabric;
  readonly entityGraph: TemporalEntityGraphStore;
  readonly provider: ExternalEquitiesProviderPort;
  readonly evidenceVault?: EvidenceVault;
  readonly staleQuoteThresholdMs?: number;
};

export class HeliosExternalEquitiesObservationPlane {
  readonly #clock: Clock;
  readonly #marketFabric: HeliosMarketObservationFabric;
  readonly #entityGraph: TemporalEntityGraphStore;
  readonly #provider: ExternalEquitiesProviderPort;
  readonly #evidenceVault?: EvidenceVault;
  readonly #trust: Aaf08TrustEngine;
  readonly #staleQuoteThresholdMs: number;

  constructor(options: HeliosExternalEquitiesObservationPlaneOptions) {
    this.#clock = options.clock;
    this.#marketFabric = options.marketFabric;
    this.#entityGraph = options.entityGraph;
    this.#provider = options.provider;
    this.#evidenceVault = options.evidenceVault;
    this.#trust = createAaf08TrustEngine(() => this.#clock.now());
    this.#staleQuoteThresholdMs = options.staleQuoteThresholdMs ?? 120_000;
  }

  providerHealth(): ExternalEquitiesProviderHealth {
    return this.#provider.health(this.#clock.now());
  }

  strategyApi() {
    return createStrategyMarketDataApi(this.#marketFabric.timeSeriesStore());
  }

  resolveProviderSymbol(providerSymbol: string, asOf: UtcInstant, knowableAtCutoff: UtcInstant) {
    return resolveProviderSymbol(this.#entityGraph, {
      providerId: this.#provider.providerId,
      providerSymbol,
      asOf,
      knowableAtCutoff,
    });
  }

  async ingestQuote(instrumentId: string): Promise<ExternalEquitiesIngestOutcome> {
    const nowUtc = this.#clock.now();
    if (!isAaf08UniverseInstrument(instrumentId)) {
      const evidenceRef = sealAaf08IngestFailure(this.#evidenceVault, {
        code: 'INVALID_INSTRUMENT',
        message: `instrument ${instrumentId} outside AAF08 universe`,
        providerId: this.#provider.providerId,
        instrumentId,
        observedAt: nowUtc,
      });
      return { ok: false, code: 'INVALID_INSTRUMENT', message: `instrument ${instrumentId} outside AAF08 universe`, evidenceRef };
    }

    const aaf07 = requireAaf07Certification(this.#provider.providerId);
    if (!aaf07.ok && this.#provider.providerId !== 'fixture_aaf08') {
      const evidenceRef = sealAaf08IngestFailure(this.#evidenceVault, {
        code: 'AAF07_NOT_CERTIFIED',
        message: aaf07.verdict.blockers.join('; '),
        providerId: this.#provider.providerId,
        instrumentId,
        observedAt: nowUtc,
      });
      return { ok: false, code: 'AAF07_NOT_CERTIFIED', message: evidenceRef ?? 'provider not AAF07 certified', evidenceRef };
    }

    const fetched = await this.#provider.fetchQuote(instrumentId, nowUtc);
    if (!fetched.ok) {
      const evidenceRef = sealAaf08IngestFailure(this.#evidenceVault, {
        code: fetched.code,
        message: fetched.message,
        providerId: this.#provider.providerId,
        instrumentId,
        observedAt: nowUtc,
      });
      return { ok: false, code: fetched.code, message: fetched.message, evidenceRef };
    }

    const payload = fetched.value;
    const binding = this.resolveProviderSymbol(
      payload.symbol,
      payload.sourceTimestamp,
      nowUtc,
    );
    if (binding.resolutionState !== 'RESOLVED' || binding.canonicalInstrumentId !== instrumentId) {
      const evidenceRef = sealAaf08IngestFailure(this.#evidenceVault, {
        code: 'SYMBOL_MAPPING_FAILURE',
        message: binding.message ?? 'AAF03 resolution failed',
        providerId: this.#provider.providerId,
        instrumentId,
        observedAt: nowUtc,
      });
      return { ok: false, code: 'SYMBOL_MAPPING_FAILURE', message: binding.message ?? 'mapping failure', evidenceRef };
    }

    const sourceAgeMs = Date.parse(nowUtc) - Date.parse(payload.sourceTimestamp);
    if (Number.isFinite(sourceAgeMs) && sourceAgeMs > this.#staleQuoteThresholdMs) {
      const evidenceRef = sealAaf08SourceStateEvidence(this.#evidenceVault, 'helios.aaf08.quote.stale', {
        instrumentId,
        providerId: payload.providerId,
        sourceAgeMs,
      });
      return { ok: false, code: 'STALE_QUOTE', message: 'quote exceeds staleness threshold', evidenceRef };
    }

    if (detectMislabeledRealtimeFeed({
      declaredRealtime: payload.feedClassification === 'realtime',
      delayedMinutes: payload.delayedMinutes,
      sourceAgeMs,
      staleThresholdMs: this.#staleQuoteThresholdMs,
    })) {
      const evidenceRef = sealAaf08SourceStateEvidence(this.#evidenceVault, 'helios.aaf08.feed.mislabeled_realtime', {
        instrumentId,
        providerId: payload.providerId,
        sourceAgeMs,
        feedClassification: payload.feedClassification,
      });
      return {
        ok: false,
        code: 'MISLABELED_REALTIME',
        message: 'delayed or stale quote labeled realtime',
        evidenceRef,
      };
    }

    const trust = assessEquitiesQuoteTrust(this.#trust, payload);
    const observation = toMarketQuoteObservation(payload);
    const ingest = this.#marketFabric.ingest(observation);
    if (!ingest.ok) {
      const evidenceRef = sealAaf08IngestFailure(this.#evidenceVault, {
        code: ingest.code,
        message: ingest.message,
        providerId: payload.providerId,
        instrumentId,
        observedAt: nowUtc,
      });
      return { ok: false, code: ingest.code, message: ingest.message, evidenceRef };
    }

    const evidenceRef = sealAaf08SourceStateEvidence(this.#evidenceVault, 'helios.aaf08.ingest.quote', {
      instrumentId,
      observationId: payload.observationId,
      trustStatus: trust.status,
      duplicate: ingest.duplicate,
      quarantined: ingest.quarantined,
    });

    return Object.freeze({
      ok: true,
      instrumentId,
      observationType: 'quote',
      evidenceRef,
      quarantined: ingest.quarantined,
      duplicate: ingest.duplicate,
    });
  }

  async ingestHistoricalBars(
    instrumentId: string,
    timeframe: BarTimeframe,
    range: ExternalEquitiesHistoricalRange,
  ): Promise<ExternalEquitiesIngestOutcome> {
    const nowUtc = this.#clock.now();
    const fetched = await this.#provider.fetchHistoricalBars(instrumentId, timeframe, range, nowUtc);
    if (!fetched.ok) {
      if (fetched.code === 'PROVIDER_CAPABILITY_UNAVAILABLE') {
        return {
          ok: false,
          code: 'CAPABILITY_UNAVAILABLE',
          message: fetched.message,
          evidenceRef: sealAaf08IngestFailure(this.#evidenceVault, {
            code: fetched.code,
            message: fetched.message,
            providerId: this.#provider.providerId,
            instrumentId,
            observedAt: nowUtc,
          }),
        };
      }
      return {
        ok: false,
        code: fetched.code,
        message: fetched.message,
        evidenceRef: sealAaf08IngestFailure(this.#evidenceVault, {
          code: fetched.code,
          message: fetched.message,
          providerId: this.#provider.providerId,
          instrumentId,
          observedAt: nowUtc,
        }),
      };
    }

    let duplicate = false;
    let quarantined = false;
    for (const barPayload of fetched.value) {
      const bar = toOhlcvBar(barPayload);
      const ingest = this.#marketFabric.ingest(bar);
      if (!ingest.ok) {
        if (ingest.code === 'DUPLICATE_BAR') {
          duplicate = true;
          continue;
        }
        return {
          ok: false,
          code: ingest.code,
          message: ingest.message,
          evidenceRef: sealAaf08IngestFailure(this.#evidenceVault, {
            code: ingest.code,
            message: ingest.message,
            providerId: barPayload.providerId,
            instrumentId,
            observedAt: nowUtc,
          }),
        };
      }
      duplicate = duplicate || ingest.duplicate;
      quarantined = quarantined || ingest.quarantined;
    }

    return Object.freeze({
      ok: true,
      instrumentId,
      observationType: 'ohlcv_bar',
      evidenceRef: null,
      quarantined,
      duplicate,
    });
  }

  async ingestMarketSession(exchange: string, benchmarkInstrumentId: string): Promise<ExternalEquitiesIngestOutcome> {
    const nowUtc = this.#clock.now();
    const fetched = await this.#provider.fetchMarketSession(exchange, nowUtc);
    if (!fetched.ok) {
      return {
        ok: false,
        code: fetched.code,
        message: fetched.message,
        evidenceRef: sealAaf08IngestFailure(this.#evidenceVault, {
          code: fetched.code,
          message: fetched.message,
          providerId: this.#provider.providerId,
          instrumentId: benchmarkInstrumentId,
          observedAt: nowUtc,
        }),
      };
    }
    const status = toMarketStatusObservation(fetched.value, benchmarkInstrumentId);
    const ingest = this.#marketFabric.ingest(status);
    if (!ingest.ok) {
      return {
        ok: false,
        code: ingest.code,
        message: ingest.message,
        evidenceRef: sealAaf08IngestFailure(this.#evidenceVault, {
          code: ingest.code,
          message: ingest.message,
          providerId: fetched.value.providerId,
          instrumentId: benchmarkInstrumentId,
          observedAt: nowUtc,
        }),
      };
    }
    return Object.freeze({
      ok: true,
      instrumentId: benchmarkInstrumentId,
      observationType: 'market_status',
      evidenceRef: null,
      quarantined: ingest.quarantined,
      duplicate: ingest.duplicate,
    });
  }

}
