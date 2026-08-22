import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { SimulationFxProvider } from '../packages/payments/src/fx-provider.ts';
import { createCustodyProviderA } from '../packages/custody/src/provider-candidate/sandbox.ts';
import { ingestCustodyWebhook, resetCustodyWebhooks } from '../packages/custody/src/provider-candidate/webhook-events.ts';
import { signFixtureCallback } from '../packages/custody/src/provider-candidate/callbacks.ts';
import { FakeIdentityTransport } from '../packages/identity/src/provider-candidate/transport.ts';
import { FixturePersonVerificationProvider } from '../packages/identity/src/provider-candidate/person.ts';
import { FakeComplianceTransport } from '../packages/kernel/src/compliance/provider-candidate/transport.ts';
import { FixtureSanctionsProvider } from '../packages/kernel/src/compliance/provider-candidate/sanctions.ts';
import { createMarketQuoteSourceA } from '../packages/sunrey-exchange/src/market-data/sandbox.ts';
import { createOracleProviderA } from '../packages/sunrey-chain/src/oracle/production/productization.ts';
import { runProviderPreflight } from '../scripts/phase-d-provider-harness.ts';
import { CandidateRailAdapter } from '../packages/payments/src/production-candidate/adapter.ts';
import { CandidateProviderAuthenticator, candidateAuthConfig } from '../packages/payments/src/production-candidate/auth.ts';
import { fixtureInternationalCapability, fixtureRailInternational } from '../packages/payments/src/production-candidate/fixtures.ts';
import { ScriptedSandboxTransport } from '../packages/payments/src/production-candidate/transport.ts';
import { InMemorySecretProvider, secretRef } from '../packages/security/src/secrets.ts';
import { asPaymentId } from '../packages/payments/src/ids.ts';
import { asBeneficiaryId } from '../packages/payments/src/ids.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from '../packages/payments/src/rail-submission.ts';
import { Money } from '../packages/money/src/money.ts';

