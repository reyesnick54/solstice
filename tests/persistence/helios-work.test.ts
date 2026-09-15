import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { asEconomicMandateId, asMandateVersion } from '../../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate } from '../../packages/platform/src/mandate/types.ts';
import { HeliosWorkOrchestrator } from '../../packages/platform/src/helios/index.ts';
import { loadHeliosWorkState, persistHeliosWorkState } from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function mandate(subjectId: string): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_persist_h06'),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'persist test',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: NOW,
    planningEligible: true,
  });
}

describePersistence('HELIOS H06 persistence', () => {
  it('work order and task state survive restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const orchestrator = new HeliosWorkOrchestrator({ clock, mandateLookup: () => mandate('id_persist') });
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_persist',
      customerId: 'cust_persist',
      subjectId: 'id_persist',
      objective: 'durable',
      mandate: mandate('id_persist'),
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      budgetCeiling: '500',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId: 'cust_persist',
      operationIdentity: 'persist_op',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'query',
      estimatedBudget: '100',
    });
    await persistHeliosWorkState(pool, orchestrator.snapshot());
    const reloaded = await loadHeliosWorkState(pool);
    assert.equal(reloaded.workOrders.length, 1);
    assert.equal(reloaded.tasks.length, 1);
    const restarted = HeliosWorkOrchestrator.fromSnapshot({ clock }, reloaded);
    const task = restarted.store.getTask(reloaded.tasks[0]!.taskId, 'cust_persist');
    assert.ok(task);
    assert.equal(task!.reservedBudgetAmount, '100');
    await durable.close();
  });
});
