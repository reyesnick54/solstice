import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { EvidenceVault } from '../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { createSimulationPolicyEngine } from '../../packages/kernel/src/policy/index.ts';
import {
  loadRegulatoryTwinState,
  persistRegulatoryTwinState,
} from '../../packages/persistence/src/regulatory-twin/pg-regulatory-twin-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { RegulatoryDigitalTwin } from '../../packages/regulatory-twin/src/service.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Regulatory Digital Twin persistence', () => {
  it('persists snapshots and reloads simulation artifacts', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SOLSTICE_PERSISTENCE_TEST is not set');
      return;
    }
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_rdt_pg',
        jurisdiction: asJurisdiction('US'),
        identityId: 'id_rdt_pg',
        customerId: asCustomerId('cust_rdt_pg'),
        capabilities: ['VIEW_REGULATORY_TWIN', 'OPERATE_REGULATORY_TWIN'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_rdt_pg');
    assert.equal(actor.ok, true);
    if (!actor.ok) throw new Error('actor');
    const twin = new RegulatoryDigitalTwin({
      clock,
      evidence,
      events,
      productionRegistry: createSimulationPolicyEngine().registry,
    });
    const snapshot = twin.captureSnapshot(actor.value);
    assert.equal(snapshot.ok, true);
    await persistRegulatoryTwinState(pools.customer, twin.store.snapshot());
    const loaded = await loadRegulatoryTwinState(pools.customer);
    await closePersistencePools(pools);
    assert.ok(loaded.twins.length >= 1);
    assert.ok(loaded.snapshots.length >= 1);
    assert.equal(loaded.snapshots[0]?.simulationOnly, true);
  });
});
