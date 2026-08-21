import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import { WEBHOOK_SCHEMA_VERSION } from '../../../security/src/regulated/webhook.ts';
import { SimulatedBankAdapter } from './bank/simulated.ts';
import { sealAccountIdentifier } from './bank/identifiers.ts';
import { ExternalAccountLinkageRegistry } from './bank/linkage.ts';
import { SimulatedFundingAdapter, inboundRequiresApprovedWorkflow } from './bank/funding.ts';
import { mapRailProductKind, railKindIsNotNetworkMembership, PAYMENT_RAIL_PRODUCT_KINDS } from './rails/kinds.ts';
import { neverPromoteUnknownToSettled, normalizePaymentProviderStatus } from './rails/status.ts';
import { classifySubmissionCertainty, decidePaymentResubmission } from './rails/idempotency.ts';
import { SimulatedProductionFxAdapter } from './fx/simulated.ts';
import { customerPricingRemainsSunReyOwned, verifyProviderQuoteTerms } from './fx/quote-integrity.ts';
import { asCorridorId, asQuoteId } from '../ids.ts';
import { FinancialWebhookIngestor } from './webhooks/ingest.ts';
import { snapshotFinancialReconciliation } from './reconciliation/bridge.ts';
import { SimulatedFinancialReconciliationAdapter } from './reconciliation/simulated.ts';
import { incompleteWithoutReconciliation } from './reconciliation/contract.ts';
import { advanceProviderLifecycle } from './lifecycle.ts';
import { authorizeAdapterInvocation } from './live-gate.ts';
import { FinancialProviderAdapterTemplate, TEMPLATE_CHECKLIST } from './template/skeleton.ts';
import { runBankCertificationSuite } from './certification/bank-suite.ts';
import { runPaymentCertificationSuite } from './certification/payment-suite.ts';
import { runFxCertificationSuite } from './certification/fx-suite.ts';
import { FINANCIAL_ADAPTER_FLAGS } from './types.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

