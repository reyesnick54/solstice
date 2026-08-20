/**
 * demo:sunrey-banking-payment-provider-candidate
 *
 * USD sender → fixture banking → fixture FX USD/SAR → fixture
 * international rail → SUBMITTED → callback → SETTLED → reconcile.
 *
 * Also demonstrates SUBMISSION_UNKNOWN → query → confirmed result.
 *
 * Fake transport only. No real bank, rail, or FX provider.
 */

import { LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { Money } from '../../../money/src/money.ts';
import { InMemorySecretProvider } from '../../../security/src/secrets.ts';
import { asBeneficiaryId, asPaymentId } from '../ids.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from '../rail-submission.ts';
import { CandidateProviderAuthenticator, candidateAuthConfig } from './auth.ts';
import { CandidateRailAdapter } from './adapter.ts';
import { CandidateWebhookIngestor, payloadDigestOf } from './webhook.ts';
import { ScriptedSandboxTransport } from './transport.ts';
import { normalizeProviderSettlementReport } from './settlement.ts';
import { reconcileCandidatePayment } from './reconciliation.ts';
import {
  fixtureBankUs,
  fixtureFxUsdSar,
  fixtureInternationalCapability,
  fixtureRailInternational,
  fixtureUsdSarQuote,
  FIXTURE_NOW,
} from './fixtures.ts';
import { internationalUsdToSarPlan, productionCandidatePosture } from './conformance.ts';
import { parseExactProviderRate } from './fx-profile.ts';

const NOW = FIXTURE_NOW;

function line(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function runBankingPaymentProviderCandidateDemo(): void {
  const secrets = new InMemorySecretProvider('simulation', {
    'payments/fixture-rail-international': 'fixture-rail-key',
    'rail-webhook/fixture-rail-international': 'fixture-webhook-key',
  });
  const authenticator = new CandidateProviderAuthenticator(secrets);
  const rail = fixtureRailInternational();
  const auth = candidateAuthConfig({
    provider: fixtureInternationalCapability().provider,
    mechanism: 'API_KEY',
    credentialRef: rail.credentialDescriptorRef.secretRef,
    webhookSignatureRef: rail.credentialDescriptorRef.secretRef,
    credentialDescriptorRef: rail.credentialDescriptorRef,
  });
  const transport = new ScriptedSandboxTransport();
  const adapter = new CandidateRailAdapter({
    capability: fixtureInternationalCapability(),
    profile: rail,
    transport,
    authenticator,
    auth,
  });

  const paymentId = asPaymentId('pay_fixture_usd_sar');
  const command = {
    authorityId: 'ea_fixture_ref_only',
    actionType: 'INITIATE_PAYMENT' as const,
    submission: createRailSubmission(
      {
        paymentId,
        provider: adapter.capability.provider,
        rail: adapter.capability.rail,
        amount: Money.fromMinorUnits(374_500n, 'SAR'),
        currency: 'SAR' as never,
        sourceReference: 'src_fixture_us',
        destinationReference: 'dst_fixture_sa',
        beneficiaryReference: asBeneficiaryId('ben_fixture'),
        purposeReference: 'fixture-cross-border',
        idempotencyKey: providerIdempotencyKeyFor(paymentId, 'idem_fixture_1'),
        correlationId: 'idem_fixture_1',
        requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
      },
      NOW,
    ),
  };

  const banking = fixtureBankUs();
  const fx = fixtureFxUsdSar();
  const quote = fixtureUsdSarQuote();
  const parsed = parseExactProviderRate('3.745');
  const plan = internationalUsdToSarPlan({ banking, rail, quote, now: NOW });

  transport.script(command.submission.idempotencyKey, 'ACCEPTED');
  const submitted = adapter.submitPayment(command);

  const configs = new Map([[adapter.capability.provider, auth]]);
  const webhooks = new CandidateWebhookIngestor(authenticator, configs, () => NOW);
  const payloadDigest = payloadDigestOf(['SETTLED', paymentId]);
  const callback = webhooks.sign(auth, {
    provider: adapter.capability.provider,
    timestamp: NOW,
    schemaVersion: 1,
    providerEventId: 'evt_fixture_settled',
    paymentId,
    railSubmissionId: command.submission.railSubmissionId,
    providerStatus: 'SETTLED',
    payloadHash: payloadDigest,
    nonce: 'nonce_fixture_1',
    providerIdentity: adapter.capability.provider,
    payloadDigest,
  });
  const ingested = webhooks.ingest(callback);
  if (ingested.outcome === 'ACCEPTED') {
    adapter.applyStatusUpdate(ingested.update);
  }

  const report = normalizeProviderSettlementReport(
    adapter.capability.provider,
    {
      providerSettlementDate: '2026-08-20',
      currency: 'SAR',
      grossAmountMinorUnits: '374500',
      feeMinorUnits: '0',
      transactionRefs: [paymentId],
      providerSettlementRef: 'sref_pay_fixture_usd_sar',
      paymentId,
    },
    NOW,
  );

  const recon = reconcileCandidatePayment({
    payment: null,
    submission: { ...command.submission, status: 'SETTLED' },
    journals: [],
    report: report.report,
  });

  const unknownTransport = new ScriptedSandboxTransport();
  unknownTransport.script('unknown_key', 'TIMEOUT_AFTER_UNKNOWN');
  const unknownAdapter = new CandidateRailAdapter({
    capability: fixtureInternationalCapability(),
    profile: rail,
    transport: unknownTransport,
    authenticator,
    auth,
  });
  const unknownCommand = {
    ...command,
    submission: createRailSubmission(
      {
        ...command.submission,
        paymentId: asPaymentId('pay_fixture_unknown'),
        idempotencyKey: providerIdempotencyKeyFor('pay_fixture_unknown', 'unknown_key'),
        correlationId: 'unknown_key',
      },
      NOW,
    ),
  };
  const unknownSubmit = unknownAdapter.submitPayment(unknownCommand);
  const queried = unknownAdapter.queryPayment({
    paymentId: unknownCommand.submission.paymentId,
    idempotencyKey: unknownCommand.submission.idempotencyKey,
    providerPaymentId: null,
  });

  const posture = productionCandidatePosture();

  line('SunRey banking / payment / FX provider candidates (Chunk 151)');
  line(`bankingProvider=${banking.providerId}`);
  line(`fxProvider=${fx.providerId}`);
  line(`railProvider=${rail.providerId}`);
  line(`sender=USD recipient=SAR quote=${parsed.ok ? `${parsed.rate.numerator}/${parsed.rate.denominator}` : parsed.reason}`);
  line(`internationalPlan=${'ok' in plan ? plan.reason : `${plan.senderCurrency}->${plan.recipientCurrency}`}`);
  line(`submitStatus=${submitted.status}`);
  line(`callback=${ingested.outcome} postsJournal=${ingested.postsJournal}`);
  line(`canonicalStatus=${ingested.outcome === 'ACCEPTED' ? ingested.update.status : ingested.code}`);
  line(`reconciliation=${recon.outcome} autoAdjusted=${recon.autoAdjustedLedger}`);
  line(`SUBMISSION_UNKNOWN=${unknownSubmit.status}`);
  line(`queryAfterUnknown=${queried.found ? queried.status : 'NOT_FOUND'}`);
  line(`REAL_BANK_CONNECTED=${posture.realBankConnected}`);
  line(`REAL_PAYMENT_NETWORK_CONNECTED=${posture.realPaymentNetworkConnected}`);
  line(`REAL_FX_PROVIDER_CONNECTED=${posture.realFxProviderConnected}`);
  line(`NETWORK_MEMBERSHIP_CLAIMED=${posture.networkMembershipClaimed}`);
  line(`PROVIDER_BALANCE_IS_LEDGER_BALANCE=${posture.providerBalanceIsLedgerBalance}`);
  line(`ADAPTER_CAN_POST_LEDGER=${adapter.canPostLedger}`);
  line(`LIVE_PAYMENTS_ENABLED=${LIVE_PAYMENTS_ENABLED}`);
  line(`LIVE_BANKING_RAILS=${LIVE_BANKING_RAILS}`);
  line(`PRODUCTION_ACTIVE=${posture.productionActive}`);
}

runBankingPaymentProviderCandidateDemo();
