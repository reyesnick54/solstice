/**
 * CampaignRuntime — one event-driven pass through the forward campaign loop (no busy wait).
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { ok, err, type Result } from '@solstice/domain';

import { consequentialTransition, commitCampaignCheckpoint } from './checkpoint.ts';
import { assertActiveLease } from './lease.ts';
import type { ForwardCampaignRuntimePorts } from './ports.ts';
import type { CampaignLoopPhase } from './taxonomy.ts';
import type {
  CampaignOrchestratorFailure,
  CampaignRuntimeTickResult,
  CampaignRunContext,
  CampaignScheduledOutcome,
  CampaignWorkItem,
} from './types.ts';
import type { ForwardAlphaDecisionId } from '../ids.ts';

function scheduleOutcomeObservation(input: {
  readonly decisionId: ForwardAlphaDecisionId;
  readonly matureAt: UtcInstant;
}): CampaignScheduledOutcome {
  return Object.freeze({
    scheduleId: `fout_${randomUUID().slice(0, 12)}`,
    decisionId: input.decisionId,
    matureAt: input.matureAt,
    sealed: true,
  });
}

export type CampaignRuntimeInput = {
  readonly context: CampaignRunContext;
  readonly workItem: CampaignWorkItem;
  readonly now: UtcInstant;
  readonly ownerId: string;
  readonly leaseGeneration: number;
  readonly ports: ForwardCampaignRuntimePorts;
  readonly pendingWork: readonly CampaignWorkItem[];
  readonly outcomeHorizonMs: number;
};

export function runCampaignRuntimePass(
  input: CampaignRuntimeInput,
): Result<CampaignRuntimeTickResult, CampaignOrchestratorFailure> {
  if (input.workItem.notBefore > input.now) {
    return err({ code: 'WORK_ITEM_NOT_READY', message: 'work item not yet due' });
  }
  const leaseErr = assertActiveLease(input.context, input.ownerId, input.leaseGeneration);
  if (leaseErr) {
    return err(leaseErr);
  }
  if (!['RUNNING', 'RECOVERING', 'DEGRADED'].includes(input.context.runState)) {
    return err({
      code: 'INVALID_STATE',
      message: `cannot run loop in state ${input.context.runState}`,
    });
  }

  if (input.workItem.kind === 'SCORE_OUTCOMES') {
    return runOutcomeScoringPass(input);
  }

  const phases: CampaignLoopPhase[] = [];
  let context = input.context;
  const boundaryKey = input.workItem.boundaryKey ?? `boundary:${input.now}`;

  const priorSealed = context.sealedBoundaryDigests[boundaryKey];
  if (priorSealed) {
    phases.push('OBSERVE', 'BUILD_POINT_IN_TIME_STATE', 'EVALUATE_STRATEGIES', 'SEAL_DECISIONS');
    context = Object.freeze({
      ...context,
      lastLoopPhase: 'SEAL_DECISIONS',
      updatedAt: input.now,
    });
    return finalizeTick({
      context,
      phases,
      newDecisionsSealed: 0,
      outcomesScored: 0,
      pendingWork: input.pendingWork,
      now: input.now,
      workItemsScheduled: [],
    });
  }

  const observationRefs = input.ports.observe({ campaignId: context.campaignId, asOf: input.now });
  phases.push('OBSERVE');

  const pit = input.ports.buildPointInTimeState({
    campaignId: context.campaignId,
    observationRefs,
    asOf: input.now,
  });
  phases.push('BUILD_POINT_IN_TIME_STATE');

  const evaluations = input.ports.evaluateStrategies({ campaignId: context.campaignId, pit });
  phases.push('EVALUATE_STRATEGIES');

  let newDecisionsSealed = 0;
  const sealedIds = [...context.sealedDecisionIds];
  const boundaryMap = { ...context.sealedBoundaryDigests };
  const pendingOutcomes = [...context.pendingOutcomes];
  const workItemsScheduled: CampaignWorkItem[] = [];

  for (const evaluation of evaluations) {
    if (!evaluation.eligibleForSeal) continue;
    const boundaryKey =
      input.workItem.boundaryKey && evaluations.length === 1
        ? input.workItem.boundaryKey
        : evaluation.boundaryKey;
    const existing = boundaryMap[boundaryKey];
    if (existing) {
      continue;
    }
    const decisionId = input.ports.sealBoundaryDecision({
      context,
      evaluation: Object.freeze({ ...evaluation, boundaryKey }),
      pit,
      sealedAt: input.now,
    });
    if (!decisionId) continue;
    boundaryMap[boundaryKey] = decisionId;
    sealedIds.push(decisionId);
    newDecisionsSealed += 1;
    phases.push('SEAL_DECISIONS');

    input.ports.executePaperShadow({ context, decisionId, executedAt: input.now });
    phases.push('PAPER_SHADOW_EXECUTION');

    const matureAt = new Date(Date.parse(input.now) + input.outcomeHorizonMs).toISOString() as UtcInstant;
    const scheduled = scheduleOutcomeObservation({ decisionId, matureAt });
    pendingOutcomes.push(scheduled);
    phases.push('SCHEDULE_OUTCOME_OBSERVATION');

    workItemsScheduled.push(
      Object.freeze({
        workItemId: `fwork_${randomUUID().slice(0, 12)}`,
        campaignId: context.campaignId,
        kind: 'SCORE_OUTCOMES' as const,
        triggerKind: 'OUTCOME_MATURITY' as const,
        enqueuedAt: input.now,
        notBefore: matureAt,
        boundaryKey: evaluation.boundaryKey,
        outcomeScheduleId: scheduled.scheduleId,
      }),
    );
  }

  let outcomesScored = 0;
  for (const row of [...pendingOutcomes]) {
    if (Date.parse(row.matureAt) > Date.parse(input.now)) continue;
    const scored = input.ports.scoreMaturedOutcome({
      context,
      decisionId: row.decisionId,
      scoredAt: input.now,
    });
    if (scored) outcomesScored += 1;
  }
  if (outcomesScored > 0) {
    phases.push('SCORE_MATURED_OUTCOMES');
  }

  input.ports.updateEvidence({ context, updatedAt: input.now });
  phases.push('UPDATE_EVIDENCE');

  const decay = input.ports.checkDecay({ context });
  phases.push('CHECK_DECAY');

  const promotion = input.ports.checkPromotionDemotion({ context, decay });
  phases.push('CHECK_PROMOTION_DEMOTION');

  const runState =
    decay.degraded && context.runState === 'RUNNING'
      ? ('DEGRADED' as const)
      : context.runState === 'RECOVERING'
        ? ('RUNNING' as const)
        : context.runState;

  context = Object.freeze({
    ...context,
    runState,
    sealedDecisionIds: Object.freeze(sealedIds),
    sealedBoundaryDigests: Object.freeze(boundaryMap),
    pendingOutcomes: Object.freeze(pendingOutcomes),
    lastLoopPhase: phases[phases.length - 1] ?? null,
    lastPromotionVerdict: promotion,
    updatedAt: input.now,
  });

  return finalizeTick({
    context,
    phases,
    newDecisionsSealed,
    outcomesScored,
    pendingWork: input.pendingWork,
    now: input.now,
    workItemsScheduled,
  });
}

function runOutcomeScoringPass(
  input: CampaignRuntimeInput,
): Result<CampaignRuntimeTickResult, CampaignOrchestratorFailure> {
  let outcomesScored = 0;
  const phases: CampaignLoopPhase[] = ['SCORE_MATURED_OUTCOMES'];
  let context = input.context;
  const scheduleId = input.workItem.outcomeScheduleId;
  const pending = context.pendingOutcomes.find((row) => row.scheduleId === scheduleId);
  if (pending && Date.parse(pending.matureAt) <= Date.parse(input.now)) {
    const scored = input.ports.scoreMaturedOutcome({
      context,
      decisionId: pending.decisionId,
      scoredAt: input.now,
    });
    if (scored) outcomesScored = 1;
  }
  input.ports.updateEvidence({ context, updatedAt: input.now });
  phases.push('UPDATE_EVIDENCE');
  const decay = input.ports.checkDecay({ context });
  phases.push('CHECK_DECAY');
  const promotion = input.ports.checkPromotionDemotion({ context, decay });
  phases.push('CHECK_PROMOTION_DEMOTION');
  const runState = decay.degraded && context.runState === 'RUNNING' ? ('DEGRADED' as const) : context.runState;
  context = Object.freeze({
    ...context,
    runState,
    lastLoopPhase: phases[phases.length - 1] ?? null,
    lastPromotionVerdict: promotion,
    updatedAt: input.now,
  });
  return finalizeTick({
    context,
    phases,
    newDecisionsSealed: 0,
    outcomesScored,
    pendingWork: input.pendingWork,
    now: input.now,
    workItemsScheduled: [],
  });
}

function finalizeTick(input: {
  readonly context: CampaignRunContext;
  readonly phases: readonly CampaignLoopPhase[];
  readonly newDecisionsSealed: number;
  readonly outcomesScored: number;
  readonly pendingWork: readonly CampaignWorkItem[];
  readonly now: UtcInstant;
  readonly workItemsScheduled: readonly CampaignWorkItem[];
}): Result<CampaignRuntimeTickResult, CampaignOrchestratorFailure> {
  let checkpoint = null as CampaignRuntimeTickResult['checkpoint'];
  let context = input.context;
  let pendingWork = input.pendingWork;
  if (consequentialTransition(input.context, context) || input.workItemsScheduled.length > 0) {
    pendingWork = Object.freeze([...pendingWork, ...input.workItemsScheduled]);
    const committed = commitCampaignCheckpoint({
      runContext: context,
      pendingWork,
      now: input.now,
    });
    checkpoint = committed.checkpoint;
    context = committed.runContext;
  }
  return ok(
    Object.freeze({
      phasesCompleted: Object.freeze([...input.phases]),
      runContext: context,
      newDecisionsSealed: input.newDecisionsSealed,
      outcomesScored: input.outcomesScored,
      checkpoint,
      workItemsScheduled: Object.freeze([...input.workItemsScheduled]),
    }),
  );
}
