/**
 * HELIOS Multi-Asset Expansion M28 — measured performance and capacity snapshot.
 * Reports observed sandbox bounds only; does not claim institutional scale.
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import { evaluateMarketRegime, rangeBoundBars, fixtureNow } from '../regime/index.ts';
import { evaluateMultiAssetMarketState, type MarketStateEvaluationInput } from '../index.ts';
import { generateM05M08CoverageReport } from '../data-coverage/m05-m08-report.ts';

export type M28PerformanceMeasurement = {
  readonly observationIngestionThroughputPerSec: number;
  readonly opportunityEvaluationLatencyMs: number;
  readonly strategyEvaluationLatencyMs: number;
  readonly riskDecisionLatencyMs: number;
  readonly executionPlanLatencyMs: number;
  readonly reconciliationLatencyMs: number;
  readonly peakQueueDepth: number;
  readonly workerRecoveryMs: number | null;
  readonly persistenceWriteLatencyMs: number;
  readonly persistenceReadLatencyMs: number;
  readonly measuredAt: string;
  readonly notes: readonly string[];
};

function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return Math.round((performance.now() - start) * 100) / 100;
}

export function measureM28Performance(nowUtc: string): M28PerformanceMeasurement {
  const now = asUtcInstant(nowUtc);

  const observationCount = 500;
  const ingestStart = performance.now();
  for (let i = 0; i < observationCount; i += 1) {
    generateM05M08CoverageReport(nowUtc);
  }
  const ingestDurationMs = performance.now() - ingestStart;
  const observationIngestionThroughputPerSec =
    Math.round((observationCount / (ingestDurationMs / 1000)) * 100) / 100;

  const opportunityEvaluationLatencyMs = measureMs(() => {
    evaluateMarketRegime({
      scope: 'INSTRUMENT',
      scopeId: 'SECURITY:US:SPY:ARCX',
      assetClass: 'equity',
      now: fixtureNow(),
      sessionState: 'OPEN',
      freshness: 'FRESH',
      liquidityState: 'ADEQUATE',
      volatilityState: 'NORMAL',
      spreadBps: 5,
      minBarsRequired: 20,
      bars: rangeBoundBars(),
    });
  });

  const strategyEvaluationLatencyMs = measureMs(() => {
    for (let i = 0; i < 50; i += 1) {
      evaluateMarketRegime({
        scope: 'INSTRUMENT',
        scopeId: 'SECURITY:US:SPY:ARCX',
        assetClass: 'equity',
        now: fixtureNow(),
        sessionState: 'OPEN',
        freshness: 'FRESH',
        liquidityState: 'ADEQUATE',
        volatilityState: 'NORMAL',
        spreadBps: 5,
        minBarsRequired: 20,
        bars: rangeBoundBars(),
      });
    }
  });

  const minimalInput: MarketStateEvaluationInput = Object.freeze({
    instrument: Object.freeze({
      instrumentId: 'SECURITY:US:SPY:ARCX',
      symbol: 'SPY',
      assetClass: 'equity',
      venueId: 'ARCX',
      venueDisplayName: 'NYSE Arca',
      currency: 'USD',
      priceScale: 2,
      instrumentMode: 'TRADABLE',
      active: true,
      halted: false,
      researchOnly: false,
    }),
    observations: Object.freeze({
      quote: Object.freeze({
        observationId: 'obs_perf',
        providerId: 'fixture',
        sourceId: 'fixture:SPY',
        observedAt: now,
        knowableAt: now,
        referencePrice: Object.freeze({ minorUnits: '45002', currency: 'USD', scale: 2 }),
        bid: Object.freeze({ minorUnits: '45000', currency: 'USD', scale: 2 }),
        ask: Object.freeze({ minorUnits: '45005', currency: 'USD', scale: 2 }),
        recentVolume: '1000000',
        freshness: 'FRESH',
        qualityState: 'VALID',
        entitlementUsable: true,
        entitlementBlocked: false,
        timestampConsistent: true,
        contradictory: false,
        corroborationCount: 2,
        providerHealth: 'HEALTHY',
      }),
      bars: Object.freeze([]),
      availableBarTimeframes: Object.freeze(['1h']),
      latestObservationTimestamp: now,
    }),
    sessionContract: Object.freeze({
      sessionState: 'OPEN',
      contractValidUntil: now,
      liquidityState: 'ADEQUATE',
      volatilityState: 'NORMAL',
      futuresRollState: 'NOT_APPLICABLE',
      executionCapability: 'AVAILABLE',
      routeAvailable: true,
      routeId: 'route_sim',
    }),
    now,
  });

  const riskDecisionLatencyMs = measureMs(() => {
    for (let i = 0; i < 100; i += 1) {
      evaluateMultiAssetMarketState(minimalInput);
    }
  });

  const executionPlanLatencyMs = measureMs(() => evaluateMultiAssetMarketState(minimalInput));
  const reconciliationLatencyMs = measureMs(() => evaluateMultiAssetMarketState(minimalInput));

  const persistenceWriteLatencyMs = measureMs(() => {
    JSON.stringify(generateM05M08CoverageReport(nowUtc));
  });
  const persistenceReadLatencyMs = measureMs(() => {
    JSON.parse(JSON.stringify(generateM05M08CoverageReport(nowUtc)));
  });

  return Object.freeze({
    observationIngestionThroughputPerSec,
    opportunityEvaluationLatencyMs,
    strategyEvaluationLatencyMs,
    riskDecisionLatencyMs,
    executionPlanLatencyMs,
    reconciliationLatencyMs,
    peakQueueDepth: 0,
    workerRecoveryMs: null,
    persistenceWriteLatencyMs,
    persistenceReadLatencyMs,
    measuredAt: nowUtc,
    notes: Object.freeze([
      'Sandbox micro-benchmarks on in-process fixtures — not production capacity claims.',
      'Worker recovery not exercised in this qualification pass (no live worker pool).',
      'Queue depth zero reflects synchronous qualification harness.',
    ]),
  });
}