describe('Phase D controlled failure scenarios', () => {
  it('fails closed for unavailable bank, unknown payment, FX timeout, and KYC/sanctions down', () => {
    const transport = new ScriptedSandboxTransport();
    transport.script('fixture-rail-international', 'OUTAGE');
    const secrets = new InMemorySecretProvider('simulation', { 'payments/fixture-rail-international': 'rail-key' });
    const profile = fixtureRailInternational();
    const adapter = new CandidateRailAdapter({
      capability: fixtureInternationalCapability(),
      profile,
      transport,
      authenticator: new CandidateProviderAuthenticator(secrets),
      auth: candidateAuthConfig({
        provider: fixtureInternationalCapability().provider,
        mechanism: 'API_KEY',
        credentialRef: secretRef('simulation', 'payments/fixture-rail-international'),
        webhookSignatureRef: secretRef('simulation', 'payments/fixture-rail-international'),
        credentialDescriptorRef: profile.credentialDescriptorRef,
      }),
    });
    const submission = createRailSubmission(
      {
        paymentId: asPaymentId('pay_down'),
        provider: adapter.capability.provider,
        rail: adapter.capability.rail,
        amount: Money.fromMinorUnits(1n, 'USD'),
        currency: 'USD' as never,
        sourceReference: 'src',
        destinationReference: 'dst',
        beneficiaryReference: asBeneficiaryId('ben_sim'),
        purposeReference: 'sandbox',
        idempotencyKey: providerIdempotencyKeyFor('pay_down', 'k'),
        correlationId: 'k',
        requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
      },
      asUtcInstant('2026-08-21T16:00:00.000Z'),
    );
    const submitted = adapter.submitPayment({
      authorityId: 'ea',
      actionType: 'INITIATE_PAYMENT',
      submission,
    });
    assert.notEqual(submitted.status, 'SETTLED');

    transport.script('unknown_key', 'TIMEOUT_AFTER_UNKNOWN');
    const fx = new SimulationFxProvider(new FrozenClock(asUtcInstant('2026-08-21T16:00:00.000Z')));
    fx.setMode('PROVIDER_UNAVAILABLE');
    const rate = fx.getReferenceRate({
      baseCurrency: 'USD',
      quoteCurrency: 'SAR',
      at: asUtcInstant('2026-08-21T16:00:00.000Z'),
    });
    assert.equal(rate.ok, false);

    const kycTransport = new FakeIdentityTransport();
    kycTransport.setScenario('cust_down', 'unavailable');
    const kyc = new FixturePersonVerificationProvider(kycTransport).verifyPerson(
      'cust_down',
      asUtcInstant('2026-08-21T16:00:00.000Z'),
    );
    assert.notEqual(kyc.outcome, 'VERIFIED');

    const sanctionsTransport = new FakeComplianceTransport();
    sanctionsTransport.setScenario('subj_down', 'unavailable');
    const sanctions = new FixtureSanctionsProvider(sanctionsTransport).screen({
      subjectKind: 'PERSON',
      subjectRef: 'subj_down',
      jurisdiction: 'US',
      now: asUtcInstant('2026-08-21T16:00:00.000Z'),
    });
    assert.equal(sanctions.available, false);
    assert.equal(sanctions.outcome, 'UNAVAILABLE');
  });

  it('fails closed for custody down, stale market data, invalid oracle, webhook replay, and uncertified production', () => {
    const custody = createCustodyProviderA();
    custody.setScenario('unavailable');
    assert.equal(custody.createVault({ vaultId: 'v', label: 'x' }).ok, false);
    custody.setScenario('wrong_environment');
    assert.equal(custody.createWallet({ vaultId: 'v', walletId: 'w', assetId: 'SUNREY_COIN', network: 'sim' }).ok, false);

    const market = createMarketQuoteSourceA();
    market.setScenario('stale');
    const stale = market.getSpotPrice('SUNREY_COIN/USD', '2026-08-21T16:00:00.000Z');
    assert.equal(stale.ok, true);
    if (!stale.ok) throw new Error('stale');
    assert.equal(stale.value.quality, 'STALE');

    const oracle = createOracleProviderA();
    oracle.setScenario('invalid_signature');
    assert.equal(oracle.observe('energy', '2026-08-21T16:00:00.000Z').ok, false);

    resetCustodyWebhooks();
    const material = 'wh';
    const callback = {
      callbackId: 'cb',
      kind: 'DEPOSIT' as const,
      assetId: 'SUNREY_COIN' as const,
      quantity: 1n,
      destination: 'addr',
      transactionRef: 'tx',
      material,
      signatureHex: signFixtureCallback(material, 'secret'),
    };
    const first = ingestCustodyWebhook({
      eventId: 'wh_replay',
      kind: 'deposit',
      providerId: 'fixture',
      callback,
      hmacSecret: 'secret',
    });
    const replay = ingestCustodyWebhook({
      eventId: 'wh_replay',
      kind: 'deposit',
      providerId: 'fixture',
      callback,
      hmacSecret: 'secret',
    });
    assert.equal(first.ok, true);
    assert.equal(replay.ok, false);

    const preflight = runProviderPreflight({
      paymentsEnabledForProduction: true,
      certifiedProductionPaymentProvider: false,
      fxExecutionEnabled: true,
      fxExecuteCapability: false,
      custodyWithdrawalsEnabled: true,
      travelRuleAvailable: false,
      uncertifiedProviderSelectedForProduction: true,
    });
    assert.ok(preflight.some((row) => row.code === 'PAYMENT_PRODUCTION_UNCERTIFIED'));
    assert.ok(preflight.some((row) => row.code === 'FX_EXECUTE_MISSING'));
    assert.ok(preflight.some((row) => row.code === 'CUSTODY_TRAVEL_RULE_UNAVAILABLE'));
    assert.ok(preflight.some((row) => row.code === 'UNCERTIFIED_PRODUCTION_PROVIDER'));
    assert.ok(preflight.every((row) => row.severity === 'FAIL_CLOSED'));
  });
});
