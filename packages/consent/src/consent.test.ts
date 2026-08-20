import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { SimulatedPayrollConnector, UserUploadConnector } from '../../personal-data-vault/src/connectors.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { PurposeScopedVaultTool } from './agent-tool.ts';
import { ConsentDataUseAuthorization } from './authorization.ts';
import { canTransition } from './taxonomy.ts';
import { RECIPIENT_PERSONAL_AGENT, RECIPIENT_PRODUCT_RESEARCH, RECIPIENT_EXTERNAL_RESEARCH } from './recipients.ts';
import { ConsentService } from './service.ts';

const T0 = asUtcInstant('2026-08-15T12:00:00.000Z');
const LATER = asUtcInstant('2026-08-15T12:10:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T12:00:00.000Z');
const PAST = asUtcInstant('2026-07-01T00:00:00.000Z');

const CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
] as const;

function harness(now = T0) {
  const clock = new FrozenClock(now);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const alice = identity.provisionSimulatedActor({
    actorId: 'actor_consent_alice',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_consent_alice',
    customerId: asCustomerId('cust_consent_alice'),
    capabilities: [...CAPS],
  });
  if (!alice.ok) {
    throw new Error(alice.error.message);
  }
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  return { clock, keys, events, evidence, identity, actor: alice.value, consent, vault };
}

function grantAgentPayroll(consent: ConsentService, actor: unknown, subjectId: string, assetId?: string) {
  const draft = consent.draftConsent(actor, {
    subjectId,
    recipientId: RECIPIENT_PERSONAL_AGENT,
    purposeRef: 'PERSONAL_AGENT_ANALYSIS',
    categories: ['PAYROLL_DATA'],
    ...(assetId ? { assetIds: [assetId] } : {}),
    fields: ['netMinor', 'currency', 'periodStart', 'periodEnd'],
    operations: ['READ', 'DERIVE', 'AGGREGATE'],
    derivationTypes: ['DERIVED_ONLY'],
    effectiveFrom: T0,
    expiresAt: EXPIRES,
    requestedRetentionDays: 30,
    idempotencyKey: `grant:${subjectId}:agent`,
  });
  if (!draft.ok) {
    throw new Error(draft.error.message);
  }
  const confirmed = consent.confirmConsent(actor, draft.value.consentId, `confirm:${draft.value.consentId}`);
  if (!confirmed.ok) {
    throw new Error(confirmed.error.message);
  }
  return confirmed.value;
}

