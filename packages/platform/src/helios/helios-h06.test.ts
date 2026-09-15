import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { asEconomicMandateId, asMandateVersion } from '../ids.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import {
  HELIOS_PHASE_2_BLOCKED,
  HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED,
  HeliosTaskWorker,
  HeliosWorkOrchestrator,
  isRetryableCategory,
  rejectBudgetSelfIncrease,
} from './index.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function mandate(subjectId: string, state: CompiledEconomicMandate['state'] = 'ACTIVE'): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_h06_test'),
    version: asMandateVersion(1),
    subjectId,
    state,
    sourceText: 'bounded research growth program',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: NOW,
    planningEligible: state === 'ACTIVE',
  });
}

function setup(subjectId = 'id_h06_a', customerId = 'cust_h06_a') {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const mandates = new Map<string, CompiledEconomicMandate>();
  const active = mandate(subjectId);
  mandates.set(active.mandateId, active);
  const orchestrator = new HeliosWorkOrchestrator({
    clock,
    evidence,
    mandateLookup: (id) => mandates.get(id),
  });
  return { clock, orchestrator, mandates, subjectId, customerId, evidence };
}

describe('HELIOS H06 durable work execution', () => {
  it('reserves budget atomically and rejects races', () => {
    const { orchestrator, subjectId, customerId } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_race',
      customerId,
      subjectId,
      objective: 'race budget',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'approval_1',
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const t1 = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'op_a',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze(['search']),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'query a',
      estimatedBudget: '600',
    });
    const t2 = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'op_b',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze(['search']),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'query b',
      estimatedBudget: '600',
    });
    if ('code' in t1) throw new Error(t1.message);
    assert.ok('code' in t2);
    if (!('code' in t2)) throw new Error('expected budget exhaustion');
    assert.equal(t2.code, 'BUDGET_EXHAUSTED');
  });

  it('prevents duplicate completion on replay', () => {
    const { orchestrator, customerId, subjectId } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_idem',
      customerId,
      subjectId,
      objective: 'idempotent',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      budgetCeiling: '500',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'idem_op',
      taskType: 'ANALYSIS',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'analyze',
      estimatedBudget: '100',
    });
    if ('code' in task) throw new Error(task.message);
    const claimed = orchestrator.claimTask({
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId,
      workerId: 'worker_a',
    });
    if ('code' in claimed) throw new Error(claimed.message);
    const done = orchestrator.completeTask({
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId,
      workerId: 'worker_a',
      leaseGeneration: claimed.lease!.leaseGeneration,
      resultRef: 'result_1',
      actualSpend: '80',
    });
    if ('code' in done) throw new Error(done.message);
    const replay = orchestrator.completeTask({
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId,
      workerId: 'worker_b',
      leaseGeneration: 99,
      resultRef: 'result_forged',
    });
    assert.ok('code' in replay);
    assert.equal(replay.code, 'TASK_ALREADY_COMPLETED');
  });

  it('recovers expired lease after restart without authority expansion', () => {
    const { clock, orchestrator, customerId, subjectId, mandates } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_restart',
      customerId,
      subjectId,
      objective: 'restart safe',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'appr',
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'restart_op',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze(['search']),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'query',
      estimatedBudget: '200',
    });
    if ('code' in task) throw new Error(task.message);
    const claimed = orchestrator.claimTask({
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId,
      workerId: 'worker_crash',
      leaseMs: 5_000,
    });
    if ('code' in claimed) throw new Error(claimed.message);
    const budgetBefore = orchestrator.store.getWorkOrder(order.workOrderId, customerId)!.researchBudget;
    const snapshot = orchestrator.snapshot();
    clock.advanceMs(10_000n);
    const restarted = HeliosWorkOrchestrator.fromSnapshot(
      { clock, mandateLookup: (id) => mandates.get(id) },
      snapshot,
    );
    const recovered = restarted.recoverAfterRestart();
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.state, 'CLAIMABLE');
    const budgetAfter = restarted.store.getWorkOrder(order.workOrderId, customerId)!.researchBudget;
    assert.equal(budgetAfter.remainingBudget, budgetBefore.remainingBudget);
    const escalation = restarted.attemptBudgetEscalation(order.workOrderId, customerId, '5000');
    assert.equal(escalation.code, 'BUDGET_SELF_INCREASE_FORBIDDEN');
  });

  it('blocks dispatch after authority revocation while preserving history', () => {
    const { orchestrator, customerId, subjectId, mandates } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_revoke',
      customerId,
      subjectId,
      objective: 'revoke',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'appr',
      budgetCeiling: '800',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'revoke_op',
      taskType: 'ANALYSIS',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'analyze',
    });
    if ('code' in task) throw new Error(task.message);
    mandates.set(mandate(subjectId).mandateId, mandate(subjectId, 'REVOKED'));
    orchestrator.revokeAuthority(order.workOrderId, customerId);
    const blocked = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'new_op',
      taskType: 'ANALYSIS',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'new',
    });
    assert.ok('code' in blocked);
    assert.equal(blocked.code, 'WORK_ORDER_NOT_ACTIVE');
    assert.ok(orchestrator.store.listAudit(customerId).some((row) => row.kind === 'authority_revoked'));
    assert.ok(orchestrator.store.getTask(task.taskId, customerId));
  });

  it('rejects cross-customer task access', () => {
    const { orchestrator, customerId, subjectId } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_iso',
      customerId,
      subjectId,
      objective: 'isolation',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      budgetCeiling: '500',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'iso_op',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'query',
    });
    if ('code' in task) throw new Error(task.message);
    assert.equal(orchestrator.store.getTask(task.taskId, 'cust_other'), undefined);
    const claim = orchestrator.claimTask({
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId: 'cust_other',
      workerId: 'evil_worker',
    });
    assert.ok('code' in claim);
    assert.equal(claim.code, 'WORK_ORDER_NOT_FOUND');
  });

  it('does not retry authorization failures forever', () => {
    assert.equal(isRetryableCategory('AUTHORIZATION_CHANGED'), false);
    assert.equal(isRetryableCategory('TRANSIENT_DEPENDENCY'), true);
  });

  it('rejects worker budget self-increase', () => {
    const rejection = rejectBudgetSelfIncrease('1000', '2000');
    assert.ok(rejection);
    assert.equal(rejection!.code, 'BUDGET_SELF_INCREASE_FORBIDDEN');
  });
});