describe('Phase D financial provider adapters', () => {
  it('seals bank identifiers without exposing raw values', () => {
    const iban = sealAccountIdentifier({ kind: 'IBAN', iban: 'GB00SIM000009999' });
    assert.equal(iban.rawValuePresent, false);
    assert.equal(iban.last4.length, 4);
    assert.match(iban.displayMask, /•/);
    assert.equal('iban' in iban, false);
    const routing = sealAccountIdentifier({
      kind: 'US_ROUTING_ACCOUNT',
      routingNumber: '011000015',
      accountNumber: 'SIM00099',
    });
    assert.equal(routing.kind, 'US_ROUTING_ACCOUNT');
    const sort = sealAccountIdentifier({ kind: 'UK_SORT_ACCOUNT', sortCode: '00-00-00', accountNumber: 'SIM1234' });
    assert.equal(sort.countryCode, 'GB');
  });

  it('runs bank account lifecycle on the simulation adapter', () => {
    const bank = new SimulatedBankAdapter();
    const customer = bank.createCustomerProfile({ sunreyCustomerId: 'cust_d02', jurisdiction: 'US' });
    assert.equal(customer.ok, true);
    if (!customer.ok) {
      return;
    }
    const account = bank.createAccount({
      providerCustomerId: customer.value.providerCustomerId,
      currency: asCurrencyCode('USD'),
      jurisdiction: 'US',
    });
    assert.equal(account.ok, true);
    if (!account.ok) {
      return;
    }
    assert.equal(account.value.providerBalanceIsLedgerAuthority, false);
    const balance = bank.getBalance(account.value.providerAccountId);
    assert.equal(balance.ok, true);
    if (balance.ok) {
      assert.equal(balance.value.isCustomerLedgerBalance, false);
    }
    const status = bank.getAccountStatus(account.value.providerAccountId);
    assert.equal(status.ok && status.value === 'OPEN', true);
    const closed = bank.closeOrRestrictAccount({ providerAccountId: account.value.providerAccountId, reason: 'CLOSE' });
    assert.equal(closed.ok && closed.value.status === 'CLOSED', true);
  });

  it('links SunRey, Ledger, and provider accounts without granting ledger authority', () => {
    const registry = new ExternalAccountLinkageRegistry();
    const linkage = registry.register({
      linkageId: 'link_d02',
      sunreyAccountId: 'acc_sunrey',
      ledgerAccountId: 'ledger_acc',
      providerId: 'SIMULATED_BANK_BAAS',
      externalAccountId: 'sim_bacc_1',
      currency: asCurrencyCode('USD'),
      jurisdiction: 'US',
      status: 'PENDING_VERIFICATION',
      createdAt: NOW,
      lastVerifiedAt: null,
      reconciliation: {
        lastStatementRef: null,
        lastTransactionCursor: null,
        lastReconciledAt: null,
        outstandingBreakCount: 0,
      },
      providerBalanceIsLedgerAuthority: false,
    });
    assert.equal(linkage.providerBalanceIsLedgerAuthority, false);
    const verified = registry.markVerified('link_d02', NOW);
    assert.equal(verified?.status, 'ACTIVE');
  });

  it('treats inbound funding as a notice, not an automatic credit', () => {
    const funding = new SimulatedFundingAdapter();
    const notice = funding.notifyDeposit({
      noticeId: 'fn_1',
      providerId: 'SIMULATED_BANK_BAAS',
      externalAccountId: 'sim_bacc_1',
      sunreyAccountId: 'acc_sunrey',
      amount: Money.fromMinorUnits(5000n, 'USD'),
      providerReference: 'prov_fn_1',
      receivedAt: NOW,
      authenticated: true,
    });
    assert.equal(notice.ok, true);
    if (!notice.ok) {
      return;
    }
    assert.equal(notice.value.automaticLedgerCredit, false);
    const workflow = inboundRequiresApprovedWorkflow(notice.value);
    assert.equal(workflow.creditCustomer, false);
  });

  it('maps product rail kinds without claiming network membership', () => {
    for (const kind of PAYMENT_RAIL_PRODUCT_KINDS) {
      const mapped = mapRailProductKind(kind);
      assert.equal(mapped.namedNetworkMembership, false);
      assert.equal(mapped.liveConnected, false);
      assert.equal(railKindIsNotNetworkMembership(kind), true);
    }
    assert.equal(mapRailProductKind('ACH').engineeringRailClass, 'US_BATCH');
    assert.equal(mapRailProductKind('SWIFT').engineeringRailClass, 'INTERNATIONAL_CORRESPONDENT');
    assert.equal(mapRailProductKind('SAUDI_LOCAL').engineeringRailClass, 'SA_DOMESTIC');
  });

  it('maps unknown vendor payment status to REQUIRES_RECONCILIATION', () => {
    const unknown = normalizePaymentProviderStatus('VENDOR_WEIRD_STATE');
    assert.equal(unknown.canonical, 'REQUIRES_RECONCILIATION');
    assert.equal(unknown.railStatus, 'UNKNOWN');
    assert.equal(unknown.originalProviderStatus, 'VENDOR_WEIRD_STATE');
    assert.equal(neverPromoteUnknownToSettled(unknown), true);
    const settled = normalizePaymentProviderStatus('SETTLED');
    assert.equal(settled.canonical, 'SETTLED');
  });

  it('refuses resubmission when submission status is unknown', () => {
    const certainty = classifySubmissionCertainty({
      submitted: true,
      providerAcknowledged: false,
      executionUnknown: true,
    });
    const decision = decidePaymentResubmission({ certainty, railStatus: 'SUBMISSION_UNKNOWN' });
    assert.equal(decision.allowed, false);
    assert.equal(decision.nextAction, 'QUERY');
  });

  it('verifies FX quote integrity and keeps customer pricing in SunRey', () => {
    const fx = new SimulatedProductionFxAdapter(new FrozenClock(NOW));
    const quote = fx.getQuote({
      quoteId: asQuoteId('quote_d02'),
      baseCurrency: 'USD' as never,
      quoteCurrency: 'SAR' as never,
      sourceAmount: Money.fromMinorUnits(10_000n, 'USD'),
      corridorId: asCorridorId('US-SA-USD-SAR'),
      legalEntityId: 'le_solstice_us_inc' as never,
      now: NOW,
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const integrity = verifyProviderQuoteTerms(quote.value, {
      providerQuoteId: quote.value.quoteId,
      rate: { numerator: quote.value.providerRate.numerator, denominator: quote.value.providerRate.denominator },
      sourceAmount: quote.value.sourceAmount,
      destinationAmount: quote.value.destinationAmount,
      baseCurrency: quote.value.baseCurrency,
      quoteCurrency: quote.value.quoteCurrency,
      expiresAt: quote.value.expiresAt,
      feeMinor: quote.value.fee.minorUnits,
      executionRef: 'fxtr_d02',
    });
    assert.equal(integrity.ok, true);
    assert.equal(customerPricingRemainsSunReyOwned(fx.pricingMode, fx.canRedefineCustomerPricing), true);
    const mismatch = verifyProviderQuoteTerms(quote.value, {
      providerQuoteId: quote.value.quoteId,
      rate: { numerator: 1n, denominator: 1n },
      sourceAmount: quote.value.sourceAmount,
      destinationAmount: quote.value.destinationAmount,
      baseCurrency: quote.value.baseCurrency,
      quoteCurrency: quote.value.quoteCurrency,
      expiresAt: quote.value.expiresAt,
      feeMinor: quote.value.fee.minorUnits,
      executionRef: null,
    });
    assert.equal(mismatch.ok, false);
  });

  it('rejects unverified webhooks and accepts verified duplicates once', () => {
    const ingestor = new FinancialWebhookIngestor();
    const secret = new SecretValue('hook-secret-d02');
    ingestor.registerProvider('SIMULATED_PROVIDER_US_BATCH', secret);
    const unverified = ingestor.ingest({
      envelope: {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'SIMULATED_PROVIDER_US_BATCH',
        eventType: 'payment.settled',
        timestampUtc: NOW,
        nonce: 'n1',
        idempotencyKey: 'k1',
        payloadHash: 'h',
        signatureHex: '00',
      },
      payload: {},
      nowMs: Date.parse(NOW),
      verificationRequired: false,
    });
    assert.equal(unverified.accepted, false);
    if (!unverified.accepted) {
      assert.equal(unverified.code, 'WEBHOOK_VERIFICATION_REQUIRED');
    }
    const envelope = ingestor.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'SIMULATED_PROVIDER_US_BATCH',
        eventType: 'payment.settled',
        timestampUtc: NOW,
        nonce: 'n2',
        idempotencyKey: 'k2',
        payloadHash: 'h',
      },
      secret,
    );
    const first = ingestor.ingest({ envelope, payload: { paymentId: 'pay_1' }, nowMs: Date.parse(NOW) });
    const second = ingestor.ingest({ envelope, payload: { paymentId: 'pay_1' }, nowMs: Date.parse(NOW) });
    assert.equal(first.accepted, true);
    assert.equal(second.accepted && second.duplicate, true);
  });

  it('requires reconciliation before a provider integration is complete', () => {
    assert.equal(incompleteWithoutReconciliation({ canSubmit: true, canReconcile: false }).integrationComplete, false);
    const port = new SimulatedFinancialReconciliationAdapter('SIMULATED_BANK_BAAS', { balanceMinor: 100n });
    const snapshot = snapshotFinancialReconciliation(port, {
      provider: 'SIMULATED_BANK_BAAS',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T00:00:00.000Z',
      sourceVersion: 'phase-d-02',
    });
    assert.equal(snapshot.providerBalanceIsLedgerAuthority, false);
    assert.equal(snapshot.balance?.isCustomerLedgerBalance, false);
  });

  it('blocks uncertified adapters and missing credentials from production', () => {
    const uncertified = advanceProviderLifecycle({
      from: 'PREPRODUCTION',
      to: 'LIMITED_LIVE',
      certified: false,
      credentialBound: true,
      webhookVerificationConfigured: true,
      productionAuthorized: false,
    });
    assert.equal(uncertified.ok, false);
    if (!uncertified.ok) {
      assert.equal(uncertified.code, 'UNCERTIFIED_ADAPTER');
    }
    const sandboxBank = authorizeAdapterInvocation({
      providerId: 'sandbox-bank',
      domain: 'BANK_BAAS',
      lifecycle: 'SANDBOX',
      requestedAs: 'PRODUCTION',
      certified: true,
      credentialRef: secretRef('simulation', 'bank/sandbox'),
      webhookVerificationRef: secretRef('simulation', 'bank/sandbox-hook'),
    });
    assert.equal(sandboxBank.allowed, false);
    if (!sandboxBank.allowed) {
      assert.equal(sandboxBank.code, 'SANDBOX_BANK_NOT_PRODUCTION');
    }
    const sandboxFx = authorizeAdapterInvocation({
      providerId: 'sandbox-fx',
      domain: 'FX_LIQUIDITY',
      lifecycle: 'SANDBOX',
      requestedAs: 'PRODUCTION',
      certified: true,
      credentialRef: secretRef('simulation', 'fx/sandbox'),
      webhookVerificationRef: secretRef('simulation', 'fx/sandbox-hook'),
    });
    assert.equal(sandboxFx.allowed, false);
    if (!sandboxFx.allowed) {
      assert.equal(sandboxFx.code, 'SANDBOX_FX_NOT_PRODUCTION');
    }
    const missingCred = authorizeAdapterInvocation({
      providerId: 'sim-bank',
      domain: 'BANK_BAAS',
      lifecycle: 'SIMULATED',
      requestedAs: 'SIMULATED',
      certified: false,
      credentialRef: null,
      webhookVerificationRef: secretRef('simulation', 'bank/hook'),
    });
    assert.equal(missingCred.allowed, false);
    if (!missingCred.allowed) {
      assert.equal(missingCred.code, 'MISSING_CREDENTIAL_REFERENCE');
    }
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(FINANCIAL_ADAPTER_FLAGS.productionAuthorized, false);
  });

  it('exposes an integration template with placeholders', () => {
    const template = new FinancialProviderAdapterTemplate({
      providerId: 'NEW_BANK_TEMPLATE',
      lifecycle: 'SANDBOX',
      credentialRef: null,
      webhookVerificationRef: null,
      capabilities: {
        createCustomer: false,
        updateCustomer: false,
        createAccount: false,
        getAccount: false,
        getBalance: false,
        getTransactions: false,
        getStatement: false,
        closeOrRestrict: false,
        getAccountStatus: false,
      },
    });
    const missing = template.missingCredential();
    assert.equal(missing.ok, false);
    assert.equal(TEMPLATE_CHECKLIST.includes('reconciliation'), true);
    assert.equal(template.canPostLedger, false);
  });

  it('passes bank, payment, and FX certification suites without authorizing production', () => {
    const bank = runBankCertificationSuite();
    assert.equal(bank.certified, true, bank.cases.filter((row) => !row.passed).map((row) => row.id).join(','));
    assert.equal(bank.productionAuthorized, false);
    const payment = runPaymentCertificationSuite();
    assert.equal(payment.certified, true, payment.cases.filter((row) => !row.passed).map((row) => `${row.id}:${row.detail}`).join(','));
    const fx = runFxCertificationSuite();
    assert.equal(fx.certified, true, fx.cases.filter((row) => !row.passed).map((row) => `${row.id}:${row.detail}`).join(','));
  });
});
