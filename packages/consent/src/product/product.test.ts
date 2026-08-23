import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { PersonalDataVault } from '../../../personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { ConsentDataUseAuthorization } from '../authorization.ts';
import { RECIPIENT_LICENSEE_SIM } from '../recipients.ts';
import { ConsentService } from '../service.ts';
import { ConsentDataRightsEngine } from './engine.ts';
import { defaultGrantedPurposeIds, expandPermissionBundle, PRODUCT_PURPOSE_CATALOG } from './purposes.ts';
import { CURRENT_DATA_TERMS_VERSION } from './taxonomy.ts';

const T0 = asUtcInstant('2026-08-23T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-23T12:00:00.000Z');

const CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
] as const;

function harness() {
  const clock = new FrozenClock(T0);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const alice = identity.provisionSimulatedActor({
    actorId: 'actor_rights_alice',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_rights_alice',
    customerId: asCustomerId('cust_rights_alice'),
    capabilities: [...CAPS],
  });
  const bob = identity.provisionSimulatedActor({
    actorId: 'actor_rights_bob',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_rights_bob',
    customerId: asCustomerId('cust_rights_bob'),
    capabilities: [...CAPS],
  });
  if (!alice.ok || !bob.ok) {
    throw new Error('provision failed');
  }
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const engine = new ConsentDataRightsEngine({ clock, consent, evidence, events });
  const actor = {
    actorId: alice.value.actorId,
    subjectId: alice.value.subjectId,
    jurisdiction: 'GB',
    verified: alice.value,
    capabilities: [...CAPS],
  };
  const other = {
    actorId: bob.value.actorId,
    subjectId: bob.value.subjectId,
    jurisdiction: 'GB',
    verified: bob.value,
    capabilities: [...CAPS],
  };
  return { clock, consent, vault, engine, actor, other, evidence };
}

