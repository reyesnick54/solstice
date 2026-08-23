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
import { PersonalDataVaultProduct } from '../../packages/personal-data-vault/src/product/service.ts';
import { PersonalDataVault } from '../../packages/personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Personal Data Vault persistence', () => {
  it('round-trips encrypted payloads and metadata after reload', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SUNREY_PERSISTENCE_TEST is not set');
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
          capabilities: ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN', 'VAULT_EXPORT_OWN', 'VAULT_DELETE_OWN'],
        }).ok,
        true,
      );
      const actor = identity.service.resolveActorContext('actor_pdv_pg');
      if (!actor.ok) {
        throw new Error('expected ok');
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
      if (!ingested.ok) {
        throw new Error('expected ok');
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

  it('round-trips product metadata without plaintext payloads', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SUNREY_PERSISTENCE_TEST is not set');
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
          actorId: 'actor_pdv_product_pg',
          jurisdiction: asJurisdiction('GB'),
          identityId: 'idn_pdv_product_pg',
          customerId: asCustomerId('cust_pdv_product_pg'),
          capabilities: ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN', 'VAULT_EXPORT_OWN', 'VAULT_DELETE_OWN'],
        }).ok,
        true,
      );
      const actor = identity.service.resolveActorContext('actor_pdv_product_pg');
      if (!actor.ok) {
        throw new Error('expected ok');
      }
      const core = new PersonalDataVault({ clock, keys, evidence, events });
      const product = new PersonalDataVaultProduct({ clock, events, vault: core });
      const seeded = product.seedPersona(actor.value, actor.value.subjectId, 'EMPLOYMENT_SKILLS');
      if (!seeded.ok) {
        throw new Error(seeded.error.message);
      }
      await persistPersonalDataVaultState(pools.customer, product.snapshot());
      const loaded = await loadPersonalDataVaultState(pools.customer);
      assert.ok((loaded.recordMetadata ?? []).length >= 1);
      assert.equal(JSON.stringify(loaded.recordMetadata).includes('Northwind'), false);
      const restored = new PersonalDataVaultProduct({
        clock,
        events,
        vault: new PersonalDataVault({ clock, keys, evidence, events }),
      });
      restored.restore({
        ...loaded,
        recordMetadata: loaded.recordMetadata ?? [],
        corrections: loaded.corrections ?? [],
        exportJobs: loaded.exportJobs ?? [],
        agentCategories: loaded.agentCategories ?? [],
      });
      const listed = restored.listRecords(actor.value, actor.value.subjectId, 'VAULT_SELF_VIEW');
      assert.equal(listed.ok, true);
      if (listed.ok) {
        assert.ok(listed.value.some((row) => row.dataCategory === 'employment'));
      }
    } finally {
      await closePersistencePools(pools);
    }
  });
});
