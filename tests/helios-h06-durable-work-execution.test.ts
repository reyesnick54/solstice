import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED,
  HeliosTaskWorker,
  HeliosWorkOrchestrator,
  collectHeliosMetrics,
} from '../packages/platform/src/helios/index.ts';
import { asEconomicMandateId, asMandateVersion, type EconomicMandateId } from '../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { lintGrowthBoundary } from '../tools/architectural-linter/src/growth-guards.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function activeMandate(subjectId: string): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_h06_integration'),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'HELIOS growth program',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: NOW,
    planningEligible: true,
  });
}

describe('HELIOS H06 integration — durable work execution and research budgets', () => {
  it('architecture guard: Growth Orchestrator helios module does not post journals', () => {
    const findings = lintGrowthBoundary('packages/platform/src/helios/orchestrator.ts');
    assert.equal(findings.length, 0);
  });

  it('executes bounded research workflow with worker dispatch', async () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const mandates = new Map([[activeMandate('id_a').mandateId, activeMandate('id_a')]]);
    const orchestrator = new HeliosWorkOrchestrator({
      clock,
      evidence,
      mandateLookup: (id) => mandates.get(id as EconomicMandateId),
    });
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_integration',
      customerId: 'cust_a',
      subjectId: 'id_a',
      objective: 'research program',
      mandate: activeMandate('id_a'),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'approval_bound',
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId: 'cust_a',
      operationIdentity: 'dispatch_op',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze(['fixture_search']),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'fixture query',
      estimatedBudget: '150',
    });
    const worker = new HeliosTaskWorker({ orchestrator, workerId: 'integration_worker' });
    worker.register('RESEARCH_QUERY', async () => ({
      resultRef: 'fixture_result',
      evidenceRefs: Object.freeze(['ev_fixture']),
      actualSpend: '120',
    }));
    const outcome = await worker.dispatchOnce({
      workOrderId: order.workOrderId,
      customerId: 'cust_a',
    });
    assert.equal(outcome.succeeded, 1);
    const metrics = collectHeliosMetrics(orchestrator.store, clock.now());
    assert.equal(metrics.taskSuccessCount, 1);
    assert.ok(BigInt(metrics.researchSpendTotal) > 0n);
    const remaining = orchestrator.store.getWorkOrder(order.workOrderId, 'cust_a')!.researchBudget.remainingBudget;
    assert.equal(remaining, '880');
    assert.equal(HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED, 'HELIOS_PHASE_2_DURABLE_CONTROL_TRUSTED');
  });
});
