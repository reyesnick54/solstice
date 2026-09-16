import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import {
  loadWorkOrderState,
  persistWorkOrderState,
} from '../../packages/persistence/src/growth/pg-work-order-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import {
  asEconomicMandateId,
  asGrowthPlanId,
  asGrowthPlanVersion,
  asMandateVersion,
} from '../../packages/platform/src/ids.ts';
import { EconomicWorkOrderService } from '../../packages/platform/src/work-order/service.ts';
import { InMemoryWorkOrderStore } from '../../packages/platform/src/work-order/store.ts';
import type { CreateEconomicWorkOrderInput } from '../../packages/platform/src/work-order/types.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-09-15T12:00:00.000Z');

function createInput(): CreateEconomicWorkOrderInput {
  return {
    subjectId: 'subj_pg_wo',
    customerId: 'cust_pg_wo',
    idempotencyKey: 'idem_pg_wo_1',
    planId: asGrowthPlanId('gpl_pg_wo'),
    planVersion: asGrowthPlanVersion(1),
    objective: {
      description: 'PG persistence work order',
      objectiveType: 'GENERAL_ECONOMIC_WORK',
      horizon: null,
      completionCriteria: Object.freeze(['done']),
      terminationCriteria: Object.freeze(['cancelled']),
      priority: null,
    },
    authorityReferences: {
      mandateId: asEconomicMandateId('emd_pg_wo'),
      mandateVersion: asMandateVersion(1),
      approvalReference: null,
      capabilityContextReference: null,
      jurisdiction: 'US',
      legalEntityId: null,
    },
    capitalBoundary: {
      maxCapitalEnvelope: { minorUnits: '10000', currency: 'USD' },
      accountId: null,
      portfolioId: null,
      liquidityRetentionReference: null,
      isBalance: false,
      isAuthorizationEnvelope: true,
    },
    researchBoundary: {
      budgetReference: null,
      budgetUnits: Object.freeze(['USD']),
      deadline: null,
      permittedCategories: Object.freeze([]),
      permittedToolClasses: Object.freeze(['PEG_QUERY']),
      permittedModelClasses: Object.freeze(['DETERMINISTIC']),
      maxConcurrency: 1,
      stopConditions: Object.freeze([]),
    },
    actionBoundary: {
      permittedActionCategories: Object.freeze(['RESEARCH']),
      unrestrictedFinancialMutation: false,
      agentAuthorityEscalation: false,
    },
    completion: {
      completionCriteria: Object.freeze(['complete']),
      expirationAt: null,
    },
  };
}

describe('Economic Work Order persistence', () => {
  it('persists and reloads work order state', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SUNREY_PERSISTENCE_TEST is not set');
      return;
    }
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_pg_wo',
        jurisdiction: asJurisdiction('US'),
        identityId: 'subj_pg_wo',
        customerId: asCustomerId('cust_pg_wo'),
        capabilities: ['VIEW_GROWTH_PLAN', 'OPERATE_GROWTH_ORCHESTRATOR'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_pg_wo');
    if (!actor.ok) {
      throw new Error('actor');
    }
    const service = new EconomicWorkOrderService({ clock, events });
    const created = service.createEconomicWorkOrder(actor.value, createInput());
    assert.equal(created.ok, true);
    await persistWorkOrderState(pools.customer, service.store.snapshot());
    const loaded = await loadWorkOrderState(pools.customer);
    const restored = new InMemoryWorkOrderStore();
    restored.loadState(loaded);
    const reloaded = restored.get(created.ok ? created.value.workOrderId : '');
    assert.ok(reloaded);
    assert.equal(reloaded?.customerId, 'cust_pg_wo');
    assert.equal(reloaded?.state, 'CREATED');
    await closePersistencePools(pools);
  });
});
