import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { loadPeveState, persistPeveState } from '../../packages/persistence/src/value/pg-peve-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { EconomicGraphService } from '../../packages/personal-economic-graph/src/service.ts';
import { FORMULA_V1 } from '../../packages/platform/src/value/formula.ts';
import { PersonalEconomicValueEngine } from '../../packages/platform/src/value/service.ts';
import { InMemoryPeveStore } from '../../packages/platform/src/value/store.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('PEVE persistence', () => {
  it('persists snapshots and attribution without a financial journal table', async (t) => {
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
    const subjectId = 'id_peve_pg';
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_peve_pg',
        jurisdiction: asJurisdiction('US'),
        identityId: subjectId,
        customerId: asCustomerId('cust_peve_pg'),
        capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'VIEW_ECONOMIC_VALUE'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_peve_pg');
    if (!actor.ok) {
      throw new Error('expected ok');
    }
    const peg = new EconomicGraphService({ clock, events });
    peg.openGraph(actor.value, subjectId);
    peg.declareIncomeSource(actor.value, subjectId, {
      incomeKind: 'SALARY',
      label: 'Salary',
      estimatedAmount: { minorUnits: '400000', currency: 'USD' },
    });
    const snapshot = peg.getEconomicSnapshot(actor.value, subjectId);
    if (!snapshot.ok) {
      throw new Error('expected ok');
    }
    const peve = new PersonalEconomicValueEngine({ clock, events });
    const recorded = peve.recordAttribution(actor.value, {
      subjectId,
      sourceEventId: 'evt_pg_fee',
      observedResult: 'fee avoided',
      amount: { minorUnits: '1500', currency: 'USD' },
      attributionType: 'FEE_AVOIDED',
      realization: 'REALIZED',
      calculationMethod: 'observed',
      confidence: 'VERIFIED',
      formulaVersion: FORMULA_V1,
      recordedAt: NOW,
    });
    assert.equal(recorded.ok, true);
    const generated = peve.generateSnapshot(actor.value, { subjectId, peg: snapshot.value });
    assert.equal(generated.ok, true);
    await persistPeveState(pools.customer, peve.store.exportState());
    const loaded = await loadPeveState(pools.customer);
    const restored = new InMemoryPeveStore();
    restored.loadState(loaded);
    const latest = restored.latestSnapshotFor(subjectId);
    assert.ok(latest);
    assert.equal(latest?.subjectId, subjectId);
    assert.equal(latest?.valuationContext.notHumanWorth, true);
    assert.equal(restored.attributionsFor(subjectId).length, 1);
    assert.equal(restored.attributionsFor(subjectId)[0]?.principalMovement, false);
    await closePersistencePools(pools);
  });
});