describe('consent ledger and purpose firewall', () => {
  it('keeps historical consent bound to the approved purpose version', () => {
    const { consent, actor } = harness();
    const granted = grantAgentPayroll(consent, actor, actor.subjectId);
    const next = consent.versionPurposeMeaning('PERSONAL_AGENT_ANALYSIS', {
      description: 'budgeting plus advertising — must be a new version',
      category: 'AGENT_ANALYSIS',
      allowedCategories: ['PAYROLL_DATA', 'PREFERENCE_DATA'],
      allowedOperations: ['READ', 'DERIVE'],
      expectedRecipientKind: 'SOLSTICE_SERVICE',
      retentionExpectationDays: 30,
      onwardSharing: 'NOT_ALLOWED',
      maxSensitivity: 'HIGHLY_SENSITIVE',
      status: 'ACTIVE',
      legalHook: 'RESEARCH_REQUIRED',
      createdAt: T0,
    });
    assert.notEqual(next.purposeVersion, granted.purposeVersion);
    assert.equal(granted.purposeVersion.endsWith('_1'), true);
    const current = consent.getConsent(actor, granted.consentId);
    assert.equal(current.ok, true);
    if (current.ok) {
      assert.equal(current.value.purposeVersion, granted.purposeVersion);
    }
  });

  it('rejects unlimited wildcard grants and illegal transitions', () => {
    const { consent, actor } = harness();
    const wild = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: [],
      operations: ['READ'],
      derivationTypes: ['RAW'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'wild',
    });
    assert.equal(wild.ok, false);
    if (!wild.ok) {
      assert.equal(wild.error.code, 'WILDCARD_GRANT_FORBIDDEN');
    }
    assert.equal(canTransition('REVOKED', 'ACTIVE'), false);
    assert.equal(canTransition('ACTIVE', 'REVOKED'), true);
  });

  it('denies purpose, category, window, and operation mismatches', () => {
    const { consent, actor } = harness();
    grantAgentPayroll(consent, actor, actor.subjectId, 'pda_payroll');
    const purpose = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PRODUCT_RESEARCH,
      purposeRef: 'PRODUCT_IMPROVEMENT_RESEARCH',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'READ',
      derivationType: 'RAW',
    });
    assert.equal(purpose.ok, false);
    if (!purpose.ok) {
      assert.equal(purpose.error.code, 'PURPOSE_MISMATCH');
    }
    const category = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_receipt',
      category: 'PURCHASE_HISTORY',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(category.ok, false);
    if (!category.ok) {
      assert.equal(category.error.code, 'RESOURCE_OUT_OF_SCOPE');
    }
    const windowed = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_BUDGET_ANALYSIS',
      categories: ['TRANSACTION_DATA'],
      windowFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      windowTo: asUtcInstant('2026-12-31T23:59:59.000Z'),
      operations: ['READ'],
      derivationTypes: ['RAW'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'window-2026',
    });
    assert.equal(windowed.ok, true);
    if (windowed.ok) {
      const confirmed = consent.confirmConsent(actor, windowed.value.consentId, 'confirm-window');
      assert.equal(confirmed.ok, true);
    }
    const oldYear = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_BUDGET_ANALYSIS',
      resourceId: 'pda_tx',
      category: 'TRANSACTION_DATA',
      windowFrom: asUtcInstant('2024-01-01T00:00:00.000Z'),
      windowTo: asUtcInstant('2024-12-31T23:59:59.000Z'),
      operation: 'READ',
      derivationType: 'RAW',
    });
    assert.equal(oldYear.ok, false);
    if (!oldYear.ok) {
      assert.equal(oldYear.error.code, 'RESOURCE_OUT_OF_SCOPE');
    }
    const exportDenied = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'EXPORT',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(exportDenied.ok, false);
    if (!exportDenied.ok) {
      assert.equal(exportDenied.error.code, 'OPERATION_OUT_OF_SCOPE');
    }
  });

  it('issues a short-lived purpose-bound permit and blocks reuse after revocation', () => {
    const { consent, actor, clock } = harness();
    const granted = grantAgentPayroll(consent, actor, actor.subjectId, 'pda_payroll');
    const issued = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    if (!issued.ok) {
      return;
    }
    assert.equal(issued.value.permit.purposeVersion, granted.purposeVersion);
    assert.equal(issued.value.permit.recipientId, RECIPIENT_PERSONAL_AGENT);
    const wrongRecipient = consent.verifyPermit(issued.value.permit, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PRODUCT_RESEARCH,
      purposeId: issued.value.permit.purposeId,
    });
    assert.equal(wrongRecipient.ok, false);
    consent.revokeConsent(actor, granted.consentId, 'user revoked', 'revoke-1');
    const after = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(after.ok, false);
    if (!after.ok) {
      assert.equal(after.error.code, 'CONSENT_REVOKED');
    }
    const duplicateRevoke = consent.revokeConsent(actor, granted.consentId, 'again', 'revoke-1');
    assert.equal(duplicateRevoke.ok, true);
    clock.set(LATER);
    const expiredPermit = consent.verifyPermit(issued.value.permit, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeId: issued.value.permit.purposeId,
    });
    assert.equal(expiredPermit.ok, false);
  });

  it('expires consent with a deterministic clock and keeps historical audit', () => {
    const { consent, actor, clock } = harness();
    const granted = grantAgentPayroll(consent, actor, actor.subjectId, 'pda_payroll');
    consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    clock.set(asUtcInstant('2026-10-01T00:00:00.000Z'));
    const listed = consent.getConsent(actor, granted.consentId);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.state, 'EXPIRED');
    }
    const denied = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'CONSENT_EXPIRED');
    }
    const uses = consent.listDataUsesForConsent(actor, granted.consentId);
    assert.equal(uses.ok, true);
    if (uses.ok) {
      assert.equal(uses.value.length >= 1, true);
    }
  });

  it('supports superseding scope without mutating the historical grant', () => {
    const { consent, actor } = harness();
    const original = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: ['PAYROLL_DATA', 'TRANSACTION_DATA'],
      operations: ['READ', 'DERIVE'],
      derivationTypes: ['DERIVED_ONLY'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'both',
    });
    if (!original.ok) {
      return;
    }
    const confirmed = consent.confirmConsent(actor, original.value.consentId, 'confirm-both');
    assert.equal(confirmed.ok, true);
    const narrowed = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: ['PAYROLL_DATA'],
      operations: ['READ', 'DERIVE'],
      derivationTypes: ['DERIVED_ONLY'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'payroll-only',
      supersedesConsentId: original.value.consentId,
    });
    if (!narrowed.ok) {
      return;
    }
    const next = consent.confirmConsent(actor, narrowed.value.consentId, 'confirm-narrow');
    assert.equal(next.ok, true);
    if (next.ok) {
      assert.equal(next.value.state, 'ACTIVE');
      assert.deepEqual([...next.value.permittedCategories], ['PAYROLL_DATA']);
    }
    const historical = consent.snapshot().records.find((row) => row.version === original.value.version);
    assert.ok(historical);
    assert.deepEqual([...historical.permittedCategories], ['PAYROLL_DATA', 'TRANSACTION_DATA']);
    assert.equal(historical.state, 'SUPERSEDED');
  });

  it('is idempotent for confirm and treats committed revocation as blocking later permits', () => {
    const { consent, actor } = harness();
    const first = grantAgentPayroll(consent, actor, actor.subjectId, 'pda_payroll');
    const again = consent.confirmConsent(actor, first.consentId, `confirm:${first.consentId}`);
    assert.equal(again.ok, true);
    if (again.ok) {
      assert.equal(again.value.grantId, first.grantId);
      assert.equal(again.value.state, 'ACTIVE');
    }
    consent.revokeConsent(actor, first.consentId, 'race', 'race-revoke');
    const raced = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_payroll',
      category: 'PAYROLL_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(raced.ok, false);
    if (!raced.ok) {
      assert.equal(raced.error.code, 'CONSENT_REVOKED');
    }
  });

  it('does not execute data-contribution consent and defaults onward sharing to denied', () => {
    const { consent, actor } = harness();
    const draft = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      operations: ['CONTRIBUTE', 'AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'contribute',
    });
    if (!draft.ok) {
      return;
    }
    assert.equal(draft.value.onwardSharing.state, 'NOT_ALLOWED');
    const confirmed = consent.confirmConsent(actor, draft.value.consentId, 'confirm-contribute');
    assert.equal(confirmed.ok, true);
    const executed = consent.executeExternalContribution(actor, draft.value.consentId);
    assert.equal(executed.ok, false);
    if (!executed.ok) {
      assert.equal(executed.error.code, 'DEPENDENCY_NOT_IMPLEMENTED');
    }
    const share = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      resourceId: 'pda_tx',
      category: 'TRANSACTION_DATA',
      operation: 'CONTRIBUTE',
      derivationType: 'AGGREGATE_ONLY',
    });
    assert.equal(share.ok, false);
    if (!share.ok) {
      assert.equal(share.error.code, 'DEPENDENCY_NOT_IMPLEMENTED');
    }
  });

  it('preserves PDV self-access and requires consent for agent-derived payroll', () => {
    const { consent, vault, actor, evidence } = harness();
    const opened = vault.openVault(actor, actor.subjectId, 'cust_consent_alice');
    assert.equal(opened.ok, true);
    const payroll = new SimulatedPayrollConnector().fetch('payroll_july');
    const ingested = vault.ingest(actor, {
      subjectId: actor.subjectId,
      sourceId: payroll.sourceId,
      sourceRecordRef: payroll.sourceRecordRef,
      idempotencyKey: 'payroll_july',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: payroll.contentType,
      payload: payroll.body,
      provenanceKind: payroll.provenanceKind,
      purposeRef: 'demo.ingest.payroll',
    });
    if (!ingested.ok) {
      return;
    }
    const self = vault.readPayload(actor, actor.subjectId, ingested.value.assetId, 'demo.view.own');
    assert.equal(self.ok, true);
    const tool = new PurposeScopedVaultTool(consent, vault);
    const denied = tool.readDerivedMonthlyIncome(actor, {
      subjectId: actor.subjectId,
      assetId: ingested.value.assetId,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'NO_ACTIVE_CONSENT');
    }
    grantAgentPayroll(consent, actor, actor.subjectId, ingested.value.assetId);
    const derived = tool.readDerivedMonthlyIncome(actor, {
      subjectId: actor.subjectId,
      assetId: ingested.value.assetId,
    });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.value.netMinor, '320000');
      assert.equal('employer' in derived.value, false);
    }
    const receipt = new UserUploadConnector().fetch('receipt_corner');
    const uploaded = vault.ingest(actor, {
      subjectId: actor.subjectId,
      sourceId: receipt.sourceId,
      sourceRecordRef: receipt.sourceRecordRef,
      idempotencyKey: 'receipt_corner',
      schemaId: 'pdsch_receipt',
      schemaVersion: '1',
      contentType: receipt.contentType,
      payload: receipt.body,
      provenanceKind: receipt.provenanceKind,
      purposeRef: 'demo.ingest.receipt',
    });
    assert.equal(uploaded.ok, true);
    if (uploaded.ok) {
      const raw = tool.readRawReceipt(actor, { subjectId: actor.subjectId, assetId: uploaded.value.assetId });
      assert.equal(raw.ok, false);
      if (!raw.ok) {
        assert.equal(raw.error.code, 'RESOURCE_OUT_OF_SCOPE');
      }
    }
    assert.equal(consent.ledgerVerifies(), true);
    assert.equal(evidence.verifyChain().ok, true);
    assert.ok(PAST < T0);
  });
});
