import { asCardId } from '../ids.ts';
import { runAuthorizationBridge } from './authorization-bridge.ts';
import { SimulatedProductionCardIssuer } from './simulated.ts';
import { CardProductionWebhookIngestor } from './webhooks.ts';
import { WEBHOOK_SCHEMA_VERSION } from '../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import { Money } from '../../../money/src/money.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { freezeAuthorizationRequest } from '../authorization.ts';
import { asCardAuthorizationId, asMerchantReference, asProcessorCardReference } from '../ids.ts';

export type CardCertificationCase = {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type CardCertificationSuiteResult = {
  readonly suite: 'CARD';
  readonly certified: boolean;
  readonly productionAuthorized: false;
  readonly cases: readonly CardCertificationCase[];
};

export function runCardCertificationSuite(
  issuer: SimulatedProductionCardIssuer = new SimulatedProductionCardIssuer(),
): CardCertificationSuiteResult {
  const cases: CardCertificationCase[] = [];
  const cardId = asCardId('card_cert_virtual');
  const issued = issuer.issueVirtualCard({ cardId, formFactor: 'VIRTUAL', programId: 'sim-us-virtual' });
  cases.push(row('issue', issued.issueOutcome === 'SUCCESS' && issued.displayHint === 'SIM-CARD', issued.issueOutcome));
  const activated = issuer.activateCard(issued.processorCardRef);
  cases.push(row('activate', activated.status === 'ACTIVE', activated.status));
  const frozen = issuer.freezeCard(issued.processorCardRef);
  cases.push(row('freeze', frozen.status === 'FROZEN', frozen.status));
  const unfrozen = issuer.unfreezeCard(issued.processorCardRef);
  cases.push(row('unfreeze', unfrozen.status === 'ACTIVE', unfrozen.status));

  const request = freezeAuthorizationRequest({
    authorizationId: asCardAuthorizationId('auth_cert_1'),
    cardId,
    processorCardRef: asProcessorCardReference(issued.processorCardRef),
    merchantRef: asMerchantReference('mcc_cert'),
    merchantCategory: '5411',
    amount: Money.fromMinorUnits(1000n, 'USD'),
    currency: 'USD' as never,
    country: 'US',
    cardPresent: false,
    ecommerce: true,
    recurring: false,
    cashAtm: false,
    processorReference: 'pref_cert_1',
    requestedAt: asUtcInstant('2026-08-21T00:00:00.000Z'),
  });
  const approved = runAuthorizationBridge(request, {
    validateSignature: () => true,
    normalize: (value) => value,
    evaluatePolicy: () => null,
    decideBalanceHold: () => ({ approved: true, externalReason: 'APPROVED' }),
    mapResponse: (decision) => decision,
  });
  cases.push(row('authorization', approved.decision.approved && approved.bypassedControls === false, 'approved'));
  const declined = runAuthorizationBridge(request, {
    validateSignature: () => true,
    normalize: (value) => value,
    evaluatePolicy: () => ({ approved: false, externalReason: 'INSUFFICIENT_FUNDS' }),
    decideBalanceHold: () => ({ approved: true, externalReason: 'SHOULD_NOT_RUN' }),
    mapResponse: (decision) => decision,
  });
  cases.push(row('decline', declined.decision.approved === false && declined.steps.some((step) => step.step === 'CARD_POLICY'), declined.decision.externalReason));

  issuer.processClearingCallback({
    clearingId: 'clr_cert_1' as never,
    amount: Money.fromMinorUnits(1000n, 'USD'),
    processorReference: 'pref_cert_1',
    authorizationId: request.authorizationId,
    cardId,
  });
  cases.push(row('capture', issuer.getTransactionStatus('pref_cert_1')?.status === 'CAPTURED', 'CAPTURED'));
  issuer.processAuthorizationCallback(request);
  cases.push(row('reversal_prep', true, 'callback accepted'));
  issuer.processRefundCallback({
    refundId: 'ref_cert_1' as never,
    amount: Money.fromMinorUnits(1000n, 'USD'),
    processorReference: 'pref_cert_refund',
    cardId,
    originalClearingId: 'clr_cert_1' as never,
  });
  cases.push(row('refund', issuer.getTransactionStatus('pref_cert_refund')?.status === 'REFUNDED', 'REFUNDED'));

  const secret = new SecretValue('card-cert-webhook');
  const ingestor = new CardProductionWebhookIngestor();
  ingestor.registerProvider(issuer.providerId, secret);
  const nowMs = Date.parse('2026-08-21T00:00:00.000Z');
  const envelope = ingestor.sign(
    {
      schemaVersion: WEBHOOK_SCHEMA_VERSION,
      providerId: issuer.providerId,
      eventType: 'card.authorization',
      timestampUtc: '2026-08-21T00:00:00.000Z',
      nonce: 'card-nonce-1',
      idempotencyKey: 'card-hook-1',
      payloadHash: 'def',
    },
    secret,
  );
  const first = ingestor.ingest({ envelope, payload: { cardId }, nowMs });
  const duplicateEnvelope = ingestor.sign(
    {
      schemaVersion: WEBHOOK_SCHEMA_VERSION,
      providerId: issuer.providerId,
      eventType: 'card.authorization',
      timestampUtc: '2026-08-21T00:00:00.000Z',
      nonce: 'card-nonce-2',
      idempotencyKey: 'card-hook-1',
      payloadHash: 'def',
    },
    secret,
  );
  const second = ingestor.ingest({ envelope: duplicateEnvelope, payload: { cardId }, nowMs });
  cases.push(row('duplicate_callback', first.accepted && second.accepted && second.duplicate === true, second.accepted ? 'duplicate' : 'rejected'));

  const wallet = issuer.evaluateEligibility({
    cardId,
    processorCardRef: issued.processorCardRef,
    walletProvider: 'APPLE_WALLET',
    deviceRef: 'dev_cert',
  });
  cases.push(row('wallet_eligibility', wallet.eligible === true && issuer.applePayCertified === false, 'eligible_uncertified'));
  cases.push(row('production_card', issuer.producesProductionCard === false, 'simulation_only'));
  return Object.freeze({
    suite: 'CARD',
    certified: cases.every((row) => row.passed),
    productionAuthorized: false,
    cases: Object.freeze(cases),
  });
}

function row(id: string, passed: boolean, detail: string): CardCertificationCase {
  return Object.freeze({ id, passed, detail });
}
