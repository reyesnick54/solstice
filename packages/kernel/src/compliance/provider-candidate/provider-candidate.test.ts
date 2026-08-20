import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { secretRef } from '../../../../security/src/secrets.ts';
import { ComplianceFabric } from '../fabric.ts';
import type { ComplianceProviderPorts, ScreeningRequest } from '../ports.ts';
import {
  aiMayApproveCompliance,
  attemptComplianceHumanReview,
  bindComplianceProviderCredential,
  caseProviderIsCanonicalAuthority,
  createFixtureCaseManagement,
  createFixtureComplianceProviderPorts,
  createFixtureComplianceTransport,
  fixtureSanctionsProviderProfile,
  grokMayApproveCompliance,
  interpretProviderScore,
  markComplianceExternalEvidencePresent,
  providerScoreIsNotHumanWorth,
  providerScoreIsNotKernelDecision,
  providerScoreIsNotPeve,
  providerScoreIsNotSunReyValuation,
  resetComplianceCredentialBindings,
  s3mMayApproveCompliance,
  ComplianceProviderWebhookConformance,
} from './index.ts';

const NOW = asUtcInstant('2026-08-20T12:00:00.000Z');

function request(subjectRef: string): ScreeningRequest {
  return { subjectKind: 'PERSON', subjectRef, jurisdiction: 'GB', now: NOW };
}

