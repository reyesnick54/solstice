import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../../config/src/flags.ts';
import {
  DocumentVerificationAdapter,
  IdentityAdapterStore,
  IdentityAdapterWebhook,
  KybAdapter,
  KycAdapter,
  assertNoKycDocumentInLog,
  bindIdentityProviderLifecycle,
  containsSensitiveIdentityMaterial,
  documentAuthenticityFor,
  expectedKycCertificationState,
  identityStateForSubject,
  kybStateForBusiness,
  providerVerifiedIssuesExecutionAuthority,
  providerVerifiedOpensAccount,
  redactIdentityLog,
  sandboxIdentityProfile,
  sandboxResultIsProductionKyc,
  sandboxVerifiedIsProductionKyc,
  toIdentityVerificationClientState,
  toPersistedKycState,
} from './production-candidate/index.ts';

const NOW = asUtcInstant('2027-08-21T12:00:00.000Z');

function adapters() {
  const store = new IdentityAdapterStore();
  const profile = sandboxIdentityProfile();
  return {
    store,
    profile,
    kyc: new KycAdapter(store, profile, identityStateForSubject),
    documents: new DocumentVerificationAdapter(store, profile, documentAuthenticityFor),
    kyb: new KybAdapter(store, profile, kybStateForBusiness),
    webhook: new IdentityAdapterWebhook(store, profile),
  };
}

