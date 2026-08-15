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
import { SimulatedPayrollConnector } from '../packages/personal-data-vault/src/connectors.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { ConsentDataUseAuthorization } from '../packages/consent/src/authorization.ts';
import { PurposeScopedVaultTool } from '../packages/consent/src/agent-tool.ts';
import { RECIPIENT_PERSONAL_AGENT, RECIPIENT_PRODUCT_RESEARCH } from '../packages/consent/src/recipients.ts';
import { ConsentService } from '../packages/consent/src/service.ts';
import { CONSENT_LEGAL_STATUS, canTransition } from '../packages/consent/src/taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T12:00:00.000Z');

describe('Chunk 24 exit criterion', () => {
  it('grants purpose-scoped derived access, denies mismatches, and blocks permits after revocation', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    const alice = identity.provisionSimulatedActor({
      actorId: 'actor_c24_a',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'idn_c24_a',
      customerId: asCustomerId('cust_c24_a'),
      capabilities: [
        'VAULT_VIEW_OWN',
        'VAULT_INGEST_OWN',
        'CONSENT_GRANT_OWN',
        'CONSENT_REVOKE_OWN',
        'CONSENT_VIEW_OWN',
      ],
    });
    assert.equal(alice.ok, true);
    if (!alice.ok) {
      return;
    }
    const consent = new ConsentService({ clock, keys, evidence, events });
    const vault = new PersonalDataVault({
      clock,
      keys,
      evidence,
      events,
      authorization: new ConsentDataUseAuthorization(consent),
    });
    assert.equal(vault.openVault(alice.value, alice.value.subjectId).ok, true);
    const payroll = new SimulatedPayrollConnector().fetch('c24');
    const asset = vault.ingest(alice.value, {
      subjectId: alice.value.subjectId,
      sourceId: payroll.sourceId,
      sourceRecordRef: payroll.sourceRecordRef,
      idempotencyKey: 'c24',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: payroll.contentType,
      payload: payroll.body,
      provenanceKind: payroll.provenanceKind,
      purposeRef: 'exit.ingest',
    });
    assert.equal(asset.ok, true);
    if (!asset.ok) {
      return;
    }
    const tool = new PurposeScopedVaultTool(consent, vault);
    const denied = tool.readDerivedMonthlyIncome(alice.value, {
      subjectId: alice.value.subjectId,
      assetId: asset.value.assetId,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'NO_ACTIVE_CONSENT');
    }
    const draft = consent.draftConsent(alice.value, {
      subjectId: alice.value.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: ['PAYROLL_DATA'],
      assetIds: [asset.value.assetId],
      operations: ['READ', 'DERIVE', 'AGGREGATE'],
      derivationTypes: ['DERIVED_ONLY'],
      effectiveFrom: NOW,
      expiresAt: EXPIRES,
      idempotencyKey: 'c24.grant',
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) {
      return;
    }
    const granted = consent.confirmConsent(alice.value, draft.value.consentId, 'c24.confirm');
    assert.equal(granted.ok, true);
    const derived = tool.readDerivedMonthlyIncome(alice.value, {
      subjectId: alice.value.subjectId,
      assetId: asset.value.assetId,
    });
    assert.equal(derived.ok, true);
    const mismatch = consent.issuePermit(alice.value, {
      subjectId: alice.value.subjectId,
      recipientId: RECIPIENT_PRODUCT_RESEARCH,
      purposeRef: 'PRODUCT_IMPROVEMENT_RESEARCH',
      resourceId: asset.value.assetId,
      category: 'PAYROLL_DATA',
      operation: 'READ',
      derivationType: 'RAW',
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.equal(mismatch.error.code, 'PURPOSE_MISMATCH');
    }
    if (granted.ok) {
      assert.equal(consent.revokeConsent(alice.value, granted.value.consentId, 'exit', 'c24.revoke').ok, true);
    }
    const after = consent.issuePermit(alice.value, {
      subjectId: alice.value.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: asset.value.assetId,
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(after.ok, false);
    if (!after.ok) {
      assert.equal(after.error.code, 'CONSENT_REVOKED');
    }
    assert.equal(canTransition('REVOKED', 'ACTIVE'), false);
    assert.equal(CONSENT_LEGAL_STATUS.counselConfirmed, false);
    assert.equal(consent.ledgerVerifies(), true);
    assert.equal(evidence.verifyChain().ok, true);
  });
});
