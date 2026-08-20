import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { PersonalDataVault } from '../packages/personal-data-vault/src/service.ts';
import { PDV_LEGAL_STATUS } from '../packages/personal-data-vault/src/taxonomy.ts';
import { SimulatedPayrollConnector } from '../packages/personal-data-vault/src/connectors.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

describe('Chunk 23 exit criterion', () => {
  it('has a subject-bound encrypted vault that fails closed across subjects and without consent', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    const alice = identity.provisionSimulatedActor({
      actorId: 'actor_c23_a',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'idn_c23_a',
      customerId: asCustomerId('cust_c23_a'),
      capabilities: ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN', 'VAULT_EXPORT_OWN', 'VAULT_DELETE_OWN'],
    });
    const bob = identity.provisionSimulatedActor({
      actorId: 'actor_c23_b',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'idn_c23_b',
      customerId: asCustomerId('cust_c23_b'),
      capabilities: ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN'],
    });
    assert.equal(alice.ok && bob.ok, true);
    if (!alice.ok || !bob.ok) {
      return;
    }
    const vault = new PersonalDataVault({ clock, keys, evidence, events });
    assert.equal(vault.openVault(alice.value, alice.value.subjectId).ok, true);
    const payroll = new SimulatedPayrollConnector().fetch('c23');
    const asset = vault.ingest(alice.value, {
      subjectId: alice.value.subjectId,
      sourceId: payroll.sourceId,
      sourceRecordRef: payroll.sourceRecordRef,
      idempotencyKey: 'c23',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: payroll.contentType,
      payload: payroll.body,
      provenanceKind: payroll.provenanceKind,
      purposeRef: 'exit.ingest',
    });
    if (!asset.ok) {
      return;
    }
    assert.equal(asset.value.authoritativeForFinancialState, false);
    assert.equal(vault.readPayload(bob.value, alice.value.subjectId, asset.value.assetId, 'exit.cross').ok, false);
    assert.equal(vault.requestThirdPartyUse(alice.value, alice.value.subjectId, asset.value.assetId, 'exit.third').ok, false);
    assert.equal(PDV_LEGAL_STATUS.status, 'RESEARCH_REQUIRED');
    assert.equal(PDV_LEGAL_STATUS.counselConfirmed, false);
  });
});