describe('consent data-rights productization', () => {
  it('keeps optional monetization off by default and expands bundles to granular scope', () => {
    const { engine, actor } = harness();
    const catalog = engine.listPermissions(actor);
    assert.equal(catalog.ok, true);
    if (!catalog.ok) {
      return;
    }
    assert.equal(catalog.value.implicitMonetizationOptIn, false);
    const licensing = catalog.value.purposes.find((row) => row.purposeId === 'data-licensing');
    assert.ok(licensing);
    assert.equal(licensing.necessity, 'OPTIONAL_COMPENSATED');
    assert.equal(licensing.granted, false);
    assert.equal(licensing.requiredForBasicAccount, false);
    assert.deepEqual([...defaultGrantedPurposeIds()], ['core-account-service']);
    const bundle = expandPermissionBundle('AGENT_SPENDING_DATA');
    assert.ok(bundle);
    const granted = engine.grantConsent(actor, {
      bundleId: 'AGENT_SPENDING_DATA',
      expiresAt: EXPIRES,
      idempotencyKey: 'bundle-agent',
      sessionId: 'ses_1',
    });
    assert.equal(granted.ok, true);
    if (granted.ok) {
      assert.deepEqual([...granted.value.dataCategories], ['TRANSACTION_DATA', 'PURCHASE_HISTORY']);
      assert.equal(granted.value.purposeId, 'agent-assistance');
      assert.equal(granted.value.bundleId, 'AGENT_SPENDING_DATA');
      assert.equal(granted.value.termsVersion, CURRENT_DATA_TERMS_VERSION);
      assert.equal(granted.value.status, 'ACTIVE');
    }
  });

  it('rejects implicit opt-in and does not treat personalization as licensing', () => {
    const { engine, actor } = harness();
    const implicit = engine.grantConsent(actor, {
      purposeId: 'data-licensing',
      expiresAt: EXPIRES,
      idempotencyKey: 'dark',
      implicitOptIn: true,
    });
    assert.equal(implicit.ok, false);
    if (!implicit.ok) {
      assert.equal(implicit.error.code, 'IMPLICIT_OPT_IN_FORBIDDEN');
    }
    const personalization = engine.grantConsent(actor, {
      purposeId: 'personalization',
      expiresAt: EXPIRES,
      idempotencyKey: 'personalize',
    });
    assert.equal(personalization.ok, true);
    const licensing = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'data-licensing',
      requestedOperation: 'CONTRIBUTE',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(licensing.decision, 'REQUIRE_CONSENT');
    const thirdParty = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'data-licensing',
      requestedOperation: 'CONTRIBUTE',
      actorKind: 'LICENSEE',
    });
    assert.equal(thirdParty.decision, 'DENY');
    const research = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'PREFERENCE_DATA',
      purposeId: 'aggregated-research',
      requestedOperation: 'AGGREGATE',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(research.decision, 'REQUIRE_CONSENT');
  });

  it('grants, receipts, revokes, and expires without erasing history', () => {
    const { engine, actor, clock } = harness();
    const granted = engine.grantConsent(actor, {
      purposeId: 'financial-analysis',
      dataCategories: ['TRANSACTION_DATA'],
      expiresAt: EXPIRES,
      idempotencyKey: 'budget',
    });
    assert.equal(granted.ok, true);
    if (!granted.ok) {
      return;
    }
    const receipt = engine.receiptFor(actor, granted.value.consentId);
    assert.equal(receipt.ok, true);
    if (receipt.ok) {
      assert.equal(receipt.value.rawPayloadIncluded, false);
      assert.equal(receipt.value.purposeId, 'financial-analysis');
      assert.equal(receipt.value.termsVersion, CURRENT_DATA_TERMS_VERSION);
    }
    const allowed = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'financial-analysis',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
      recordId: 'pda_tx_1',
    });
    assert.equal(allowed.decision, 'ALLOW');
    const revoked = engine.revokeConsent(actor, granted.value.consentId, 'user revoked', 'rev-1');
    assert.equal(revoked.ok, true);
    if (revoked.ok) {
      assert.equal(revoked.value.revocation.disabledAccess, true);
      assert.equal(revoked.value.revocation.historicalProcessingErased, false);
    }
    const after = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'financial-analysis',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(after.decision, 'REQUIRE_CONSENT');
    const again = engine.grantConsent(actor, {
      purposeId: 'analytics',
      expiresAt: EXPIRES,
      idempotencyKey: 'analytics',
    });
    assert.equal(again.ok, true);
    clock.set(asUtcInstant('2026-10-01T00:00:00.000Z'));
    const expired = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'PREFERENCE_DATA',
      purposeId: 'analytics',
      requestedOperation: 'AGGREGATE',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(expired.decision, 'REQUIRE_CONSENT');
  });

  it('does not apply broader terms to an old grant', () => {
    const { engine, actor } = harness();
    const granted = engine.grantConsent(actor, {
      purposeId: 'personalization',
      expiresAt: EXPIRES,
      idempotencyKey: 'terms-old',
    });
    assert.equal(granted.ok, true);
    engine.advanceTerms('sunrey.data-terms.v2', ['personalization']);
    const decision = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'PREFERENCE_DATA',
      purposeId: 'personalization',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(decision.decision, 'REQUIRE_CONSENT');
    assert.equal(decision.reasonCode, 'TERMS_REQUIRE_NEW_CONSENT');
  });

  it('requires both Agent mandate and data consent', () => {
    const { engine, actor } = harness();
    const mandate = {
      state: 'ACTIVE',
      assistScopes: ['ANALYZE_SPENDING', 'READ_ACCOUNTS'],
      actionClasses: ['READ_FINANCIAL_STATE'],
    };
    const missingConsent = engine.evaluateAgentAccess({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      requestedOperation: 'DERIVE',
      mandate,
    });
    assert.equal(missingConsent.decision, 'REQUIRE_CONSENT');
    assert.equal(missingConsent.mandateSatisfied, true);
    assert.equal(missingConsent.consentSatisfied, false);
    const granted = engine.grantConsent(actor, {
      bundleId: 'AGENT_SPENDING_DATA',
      expiresAt: EXPIRES,
      idempotencyKey: 'agent-spend',
    });
    assert.equal(granted.ok, true);
    const both = engine.evaluateAgentAccess({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      requestedOperation: 'DERIVE',
      mandate,
    });
    assert.equal(both.decision, 'ALLOW');
    assert.equal(both.mandateSatisfied, true);
    assert.equal(both.consentSatisfied, true);
    const noMandate = engine.evaluateAgentAccess({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      requestedOperation: 'DERIVE',
      mandate: { state: 'REVOKED', assistScopes: ['ANALYZE_SPENDING'], actionClasses: ['READ_FINANCIAL_STATE'] },
    });
    assert.equal(noMandate.decision, 'DENY');
    const payroll = engine.evaluateAgentAccess({
      actor,
      subjectId: actor.subjectId,
      category: 'PAYROLL_DATA',
      requestedOperation: 'READ',
      mandate,
    });
    assert.equal(payroll.decision, 'REQUIRE_CONSENT');
  });

  it('denies third-party access without a scoped license', () => {
    const { engine, actor } = harness();
    const denied = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'data-licensing',
      requestedOperation: 'CONTRIBUTE',
      actorKind: 'LICENSEE',
    });
    assert.equal(denied.decision, 'DENY');
    assert.equal(denied.reasonCode, 'LICENSE_DENIED');
    const economic = engine.grantConsent(actor, {
      purposeId: 'data-licensing',
      dataCategories: ['TRANSACTION_DATA'],
      expiresAt: EXPIRES,
      idempotencyKey: 'license-econ',
      economicUseClass: 'ECONOMIC_LICENSING',
      recipientClass: 'APPROVED_LICENSEE',
    });
    assert.equal(economic.ok, true);
    const license = engine.createLicense(actor, {
      licenseeId: RECIPIENT_LICENSEE_SIM,
      purposeId: 'data-licensing',
      categories: ['TRANSACTION_DATA'],
      queryLimit: 1,
      windowFrom: T0,
      windowTo: EXPIRES,
      privacyRequirements: ['NO_RAW_REIDENTIFICATION', 'SCOPED_QUERY_ONLY'],
    });
    assert.equal(license.ok, true);
    if (!license.ok) {
      return;
    }
    assert.equal(license.value.unrestrictedDatabaseAccess, false);
    const allowed = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'data-licensing',
      requestedOperation: 'CONTRIBUTE',
      actorKind: 'LICENSEE',
      licenseId: license.value.licenseId,
    });
    assert.equal(allowed.decision, 'ALLOW');
    const exhausted = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'data-licensing',
      requestedOperation: 'CONTRIBUTE',
      actorKind: 'LICENSEE',
      licenseId: license.value.licenseId,
    });
    assert.equal(exhausted.decision, 'DENY');
  });

  it('enrolls and withdraws HIN without closing financial services', () => {
    const { engine, actor } = harness();
    const before = engine.getHinParticipation(actor);
    assert.equal(before.ok, true);
    if (before.ok) {
      assert.equal(before.value.state, 'NOT_ENROLLED');
      assert.equal(before.value.financialServicesRemainOpen, true);
    }
    const enrolled = engine.enrollHin(actor, { expiresAt: EXPIRES, idempotencyKey: 'hin-enroll' });
    assert.equal(enrolled.ok, true);
    if (enrolled.ok) {
      assert.equal(enrolled.value.state, 'ENROLLED');
    }
    const paused = engine.pauseHin(actor);
    assert.equal(paused.ok, true);
    if (paused.ok) {
      assert.equal(paused.value.state, 'PAUSED');
    }
    const withdrawn = engine.withdrawHin(actor);
    assert.equal(withdrawn.ok, true);
    if (withdrawn.ok) {
      assert.equal(withdrawn.value.state, 'WITHDRAWN');
      assert.equal(withdrawn.value.financialServicesRemainOpen, true);
    }
    const core = engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'core-account-service',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
    });
    assert.equal(core.decision, 'ALLOW');
  });

  it('runs a configurable rights-request workflow and isolates subjects', () => {
    const { engine, actor, other } = harness();
    const access = engine.submitRightsRequest(actor, { type: 'ACCESS', idempotencyKey: 'r-access' });
    assert.equal(access.ok, true);
    if (access.ok) {
      assert.equal(access.value.state, 'SUBMITTED');
      assert.equal(access.value.applicable, true);
    }
    const advanced = engine.advanceRightsRequest(actor, access.ok ? access.value.requestId : '', 'COMPLETED', 'export prepared');
    assert.equal(advanced.ok, true);
    const us = engine.submitRightsRequest(
      { ...actor, jurisdiction: 'US' },
      { type: 'OBJECTION', idempotencyKey: 'r-obj', jurisdiction: 'US' },
    );
    assert.equal(us.ok, false);
    const listed = engine.listRightsRequests(actor);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.length >= 1, true);
    }
    const crossed = engine.listConsents({ ...other, subjectId: actor.subjectId });
    assert.equal(crossed.ok, false);
    const own = engine.listConsents(other);
    assert.equal(own.ok, true);
    if (own.ok) {
      assert.equal(own.value.length, 0);
    }
  });

  it('records access audit without raw values and refuses blanket delegation', () => {
    const { engine, actor } = harness();
    engine.mayAccessData({
      actor,
      subjectId: actor.subjectId,
      category: 'TRANSACTION_DATA',
      purposeId: 'financial-analysis',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
      recordId: 'pda_secret',
    });
    const history = engine.listAccessHistory(actor);
    assert.equal(history.ok, true);
    if (history.ok) {
      assert.equal(history.value[0]?.rawValueLogged, false);
      assert.equal(history.value[0]?.resourceRef, 'pda_secret');
      assert.equal(JSON.stringify(history.value).includes('salary'), false);
    }
    const blanket = engine.createDelegation(actor, {
      delegateActorId: 'actor_family',
      relationship: 'FAMILY_MEMBER',
      categories: [],
      purposeIds: [],
      operations: ['READ'],
    });
    assert.equal(blanket.ok, false);
    const sensitive = engine.createDelegation(actor, {
      delegateActorId: 'actor_family',
      relationship: 'FAMILY_MEMBER',
      categories: ['PAYROLL_DATA'],
      purposeIds: ['financial-analysis'],
      operations: ['READ'],
    });
    assert.equal(sensitive.ok, false);
    const scoped = engine.createDelegation(actor, {
      delegateActorId: 'actor_family',
      relationship: 'FAMILY_MEMBER',
      categories: ['PAYROLL_DATA'],
      purposeIds: ['financial-analysis'],
      operations: ['READ'],
      explicitSensitive: true,
    });
    assert.equal(scoped.ok, true);
  });

  it('classifies every catalog purpose and keeps production gates closed', () => {
    const families = new Set(PRODUCT_PURPOSE_CATALOG.map((row) => row.family));
    for (const family of [
      'CORE_SERVICE',
      'PERSONALIZATION',
      'FINANCIAL_ANALYSIS',
      'AGENT_ASSISTANCE',
      'RESEARCH',
      'ANALYTICS',
      'DATA_LICENSING',
      'HIN_PARTICIPATION',
      'MARKETING',
      'PRODUCT_IMPROVEMENT',
    ]) {
      assert.equal(families.has(family as never), true, family);
    }
    assert.equal(
      PRODUCT_PURPOSE_CATALOG.some((row) => row.necessity === 'OPTIONAL_COMPENSATED' && row.requiredForBasicAccount),
      false,
    );
    assert.equal(PRODUCT_PURPOSE_CATALOG.every((row) => row.legalHook !== 'CONFIRMED_BY_COUNSEL'), true);
  });
});
