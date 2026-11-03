import { err, ok, type Result } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { ResearchMonitorTriggerEvent } from '../os07/research-monitor-contract.ts';
import { ResearchTriggerBudget } from './budget.ts';
import { ResearchTriggerDedupe } from './dedupe.ts';
import { ResearchTriggerEvidence } from './evidence.ts';
import { researchTriggerRunIdFor } from './ids.ts';
import { assertResearchOnlyWorkOrder, buildTriggeredResearchWorkOrder } from './triggered-work-order.ts';
import {
  DEFAULT_RESEARCH_TRIGGER_BUDGET_LIMITS,
  type ResearchTriggerBudgetLimits,
  type ResearchTriggerMeshPort,
  type ResearchTriggerRouterFailure,
  type ResearchTriggerRouterInput,
  type ResearchTriggerRunResult,
  type ResearchTriggerStrategyEvaluationPort,
} from './types.ts';
import type { TriggerRouterReasonCode } from './taxonomy.ts';
import { ResearchTriggerRouterStore } from './store.ts';
import { evaluateTriggerValueOfInformation } from './voi.ts';
import type { TriggerRouterOutcome } from './taxonomy.ts';

export type ResearchTriggerRouterPorts = {
  readonly mesh: ResearchTriggerMeshPort;
  readonly evidenceVault?: EvidenceVault;
  readonly strategyEvaluation?: ResearchTriggerStrategyEvaluationPort;
  readonly budgetLimits?: ResearchTriggerBudgetLimits;
};

/**
 * Routes OS07 monitor triggers into bounded HELIOS research work orders and specialist mesh runs.
 * Research-only router: no financial mutators or trading adapters are referenced here.
 */
export class ResearchTriggerRouter {
  readonly store: ResearchTriggerRouterStore;
  readonly budget: ResearchTriggerBudget;
  readonly dedupe: ResearchTriggerDedupe;
  private readonly mesh: ResearchTriggerMeshPort;
  private readonly evidence: ResearchTriggerEvidence;
  private readonly evidenceVault?: EvidenceVault;
  private readonly strategyEvaluation?: ResearchTriggerStrategyEvaluationPort;

  constructor(ports: ResearchTriggerRouterPorts) {
    const limits = ports.budgetLimits ?? DEFAULT_RESEARCH_TRIGGER_BUDGET_LIMITS;
    this.mesh = ports.mesh;
    if (ports.evidenceVault !== undefined) {
      this.evidenceVault = ports.evidenceVault;
    }
    if (ports.strategyEvaluation !== undefined) {
      this.strategyEvaluation = ports.strategyEvaluation;
    }
    this.store = new ResearchTriggerRouterStore();
    this.budget = new ResearchTriggerBudget(limits);
    this.dedupe = new ResearchTriggerDedupe(limits);
    this.evidence = new ResearchTriggerEvidence();
  }

