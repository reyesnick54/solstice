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
import { candidateUsOpenAccountReview } from '../../packages/regulatory-twin/src/candidates.ts';
import { classified } from '../../packages/regulatory-twin/src/facts.ts';
import { asRegulatoryScenarioId } from '../../packages/regulatory-twin/src/ids.ts';
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
    if (!snapshot.ok) throw new Error('snapshot');
    const baseline = twin.productionRegistry
      .listVersions('US')
      .find((row) => row.lifecycle === 'ACTIVE_SIMULATION');
    assert.ok(baseline);
    const candidate = candidateUsOpenAccountReview(baseline);
    const registered = twin.registerCandidateSet(actor.value, {
      label: 'pg-persist-v2',
      createdAt: NOW,
      versions: [candidate],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'persistence integration fixture',
    });
    assert.equal(registered.ok, true);
    if (!registered.ok) throw new Error('candidate');
    const scenario = {
      scenarioId: asRegulatoryScenarioId('rsc_pg_open_account'),
      name: 'pg-open-account',
      category: 'US_RETAIL_ACCOUNT' as const,
      createdAt: NOW,
      facts: {
        jurisdiction: classified('US', 'SYNTHETIC_FACT'),
        actorId: classified('rdt_pg_actor', 'SYNTHETIC_FACT'),
        customerId: classified('cus_rdt_pg', 'SYNTHETIC_FACT'),
        customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
        kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
        kycRecordVersion: classified(1, 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
        actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
      },
      hypotheticalOverrides: Object.freeze([]),
      invariant: false,
    };
    assert.equal(twin.createScenario(actor.value, scenario).ok, true);
    const compared = twin.compare(actor.value, {
      scenario,
      candidateVersions: [candidate],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: registered.value.candidateSetId,
    });
    assert.equal(compared.ok, true);
    await persistRegulatoryTwinState(pools.customer, twin.store.snapshot());
    const loaded = await loadRegulatoryTwinState(pools.customer);
    await closePersistencePools(pools);
    assert.ok(loaded.twins.length >= 1);
    assert.ok(loaded.snapshots.length >= 1);
    assert.equal(loaded.snapshots[0]?.simulationOnly, true);
    assert.ok(loaded.scenarios.length >= 1);
    assert.ok(loaded.runs.length >= 1);
    assert.ok(loaded.candidates.length >= 1);
    assert.equal(loaded.candidates[0]?.legalReviewStatus, 'RESEARCH_REQUIRED');
  });
});
