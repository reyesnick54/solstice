import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { EvidenceVault } from '../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import {
  loadPersonalDataVaultState,
  persistPersonalDataVaultState,
} from '../../packages/persistence/src/personal-data-vault/pg-personal-data-vault-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { SimulatedPayrollConnector } from '../../packages/personal-data-vault/src/connectors.ts';
import { PersonalDataVault } from '../../packages/personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Personal Data Vault persistence', () => {
  it('round-trips encrypted payloads and metadata after reload', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SOLSTICE_PERSISTENCE_TEST is not set');
      return;
    }
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    try {
      const clock = new FrozenClock(NOW);
      const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
      const events = new DomainEventLog();
      const evidence = new EvidenceVault(clock);
      const identity = new SimulatedIdentityAdapter({ clock, keys, events });
      assert.equal(
        identity.provisionSimulatedActor({
          actorId: 'actor_pdv_pg',
          jurisdiction: asJurisdiction('GB'),
          identityId: 'idn_pdv_pg',
          customerId: asCustomerId('cust_pdv_pg'),
          capabilities: ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN'],
        }).ok,
        true,
      );
      const actor = identity.service.resolveActorContext('actor_pdv_pg');
      assert.equal(actor.ok, true);
      if (!actor.ok) {
        return;
      }
      const vault = new PersonalDataVault({ clock, keys, evidence, events });
      assert.equal(vault.openVault(actor.value, actor.value.subjectId, 'cust_pdv_pg').ok, true);
      const payroll = new SimulatedPayrollConnector().fetch('pg_pay');
      const ingested = vault.ingest(actor.value, {
        subjectId: actor.value.subjectId,
        sourceId: payroll.sourceId,
        sourceRecordRef: payroll.sourceRecordRef,
        idempotencyKey: 'pg_pay',
        schemaId: 'pdsch_payroll',
        schemaVersion: '1',
        contentType: payroll.contentType,
        payload: payroll.body,
        provenanceKind: payroll.provenanceKind,
        purposeRef: 'persist.ingest',
      });
      assert.equal(ingested.ok, true);
      if (!ingested.ok) {
        return;
      }
      await persistPersonalDataVaultState(pools.customer, vault.snapshot());
      const loaded = await loadPersonalDataVaultState(pools.customer);
      assert.equal(JSON.stringify(loaded.assets).includes('320000'), false);
      assert.equal(loaded.payloads[0]?.envelope.ciphertext.includes('320000'), false);
      const restored = new PersonalDataVault({ clock, keys, evidence, events });
      restored.restore(loaded);
      const read = restored.readPayload(actor.value, actor.value.subjectId, ingested.value.assetId, 'persist.read');
      assert.equal(read.ok, true);
      if (read.ok) {
        assert.equal((read.value as { netMinor: string }).netMinor, '320000');
      }
    } finally {
      await closePersistencePools(pools);
    }
  });
});
