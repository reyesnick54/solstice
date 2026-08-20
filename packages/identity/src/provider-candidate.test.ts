import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { secretRef } from '../../security/src/secrets.ts';
import type {
  BeneficialOwnershipProvider,
  BusinessVerificationProvider,
  DocumentVerificationProvider,
  IdentityProviderPorts,
  IdentityVerificationProvider,
  LivenessVerificationProvider,
} from './ports.ts';
import type { DeviceRiskProvider } from './auth.ts';
import {
  assertNoSensitiveIdentityLog,
  attemptIdentityHumanReview,
  bindIdentityProviderCredential,
  createFixtureIdentityProviderPorts,
  createFixtureIdentityTransport,
  fixtureBusiness,
  fixtureDevice,
  fixtureIdentityProviderProfile,
  IdentityProviderWebhookConformance,
  kycVerifiedEnablesPayments,
  kycVerifiedEnablesTrading,
  kycVerifiedIssuesExecutionAuthority,
  kycVerifiedOpensAccount,
  markIdentityExternalEvidencePresent,
  rejectCrossWorkloadReuse,
  resetIdentityCredentialBindings,
  toStoreRecord,
} from './provider-candidate/index.ts';

const NOW = asUtcInstant('2026-08-20T12:00:00.000Z');

describe('CHUNK-152 identity provider-candidate', () => {
  it('1. reuses IdentityProviderPorts', () => {
    const ports: IdentityProviderPorts = createFixtureIdentityProviderPorts();
    const person: IdentityVerificationProvider = ports.identityVerification;
    const document: DocumentVerificationProvider = ports.documentVerification;
    const liveness: LivenessVerificationProvider = ports.liveness;
    const business: BusinessVerificationProvider = ports.businessVerification;
    const owners: BeneficialOwnershipProvider = ports.beneficialOwnership;
    const device: DeviceRiskProvider = ports.deviceRisk;
    assert.equal(typeof person.verifyPerson, 'function');
    assert.equal(typeof document.verifyDocument, 'function');
    assert.equal(typeof liveness.verifyLiveness, 'function');
    assert.equal(typeof business.verifyBusiness, 'function');
    assert.equal(typeof owners.lookupBeneficialOwners, 'function');
    assert.equal(typeof device.assess, 'function');
  });

  it('2-6. normalizes person, document, liveness, business, and beneficial ownership', () => {
    const ports = createFixtureIdentityProviderPorts();
    const person = ports.identityVerification.verifyPerson('idn_ok', NOW);
    const document = ports.documentVerification.verifyDocument('doc_ok', NOW);
    const liveness = ports.liveness.verifyLiveness('liv_ok', NOW);
    const business = ports.businessVerification.verifyBusiness(fixtureBusiness(NOW), NOW);
    const owners = ports.beneficialOwnership.lookupBeneficialOwners('reg_ok', NOW);
    assert.equal(person.outcome, 'VERIFIED');
    assert.equal(document.outcome, 'VERIFIED');
    assert.equal(liveness.outcome, 'VERIFIED');
    assert.equal(business.outcome, 'VERIFIED');
    assert.equal(owners.ownerRefs.length, 1);
    assert.equal(owners.providerRef.includes('fixture-identity'), true);
    assert.deepEqual(Object.keys(person).sort(), ['evidenceRefs', 'observedAt', 'outcome', 'providerRef', 'reasonCodes']);
  });

  it('7. does not persist raw documents', () => {
    const ports = createFixtureIdentityProviderPorts();
    const result = ports.documentVerification.verifyDocument('doc_ok', NOW);
    const stored = toStoreRecord(result);
    assert.equal(stored.rawDocumentPersisted, false);
    assert.equal(stored.rawVendorResponsePersisted, false);
    assert.equal(ports.documentVerification.persisted('doc_ok')?.rawDocumentPersisted, false);
  });

  it('8. does not log biometric material', () => {
    const ports = createFixtureIdentityProviderPorts();
    ports.liveness.verifyLiveness('liv_ok', NOW);
    for (const entry of ports.liveness.logs()) {
      assertNoSensitiveIdentityLog(entry);
      assert.equal((entry as { biometricLogged: boolean }).biometricLogged, false);
    }
  });

  it('9. KYC VERIFIED does not open an account or issue authority', () => {
    const ports = createFixtureIdentityProviderPorts();
    const verified = ports.identityVerification.verifyPerson('idn_ok', NOW);
    assert.equal(verified.outcome, 'VERIFIED');
    assert.equal(kycVerifiedOpensAccount(), false);
    assert.equal(kycVerifiedIssuesExecutionAuthority(), false);
    assert.equal(kycVerifiedEnablesPayments(), false);
    assert.equal(kycVerifiedEnablesTrading(), false);
  });

  it('handles KYC timeout, schema drift, and liveness unavailability', () => {
    const transport = createFixtureIdentityTransport();
    const ports = createFixtureIdentityProviderPorts(transport);
    transport.setScenario('idn_timeout', 'timeout');
    transport.setScenario('doc_schema', 'schema_drift');
    transport.setScenario('liv_unavailable', 'unavailable');
    assert.equal(ports.identityVerification.verifyPerson('idn_timeout', NOW).outcome, 'FAILED');
    assert.ok(ports.identityVerification.verifyPerson('idn_timeout', NOW).reasonCodes.includes('KYC_TIMEOUT'));
    assert.ok(ports.documentVerification.verifyDocument('doc_schema', NOW).reasonCodes.includes('DOCUMENT_SCHEMA_DRIFT'));
    assert.ok(ports.liveness.verifyLiveness('liv_unavailable', NOW).reasonCodes.includes('PROVIDER_UNAVAILABLE'));
  });

  it('rejects webhook replay and isolates kyc_worker credentials', () => {
    resetIdentityCredentialBindings();
    const binding = bindIdentityProviderCredential({ workloadIdentity: 'kyc_worker' });
    assert.equal('ok' in binding ? false : binding.workloadIdentity, 'kyc_worker');
    const reuse = rejectCrossWorkloadReuse(secretRef('simulation', 'kyc-worker-credential'), 'screening_worker');
    assert.equal(reuse.reasonCode, 'CROSS_WORKLOAD_REUSE_REJECTED');
    const webhooks = new IdentityProviderWebhookConformance();
    const envelope = webhooks.sign({
      eventType: 'person.verified',
      timestampUtc: NOW,
      nonce: 'n1',
      idempotencyKey: 'idemp-1',
      payload: { outcome: 'VERIFIED' },
    });
    const first = webhooks.ingest(envelope, Date.parse(NOW), () =>
      createFixtureIdentityProviderPorts().identityVerification.verifyPerson('idn_ok', NOW),
    );
    const nonceReplay = webhooks.ingest(envelope, Date.parse(NOW), () => {
      throw new Error('must not apply replayed webhook');
    });
    const duplicate = webhooks.ingest(
      webhooks.sign({
        eventType: 'person.verified',
        timestampUtc: NOW,
        nonce: 'n2',
        idempotencyKey: 'idemp-1',
        payload: { outcome: 'VERIFIED' },
      }),
      Date.parse(NOW),
      () => {
        throw new Error('must not apply duplicate webhook');
      },
    );
    assert.equal(first.ok, true);
    assert.equal(nonceReplay.ok, false);
    assert.equal(!nonceReplay.ok && nonceReplay.code === 'REPLAYED', true);
    assert.equal(duplicate.ok && duplicate.duplicate, true);
  });

  it('cannot fabricate external evidence and AI cannot human-review', () => {
    assert.equal(
      markIdentityExternalEvidencePresent({
        serviceContractRef: null,
        dataProcessingAgreementRef: null,
        securityReviewRef: null,
        jurisdictionReviewRef: null,
        licenseRegistrationRef: null,
        slaContinuityRef: null,
        humanAcceptanceRef: null,
      }).present,
      false,
    );
    assert.equal(attemptIdentityHumanReview({ actorKind: 'AI', role: 'COUNSEL_REVIEWER' }).ok, false);
    assert.equal(attemptIdentityHumanReview({ actorKind: 'S3M', role: 'SECURITY_REVIEWER' }).ok, false);
    assert.equal(attemptIdentityHumanReview({ actorKind: 'GROK', role: 'OPERATIONS_REVIEWER' }).ok, false);
    assert.equal(attemptIdentityHumanReview({ actorKind: 'HUMAN_OPERATOR', role: 'COMMERCIAL_REVIEWER' }).ok, true);
  });

  it('keeps production unauthorized and uses no real transport', () => {
    const profile = fixtureIdentityProviderProfile();
    const transport = createFixtureIdentityTransport();
    assert.equal(profile.productionAuthorized, false);
    assert.equal(profile.liveVendorConnected, false);
    assert.equal(transport.realNetwork, false);
    assert.equal(transport.kind, 'FAKE');
    const device = createFixtureIdentityProviderPorts().deviceRisk.assess(fixtureDevice(NOW), NOW);
    assert.equal(device.recommendedState, 'KNOWN');
  });
});
