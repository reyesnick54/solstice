import type { UtcInstant } from '@solstice/domain';

import { SHADOW_LAB_LONG_RUN_STEPS } from '../taxonomy.ts';
import type {
  ShadowLabLongRunResult,
  ShadowLabLongRunStepResult,
} from '../types.ts';
import {
  checkpointFromChain,
  duplicateDecisionIds,
  sealDecision,
  verifyEvidenceChain,
} from './evidence-chain.ts';
import { InMemoryShadowLabStore } from './store.ts';

export type LongRunHarnessInput = {
  readonly campaignId: string;
  readonly now: UtcInstant;
  readonly strategyIds: readonly string[];
  /** Strategy id that deliberately degrades (for demotion step). */
  readonly degradingStrategyId: string;
};

function stepResult(
  step: (typeof SHADOW_LAB_LONG_RUN_STEPS)[number],
  ok: boolean,
  detail: string,
): ShadowLabLongRunStepResult {
  return Object.freeze({ step, ok, detail });
}

function addDays(at: UtcInstant, days: number): UtcInstant {
  const d = new Date(at);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString() as UtcInstant;
}

/**
 * Deterministic in-memory long-run shadow lab simulation (synthetic harness).
 * No customer money; no live execution.
 */
export function runShadowLabLongRun(input: LongRunHarnessInput): ShadowLabLongRunResult {
  const steps: ShadowLabLongRunStepResult[] = [];
  const store = new InMemoryShadowLabStore();
  const { campaignId, strategyIds, degradingStrategyId } = input;

  for (const sid of strategyIds) {
    store.registerFrozenStrategy(sid, `freeze-hash:${sid}`);
  }
  steps.push(
    stepResult(
      'REGISTER_FROZEN_STRATEGIES',
      store.frozenStrategyCount() === strategyIds.length,
      `registered ${store.frozenStrategyCount()} strategies`,
    ),
  );

  store.startCampaign(campaignId, strategyIds);
  steps.push(stepResult('START_CAMPAIGN', store.campaignActive(), campaignId));

  let seq = 0;
  let prevHash = 'GENESIS';
  const knowable = input.now;
  const observations = 12;
  for (let i = 0; i < observations; i++) {
    const recorded = addDays(knowable, i);
    store.ingestObservation(campaignId, recorded, i, 100n + BigInt(i));
  }
  steps.push(
    stepResult(
      'ACQUIRE_CHRONOLOGICAL_OBSERVATIONS',
      store.observationCount(campaignId) === observations,
      `${observations} chronological observations`,
    ),
  );

  for (const sid of strategyIds) {
    const recorded = addDays(knowable, seq + 1);
    const decisionId = `dec:${campaignId}:${sid}#${seq}`;
    const degraded = sid === degradingStrategyId && seq >= 4;
    const action = degraded ? 'HOLD_DEGRADING' : 'SHADOW_ENTER';
    const sealed = sealDecision({
      decisionId,
      strategyId: sid,
      campaignId,
      knowableAt: knowable,
      recordedAt: recorded,
      sequence: seq,
      previousHash: prevHash,
      action,
    });
    prevHash = sealed.contentHash;
    store.appendSealedDecision(sealed);
    store.recordShadowNotional(sid, degraded ? 0n : 1_000_000n);
    seq += 1;
  }
  steps.push(
    stepResult('PRODUCE_DECISIONS', store.decisionCount() === strategyIds.length, `${seq} decisions`),
  );

  const chainOk = verifyEvidenceChain(store.allDecisions());
  steps.push(stepResult('SEAL_DECISIONS', chainOk, 'hash-chained evidence'));

  const executed = store.simulateExecution();
  steps.push(
    stepResult('SIMULATE_REALISTIC_EXECUTION', executed.trades > 0, `${executed.trades} shadow fills`),
  );

  const capitalOk = store.shadowCapitalReconciled();
  steps.push(stepResult('MAINTAIN_SHADOW_CAPITAL', capitalOk, 'shadow book balanced'));

  const cp1 = checkpointFromChain(campaignId, store.allDecisions(), 1, addDays(knowable, 2));
  store.saveCheckpoint(cp1);
  steps.push(stepResult('PERSIST_CHECKPOINTS', store.checkpointCount() === 1, cp1.checkpointId));

  const reloaded = store.restartFromCheckpoint(cp1);
  steps.push(
    stepResult(
      'RESTART_RUNTIME',
      reloaded.decisionCount === store.decisionCount(),
      `generation ${reloaded.runtimeGeneration}`,
    ),
  );

  const dupes = duplicateDecisionIds(store.allDecisions());
  steps.push(
    stepResult('PROVE_NO_DUPLICATE_DECISIONS', dupes.length === 0, `duplicates=${dupes.length}`),
  );

  const matured = store.matureOutcomes(addDays(knowable, 14));
  steps.push(stepResult('MATURE_OUTCOMES', matured.count >= strategyIds.length, `${matured.count} outcomes`));

  const seqEvidence = store.updateSequentialEvidence();
  steps.push(
    stepResult('UPDATE_SEQUENTIAL_EVIDENCE', seqEvidence.updated, `prequential step ${seqEvidence.step}`),
  );

  const bench = store.compareBenchmarks();
  steps.push(
    stepResult(
      'COMPARE_BENCHMARKS',
      bench.compared,
      `excessMinor=${bench.excessMinor.toString()}`,
    ),
  );

  const decay = store.detectDegradingStrategy(degradingStrategyId);
  steps.push(
    stepResult(
      'DETECT_DEGRADING_STRATEGY',
      decay.detected,
      `${degradingStrategyId} score=${decay.score}`,
    ),
  );

  const demoted = store.demoteStrategy(degradingStrategyId, 'AUTOMATIC_SHADOW_DEMOTION');
  steps.push(stepResult('DEMOTE_STRATEGY', demoted, degradingStrategyId));

  const preserved = verifyEvidenceChain(store.allDecisions()) && store.evidenceAppendOnly();
  steps.push(stepResult('PRESERVE_ALL_EVIDENCE', preserved, 'append-only vault'));

  const dailyId = store.produceDailyReport(addDays(knowable, 1));
  steps.push(stepResult('PRODUCE_DAILY_REPORT', dailyId.length > 0, dailyId));

  const weeklyId = store.produceWeeklyReport(addDays(knowable, 7));
  steps.push(stepResult('PRODUCE_WEEKLY_REPORT', weeklyId.length > 0, weeklyId));

  store.simulateProviderOutage();
  const afterOutage = store.recoverProviderAndContinue();
  steps.push(
    stepResult(
      'RECOVER_PROVIDER_OUTAGE',
      afterOutage.recovered,
      `observations after recovery=${afterOutage.observationCount}`,
    ),
  );

  const historyOk = store.historyNeverRewritten();
  steps.push(
    stepResult(
      'CONTINUE_WITHOUT_REWRITING_HISTORY',
      historyOk,
      `chainHead=${store.chainHead()}`,
    ),
  );

  const allStepsOk = steps.every((s) => s.ok) && SHADOW_LAB_LONG_RUN_STEPS.length === steps.length;

  return Object.freeze({
    campaignId,
    steps: Object.freeze(steps),
    allStepsOk,
    sealedDecisions: Object.freeze([...store.allDecisions()]),
    demotedStrategyId: demoted ? degradingStrategyId : null,
    evidenceChainIntact: verifyEvidenceChain(store.allDecisions()),
    duplicateDecisionIds: duplicateDecisionIds(store.allDecisions()),
    dailyReportId: dailyId,
    weeklyReportId: weeklyId,
  });
}