describe('Phase D identity verification adapters', () => {
  it('runs KYC start/pending/verified/failed/expired certification cases', () => {
    const { kyc } = adapters();
    const cases = [
      ['idn_pending', 'pending'],
      ['idn_verified', 'verified'],
      ['idn_fail', 'failed'],
      ['idn_expired', 'expired'],
    ] as const;
    for (const [identityId, testCase] of cases) {
      const applicant = kyc.createApplicant({
        identityId,
        jurisdiction: asJurisdiction('GB'),
        now: NOW,
      });
      const verification = kyc.startVerification({ applicantId: applicant.applicantId, now: NOW });
      assert.equal(verification.state, expectedKycCertificationState(testCase));
      assert.equal(verification.isProductionKyc, false);
      assert.equal(kyc.retrieveApplicant(applicant.applicantId)?.identityId, identityId);
      assert.equal(kyc.retrieveVerification(verification.verificationId)?.state, verification.state);
    }
  });

  it('maps REQUIRES_REVIEW to persisted IN_PROGRESS and client REVIEW', () => {
    assert.equal(toPersistedKycState('REQUIRES_REVIEW'), 'IN_PROGRESS');
    assert.equal(toIdentityVerificationClientState('REQUIRES_REVIEW'), 'REVIEW');
    assert.equal(toIdentityVerificationClientState('FAILED'), 'ACTION_REQUIRED');
    assert.equal(toIdentityVerificationClientState('VERIFIED'), 'VERIFIED');
  });

  it('rejects raw document images and never retains them', () => {
    const { documents } = adapters();
    const failed = documents.requestDocumentVerification({
      documentRef: 'doc_document_failure',
      documentType: 'PASSPORT',
      country: 'GB',
      now: NOW,
      rawPayload: { documentImage: `data:image/png;base64,${'A'.repeat(100)}` },
    });
    assert.equal(failed.authenticity, 'FAILED');
    assert.equal(failed.imageRetained, false);
    assert.ok(failed.reasonCodes.includes('RAW_DOCUMENT_REJECTED'));
    const ok = documents.requestDocumentVerification({
      documentRef: 'doc_ok',
      documentType: 'PASSPORT',
      country: 'GB',
      now: NOW,
      storageRef: 'secure-store:doc_ok',
    });
    assert.equal(ok.authenticity, 'AUTHENTIC');
    assert.equal(ok.imageRetained, false);
    assert.equal(ok.storageRef, 'secure-store:doc_ok');
  });

  it('keeps KYB off the individual KYC model', () => {
    const { kyb } = adapters();
    const record = kyb.startBusinessVerification({
      businessId: 'biz_verified',
      registrationRef: 'reg-1',
      jurisdiction: asJurisdiction('GB'),
      now: NOW,
      beneficialOwnerRefs: ['bo-1'],
      directorRefs: ['dir-1'],
    });
    assert.equal(record.isIndividualKyc, false);
    assert.equal(record.state, 'VERIFIED');
    assert.equal(record.beneficialOwnerRefs.length, 1);
    const refreshed = kyb.refreshBusinessMonitoring({ kybId: record.kybId, now: NOW });
    assert.equal(refreshed.ongoingMonitoring, true);
  });

  it('rejects unverified and duplicate webhooks without changing verified state', () => {
    const { kyc, webhook, store } = adapters();
    const applicant = kyc.createApplicant({
      identityId: 'idn_verified',
      jurisdiction: asJurisdiction('GB'),
      now: NOW,
    });
    const started = kyc.startVerification({ applicantId: applicant.applicantId, now: NOW });
    assert.equal(started.state, 'VERIFIED');
    const unsigned = {
      schemaVersion: 1 as const,
      providerId: sandboxIdentityProfile().providerId,
      eventType: 'verification.updated',
      timestampUtc: NOW,
      nonce: 'nonce-1',
      idempotencyKey: 'idemp-1',
      payloadHash: 'abc',
      signatureHex: '00',
    };
    const rejected = webhook.receiveWebhook(
      unsigned,
      { verificationId: started.verificationId, state: 'FAILED', now: NOW },
      Date.parse(NOW),
    );
    assert.equal(rejected.ok, false);
    assert.equal(store.verifications.get(started.verificationId)?.state, 'VERIFIED');
    const signed = webhook.sign({
      eventType: 'verification.updated',
      timestampUtc: NOW,
      nonce: 'nonce-2',
      idempotencyKey: 'idemp-2',
      payload: { verificationId: started.verificationId, state: 'REQUIRES_REVIEW', now: NOW },
    });
    const first = webhook.receiveWebhook(
      signed,
      { verificationId: started.verificationId, state: 'REQUIRES_REVIEW', now: NOW },
      Date.parse(NOW),
    );
    assert.equal(first.ok, true);
    assert.equal(first.ok && first.duplicate, false);
    const replayed = webhook.receiveWebhook(
      signed,
      { verificationId: started.verificationId, state: 'FAILED', now: NOW },
      Date.parse(NOW),
    );
    assert.equal(replayed.ok, false);
    assert.equal(replayed.ok === false && replayed.code, 'REPLAYED');
    assert.equal(replayed.ok === false && replayed.stateUnchanged, true);
    const duplicateSigned = webhook.sign({
      eventType: 'verification.updated',
      timestampUtc: NOW,
      nonce: 'nonce-3',
      idempotencyKey: 'idemp-2',
      payload: { verificationId: started.verificationId, state: 'FAILED', now: NOW },
    });
    const duplicate = webhook.receiveWebhook(
      duplicateSigned,
      { verificationId: started.verificationId, state: 'FAILED', now: NOW },
      Date.parse(NOW),
    );
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.ok && duplicate.duplicate, true);
    assert.equal(store.verifications.get(started.verificationId)?.state, 'REQUIRES_REVIEW');
  });

  it('survives snapshot/hydrate restart and isolates sandbox from production KYC', () => {
    const first = adapters();
    const applicant = first.kyc.createApplicant({
      identityId: 'idn_verified',
      jurisdiction: asJurisdiction('GB'),
      now: NOW,
    });
    first.kyc.startVerification({ applicantId: applicant.applicantId, now: NOW });
    const snapshot = first.store.snapshot();
    const second = adapters();
    second.store.hydrate(snapshot);
    assert.equal(second.store.latestVerification('idn_verified')?.state, 'VERIFIED');
    assert.equal(sandboxVerifiedIsProductionKyc(), false);
    assert.equal(sandboxResultIsProductionKyc(first.profile, 'VERIFIED').acceptedAsProduction, false);
    assert.equal(providerVerifiedOpensAccount(), false);
    assert.equal(providerVerifiedIssuesExecutionAuthority(), false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(ENVIRONMENT, 'simulation');
    const binding = bindIdentityProviderLifecycle(first.profile);
    assert.equal(binding.productionKycEnabled, false);
    assert.throws(() => bindIdentityProviderLifecycle(first.profile, 'PRODUCTION_AUTHORIZED'));
  });

  it('redacts KYC documents from logs', () => {
    const log = redactIdentityLog({
      providerId: 'sandbox-identity-adapter',
      eventType: 'verification.updated',
      subjectRef: 'idn_verified',
      state: 'VERIFIED',
      reasonCodes: ['SANDBOX_IDENTITY_VERIFIED'],
      evidenceRefs: ['id-ev:1'],
    });
    assert.equal(log.documentImagePresent, false);
    assert.equal(log.rawIdentityPayloadPresent, false);
    assertNoKycDocumentInLog(log);
    assert.equal(
      containsSensitiveIdentityMaterial({ documentImage: `data:image/png;base64,${'B'.repeat(100)}` }),
      true,
    );
    assert.throws(() =>
      assertNoKycDocumentInLog({ documentImage: `data:image/png;base64,${'B'.repeat(100)}` }),
    );
  });

  it('isolates verification records across identities', () => {
    const { kyc, store } = adapters();
    const alice = kyc.createApplicant({
      identityId: 'idn_verified',
      jurisdiction: asJurisdiction('GB'),
      now: NOW,
    });
    const bob = kyc.createApplicant({
      identityId: 'idn_pending',
      jurisdiction: asJurisdiction('GB'),
      now: NOW,
    });
    const aliceVerification = kyc.startVerification({ applicantId: alice.applicantId, now: NOW });
    const bobVerification = kyc.startVerification({ applicantId: bob.applicantId, now: NOW });
    assert.equal(store.latestVerification('idn_verified')?.verificationId, aliceVerification.verificationId);
    assert.equal(store.latestVerification('idn_pending')?.verificationId, bobVerification.verificationId);
    assert.notEqual(store.latestVerification('idn_verified')?.identityId, bob.identityId);
    assert.equal(kyc.retrieveVerification(aliceVerification.verificationId)?.identityId, 'idn_verified');
    assert.notEqual(kyc.retrieveVerification(aliceVerification.verificationId)?.identityId, 'idn_pending');
  });

  it('refreshes screening and returns provider evidence references', () => {
    const clock = new FrozenClock(NOW);
    const { kyc } = adapters();
    const applicant = kyc.createApplicant({
      identityId: 'idn_verified',
      jurisdiction: asJurisdiction('GB'),
      now: clock.now(),
    });
    const started = kyc.startVerification({ applicantId: applicant.applicantId, now: clock.now() });
    const refreshed = kyc.refreshScreening({ verificationId: started.verificationId, now: clock.now() });
    assert.ok(refreshed.reasonCodes.includes('SCREENING_REFRESHED'));
    assert.equal(kyc.retrieveProviderEvidence(started.verificationId).providerEvidenceRef?.startsWith('prov-ev:'), true);
  });
});