describe('HELIOS Phase 2 acceptance ceremony', () => {
  it('HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED', async () => {
    const blockers: string[] = [];
    const { clock, orchestrator, customerId, subjectId, mandates } = setup();
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_phase2',
      customerId,
      subjectId,
      objective: 'customer growth program',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'customer_approval_1',
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
      maxConcurrentTasks: 2,
    });
    if ('code' in order) {
      blockers.push(`work order: ${order.message}`);
    } else {
      const taskA = orchestrator.createTask({
        workOrderId: order.workOrderId,
        customerId,
        operationIdentity: 'research_a',
        taskType: 'RESEARCH_QUERY',
        requiredCapability: 'HELIOS_RESEARCH',
        permittedTools: Object.freeze(['search']),
        permittedModelClass: 'SIMULATION',
        requestedObjective: 'market scan',
        estimatedBudget: '300',
      });
      const taskB = orchestrator.createTask({
        workOrderId: order.workOrderId,
        customerId,
        operationIdentity: 'research_b',
        taskType: 'ANALYSIS',
        requiredCapability: 'HELIOS_RESEARCH',
        permittedTools: Object.freeze(['analyze']),
        permittedModelClass: 'SIMULATION',
        requestedObjective: 'synthesis',
        dependencyTaskIds: 'code' in taskA ? [] : [taskA.taskId],
        estimatedBudget: '200',
      });
      const worker = new HeliosTaskWorker({ orchestrator, workerId: 'worker_phase2' });
      worker.register('RESEARCH_QUERY', async () => ({
        resultRef: 'evidence_scan_1',
        evidenceRefs: Object.freeze(['ev_1']),
        actualSpend: '250',
      }));
      if ('code' in taskA) blockers.push('task A failed');
      else {
        const claimed = orchestrator.claimTask({
          taskId: taskA.taskId,
          workOrderId: order.workOrderId,
          customerId,
          workerId: 'worker_phase2',
          leaseMs: 30_000,
        });
        if ('code' in claimed) blockers.push('claim A failed');
        else {
          const completed = orchestrator.completeTask({
            taskId: taskA.taskId,
            workOrderId: order.workOrderId,
            customerId,
            workerId: 'worker_phase2',
            leaseGeneration: claimed.lease!.leaseGeneration,
            resultRef: 'evidence_scan_1',
            actualSpend: '250',
          });
          if ('code' in completed) blockers.push('complete A failed');
        }
      }
      if (!('code' in taskB)) {
        const inProgress = orchestrator.claimTask({
          taskId: taskB.taskId,
          workOrderId: order.workOrderId,
          customerId,
          workerId: 'worker_phase2',
          leaseMs: 5_000,
        });
        if ('code' in inProgress) blockers.push('claim B in-progress failed');
        const budgetMid = orchestrator.store.getWorkOrder(order.workOrderId, customerId)!.researchBudget;
        const snapshot = orchestrator.snapshot();
        clock.advanceMs(10_000n);
        const restarted = HeliosWorkOrchestrator.fromSnapshot(
          { clock, mandateLookup: (id) => mandates.get(id) },
          snapshot,
        );
        restarted.recoverAfterRestart();
        const budgetAfterRestart = restarted.store.getWorkOrder(order.workOrderId, customerId)!.researchBudget;
        if (budgetAfterRestart.remainingBudget !== budgetMid.remainingBudget) {
          blockers.push('budget changed illegitimately on restart');
        }
        const dup = restarted.completeTask({
          taskId: 'code' in taskA ? '' : taskA.taskId,
          workOrderId: order.workOrderId,
          customerId,
          workerId: 'forged',
          leaseGeneration: 1,
          resultRef: 'forged',
        });
        if (!('code' in dup)) blockers.push('duplicate completion accepted');
        restarted.pauseWorkOrder(order.workOrderId, customerId);
        const postPause = restarted.createTask({
          workOrderId: order.workOrderId,
          customerId,
          operationIdentity: 'post_pause',
          taskType: 'ANALYSIS',
          requiredCapability: 'HELIOS_RESEARCH',
          permittedTools: Object.freeze([]),
          permittedModelClass: 'SIMULATION',
          requestedObjective: 'blocked',
        });
        if (!('code' in postPause)) blockers.push('dispatch after pause not blocked');
        const authEsc = restarted.attemptAuthorityEscalation(order.workOrderId, customerId, {
          capability: 'HELIOS_ANALYSIS',
        });
        if (authEsc.code !== 'AUTHORITY_EXPANSION_FORBIDDEN') blockers.push('authority escalation not rejected');
        const cross = restarted.claimTask({
          taskId: 'code' in taskB ? '' : taskB.taskId,
          workOrderId: order.workOrderId,
          customerId: 'cust_other',
          workerId: 'evil',
        });
        if (!('code' in cross)) blockers.push('cross-customer claim not rejected');
        if (restarted.store.listAudit(customerId).length === 0) blockers.push('audit trail missing');
      }
    }
    if (blockers.length > 0) {
      assert.equal(`${HELIOS_PHASE_2_BLOCKED}: ${blockers.join('; ')}`, HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED);
    } else {
      assert.equal(HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED, 'HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED');
    }
  });
});