  route(input: ResearchTriggerRouterInput): Result<ResearchTriggerRunResult, ResearchTriggerRouterFailure> {
    const validation = this.validate(input);
    if (!validation.ok) {
      return validation;
    }
    const { trigger, now } = input;
    const nowMs = Date.parse(now);
    const runId = researchTriggerRunIdFor(trigger.triggerEventId, input.mandateBoundWorkOrder.workOrderId);
    const reasonCodes: TriggerRouterReasonCode[] = ['RESEARCH_ONLY_SCOPE', 'EXECUTION_PATH_FORBIDDEN'];

    const prior = this.dedupe.checkIdempotency(trigger.idempotencyKey);
    if (prior) {
      const replay = this.store.getRun(prior.runId);
      if (replay) {
        const replayResult: ResearchTriggerRunResult = Object.freeze({
          ...replay,
          outcome: 'IDEMPOTENT_REPLAY',
          reasonCodes: Object.freeze(['IDEMPOTENCY_REPLAY', ...replay.reasonCodes] as TriggerRouterReasonCode[]),
        });
        return ok(replayResult);
      }
    }

    const cooldown = this.dedupe.checkCooldown(trigger.cooldownKey, nowMs);
    if (cooldown.blocked) {
      return ok(this.storeAndReturn(runId, 'COOLDOWN', [cooldown.reason], null, null, false));
    }

    const dedupe = this.dedupe.checkDedupe(trigger.dedupeFingerprint, nowMs);
    if (dedupe.blocked) {
      return ok(this.storeAndReturn(runId, 'DEDUPED', [dedupe.reason], null, null, false));
    }

    const voi = evaluateTriggerValueOfInformation({
      trigger,
      researchBudget: input.researchBudget,
      voiContext: input.voiContext,
    });
    if (voi.denied) {
      const codes: TriggerRouterReasonCode[] = [...reasonCodes];
      if (voi.spendDecision === 'WAIT_FOR_DATA') {
        codes.push('VOI_WAIT_FOR_DATA');
      } else {
        codes.push('VOI_DO_NOT_RESEARCH');
      }
      return ok(this.storeAndReturn(runId, 'VOI_DENIED', codes, null, null, false));
    }
    if (voi.reduced) {
      reasonCodes.push('VOI_BUDGET_REDUCED');
    }

    const begin = this.budget.beginRun(trigger.customerId, now);
    if (!begin.ok) {
      return ok(this.storeAndReturn(runId, 'LIMIT_EXCEEDED', [begin.error.code, ...reasonCodes], null, null, false));
    }

    try {
      assertResearchOnlyWorkOrder(input.mandateBoundWorkOrder);
      const triggeredWorkOrder = buildTriggeredResearchWorkOrder({
        trigger,
        economicWorkOrder: input.mandateBoundWorkOrder,
        approvedBudgetMinor: voi.approvedBudgetMinor,
        now,
      });

      const approvedBudgetMicros = BigInt(voi.approvedBudgetMinor) * 10_000n;
      const meshResult = this.mesh.runTriggeredResearch({
        workOrderId: triggeredWorkOrder.economicWorkOrderId,
        subjectId: trigger.subjectId,
        objective: `Monitor ${trigger.monitorId}: ${trigger.triggerExplanation}`,
        opportunityKind: trigger.opportunityKind ?? 'GENERIC',
        roles: triggeredWorkOrder.routedMeshRoles,
        evidenceBundle: buildEvidenceBundle(trigger),
        approvedBudgetMicros,
      });

      if (!meshResult.ok) {
        return ok(this.storeAndReturn(runId, 'MESH_FAILED', ['MESH_ERROR', ...reasonCodes], triggeredWorkOrder, null, false));
      }

      const spendRecorded = this.budget.recordSpend(trigger.customerId, meshResult.cost);
      if (!spendRecorded.ok) {
        return ok(this.storeAndReturn(runId, 'LIMIT_EXCEEDED', [spendRecorded.error.code, ...reasonCodes], triggeredWorkOrder, null, false));
      }

      const evidenceRecord = this.evidence.sealTriggeredResearch(this.evidenceVault, {
        runId,
        trigger,
        agentsRan: meshResult.agents,
        sourcesUsed: meshResult.sourcesUsed,
        cost: meshResult.cost,
        confidenceBefore: trigger.confidenceBefore,
        confidenceAfter: meshResult.confidenceAfter,
        voiAssessment: voi.assessment,
        spendDecision: voi.spendDecision,
        now,
      });

      this.dedupe.recordIdempotency(trigger.idempotencyKey, runId, now);
      this.dedupe.recordDedupe(trigger.dedupeFingerprint, runId, nowMs);
      this.dedupe.recordCooldown(trigger.cooldownKey, trigger.cooldownSeconds, nowMs);

      const outcome: TriggerRouterOutcome = voi.reduced ? 'VOI_REDUCED' : 'RESEARCH_COMPLETED';
      const result = this.storeAndReturn(
        runId,
        outcome,
        reasonCodes,
        triggeredWorkOrder,
        evidenceRecord,
        Boolean(input.requestStrategyEvaluation),
        meshResult.meshRunId,
      );

      if (input.requestStrategyEvaluation && this.strategyEvaluation && result.triggeredWorkOrder && result.evidence) {
        this.strategyEvaluation.evaluateResearchResult({
          runId,
          triggeredWorkOrder: result.triggeredWorkOrder,
          evidence: result.evidence,
        });
      }

      return ok(result);
    } finally {
      this.budget.endRun(trigger.customerId);
    }
  }

  private validate(input: ResearchTriggerRouterInput): Result<true, ResearchTriggerRouterFailure> {
    if (!input.trigger.idempotencyKey.trim()) {
      return err({ code: 'INVALID_TRIGGER', message: 'idempotency key required' });
    }
    if (input.trigger.customerId !== input.mandateBoundWorkOrder.customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'trigger customer must match work order' });
    }
    if (input.mandateBoundWorkOrder.state !== 'ACTIVE') {
      return err({ code: 'WORK_ORDER_INACTIVE', message: 'work order must be ACTIVE' });
    }
    return ok(true);
  }

  private storeAndReturn(
    runId: ReturnType<typeof researchTriggerRunIdFor>,
    outcome: TriggerRouterOutcome,
    reasonCodes: readonly TriggerRouterReasonCode[],
    triggeredWorkOrder: ResearchTriggerRunResult['triggeredWorkOrder'],
    evidence: ResearchTriggerRunResult['evidence'],
    strategyEvaluationRequested: boolean,
    meshRunId: string | null = null,
  ): ResearchTriggerRunResult {
    const result: ResearchTriggerRunResult = Object.freeze({
      runId,
      outcome,
      reasonCodes: Object.freeze([...reasonCodes]),
      triggeredWorkOrder,
      meshRunId,
      evidence,
      strategyEvaluationRequested,
    });
    this.store.putRun(result);
    return result;
  }
}

function buildEvidenceBundle(trigger: ResearchMonitorTriggerEvent) {
  const refs = [...trigger.availableInformation.observationRefs, ...trigger.availableInformation.featureRefs];
  return Object.freeze(
    refs.map((sourceRef, index) =>
      Object.freeze({
        evidenceId: `rt_evd_${index}`,
        sourceKind: trigger.observationRef === sourceRef ? 'MARKET_OBSERVATION' : 'EXTERNAL_PUBLIC',
        sourceRef,
        observedAt: trigger.availableInformation.capturedAt,
        freshnessOk: trigger.availableInformation.dataAvailable,
        entitlementOk: true,
        provenanceRef: `monitor:${trigger.monitorId}:${trigger.monitorVersion}`,
      }),
    ),
  );
}
