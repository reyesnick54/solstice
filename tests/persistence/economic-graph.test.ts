import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog, type DomainEvent } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import {
  loadEconomicGraphState,
  persistEconomicGraphState,
} from '../../packages/persistence/src/economic-graph/pg-economic-graph-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { EconomicGraphService } from '../../packages/personal-economic-graph/src/service.ts';
import { InMemoryEconomicGraphStore } from '../../packages/personal-economic-graph/src/store.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-07-15T12:00:00.000Z');

describe('Personal Economic Graph persistence', () => {
  it('persists and reloads a graph projection', async (t) => {
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
    const subjectId = 'id_peg_pg';
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_peg_pg',
        jurisdiction: asJurisdiction('US'),
        identityId: subjectId,
        customerId: asCustomerId('cust_peg_pg'),
        capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_peg_pg');
    if (!actor.ok) {
      return;
    }
    const peg = new EconomicGraphService({ clock, events });
    peg.registerAccountCurrency('acct_pg', 'USD');
    peg.openGraph(actor.value, subjectId);
    peg.ingest(
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: NOW,
        eventId: 'pg_open',
        payload: {
          accountId: 'acct_pg',
          ownerId: 'cust_peg_pg',
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'I-pg',
        },
      } as DomainEvent,
      subjectId,
    );
    peg.declareGoal(actor.value, subjectId, {
      goalKind: 'EMERGENCY_RESERVE',
      label: 'Emergency fund',
      target: { minorUnits: '2000000', currency: 'USD' },
      priority: 1,
    });
    await persistEconomicGraphState(pools.customer, peg.store.exportState());
    const loaded = await loadEconomicGraphState(pools.customer);
    const restored = new InMemoryEconomicGraphStore();
    restored.loadState(loaded);
    const restoredService = new EconomicGraphService({ clock, store: restored });
    const graph = restoredService.getEconomicGraph(actor.value, subjectId);
    if (!graph.ok) {
      return;
    }
    assert.ok(graph.value.nodes.some((node) => node.kind === 'GOAL' && node.survivesRebuild));
    assert.ok(graph.value.nodes.some((node) => node.kind === 'ACCOUNT'));
    await closePersistencePools(pools);
  });
});
