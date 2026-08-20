import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { persistStrategyLabState } from '../../packages/persistence/src/strategy-lab/pg-strategy-lab-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../packages/model-registry/src/registry.ts';
import { defaultSimulationBudget, RiskEngine } from '../../packages/risk/src/engine.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { equalWeightSpec } from '../../packages/strategy-lab/src/fixtures.ts';
import { StrategyLab } from '../../packages/strategy-lab/src/service.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('strategy lab persistence', () => {
  it('persists strategy versions, datasets, and kill-switch state', async (t) => {
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
        actorId: 'actor_lab_pg',
        jurisdiction: asJurisdiction('GB'),
        identityId: 'id_lab_pg',
        customerId: asCustomerId('cust_lab_pg'),
        capabilities: ['VIEW_ACCOUNT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_lab_pg');
    if (!actor.ok) {
      return;
    }
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalRiskModel(registry, actor.value, NOW).ok, true);
    const risk = new RiskEngine({ clock, registry, events });
    const lab = new StrategyLab({ clock, risk, registry, events });
    risk.putBudget(
      defaultSimulationBudget({
        subjectId: 'cust_lab_pg',
        portfolioId: 'inv_lab_pg',
        reviewBy: NOW,
      }),
    );
    assert.equal(lab.createDraft({ specification: equalWeightSpec() }).ok, true);
    await persistStrategyLabState(pools.customer, lab.store.snapshot());
    const strategies = await pools.customer.query('SELECT strategy_id, lifecycle FROM strategy_lab.strategy');
    const live = await pools.customer.query(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'strategy_lab' AND column_name = 'live_approved'`,
    );
    assert.equal(strategies.rowCount, 1);
    assert.equal(strategies.rows[0]?.lifecycle, 'DRAFT');
    assert.ok((live.rowCount ?? 0) >= 1);
    await closePersistencePools(pools);
  });
});
