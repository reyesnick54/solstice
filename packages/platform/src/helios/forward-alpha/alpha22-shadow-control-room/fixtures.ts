import { asUtcInstant } from '@solstice/domain';

import type { ShadowLabTelemetrySnapshot } from './types.ts';

export const ALPHA22_FIXTURE_NOW = asUtcInstant('2026-11-08T12:00:00.000Z');
export const ALPHA22_FIXTURE_TICK = asUtcInstant('2026-11-08T11:59:30.000Z');

export function healthyShadowLabTelemetryFixture(
  overrides: Partial<ShadowLabTelemetrySnapshot> = {},
): ShadowLabTelemetrySnapshot {
  return Object.freeze({
    observedAt: ALPHA22_FIXTURE_NOW,
    simulationOnly: true,
    activeCampaignCount: 1,
    activeStrategyCount: 2,
    campaigns: Object.freeze([
      Object.freeze({
        campaignId: 'fcamp_alpha22_fixture',
        status: 'ACTIVE',
        strategyIds: Object.freeze(['strat_a', 'strat_b']),
        lastTickAt: ALPHA22_FIXTURE_TICK,
      }),
    ]),
    strategies: Object.freeze([
      Object.freeze({
        strategyId: 'strat_a',
        campaignId: 'fcamp_alpha22_fixture',
        paused: false,
        decayFlagged: false,
        decisionCount: 120n,
      }),
      Object.freeze({
        strategyId: 'strat_b',
        campaignId: 'fcamp_alpha22_fixture',
        paused: false,
        decayFlagged: false,
        decisionCount: 80n,
      }),
    ]),
    lastSuccessfulTickAt: ALPHA22_FIXTURE_TICK,
    marketDataState: 'TRUSTED',
    marketDataAgeMs: 2_000,
    decisionCount: 200n,
    decisionsPerMinute: 12,
    pendingOutcomes: 3n,
    maturedOutcomes: 197n,
    paperOrderCount: 45n,
    paperFillCount: 42n,
    shadowNavMinor: '102500000',
    peakNavMinor: '103000000',
    drawdownBps: 48,
    benchmarkActiveReturnBps: 125,
    evidenceStatus: Object.freeze({
      persisted: true,
      lastSealAt: ALPHA22_FIXTURE_TICK,
      chainHeadHash: 'evhash_alpha22_fixture',
      mismatch: false,
    }),
    decayStatus: Object.freeze({
      monitored: true,
      strategiesInDecay: Object.freeze([]),
    }),
    providers: Object.freeze([
      Object.freeze({
        providerId: 'fixture_crypto_ws',
        healthy: true,
        lastSuccessAt: ALPHA22_FIXTURE_TICK,
      }),
    ]),
    researchBudget: Object.freeze({
      budgetId: 'rbdg_alpha22',
      spentMinor: '1500000',
      limitMinor: '50000000',
      remainingMinor: '48500000',
    }),
    errorCount: 0n,
    leaseHeld: true,
    persistenceHealthy: true,
    evidenceHashOk: true,
    outcomeBacklogAgeMs: 5_000,
    decisionFreshnessAgeMs: 8_000,
    evidencePersistLatencyMs: 1_200,
    recoveryDurationMs: null,
    campaignRuntimeAvailabilityRatio: 0.999,
    ...overrides,
  });
}

export function degradedShadowLabTelemetryFixture(): ShadowLabTelemetrySnapshot {
  return healthyShadowLabTelemetryFixture({
    marketDataState: 'UNTRUSTED',
    marketDataAgeMs: 120_000,
    leaseHeld: false,
    pendingOutcomes: 80n,
    outcomeBacklogAgeMs: 400_000,
    persistenceHealthy: false,
    evidenceHashOk: false,
    evidenceStatus: Object.freeze({
      persisted: false,
      lastSealAt: null,
      chainHeadHash: null,
      mismatch: true,
    }),
    decayStatus: Object.freeze({
      monitored: true,
      strategiesInDecay: Object.freeze(['strat_a']),
    }),
    drawdownBps: 2_000,
    decisionsPerMinute: 800,
    campaigns: Object.freeze([
      Object.freeze({
        campaignId: 'fcamp_alpha22_fixture',
        status: 'STOPPED',
        strategyIds: Object.freeze(['strat_a']),
        lastTickAt: null,
      }),
    ]),
    providers: Object.freeze([
      Object.freeze({
        providerId: 'fixture_crypto_ws',
        healthy: false,
        lastSuccessAt: null,
      }),
    ]),
    campaignRuntimeAvailabilityRatio: 0.9,
    decisionFreshnessAgeMs: 200_000,
    recoveryDurationMs: 900_000,
  });
}
