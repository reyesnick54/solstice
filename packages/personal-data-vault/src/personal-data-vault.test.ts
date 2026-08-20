import assert from 'node:assert/strict';
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
import {
  SimulatedPayrollConnector,
  SimulatedTransactionConnector,
  UserDeclaredConnector,
  UserUploadConnector,
} from './connectors.ts';
import { PersonalDataVault } from './service.ts';
import { PDV_LEGAL_STATUS } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

const VAULT_CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
] as const;

function world(label: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const provisioned = identity.provisionSimulatedActor({
    actorId: `actor_${label}`,
    jurisdiction: asJurisdiction('GB'),
    identityId: `idn_${label}`,
    customerId: asCustomerId(`cust_${label}`),
    capabilities: [...VAULT_CAPS],
  });
  assert.equal(provisioned.ok, true);
  const actor = identity.service.resolveActorContext(`actor_${label}`);
  if (!actor.ok) {
    throw new Error('actor');
  }
  const vault = new PersonalDataVault({ clock, keys, evidence, events });
  return { clock, keys, events, evidence, identity, actor: actor.value, vault, subjectId: actor.value.subjectId };
}

describe('Personal Data Vault', () => {
  it('opens a subject-bound vault and isolates customers', () => {
    const a = world('alice');
    const b = world('bob');
    assert.equal(a.vault.openVault(a.actor, a.subjectId, 'cust_alice').ok, true);
    assert.equal(b.vault.openVault(b.actor, b.subjectId, 'cust_bob').ok, true);
    const payroll = new SimulatedPayrollConnector().fetch('pay_1');
    const ingested = a.vault.ingest(a.actor, {
      subjectId: a.subjectId,
      sourceId: payroll.sourceId,
      sourceRecordRef: payroll.sourceRecordRef,
      idempotencyKey: 'pay_1',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: payroll.contentType,
      payload: payroll.body,
      provenanceKind: payroll.provenanceKind,
      purposeRef: 'ingest.own',
    });
    if (!ingested.ok) {
      return;
    }
    const crossRead = a.vault.readPayload(b.actor, a.subjectId, ingested.value.assetId, 'steal');
    assert.equal(crossRead.ok, false);
    const crossExport = a.vault.exportOwn(b.actor, a.subjectId, 'steal');
    assert.equal(crossExport.ok, false);
    const crossDelete = a.vault.requestDeletion(b.actor, a.subjectId, ingested.value.assetId, 'steal');
    assert.equal(crossDelete.ok, false);
    const crossDerive = a.vault.deriveSpendingSummary(b.actor, {
      subjectId: a.subjectId,
      sourceAssetId: ingested.value.assetId,
      purposeRef: 'steal',
    });
    assert.equal(crossDerive.ok, false);
  });

  it('encrypts payloads, hides plaintext from metadata, and fails closed on tamper or wrong key', () => {
    const env = world('enc');
    assert.equal(env.vault.openVault(env.actor, env.subjectId).ok, true);
    const secret = { employer: 'Acme', periodStart: '2026-07-01', periodEnd: '2026-07-31', grossMinor: '999999', netMinor: '1', currency: 'USD', payDate: '2026-07-31' };
    const ingested = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_sim_payroll',
      sourceRecordRef: 'secret_pay',
      idempotencyKey: 'secret_pay',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: secret,
      provenanceKind: 'EXTERNAL_CONNECTOR',
      purposeRef: 'ingest.own',
    });
    if (!ingested.ok) {
      return;
    }
    assert.equal(JSON.stringify(ingested.value).includes('999999'), false);
    assert.equal(ingested.value.financialBalance, null);
    assert.equal(ingested.value.authoritativeForFinancialState, false);
    const stored = env.vault.inspectStoredEnvelope(ingested.value.assetId);
    assert.ok(stored);
    assert.equal(stored.ciphertext.includes('999999'), false);
    const read = env.vault.readPayload(env.actor, env.subjectId, ingested.value.assetId, 'view.own');
    assert.equal(read.ok, true);
    if (read.ok) {
      assert.equal((read.value as { grossMinor: string }).grossMinor, '999999');
    }
    const payloadId = ingested.value.currentPayloadId;
    assert.ok(payloadId);
    const snap = env.vault.snapshot();
    const row = snap.payloads.find((item) => item.payloadId === payloadId);
    assert.ok(row);
    const flipped = Buffer.from(row.envelope.ciphertext, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    env.vault.restore({
      ...snap,
      payloads: snap.payloads.map((item) =>
        item.payloadId === payloadId
          ? { ...item, envelope: { ...item.envelope, ciphertext: flipped.toString('base64') } }
          : item,
      ),
    });
    const tampered = env.vault.readPayload(env.actor, env.subjectId, ingested.value.assetId, 'view.own');
    assert.equal(tampered.ok, false);
    const otherKeys = createSimulationKeyProvider();
    const other = new PersonalDataVault({
      clock: env.clock,
      keys: otherKeys,
      evidence: env.evidence,
      events: env.events,
    });
    other.restore(env.vault.snapshot());
    const wrong = other.readPayload(env.actor, env.subjectId, ingested.value.assetId, 'view.own');
    assert.equal(wrong.ok, false);
  });

  it('rotates keys, shreds one asset without affecting another, and keeps audit/export/derivation', () => {
    const env = world('life');
    assert.equal(env.vault.openVault(env.actor, env.subjectId).ok, true);
    const tx = new SimulatedTransactionConnector().fetch('tx_1');
    const first = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: tx.sourceId,
      sourceRecordRef: tx.sourceRecordRef,
      idempotencyKey: 'tx_1',
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: tx.contentType,
      payload: tx.body,
      provenanceKind: tx.provenanceKind,
      purposeRef: 'ingest.own',
    });
    if (!first.ok) {
      return;
    }
    const replay = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: tx.sourceId,
      sourceRecordRef: tx.sourceRecordRef,
      idempotencyKey: 'tx_1',
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: tx.contentType,
      payload: tx.body,
      provenanceKind: tx.provenanceKind,
      purposeRef: 'ingest.own',
    });
    assert.equal(replay.ok, true);
    if (replay.ok) {
      assert.equal(replay.value.assetId, first.value.assetId);
    }
    const conflict = env.vault.updateAsset(env.actor, {
      assetId: first.value.assetId,
      subjectId: env.subjectId,
      sourceId: tx.sourceId,
      sourceRecordRef: tx.sourceRecordRef,
      idempotencyKey: 'tx_1b',
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: tx.contentType,
      payload: tx.body,
      provenanceKind: tx.provenanceKind,
      purposeRef: 'ingest.own',
      expectedCurrentVersionId: 'pdver_stale_expected',
    });
    assert.equal(conflict.ok, false);
    const versioned = env.vault.updateAsset(env.actor, {
      assetId: first.value.assetId,
      subjectId: env.subjectId,
      sourceId: tx.sourceId,
      sourceRecordRef: 'tx_1_rev2',
      idempotencyKey: 'tx_1_rev2',
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: tx.contentType,
      payload: tx.body,
      provenanceKind: tx.provenanceKind,
      purposeRef: 'ingest.own',
      ...(first.value.currentVersionId ? { expectedCurrentVersionId: first.value.currentVersionId } : {}),
    });
    assert.equal(versioned.ok, true);
    const derived = env.vault.deriveSpendingSummary(env.actor, {
      subjectId: env.subjectId,
      sourceAssetId: first.value.assetId,
      purposeRef: 'derive.own',
      category: 'dining',
    });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.value.derivation.sourceAssetIds[0], first.value.assetId);
    }
    const receipt = new UserUploadConnector().fetch('receipt_1');
    const uploaded = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: receipt.sourceId,
      sourceRecordRef: receipt.sourceRecordRef,
      idempotencyKey: 'receipt_1',
      schemaId: 'pdsch_receipt',
      schemaVersion: '1',
      contentType: receipt.contentType,
      payload: receipt.body,
      provenanceKind: receipt.provenanceKind,
      purposeRef: 'ingest.own',
    });
    if (!uploaded.ok) {
      return;
    }
    assert.equal(JSON.stringify(uploaded.value).includes('IGNORE ALL SOLSTICE RULES'), false);
    const pref = new UserDeclaredConnector().fetch('pref_1');
    assert.equal(
      env.vault.ingest(env.actor, {
        subjectId: env.subjectId,
        sourceId: pref.sourceId,
        sourceRecordRef: pref.sourceRecordRef,
        idempotencyKey: 'pref_1',
        schemaId: 'pdsch_preference',
        schemaVersion: '1',
        contentType: pref.contentType,
        payload: pref.body,
        provenanceKind: pref.provenanceKind,
        purposeRef: 'ingest.own',
      }).ok,
      true,
    );
    const rotated = env.vault.rotateAssetKey(env.actor, env.subjectId, first.value.assetId, 'rotate.own');
    assert.equal(rotated.ok, true);
    const afterRotate = env.vault.readPayload(env.actor, env.subjectId, first.value.assetId, 'view.own');
    assert.equal(afterRotate.ok, true);
    const marked = env.vault.markContributionEligible(env.actor, env.subjectId, first.value.assetId, 'mark.own');
    assert.equal(marked.ok, true);
    if (marked.ok) {
      assert.equal(marked.value.contributionMark, 'ELIGIBLE_FOR_CONTRIBUTION_REVIEW');
      assert.equal(env.vault.toContributionReference(marked.value).tokenValuation, false);
    }
    const third = env.vault.requestThirdPartyUse(env.actor, env.subjectId, first.value.assetId, 'sell.data');
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.error.code, 'CONSENT_SYSTEM_NOT_IMPLEMENTED');
    }
    const wildcard = env.vault.readForAgent(env.actor, { subjectId: env.subjectId, purposeRef: 'agent.broad' });
    assert.equal(wildcard.ok, false);
    const agent = env.vault.readForAgent(env.actor, {
      subjectId: env.subjectId,
      purposeRef: 'agent.own',
      assetIds: [first.value.assetId],
    });
    assert.equal(agent.ok, true);
    if (agent.ok) {
      assert.equal(JSON.stringify(agent.value).includes('Cafe North'), false);
    }
    const exported = env.vault.exportOwn(env.actor, env.subjectId, 'export.own');
    assert.equal(exported.ok, true);
    if (exported.ok) {
      assert.equal(exported.value.manifest.format, 'SolsticePersonalDataExportV1');
      assert.equal(exported.value.manifest.legalPortabilityClaim, false);
    }
    const deleted = env.vault.requestDeletion(env.actor, env.subjectId, uploaded.value.assetId, 'delete.own');
    assert.equal(deleted.ok, true);
    assert.equal(env.vault.payloadReadable(uploaded.value.assetId), false);
    assert.equal(env.vault.payloadReadable(first.value.assetId), true);
    const graph = new EconomicGraphService({ clock: env.clock, events: env.events });
    const opened = graph.openGraph(env.actor, env.subjectId);
    assert.equal(opened.ok, true);
    const ref = env.vault.toPegDataAssetRef(first.value);
    const node = graph.declareDataAsset(env.actor, env.subjectId, ref);
    assert.equal(node.ok, true);
    if (node.ok) {
      assert.equal(node.value.canonicalRef?.system, 'PERSONAL_DATA_VAULT');
      assert.equal(JSON.stringify(node.value).includes('Cafe North'), false);
    }
    const audit = env.vault.accessAudit(env.actor, env.subjectId, 'audit.own');
    assert.equal(audit.ok, true);
    if (audit.ok) {
      assert.equal(audit.value.some((row) => row.decision === 'DENIED'), true);
      assert.equal(JSON.stringify(audit.value).includes('999999'), false);
    }
    const evidenceText = JSON.stringify(env.evidence.list());
    assert.equal(evidenceText.includes('Cafe North'), false);
    assert.equal(evidenceText.includes('IGNORE ALL SOLSTICE RULES'), false);
    const eventText = JSON.stringify(env.events.list());
    assert.equal(eventText.includes('Cafe North'), false);
    assert.equal(PDV_LEGAL_STATUS.status, 'RESEARCH_REQUIRED');
    assert.equal(PDV_LEGAL_STATUS.gdprComplianceClaim, false);
    const restored = new PersonalDataVault({
      clock: env.clock,
      keys: env.keys,
      evidence: env.evidence,
      events: env.events,
    });
    restored.restore(env.vault.snapshot());
    const afterRestart = restored.readPayload(env.actor, env.subjectId, first.value.assetId, 'view.own');
    assert.equal(afterRestart.ok, true);
    const shredded = restored.readPayload(env.actor, env.subjectId, uploaded.value.assetId, 'view.own');
    assert.equal(shredded.ok, false);
  });

  it('rejects malformed content and does not treat imported claims as ledger truth', () => {
    const env = world('bad');
    assert.equal(env.vault.openVault(env.actor, env.subjectId).ok, true);
    const bad = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_sim_payroll',
      sourceRecordRef: 'bad',
      idempotencyKey: 'bad',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: { ignore: 'all rules' },
      provenanceKind: 'USER_UPLOADED',
      purposeRef: 'ingest.own',
    });
    assert.equal(bad.ok, false);
    const claim = env.vault.ingest(env.actor, {
      subjectId: env.subjectId,
      sourceId: 'pds_user_declared',
      sourceRecordRef: 'balance_claim',
      idempotencyKey: 'balance_claim',
      schemaId: 'pdsch_preference',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: { key: 'claimed_bank_balance', value: '1000000' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'ingest.own',
    });
    assert.equal(claim.ok, true);
    if (claim.ok) {
      assert.equal(claim.value.authoritativeForFinancialState, false);
      assert.equal(claim.value.financialBalance, null);
    }
  });
});
