import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { loadGrowthState, persistGrowthState } from '../../packages/persistence/src/growth/pg-growth-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { EconomicGraphService } from '../../packages/personal-economic-graph/src/service.ts';
import { GrowthOrchestrator } from '../../packages/platform/src/service.ts';
import { InMemoryGrowthStore } from '../../packages/platform/src/store.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Growth Orchestrator persistence', () => {
  it('persists mandate versions and reloads planning state', async (t) => {
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
    const subjectId = 'id_growth_pg';
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_growth_pg',
        jurisdiction: asJurisdiction('US'),
        identityId: subjectId,
        customerId: asCustomerId('cust_growth_pg'),
        capabilities: [
          'VIEW_ECONOMIC_GRAPH',
          'DECLARE_ECONOMIC_FACT',
          'VIEW_GROWTH_PLAN',
          'CONFIRM_ECONOMIC_MANDATE',
        ],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_growth_pg');
    assert.equal(actor.ok, true);
    if (!actor.ok) {
      return;
    }
    const peg = new EconomicGraphService({ clock, events });
    peg.openGraph(actor.value, subjectId);
    peg.declareIncomeSource(actor.value, subjectId, {
      incomeKind: 'SALARY',
      label: 'Salary',
      estimatedAmount: { minorUnits: '1000000', currency: 'USD' },
    });
    const orchestrator = new GrowthOrchestrator({ clock, events, peg });
    const compiled = orchestrator.interpretAndCompile(actor.value, {
      subjectId,
      sourceText: 'Keep at least $8,000 liquid and reduce expensive debt.',
    });
    assert.equal(compiled.ok, true);
    const confirmed = orchestrator.confirmAndActivate(actor.value, subjectId);
    assert.equal(confirmed.ok, true);
    await persistGrowthState(pools.customer, orchestrator.store.exportState());
    const loaded = await loadGrowthState(pools.customer);
    const restored = new InMemoryGrowthStore();
    restored.loadState(loaded);
    const mandate = restored.activeMandateFor(subjectId);
    assert.ok(mandate);
    assert.equal(mandate?.state, 'ACTIVE');
    assert.equal(mandate?.planningEligible, true);
    await closePersistencePools(pools);
  });
});
