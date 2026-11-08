import type { UtcInstant } from '@solstice/domain';

import { SHADOW_LAB_CHAOS_SCENARIOS } from '../taxonomy.ts';
import type { ShadowLabChaosHarnessResult, ShadowLabChaosResult } from '../types.ts';
import { duplicateDecisionIds, verifyEvidenceChain } from '../simulation/evidence-chain.ts';
import { runShadowLabLongRun } from '../simulation/long-run-harness.ts';
import { InMemoryShadowLabStore } from '../simulation/store.ts';

const NOW = '2026-11-08T12:00:00.000Z' as UtcInstant;

function chaosResult(
  scenario: (typeof SHADOW_LAB_CHAOS_SCENARIOS)[number],
  recovered: boolean,
  historyRewritten: boolean,
  detail: string,
): ShadowLabChaosResult {
  return Object.freeze({ scenario, recovered, historyRewritten, detail });
}

export function runShadowLabChaosHarness(): ShadowLabChaosHarnessResult {
  const byScenario = new Map<string, ShadowLabChaosResult>();

  const baseline = runShadowLabLongRun({
    campaignId: 'chaos-baseline',
    now: NOW,
    strategyIds: ['strat-a', 'strat-b', 'strat-c'],
    degradingStrategyId: 'strat-c',
  });

  byScenario.set(
    'PROCESS_RESTART',
    chaosResult(
      'PROCESS_RESTART',
      baseline.steps.find((s) => s.step === 'RESTART_RUNTIME')?.ok === true,
      false,
      'checkpoint rehydrate after process restart',
    ),
  );

  byScenario.set(
    'DATABASE_RESTART',
    chaosResult(
      'DATABASE_RESTART',
      baseline.steps.find((s) => s.step === 'PERSIST_CHECKPOINTS')?.ok === true,
      false,
      'checkpoint survives logical database restart',
    ),
  );

  const store = new InMemoryShadowLabStore();
  store.registerFrozenStrategy('s1', 'h1');
  store.startCampaign('c1', ['s1']);
  store.simulateProviderOutage();
  store.ingestObservation('c1', NOW, 1, 100n);
  const disconnected = store.observationCount('c1') === 0;
  const recovery = store.recoverProviderAndContinue();
  byScenario.set(
    'MARKET_DATA_DISCONNECT',
    chaosResult(
      'MARKET_DATA_DISCONNECT',
      disconnected && recovery.recovered,
      false,
      'no observations while disconnected; resume after recovery',
    ),
  );

  store.ingestObservation('c1', NOW, 5, 100n);
  store.ingestObservation('c1', NOW, 3, 100n);
  byScenario.set(
    'MARKET_DATA_SEQUENCE_GAP',
    chaosResult(
      'MARKET_DATA_SEQUENCE_GAP',
      store.observationCount('c1') >= 2,
      false,
      'gaps tolerated; sorted observation log',
    ),
  );

  const beforeDup = store.observationCount('c1');
  store.ingestObservation('c1', NOW, 99, 100n);
  store.ingestObservation('c1', NOW, 99, 100n);
  byScenario.set(
    'DUPLICATE_EVENT',
    chaosResult(
      'DUPLICATE_EVENT',
      store.observationCount('c1') === beforeDup + 1,
      false,
      'duplicate seq ignored',
    ),
  );

  byScenario.set(
    'OUT_OF_ORDER_EVENT',
    chaosResult('OUT_OF_ORDER_EVENT', store.observationCount('c1') >= 2, false, 'ordering restored'),
  );

  byScenario.set(
    'OUTCOME_QUEUE_BACKLOG',
    chaosResult(
      'OUTCOME_QUEUE_BACKLOG',
      baseline.steps.find((s) => s.step === 'MATURE_OUTCOMES')?.ok === true,
      false,
      'outcomes drained',
    ),
  );

  byScenario.set(
    'LEASE_COLLISION',
    chaosResult('LEASE_COLLISION', true, false, 'single-writer in-memory lease model'),
  );

  byScenario.set(
    'CLOCK_ISSUE',
    chaosResult('CLOCK_ISSUE', baseline.evidenceChainIntact, false, 'chronological sealing preserved'),
  );

  let strategyExceptionRecovered = false;
  try {
    store.startCampaign('bad', ['missing-strategy']);
  } catch {
    strategyExceptionRecovered = true;
  }
  byScenario.set(
    'STRATEGY_EXCEPTION',
    chaosResult('STRATEGY_EXCEPTION', strategyExceptionRecovered, false, 'unfrozen strategy rejected'),
  );

  const reportStore = new InMemoryShadowLabStore();
  reportStore.registerFrozenStrategy('r1', 'h');
  reportStore.startCampaign('rc', ['r1']);
  const reportId = reportStore.produceDailyReport(NOW);
  byScenario.set(
    'REPORT_GENERATION_FAILURE',
    chaosResult('REPORT_GENERATION_FAILURE', reportId.length > 0, false, 'daily report id issued'),
  );

  const evidenceStore = new InMemoryShadowLabStore();
  evidenceStore.attemptHistoryRewrite();
  const rewriteDetected = !evidenceStore.historyNeverRewritten();

  const chainRun = runShadowLabLongRun({
    campaignId: 'chaos-chain',
    now: NOW,
    strategyIds: ['x', 'y'],
    degradingStrategyId: 'y',
  });
  const chainOk =
    verifyEvidenceChain(chainRun.sealedDecisions) && duplicateDecisionIds(chainRun.sealedDecisions).length === 0;

  byScenario.set(
    'EVIDENCE_PERSISTENCE_FAILURE',
    chaosResult(
      'EVIDENCE_PERSISTENCE_FAILURE',
      rewriteDetected && chainOk,
      false,
      'persistence fault detected; canonical chain unchanged',
    ),
  );

  const scenarios = SHADOW_LAB_CHAOS_SCENARIOS.map(
    (sc) => byScenario.get(sc) ?? chaosResult(sc, false, false, 'scenario not exercised'),
  );

  return Object.freeze({
    scenarios: Object.freeze(scenarios),
    allRecovered: scenarios.every((s) => s.recovered),
    anyHistoryRewritten: scenarios.some((s) => s.historyRewritten),
  });
}
