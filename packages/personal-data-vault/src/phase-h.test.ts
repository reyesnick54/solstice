import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { CANONICAL_PERSONAL_DATA_FABRIC, PHASE_H_DATA_ARCHITECTURE_AUDIT } from './product/fabric.ts';
import { HIGHLY_SENSITIVE_CLASSIFICATIONS } from './product/classification.ts';
import { PersonalDataVaultProduct } from './product/service.ts';
import { PersonalDataVault } from './service.ts';

const NOW = asUtcInstant('2026-08-23T09:00:00.000Z');
const ROOT = join(import.meta.dirname, '..', '..', '..');

const VAULT_CAPS = ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN', 'VAULT_EXPORT_OWN', 'VAULT_DELETE_OWN'] as const;

function world(label: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: `actor_${label}`,
      jurisdiction: asJurisdiction('GB'),
      identityId: `idn_${label}`,
      customerId: asCustomerId(`cust_${label}`),
      capabilities: [...VAULT_CAPS],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(`actor_${label}`);
  if (!actor.ok) {
    throw new Error('actor');
  }
  const core = new PersonalDataVault({ clock, keys, evidence, events });
  const vault = new PersonalDataVaultProduct({ clock, events, vault: core });
  return { clock, keys, events, evidence, identity, actor: actor.value, vault, subjectId: actor.value.subjectId };
}

