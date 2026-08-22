import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { WEBHOOK_SCHEMA_VERSION } from '../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../security/src/redaction.ts';
import { asCardAuthorizationId, asCardId, asMerchantReference, asProcessorCardReference } from './ids.ts';
import { freezeAuthorizationRequest } from './authorization.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import { SimulatedProductionCardIssuer } from './production-adapters/simulated.ts';
import { runAuthorizationBridge } from './production-adapters/authorization-bridge.ts';
import { refuseApplicationPanStorage } from './production-adapters/pci.ts';
import { authorizeCardAdapterInvocation } from './production-adapters/live-gate.ts';
import { CardProductionWebhookIngestor } from './production-adapters/webhooks.ts';
import { runCardCertificationSuite } from './production-adapters/certification.ts';
import { CARD_ADAPTER_FLAGS } from './production-adapters/types.ts';

describe('Phase D card provider adapters', () => {
  it('issues, freezes, and unfreezes through the production issuer contract', () => {
    const issuer = new SimulatedProductionCardIssuer();
    const issued = issuer.issueVirtualCard({
      cardId: asCardId('card_d02_virtual'),
      formFactor: 'VIRTUAL',
      programId: 'sim-us-virtual',
    });
    assert.equal(issued.displayHint, 'SIM-CARD');
    assert.equal(issuer.producesProductionCard, false);
    assertNoSensitiveCardData(issued);
    issuer.activateCard(issued.processorCardRef);
    assert.equal(issuer.freezeCard(issued.processorCardRef).status, 'FROZEN');
    assert.equal(issuer.unfreezeCard(issued.processorCardRef).status, 'ACTIVE');
  });

  it('measures the authorization bridge without bypassing controls', () => {
    const request = freezeAuthorizationRequest({
      authorizationId: asCardAuthorizationId('auth_d02'),
      cardId: asCardId('card_d02_virtual'),
      processorCardRef: asProcessorCardReference('sim_tok_card_d02_virtual'),
      merchantRef: asMerchantReference('mcc_d02'),
      merchantCategory: '5411',
      amount: Money.fromMinorUnits(2500n, 'USD'),
      currency: 'USD' as never,
      country: 'US',
      cardPresent: false,
      ecommerce: true,
      recurring: false,
      cashAtm: false,
      processorReference: 'pref_d02',
      requestedAt: asUtcInstant('2026-08-21T00:00:00.000Z'),
    });
    let holdCalled = false;
    const declined = runAuthorizationBridge(request, {
      validateSignature: () => true,
      normalize: (value) => value,
      evaluatePolicy: () => ({ approved: false, externalReason: 'CARD_FROZEN' }),
      decideBalanceHold: () => {
        holdCalled = true;
        return { approved: true, externalReason: 'SHOULD_NOT_APPROVE' };
      },
      mapResponse: (decision) => decision,
    });
    assert.equal(declined.decision.approved, false);
    assert.equal(declined.bypassedControls, false);
    assert.equal(holdCalled, false);
    assert.equal(declined.steps.some((step) => step.step === 'CARD_POLICY'), true);
    assert.equal(declined.totalElapsedNs >= 0n, true);
  });

  it('exposes uncertified Apple/Google wallet hooks', () => {
    const issuer = new SimulatedProductionCardIssuer();
    const issued = issuer.issueVirtualCard({
      cardId: asCardId('card_d02_wallet'),
      formFactor: 'VIRTUAL',
      programId: 'sim-us-virtual',
    });
    issuer.activateCard(issued.processorCardRef);
    const eligibility = issuer.evaluateEligibility({
      cardId: issued.processorCardRef,
      processorCardRef: issued.processorCardRef,
      walletProvider: 'GOOGLE_WALLET',
      deviceRef: 'dev_d02',
    });
    assert.equal(eligibility.eligible, true);
    assert.equal(issuer.applePayCertified, false);
    assert.equal(issuer.googlePayCertified, false);
    assert.equal(issuer.suspend({
      cardId: 'card_d02_wallet',
      processorCardRef: issued.processorCardRef,
      walletProvider: 'APPLE_WALLET',
      deviceRef: 'dev_d02',
    }).status, 'SUSPENDED');
  });

  it('refuses PAN/CVV persistence and unverified card webhooks', () => {
    const pci = refuseApplicationPanStorage();
    assert.equal(pci.persistPan, false);
    assert.equal(pci.persistCvv, false);
    const ingestor = new CardProductionWebhookIngestor();
    const refused = ingestor.ingest({
      envelope: {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'SIMULATED_CARD_PROCESSOR',
        eventType: 'card.authorization',
        timestampUtc: '2026-08-21T00:00:00.000Z',
        nonce: 'n',
        idempotencyKey: 'k',
        payloadHash: 'h',
        signatureHex: '00',
      },
      payload: { cardId: 'card_d02' },
      nowMs: Date.parse('2026-08-21T00:00:00.000Z'),
      verificationRequired: false,
    });
    assert.equal(refused.accepted, false);
    if (!refused.accepted) {
      assert.equal(refused.code, 'WEBHOOK_VERIFICATION_REQUIRED');
    }
    const secret = new SecretValue('card-hook');
    ingestor.registerProvider('SIMULATED_CARD_PROCESSOR', secret);
    const envelope = ingestor.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'SIMULATED_CARD_PROCESSOR',
        eventType: 'card.authorization',
        timestampUtc: '2026-08-21T00:00:00.000Z',
        nonce: 'n2',
        idempotencyKey: 'k2',
        payloadHash: 'h',
      },
      secret,
    );
    const accepted = ingestor.ingest({
      envelope,
      payload: { cardId: 'card_d02' },
      nowMs: Date.parse('2026-08-21T00:00:00.000Z'),
    });
    assert.equal(accepted.accepted, true);
  });

  it('blocks simulation cards from the production lifecycle', () => {
    const decision = authorizeCardAdapterInvocation({
      lifecycle: 'SIMULATED',
      requestedAs: 'PRODUCTION',
      certified: true,
      credentialBound: true,
    });
    assert.equal(decision.allowed, false);
    if (!decision.allowed) {
      assert.equal(decision.code, 'SIMULATION_CARD_NOT_PRODUCTION');
    }
    assert.equal(CARD_ADAPTER_FLAGS.productionCardIssued, false);
  });

  it('passes the card certification suite without production authorization', () => {
    const suite = runCardCertificationSuite();
    assert.equal(suite.certified, true, suite.cases.filter((row) => !row.passed).map((row) => `${row.id}:${row.detail}`).join(','));
    assert.equal(suite.productionAuthorized, false);
  });
});
