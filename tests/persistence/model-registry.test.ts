import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { persistModelRegistryState } from '../../packages/persistence/src/model-registry/pg-model-registry-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../packages/model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Model Registry persistence', () => {
  it('persists hash-addressable model versions without executable code columns', async (t) => {
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
        actorId: 'actor_model_pg',
        jurisdiction: asJurisdiction('GB'),
        identityId: 'id_model_pg',
        customerId: asCustomerId('cust_model_pg'),
        capabilities: ['VIEW_ACCOUNT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_model_pg');
    assert.equal(actor.ok, true);
    if (!actor.ok) {
      return;
    }
    const registry = new ModelRegistry();
    const seeded = seedCanonicalRiskModel(registry, actor.value, NOW);
    assert.equal(seeded.ok, true);
    await persistModelRegistryState(pools.customer, registry.snapshot());
    const models = await pools.customer.query(
      'SELECT model_id, version, lifecycle, live_approved FROM model_registry.model_version',
    );
    const artifacts = await pools.customer.query('SELECT sha256 FROM model_registry.artifact');
    const approvals = await pools.customer.query('SELECT actor_id FROM model_registry.approval');
    assert.equal(models.rowCount, 1);
    assert.equal(models.rows[0]?.lifecycle, 'APPROVED_FOR_SIMULATION');
    assert.equal(models.rows[0]?.live_approved, false);
    assert.equal(artifacts.rowCount, 1);
    assert.equal(approvals.rowCount, 1);
    assert.equal(String(approvals.rows[0]?.actor_id).startsWith('mdl_'), false);
    await closePersistencePools(pools);
  });
});