describe('Phase H Personal Data Vault productization', () => {
  it('keeps one canonical fabric and refuses competing packages', () => {
    assert.equal(CANONICAL_PERSONAL_DATA_FABRIC.owner, 'packages/personal-data-vault');
    assert.equal(CANONICAL_PERSONAL_DATA_FABRIC.secondFabricForbidden, true);
    assert.equal(CANONICAL_PERSONAL_DATA_FABRIC.productionActive, false);
    assert.ok(PHASE_H_DATA_ARCHITECTURE_AUDIT.some((row) => row.classification === 'CANONICAL'));
    assert.equal(existsSync(join(ROOT, 'packages/personal-data-fabric')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-fabric')), false);
    assert.equal(existsSync(join(ROOT, 'packages/vault-v2')), false);
  });

  it('owns, classifies, versions, and hashes a user-declared record', () => {
    const env = world('owner');
    assert.equal(env.vault.open(env.actor, env.subjectId, 'cust_owner').ok, true);
    const created = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'pref:1',
      idempotencyKey: 'pref:1',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      categoryId: 'goals_preferences',
      contentType: 'application/json',
      payload: { key: 'theme', value: 'dark' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    assert.equal(created.value.ownership.controllerDoesNotOwnData, true);
    assert.equal(created.value.ownership.controllerRole, 'SUNREY_SERVICE');
    assert.equal(created.value.classification, 'USER_PROVIDED');
    assert.equal(created.value.dataKind, 'USER_DECLARATION');
    assert.equal(created.value.verificationState, 'USER_DECLARED');
    assert.ok(created.value.integrityHash);
    assert.equal(created.value.authoritativeForFinancialState, false);
    const history = env.vault.listHistory(env.actor, env.subjectId, created.value.dataRecordId, 'VAULT_SELF_VIEW');
    assert.equal(history.ok, true);
    if (history.ok) {
      assert.equal(history.value.length, 1);
    }
  });

  it('keeps provenance and parent ids on derived records and never marks AI as verified fact', () => {
    const env = world('derived');
    const source = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_sim_transactions',
      sourceRecordRef: 'tx:1',
      idempotencyKey: 'tx:1',
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      categoryId: 'financial',
      contentType: 'application/json',
      payload: { transactions: [{ id: 't1', bookedAt: NOW, merchant: 'Cafe', category: 'dining', amountMinor: '100', currency: 'USD' }] },
      provenanceKind: 'EXTERNAL_CONNECTOR',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!source.ok) {
      throw new Error(source.error.message);
    }
    const derived = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_derived_spending',
      sourceRecordRef: 'sum:1',
      idempotencyKey: 'sum:1',
      schemaId: 'pdsch_spending_summary',
      schemaVersion: '1',
      categoryId: 'consumption',
      contentType: 'application/json',
      payload: {
        windowFrom: '2026-06-01T00:00:00.000Z',
        windowTo: '2026-08-01T00:00:00.000Z',
        currency: 'USD',
        categories: [{ category: 'dining', totalMinor: '100' }],
      },
      provenanceKind: 'DERIVED',
      purposeRef: 'VAULT_SELF_MANAGE',
      parentRecordIds: [source.value.dataRecordId],
    });
    if (!derived.ok) {
      throw new Error(derived.error.message);
    }
    assert.equal(derived.value.dataKind, 'DERIVED_DATA');
    assert.equal(derived.value.verificationState, 'DERIVED');
    assert.ok(derived.value.parentRecordIds.includes(source.value.dataRecordId));
    assert.ok(derived.value.provenance.parentRecordIds.includes(source.value.dataRecordId));
    const inference = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'ai:1',
      idempotencyKey: 'ai:1',
      schemaId: 'pdsch_inference',
      schemaVersion: '1',
      categoryId: 'goals_preferences',
      contentType: 'application/json',
      payload: { statement: 'likely saver', modelRef: 'sim-model' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
      dataKind: 'AI_INFERENCE',
    });
    if (!inference.ok) {
      throw new Error(inference.error.message);
    }
    assert.equal(inference.value.dataKind, 'AI_INFERENCE');
    assert.equal(inference.value.verificationState, 'AI_INFERRED');
    assert.notEqual(inference.value.verificationState, 'VERIFIED');
    assert.equal(inference.value.confidence, 'AI_INFERRED');
  });

  it('rejects highly sensitive ingest-by-default and forbidden credential fields', () => {
    const env = world('deny');
    const health = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'health:1',
      idempotencyKey: 'health:1',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      categoryId: 'health_wellness',
      contentType: 'application/json',
      payload: { key: 'note', value: 'n/a' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    assert.equal(health.ok, false);
    if (!health.ok) {
      assert.equal(health.error.code, 'CATEGORY_NOT_INGESTIBLE');
    }
    const secret = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'secret:1',
      idempotencyKey: 'secret:1',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      categoryId: 'goals_preferences',
      contentType: 'application/json',
      payload: { key: 'x', value: 'y', privateKey: 'hex' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    assert.equal(secret.ok, false);
    if (!secret.ok) {
      assert.equal(secret.error.code, 'FORBIDDEN_PAYLOAD_FIELD');
    }
    assert.ok(HIGHLY_SENSITIVE_CLASSIFICATIONS.includes('BIOMETRIC_SENSITIVE'));
  });

  it('corrects user-declared data, disputes derived data, and exports without other users', () => {
    const env = world('correct');
    const declared = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'job:1',
      idempotencyKey: 'job:1',
      schemaId: 'pdsch_employment',
      schemaVersion: '1',
      categoryId: 'employment',
      contentType: 'application/json',
      payload: { employer: 'Old Co', title: 'Intern', startedOn: '2020-01-01' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!declared.ok) {
      throw new Error(declared.error.message);
    }
    const corrected = env.vault.correctOrDispute(env.actor, {
      subjectId: env.subjectId,
      recordId: declared.value.dataRecordId,
      purpose: 'VAULT_CORRECTION',
      reason: 'title change',
      proposedPayload: { employer: 'Old Co', title: 'Analyst', startedOn: '2020-01-01' },
    });
    if (!corrected.ok) {
      throw new Error(corrected.error.message);
    }
    assert.equal(corrected.value.correction.status, 'APPLIED');
    const derived = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_derived_spending',
      sourceRecordRef: 'sum:d',
      idempotencyKey: 'sum:d',
      schemaId: 'pdsch_spending_summary',
      schemaVersion: '1',
      categoryId: 'consumption',
      contentType: 'application/json',
      payload: {
        windowFrom: '2026-06-01T00:00:00.000Z',
        windowTo: '2026-08-01T00:00:00.000Z',
        currency: 'USD',
        categories: [{ category: 'dining', totalMinor: '9' }],
      },
      provenanceKind: 'DERIVED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!derived.ok) {
      throw new Error(derived.error.message);
    }
    const disputed = env.vault.correctOrDispute(env.actor, {
      subjectId: env.subjectId,
      recordId: derived.value.dataRecordId,
      purpose: 'VAULT_CORRECTION',
      reason: 'total looks wrong',
    });
    if (!disputed.ok) {
      throw new Error(disputed.error.message);
    }
    assert.equal(disputed.value.correction.status, 'REVIEW_PENDING');
    assert.equal(disputed.value.record.disputed, true);
    const exported = env.vault.requestExport(env.actor, env.subjectId, 'VAULT_EXPORT');
    assert.equal(exported.ok, true);
    if (exported.ok) {
      assert.equal(exported.value.legalPortabilityClaim, false);
      const bundle = env.vault.getExport(env.actor, env.subjectId, exported.value.exportId, 'VAULT_EXPORT');
      assert.equal(bundle.ok, true);
    }
  });

  it('isolates subjects, constrains Agent access, and keeps PEG as a reference only', () => {
    const a = world('alice_h');
    const b = world('bob_h');
    const created = a.vault.ingestRecord(a.actor, {
      subjectId: a.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'a:1',
      idempotencyKey: 'a:1',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      categoryId: 'goals_preferences',
      contentType: 'application/json',
      payload: { key: 'k', value: 'v' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    const cross = b.vault.listRecords(b.actor, a.subjectId, 'VAULT_SELF_VIEW');
    assert.equal(cross.ok, false);
    a.vault.setAgentCategories(a.subjectId, ['goals_preferences']);
    const wildcard = a.vault.agentRecords(a.actor, { subjectId: a.subjectId, purpose: 'AGENT_ANALYSIS' });
    assert.equal(wildcard.ok, false);
    if (!wildcard.ok) {
      assert.equal(wildcard.error.code, 'GET_ALL_FORBIDDEN');
    }
    const allowed = a.vault.agentRecords(a.actor, {
      subjectId: a.subjectId,
      purpose: 'AGENT_ANALYSIS',
      categoryIds: ['goals_preferences'],
    });
    assert.equal(allowed.ok, true);
    a.vault.setAgentCategories(a.subjectId, []);
    const denied = a.vault.agentRecords(a.actor, {
      subjectId: a.subjectId,
      purpose: 'AGENT_ANALYSIS',
      categoryIds: ['goals_preferences'],
    });
    assert.equal(denied.ok, false);
    const graph = new EconomicGraphService({ clock: a.clock, events: a.events });
    assert.equal(graph.openGraph(a.actor, a.subjectId).ok, true);
    const ref = a.vault.toPegReference(created.value.dataRecordId);
    assert.ok(ref);
    const node = graph.declareDataAsset(a.actor, a.subjectId, ref!);
    assert.equal(node.ok, true);
    assert.equal(CANONICAL_PERSONAL_DATA_FABRIC.isNotPeg, true);
  });

  it('tombstones deleted records, restores after snapshot, and keeps production disabled', () => {
    const env = world('retain');
    const created = env.vault.ingestRecord(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'del:1',
      idempotencyKey: 'del:1',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      categoryId: 'goals_preferences',
      contentType: 'application/json',
      payload: { key: 'gone', value: 'yes' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'VAULT_SELF_MANAGE',
    });
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    assert.equal(env.vault.deleteRecord(env.actor, env.subjectId, created.value.dataRecordId, 'VAULT_SELF_MANAGE').ok, true);
    const listed = env.vault.listRecords(env.actor, env.subjectId, 'VAULT_SELF_VIEW');
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.some((row) => row.dataRecordId === created.value.dataRecordId), false);
    }
    const snap = env.vault.snapshot();
    const restored = world('restore');
    restored.vault.restore(snap);
    const home = restored.vault.home(env.actor, env.subjectId, 'VAULT_SELF_VIEW');
    assert.equal(home.ok, true);
    if (home.ok) {
      assert.equal(home.value.productionActive, false);
      assert.equal(home.value.liveMonetizationEnabled, false);
      assert.equal(home.value.sunreyOwnsUserData, false);
    }
    const types = env.events.list().map((row) => row.eventType);
    assert.ok(types.includes('VaultRecordCreated'));
    assert.ok(types.includes('VaultRecordDeleted'));
    assert.equal(types.some((type) => JSON.stringify(env.events.list()).includes('privateKey')), false);
  });

  it('seeds sandbox personas without real personal data', () => {
    const env = world('persona');
    const seeded = env.vault.seedPersona(env.actor, env.subjectId, 'FINANCIAL');
    assert.equal(seeded.ok, true);
    if (seeded.ok) {
      assert.equal(seeded.value[0]?.dataCategory, 'financial');
      assert.equal(JSON.stringify(seeded.value).includes('@'), false);
    }
  });
});