describe('CHUNK-152 compliance provider-candidate', () => {
  it('10. reuses compliance provider ports', () => {
    const ports: ComplianceProviderPorts = createFixtureComplianceProviderPorts();
    assert.equal(typeof ports.sanctions.screen, 'function');
    assert.equal(typeof ports.pep.screen, 'function');
    assert.equal(typeof ports.adverseMedia.screen, 'function');
    assert.equal(typeof ports.transactionMonitoring.evaluate, 'function');
    assert.equal(typeof ports.fraud.evaluate, 'function');
    assert.equal(typeof ports.deviceRisk.screen, 'function');
  });

  it('11-13. unavailable is never CLEAR for sanctions, PEP, or AML', () => {
    const transport = createFixtureComplianceTransport();
    const ports = createFixtureComplianceProviderPorts(transport);
    transport.setScenario('outage-s', 'unavailable');
    transport.setScenario('outage-p', 'timeout');
    transport.setScenario('outage-a', 'auth_failure');
    const sanctions = ports.sanctions.screen(request('outage-s'));
    const pep = ports.pep.screen(request('outage-p'));
    const aml = ports.transactionMonitoring.evaluate(request('outage-a'));
    assert.equal(sanctions.outcome, 'UNAVAILABLE');
    assert.notEqual(sanctions.outcome, 'CLEAR');
    assert.equal(pep.outcome, 'UNAVAILABLE');
    assert.notEqual(pep.outcome, 'CLEAR');
    assert.equal(aml.outcome, 'UNAVAILABLE');
    assert.notEqual(aml.outcome, 'CLEAR');
  });

  it('14. adverse media stores references without article bodies or guilt', () => {
    const transport = createFixtureComplianceTransport();
    const ports = createFixtureComplianceProviderPorts(transport);
    transport.setScenario('sim_review_media', 'manual_review');
    const media = ports.adverseMedia.screen(request('sim_review_media'));
    assert.equal(media.articleBodyCopied, false);
    assert.equal(media.treatedAsGuilt, false);
    assert.equal('articleBody' in media, false);
    assert.ok(media.references.every((ref) => ref.contentHash.length === 64));
  });

  it('15-18. vendor score is not a Kernel, PEVE, human-worth, or SunRey decision', () => {
    const interpretation = interpretProviderScore(88, 0.7);
    assert.equal(interpretation.isKernelDecision, false);
    assert.equal(interpretation.isPeve, false);
    assert.equal(interpretation.isHumanWorth, false);
    assert.equal(interpretation.isSunReyValuation, false);
    assert.equal(providerScoreIsNotKernelDecision(), false);
    assert.equal(providerScoreIsNotPeve(), false);
    assert.equal(providerScoreIsNotHumanWorth(), false);
    assert.equal(providerScoreIsNotSunReyValuation(), false);
  });

  it('19. case provider is not canonical case authority and rejects replay', () => {
    const cases = createFixtureCaseManagement();
    const first = cases.ingest(
      { externalCaseId: 'ext-1', status: 'OPEN', assigneeRef: 'op-1', evidenceRefs: ['ev-1'] },
      NOW,
    );
    const replay = cases.ingest(
      { externalCaseId: 'ext-1', status: 'CLOSED', assigneeRef: 'op-2', evidenceRefs: ['ev-2'] },
      NOW,
    );
    assert.equal(first.externalSystemIsCanonical, false);
    assert.equal(caseProviderIsCanonicalAuthority(), false);
    assert.equal(replay.case.caseId, first.case.caseId);
    assert.equal(replay.case.status, 'OPEN');
  });

  it('feeds existing Kernel policy without treating CLEAR-on-invalid as CLEAR', () => {
    const transport = createFixtureComplianceTransport();
    const ports = createFixtureComplianceProviderPorts(transport);
    transport.setScenario('schema-clear', 'invalid_clear');
    const invalid = ports.sanctions.screen(request('schema-clear'));
    assert.equal(invalid.outcome, 'UNAVAILABLE');
    assert.ok(invalid.reasonCodes.includes('SCHEMA_INVALID'));
    const fabric = new ComplianceFabric({ clock: new FrozenClock(NOW), ports });
    const facts = fabric.collectFacts({ subjectRef: 'schema-clear', jurisdiction: 'GB' });
    assert.equal(facts.sanctionsOutcome === 'CLEAR', false);
  });

  it('handles sanctions false positive, PEP potential match, fraud overflow, and confidence float', () => {
    const transport = createFixtureComplianceTransport();
    const ports = createFixtureComplianceProviderPorts(transport);
    transport.setScenario('false_positive', 'manual_review');
    transport.setScenario('pep_hit', 'potential_match');
    transport.setScenario('overflow', 'score_overflow');
    transport.setScenario('float', 'confidence_float');
    assert.equal(ports.sanctions.screen(request('false_positive')).outcome, 'REVIEW');
    assert.equal(ports.pep.screen(request('pep_hit')).outcome, 'REVIEW');
    assert.equal(ports.fraud.evaluate(request('overflow')).outcome, 'UNAVAILABLE');
    assert.equal(ports.fraud.evaluate(request('float')).outcome, 'UNAVAILABLE');
    assert.equal(ports.fraud.evaluate(request('overflow')).freezesFunds, false);
  });

  it('rejects AML webhook replay and isolates screening credentials', () => {
    resetComplianceCredentialBindings();
    const first = bindComplianceProviderCredential({
      providerId: 'fixture-aml',
      workloadIdentity: 'screening_worker',
      credentialRef: secretRef('simulation', 'shared-regtech'),
    });
    assert.equal('ok' in first, false);
    const reuse = bindComplianceProviderCredential({
      providerId: 'fixture-travel-rule',
      workloadIdentity: 'case_management',
      credentialRef: secretRef('simulation', 'shared-regtech'),
    });
    assert.equal('ok' in reuse && reuse.ok === false && reuse.reasonCode === 'CROSS_WORKLOAD_REUSE_REJECTED', true);
    const webhooks = new ComplianceProviderWebhookConformance();
    const envelope = webhooks.sign({
      eventType: 'aml.alert',
      timestampUtc: NOW,
      nonce: 'n-aml',
      idempotencyKey: 'aml-1',
      payload: { alert: true },
    });
    const ports = createFixtureComplianceProviderPorts();
    const applied = webhooks.ingest(envelope, Date.parse(NOW), () => ports.transactionMonitoring.evaluate(request('ok')));
    const nonceReplay = webhooks.ingest(envelope, Date.parse(NOW), () => {
      throw new Error('replayed AML webhook must not transition state');
    });
    const duplicate = webhooks.ingest(
      webhooks.sign({
        eventType: 'aml.alert',
        timestampUtc: NOW,
        nonce: 'n-aml-2',
        idempotencyKey: 'aml-1',
        payload: { alert: true },
      }),
      Date.parse(NOW),
      () => {
        throw new Error('duplicate AML webhook must not transition state');
      },
    );
    assert.equal(applied.ok, true);
    assert.equal(nonceReplay.ok, false);
    assert.equal(!nonceReplay.ok && nonceReplay.code === 'REPLAYED', true);
    assert.equal(duplicate.ok && duplicate.duplicate, true);
  });

  it('AI, S3M, and Grok cannot satisfy human review or fabricate evidence', () => {
    const opened = createFixtureCaseManagement().ingest(
      { externalCaseId: 'ext-ai', status: 'OPEN', assigneeRef: null, evidenceRefs: [] },
      NOW,
    );
    assert.equal(attemptComplianceHumanReview({ case: opened.case, actorKind: 'AI', decision: 'CLEAR', now: NOW }).ok, false);
    assert.equal(attemptComplianceHumanReview({ case: opened.case, actorKind: 'S3M', decision: 'CLEAR', now: NOW }).ok, false);
    assert.equal(attemptComplianceHumanReview({ case: opened.case, actorKind: 'GROK', decision: 'CLEAR', now: NOW }).ok, false);
    assert.equal(aiMayApproveCompliance(), false);
    assert.equal(s3mMayApproveCompliance(), false);
    assert.equal(grokMayApproveCompliance(), false);
    assert.equal(
      markComplianceExternalEvidencePresent({
        serviceContractRef: null,
        dataProcessingAgreementRef: 'missing-others',
        securityReviewRef: null,
        jurisdictionReviewRef: null,
        licenseRegistrationRef: null,
        slaContinuityRef: null,
        humanAcceptanceRef: null,
      }).present,
      false,
    );
    assert.equal(fixtureSanctionsProviderProfile().productionAuthorized, false);
  });
});
