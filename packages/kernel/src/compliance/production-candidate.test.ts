import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../../../config/src/flags.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  ComplianceProviderOrchestrator,
  assertNoSensitiveComplianceLog,
  bindComplianceProviderLifecycle,
  clientMaySeeInternalMatchLogic,
  dispositionForOutage,
  outageMayAutoAllow,
  providerFindingIsNotKernelDecision,
  providerMatchIsNotProhibition,
  redactComplianceLog,
  sandboxComplianceProfile,
} from './production-candidate/index.ts';

const NOW = asUtcInstant('2027-08-21T12:00:00.000Z');

function orch(unavailable = false) {
  return new ComplianceProviderOrchestrator(new FrozenClock(NOW), { unavailable });
}

describe('Phase D compliance provider adapters', () => {
  it('does not create a parallel compliance package', () => {
    assert.equal(existsSync('packages/compliance'), false);
    assert.equal(existsSync('packages/kyc'), false);
    assert.equal(existsSync('packages/aml'), false);
    assert.equal(existsSync('packages/sanctions'), false);
  });

  it('maps sanctions certification cases without treating MATCH as a Kernel ALLOW', () => {
    const runtime = orch();
    const clear = runtime.screenSanctions({
      subjectKind: 'PERSON',
      subjectRef: 'idn_clear',
      jurisdiction: 'GB',
    });
    assert.equal(clear.finding.matchState, 'NO_MATCH');
    assert.equal(clear.kernelHint, 'ALLOW');
    assert.equal(clear.finding.isKernelDecision, false);

    const possible = runtime.screenSanctions({
      subjectKind: 'PERSON',
      subjectRef: 'idn_possible_sanctions',
      jurisdiction: 'GB',
    });
    assert.equal(possible.finding.matchState, 'POSSIBLE_MATCH');
    assert.equal(possible.kernelHint, 'REQUIRE_MANUAL_REVIEW');
    assert.ok(possible.caseLink);
    assert.notEqual(possible.kernelHint, 'ALLOW');

    const confirmed = runtime.screenSanctions({
      subjectKind: 'ORGANIZATION',
      subjectRef: 'org_confirmed_sanctions_match',
      jurisdiction: 'GB',
    });
    assert.equal(confirmed.finding.matchState, 'CONFIRMED_MATCH');
    assert.equal(confirmed.kernelHint, 'BLOCK');
    assert.equal(confirmed.caseLink?.opened.finality, 'FINAL_HARD_BLOCK');

    const wallet = runtime.screenSanctions({
      subjectKind: 'WALLET',
      subjectRef: 'wallet_possible',
      jurisdiction: 'GB',
    });
    assert.equal(wallet.finding.subjectKind, 'WALLET');
    assert.equal(providerFindingIsNotKernelDecision(), false);
    assert.equal(providerMatchIsNotProhibition(), false);
  });

  it('fails closed when the sanctions provider is unavailable', () => {
    const runtime = orch(true);
    const result = runtime.screenSanctions({
      subjectKind: 'PERSON',
      subjectRef: 'idn_any',
      jurisdiction: 'GB',
    });
    assert.equal(result.finding.matchState, 'UNAVAILABLE');
    assert.equal(result.kernelHint, 'BLOCK');
    assert.equal(runtime.outageDisposition(), 'BLOCK');
    assert.equal(outageMayAutoAllow(), false);
    assert.equal(dispositionForOutage({ required: true, posture: 'REQUIRE_MANUAL_REVIEW' }), 'REQUIRES_REVIEW');
    assert.equal(dispositionForOutage({ required: true, posture: 'DEFER' }), 'TEMPORARILY_UNAVAILABLE');
  });

  it('screens PEP and adverse media as findings, not eligibility decisions', () => {
    const runtime = orch();
    const pep = runtime.screenPep({
      subjectRef: 'idn_pep',
      jurisdiction: 'GB',
      relatedPersonRef: 'idn_related',
    });
    assert.equal(pep.finding.kind, 'PEP');
    assert.equal(pep.finding.isEligibilityDecision, false);
    assert.equal(pep.kernelHint, 'REQUIRE_MANUAL_REVIEW');
    const media = runtime.screenAdverseMedia({ subjectRef: 'idn_adverse_media', jurisdiction: 'GB' });
    assert.equal(media.finding.kind, 'ADVERSE_MEDIA');
    assert.ok(media.caseLink);
  });

  it('turns AML signals into alerts and cases without editing the ledger', () => {
    const runtime = orch();
    const submitted = runtime.submitAml({
      signalId: 'sig-1',
      source: 'PAYMENTS',
      subjectRef: 'idn_aml_alert',
      counterpartyRef: 'cp-1',
      amountMinor: 1_000n,
      currency: 'USD',
      eventRef: 'pay-1',
    });
    assert.equal(submitted.alert, true);
    assert.ok(submitted.caseLink);
    assert.equal(submitted.kernelHint, 'REQUIRE_MANUAL_REVIEW');
    const duplicate = runtime.submitAml({
      signalId: 'sig-1',
      source: 'PAYMENTS',
      subjectRef: 'idn_aml_alert',
      counterpartyRef: 'cp-1',
      amountMinor: 1_000n,
      currency: 'USD',
      eventRef: 'pay-1',
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.caseLink, null);
  });

  it('keeps fraud recommendations below Kernel policy', () => {
    const runtime = orch();
    const high = runtime.evaluateFraud('idn_fraud_high_risk');
    assert.equal(high.recommendedAction, 'HOLD');
    assert.equal(high.riskCategory, 'HIGH');
    assert.ok(high.caseLink);
    assert.notEqual(high.kernelHint, 'ALLOW');
    const low = runtime.evaluateFraud('idn_ok');
    assert.equal(low.recommendedAction, 'ALLOW');
  });

  it('creates KYC adapter states and client-safe BFF mapping', () => {
    const runtime = orch();
    const pending = runtime.startKyc({ identityId: 'idn_pending', jurisdiction: asJurisdiction('GB') });
    assert.equal(pending.state, 'IN_PROGRESS');
    assert.equal(runtime.clientVerificationState('idn_pending'), 'IN_PROGRESS');
    const verified = runtime.startKyc({ identityId: 'idn_verified', jurisdiction: asJurisdiction('GB') });
    assert.equal(verified.state, 'VERIFIED');
    assert.equal(runtime.clientVerificationState('idn_verified'), 'VERIFIED');
    assert.equal(verified.isProductionKyc, false);
  });

  it('schedules policy-gated rescreen jobs and refuses continuous checks', () => {
    const runtime = orch();
    const denied = runtime.scheduleMonitoring({
      trigger: 'SANCTIONS_LIST_UPDATE',
      subjectRef: 'idn_ok',
      policyAllows: false,
    });
    assert.equal('ok' in denied && denied.ok === false, true);
    const allowed = runtime.scheduleMonitoring({
      trigger: 'KYC_EXPIRY',
      subjectRef: 'idn_ok',
      policyAllows: true,
    });
    assert.equal('jobType' in allowed && allowed.jobType === 'KYC_EXPIRY_CHECK', true);
  });

  it('feeds Exchange and custody eligibility facts without bypassing those owners', () => {
    const runtime = orch();
    runtime.screenSanctions({
      subjectKind: 'PERSON',
      subjectRef: 'trader_possible_sanctions',
      jurisdiction: 'GB',
    });
    const exchange = runtime.exchangeFacts('trader_possible_sanctions');
    assert.equal(exchange.complianceState, 'RESTRICTED');
    assert.equal(exchange.bypassesExchangeAuthority, false);
    const custody = runtime.custodyFacts('idn_verified');
    assert.equal(custody.bypassesCustodyAuthority, false);
  });

  it('rejects unverified compliance webhooks and de-duplicates', () => {
    const runtime = orch();
    const finding = runtime.sanctions.screen({
      subjectKind: 'PERSON',
      subjectRef: 'idn_ok',
      now: NOW,
    });
    const bad = runtime.complianceWebhook.receiveWebhook(
      {
        schemaVersion: 1,
        providerId: sandboxComplianceProfile().providerId,
        eventType: 'sanctions.updated',
        timestampUtc: NOW,
        nonce: 'n1',
        idempotencyKey: 'k1',
        payloadHash: 'x',
        signatureHex: '00',
      },
      () => finding,
      Date.parse(NOW),
    );
    assert.equal(bad.ok, false);
    const signed = runtime.complianceWebhook.sign({
      eventType: 'sanctions.updated',
      timestampUtc: NOW,
      nonce: 'n2',
      idempotencyKey: 'k2',
      payload: { findingId: finding.findingId },
    });
    const first = runtime.complianceWebhook.receiveWebhook(signed, () => finding, Date.parse(NOW));
    const replayed = runtime.complianceWebhook.receiveWebhook(signed, () => finding, Date.parse(NOW));
    assert.equal(first.ok, true);
    assert.equal(replayed.ok, false);
    assert.equal(replayed.ok === false && replayed.code, 'REPLAYED');
    assert.equal(replayed.ok === false && replayed.stateUnchanged, true);
    const duplicateSigned = runtime.complianceWebhook.sign({
      eventType: 'sanctions.updated',
      timestampUtc: NOW,
      nonce: 'n3',
      idempotencyKey: 'k2',
      payload: { findingId: finding.findingId },
    });
    const duplicate = runtime.complianceWebhook.receiveWebhook(duplicateSigned, () => finding, Date.parse(NOW));
    assert.equal(duplicate.ok && duplicate.duplicate, true);
  });

  it('hydrates after restart and keeps production disabled', () => {
    const first = orch();
    first.screenSanctions({
      subjectKind: 'PERSON',
      subjectRef: 'idn_possible_sanctions',
      jurisdiction: 'GB',
    });
    const snapshot = first.snapshot();
    const second = orch();
    second.hydrate(snapshot);
    assert.equal(second.exchangeFacts('idn_possible_sanctions').complianceState, 'RESTRICTED');
    assert.equal(first.flags().productionAuthorized, false);
    assert.equal(first.flags().liveVendorConnected, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.throws(() => bindComplianceProviderLifecycle(sandboxComplianceProfile(), 'PRODUCTION_AUTHORIZED'));
  });

  it('redacts secret matching logic from logs and client views', () => {
    const log = redactComplianceLog({
      providerId: 'sandbox-compliance-adapter',
      findingKind: 'SANCTIONS',
      subjectRef: 'idn_ok',
      matchState: 'NO_MATCH',
      reasonCodes: ['SANCTIONS_NO_MATCH'],
    });
    assert.equal(log.scoreOmitted, true);
    assertNoSensitiveComplianceLog(log);
    assert.equal(clientMaySeeInternalMatchLogic(), false);
    assert.throws(() =>
      assertNoSensitiveComplianceLog({ note: 'sanctions score 87 because matched secret database rule X' }),
    );
  });
});
