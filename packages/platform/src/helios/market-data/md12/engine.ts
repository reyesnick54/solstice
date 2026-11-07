/**
 * MD12 processing pipeline — ingest events, detect anomalies, compute states.
 */

import type { UtcInstant } from '@solstice/domain';

import { detectMarketDataAnomalies, type Md12DetectionContext } from './detect.ts';
import { computeLiquidityState, computeMicrostructureState } from './microstructure.ts';
import { buildMarketDataQualityState } from './quality-score.ts';
import type { Md12AnomalyStore } from './store.ts';
import type { MarketDataAnomaly, MarketDataQualityState, Md12MarketEvent } from './types.ts';

export type Md12EngineState = {
  readonly priorSequence: bigint | null;
  readonly priorSourceTimestamp: UtcInstant | null;
  readonly priorKnowableAt: UtcInstant | null;
  readonly tradeFingerprints: ReadonlySet<string>;
  readonly recentEvents: readonly Md12MarketEvent[];
};

export function createMd12EngineState(seed: Partial<Md12EngineState> = {}): Md12EngineState {
  return Object.freeze({
    priorSequence: seed.priorSequence ?? null,
    priorSourceTimestamp: seed.priorSourceTimestamp ?? null,
    priorKnowableAt: seed.priorKnowableAt ?? null,
    tradeFingerprints: seed.tradeFingerprints ?? new Set<string>(),
    recentEvents: seed.recentEvents ?? Object.freeze([]),
  });
}

function instantMs(iso: UtcInstant): number {
  return Date.parse(iso);
}

export type Md12ProcessResult = {
  readonly anomalies: readonly MarketDataAnomaly[];
  readonly quality: MarketDataQualityState;
  readonly nextState: Md12EngineState;
};

export function processMd12MarketEvent(input: {
  readonly event: Md12MarketEvent;
  readonly now: UtcInstant;
  readonly store: Md12AnomalyStore;
  readonly engineState: Md12EngineState;
  readonly corroborationProviderCount?: number;
  readonly referenceMidMinorUnits?: bigint | null;
  readonly alternateProviderMidMinorUnits?: bigint | null;
  readonly alternateVenueMidMinorUnits?: bigint | null;
  readonly staleQuoteMs?: number;
  readonly recentWindowSize?: number;
}): Md12ProcessResult {
  const ctx: Md12DetectionContext = {
    now: input.now,
    priorSequence: input.engineState.priorSequence,
    priorSourceTimestamp: input.engineState.priorSourceTimestamp,
    priorKnowableAt: input.engineState.priorKnowableAt,
    priorTradeFingerprints: input.engineState.tradeFingerprints,
    referenceMidMinorUnits: input.referenceMidMinorUnits ?? input.event.referenceMidMinorUnits,
    alternateProviderMidMinorUnits: input.alternateProviderMidMinorUnits ?? null,
    alternateVenueMidMinorUnits: input.alternateVenueMidMinorUnits ?? null,
    staleQuoteMs: input.staleQuoteMs,
  };

  const detected = detectMarketDataAnomalies(input.event, ctx);
  for (const anomaly of detected) {
    if (!input.store.get(anomaly.anomalyId)) {
      input.store.append(anomaly);
    }
  }

  const windowSize = input.recentWindowSize ?? 32;
  const recentEvents = Object.freeze([...input.engineState.recentEvents, input.event].slice(-windowSize));
  const micro = computeMicrostructureState(input.event, recentEvents);
  const liquidity = computeLiquidityState(input.event, micro);

  const quoteAgeMs = Math.max(0, instantMs(input.now) - instantMs(input.event.sourceTimestamp));
  const quality = buildMarketDataQualityState({
    instrumentId: input.event.instrumentId,
    venueId: input.event.venueId,
    providerId: input.event.providerId,
    asOf: input.event.knowableAt,
    quoteAgeMs,
    staleQuoteMs: input.staleQuoteMs,
    anomalies: input.store.list(),
    microstructure: micro,
    liquidity,
    corroborationProviderCount: input.corroborationProviderCount ?? 1,
  });

  const nextFingerprints = new Set(input.engineState.tradeFingerprints);
  if (input.event.duplicateTradeFingerprint) {
    nextFingerprints.add(input.event.duplicateTradeFingerprint);
  }

  const nextState = createMd12EngineState({
    priorSequence: input.event.sequence ?? input.engineState.priorSequence,
    priorSourceTimestamp: input.event.sourceTimestamp,
    priorKnowableAt: input.event.knowableAt,
    tradeFingerprints: nextFingerprints,
    recentEvents,
  });

  return Object.freeze({
    anomalies: detected,
    quality,
    nextState,
  });
}
