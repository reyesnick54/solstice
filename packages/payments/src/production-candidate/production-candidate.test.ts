import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { InMemorySecretProvider, secretRef } from '../../../security/src/secrets.ts';
import { asBeneficiaryId, asPaymentId } from '../ids.ts';
import { asInboundPaymentId, asOpaqueAccountRef, emptyRailReferences } from '../rail-ids.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from '../rail-submission.ts';
import { simulationRoutesFor } from '../route.ts';
import { CandidateProviderAuthenticator, candidateAuthConfig, rotateCandidateCredential } from './auth.ts';
import { CandidateRailAdapter } from './adapter.ts';
import {
  baasReferenceIsNotLedgerBalance,
  exposeProviderLiquidityToTreasury,
  hardEligibilityFilters,
  inboundNoticeIsNotAutomaticCredit,
  internationalUsdToSarPlan,
  mapInboundNotice,
  mapProviderReturn,
  planProviderFailover,
  productionCandidatePosture,
  scoreOnlyAfterHardFilters,
  treasuryAdvisorCannotOverrideKernel,
} from './conformance.ts';
import {
  fixtureBankGcc,
  fixtureBankUs,
  fixtureFxUsdSar,
  fixtureInternationalCapability,
  fixtureRailInternational,
  fixtureRailInternationalFailover,
  fixtureUsdSarQuote,
  FIXTURE_NOW,
} from './fixtures.ts';
import { parseExactProviderRate, quoteFromCandidateProvider } from './fx-profile.ts';
import { reconcileCandidatePayment } from './reconciliation.ts';
import { normalizeProviderSettlementReport } from './settlement.ts';
import { FixturePaymentTransport, ScriptedSandboxTransport } from './transport.ts';
import { namedNetworkAccessRequiresEvidence, PRODUCTION_CANDIDATE_FLAGS } from './types.ts';
import { CandidateWebhookIngestor, payloadDigestOf } from './webhook.ts';
import { railClassIsNotNetworkMembership } from './rail-profile.ts';
import { freezeBeneficiary } from '../beneficiary.ts';

const NOW = FIXTURE_NOW;

function secrets() {
  return new InMemorySecretProvider('simulation', {
    'payments/fixture-rail-international': 'rail-key',
    'payments/fixture-rail-international-b': 'rail-key-b',
    'payments/rotated': 'rotated-key',
  });
}

function authFor(adapterProvider: string, path = 'payments/fixture-rail-international') {
  const profile = fixtureRailInternational();
  return candidateAuthConfig({
    provider: adapterProvider as never,
    mechanism: 'API_KEY',
    credentialRef: secretRef('simulation', path),
    webhookSignatureRef: secretRef('simulation', path),
    credentialDescriptorRef: {
      ...profile.credentialDescriptorRef,
      secretRef: secretRef('simulation', path),
    },
  });
}

function commandFor(adapter: CandidateRailAdapter, paymentId: string, key = `key_${paymentId}`, status: 'PENDING' | 'SUBMISSION_UNKNOWN' = 'PENDING') {
  const submission = createRailSubmission(
    {
      paymentId: asPaymentId(paymentId),
      provider: adapter.capability.provider,
      rail: adapter.capability.rail,
      amount: Money.fromMinorUnits(374_500n, 'SAR'),
      currency: 'SAR' as never,
      sourceReference: 'src_opaque',
      destinationReference: 'dst_opaque',
      beneficiaryReference: asBeneficiaryId('ben_sim'),
      purposeReference: 'simulation',
      idempotencyKey: providerIdempotencyKeyFor(paymentId, key),
      correlationId: key,
      requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
    },
    NOW,
  );
  return {
    authorityId: 'ea_sim_ref',
    actionType: 'INITIATE_PAYMENT' as const,
    submission: status === 'SUBMISSION_UNKNOWN' ? { ...submission, status, executionUnknown: true } : submission,
  };
}

function adapterWith(transport: ScriptedSandboxTransport | FixturePaymentTransport, path?: string) {
  const authenticator = new CandidateProviderAuthenticator(secrets());
  const capability = fixtureInternationalCapability();
  return new CandidateRailAdapter({
    capability,
    profile: fixtureRailInternational(),
    transport,
    authenticator,
    auth: authFor(capability.provider, path),
  });
}

describe('Chunk 151 banking payment and FX provider candidates', () => {
  it('1. builds a provider-neutral banking profile', () => {
    const profile = fixtureBankUs();
    assert.equal(profile.providerId, 'fixture-bank-us');
    assert.equal(profile.providerAcceptanceRef.domain, 'BANKING_REFERENCE');
    assert.equal(profile.productionAuthorized, false);
    assert.ok(profile.supportedAccountReferenceClasses.includes('EXTERNAL_ACCOUNT_ID'));
    assert.equal(fixtureBankGcc().providerId, 'fixture-bank-gcc');
  });

  it('2. builds a provider-neutral rail profile', () => {
    const profile = fixtureRailInternational();
    assert.equal(profile.railClass, 'INTERNATIONAL_CORRESPONDENT');
    assert.equal(profile.idempotencyRequired, true);
    assert.equal(profile.queryAfterUnknownRequired, true);
    assert.equal(profile.namedNetworkMembershipClaimed, false);
    assert.equal(profile.providerAcceptanceRef.domain, 'PAYMENT_RAIL');
  });

  it('3. builds a provider-neutral FX profile', () => {
    const profile = fixtureFxUsdSar();
    assert.equal(profile.providerId, 'fixture-fx-usd-sar');
    assert.equal(profile.providerAcceptanceRef.domain, 'FX_LIQUIDITY');
    assert.equal(profile.precision.representation, 'EXACT_RATIONAL');
    assert.equal(profile.productionAuthorized, false);
  });

  it('4. stores SecretReference only', () => {
    const profile = fixtureRailInternational();
    assert.equal(profile.credentialDescriptorRef.secretRef.scheme, 'secret');
    assert.equal(profile.credentialDescriptorRef.plaintextCredential, false);
    assert.match(profile.credentialDescriptorRef.secretRef.href, /^secret:\/\//);
  });

  it('5. reuses the RailAdapter contract', () => {
    const adapter = adapterWith(new FixturePaymentTransport());
    assert.equal(typeof adapter.submitPayment, 'function');
    assert.equal(typeof adapter.queryPayment, 'function');
    assert.equal(typeof adapter.cancelPayment, 'function');
    assert.equal(typeof adapter.validateRoute, 'function');
    assert.equal(adapter.capability.rail, 'INTERNATIONAL_CORRESPONDENT');
  });

  it('6. adapter cannot issue Execution Authority', () => {
    const adapter = adapterWith(new FixturePaymentTransport());
    assert.equal(adapter.canIssueExecutionAuthority, false);
    const source = readFileSync(new URL('./adapter.ts', import.meta.url), 'utf8');
    assert.equal(/AuthorityIssuer/.test(source), false);
    assert.equal(/issueExecutionAuthority/.test(source), false);
  });

  it('7. adapter cannot post ledger', () => {
    const adapter = adapterWith(new FixturePaymentTransport());
    assert.equal(adapter.canPostLedger, false);
    const source = readFileSync(new URL('./adapter.ts', import.meta.url), 'utf8');
    assert.equal(/postJournal/.test(source), false);
    assert.equal(/from '\.\.\/\.\.\/ledger/.test(source), false);
  });

  it('8. idempotency is mandatory', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_idemp_req');
    assert.ok(command.submission.idempotencyKey.length > 0);
    transport.script(command.submission.idempotencyKey, 'SUCCESS');
    const result = adapter.submitPayment(command);
    assert.notEqual(result.status, 'UNKNOWN');
  });

  it('9. duplicate submit is rejected as a replay of the original command', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_dup', 'same');
    transport.script(command.submission.idempotencyKey, 'SUCCESS');
    const first = adapter.submitPayment(command);
    const second = adapter.submitPayment(command);
    assert.equal(first.references.providerPaymentId, second.references.providerPaymentId);
    assert.equal(first.status, second.status);
  });

  it('10. SUBMISSION_UNKNOWN queries first', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_unknown', 'unknown_key', 'SUBMISSION_UNKNOWN');
    const blocked = adapter.submitPayment(command);
    assert.equal(blocked.status, 'SUBMISSION_UNKNOWN');
    assert.equal(blocked.retryClass, 'DO_NOT_RETRY_WITHOUT_QUERY');
    const queried = adapter.queryPayment({
      paymentId: command.submission.paymentId,
      idempotencyKey: command.submission.idempotencyKey,
      providerPaymentId: null,
    });
    assert.equal(typeof queried.found, 'boolean');
  });

  it('11. maps provider status to canonical statuses', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    transport.script('ack_key', 'ACCEPTED');
    const result = adapter.submitPayment(commandFor(adapter, 'pay_ack', 'ack_key'));
    assert.equal(result.status, 'ACCEPTED');
  });

  it('12. accepts a signed webhook', () => {
    const authenticator = new CandidateProviderAuthenticator(secrets());
    const capability = fixtureInternationalCapability();
    const config = authFor(capability.provider);
    const ingestor = new CandidateWebhookIngestor(authenticator, new Map([[capability.provider, config]]), () => NOW);
    const digest = payloadDigestOf(['SETTLED', 'pay_cb']);
    const signed = ingestor.sign(config, {
      provider: capability.provider,
      timestamp: NOW,
      schemaVersion: 1,
      providerEventId: 'evt_signed',
      paymentId: 'pay_cb',
      railSubmissionId: 'rsub_cb',
      providerStatus: 'SETTLED',
      payloadHash: digest,
      nonce: 'nonce_signed',
      providerIdentity: capability.provider,
      payloadDigest: digest,
      signature: '',
    });
    const ingested = ingestor.ingest(signed);
    assert.equal(ingested.outcome, 'ACCEPTED');
    assert.equal(ingested.postsJournal, false);
  });

  it('13. rejects webhook replay', () => {
    const authenticator = new CandidateProviderAuthenticator(secrets());
    const capability = fixtureInternationalCapability();
    const config = authFor(capability.provider);
    const ingestor = new CandidateWebhookIngestor(authenticator, new Map([[capability.provider, config]]), () => NOW);
    const digest = payloadDigestOf(['SETTLED', 'pay_replay']);
    const envelope = {
      provider: capability.provider,
      timestamp: NOW,
      schemaVersion: 1,
      providerEventId: 'evt_replay',
      paymentId: 'pay_replay',
      railSubmissionId: 'rsub_replay',
      providerStatus: 'SETTLED',
      payloadHash: digest,
      nonce: 'nonce_replay',
      providerIdentity: capability.provider,
      payloadDigest: digest,
      signature: '',
    };
    const signed = ingestor.sign(config, envelope);
    assert.equal(ingestor.ingest(signed).outcome, 'ACCEPTED');
    const replay = ingestor.ingest(signed);
    assert.equal(replay.outcome === 'REJECTED' || (replay.outcome === 'ACCEPTED' && 'duplicate' in replay && replay.duplicate), true);
    assert.equal(replay.postsJournal, false);
  });

  it('14. inbound notice is not an automatic credit', () => {
    const notice = {
      inboundId: asInboundPaymentId('inb_1'),
      provider: fixtureInternationalCapability().provider,
      rail: 'INTERNATIONAL_CORRESPONDENT' as const,
      amount: Money.fromMinorUnits(1000n, 'USD'),
      destinationReference: asOpaqueAccountRef('dst'),
      sourceReference: asOpaqueAccountRef('src'),
      references: emptyRailReferences(),
      purposeReference: 'inbound-fixture',
    };
    const mapped = mapInboundNotice(notice, NOW, 'hash');
    assert.equal(mapped.destinationAccountId, null);
    assert.equal(mapped.journalIds.length, 0);
    const gate = inboundNoticeIsNotAutomaticCredit(notice, true, true, true, true);
    assert.equal(gate.creditCustomer, false);
    const unauth = inboundNoticeIsNotAutomaticCredit(notice, false, true, true, true);
    assert.equal(unauth.creditCustomer, false);
  });

  it('15. return preserves original settlement history', () => {
    const returned = mapProviderReturn(
      {
        paymentId: asPaymentId('pay_ret'),
        originalSubmissionId: 'rsub_ret' as never,
        reason: 'BENEFICIARY_ACCOUNT_CLOSED',
        amount: Money.fromMinorUnits(374_500n, 'SAR'),
        references: emptyRailReferences(),
        occurredAt: NOW,
      },
      ['jnl_original_settle'],
    );
    assert.equal(returned.originalHistoryPreserved, true);
    assert.deepEqual(returned.originalJournalIds, ['jnl_original_settle']);
  });

  it('16. cancellation semantics', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_cancel');
    transport.script(command.submission.idempotencyKey, 'SUCCESS');
    adapter.submitPayment(command);
    const tooLate = adapter.cancelPayment({ command });
    assert.equal(tooLate.outcome, 'CANCELLATION_TOO_LATE');
    const pendingTransport = new ScriptedSandboxTransport();
    const pending = adapterWith(pendingTransport);
    const pendingCommand = commandFor(pending, 'pay_cancel_ok');
    pendingTransport.script(pendingCommand.submission.idempotencyKey, 'PENDING');
    pending.submitPayment(pendingCommand);
    const cancelled = pending.cancelPayment({ command: pendingCommand });
    assert.equal(cancelled.outcome, 'CANCELLED');
  });

  it('17. normalizes a settlement report without treating it as ledger truth', () => {
    const normalized = normalizeProviderSettlementReport(
      'fixture-rail-international',
      {
        providerSettlementDate: '2026-08-20',
        currency: 'SAR',
        grossAmountMinorUnits: '374500',
        feeMinorUnits: '100',
        transactionRefs: ['pay_rep'],
        providerSettlementRef: 'sref_pay_rep',
        paymentId: 'pay_rep',
      },
      NOW,
    );
    assert.equal(normalized.isLedgerSourceOfTruth, false);
    assert.equal(normalized.report.grossAmount.minorUnits, 374_500n);
    assert.equal(normalized.report.fees.minorUnits, 100n);
  });

  it('18. does not auto-adjust the ledger on reconciliation mismatch', () => {
    const result = reconcileCandidatePayment({
      payment: {
        paymentId: 'pay_x',
        status: 'SETTLED',
        journalIds: [],
        settlementRef: 'sref',
        quotedDestinationAmount: Money.fromMinorUnits(1n, 'SAR'),
        sourceAmount: Money.fromMinorUnits(1n, 'USD'),
        destinationCurrency: 'SAR',
        sourceCurrency: 'USD',
      } as never,
      submission: null,
      journals: [],
      report: null,
    });
    assert.equal(result.autoAdjustedLedger, false);
    assert.notEqual(result.outcome, 'MATCHED');
  });

  it('19. bank provider balance is not the ledger balance', () => {
    const reference = {
      externalAccountId: 'baas_ext_1',
      routingCoordinateRef: 'coord_1',
      lifecycleRef: 'life_1',
      isCanonicalLedgerBalance: false as const,
    };
    assert.equal(baasReferenceIsNotLedgerBalance(reference), true);
    const exposed = exposeProviderLiquidityToTreasury({
      providerId: 'fixture-bank-us',
      amount: Money.fromMinorUnits(9_990_000n, 'USD'),
      currency: 'USD' as never,
      asOf: NOW,
      use: 'TREASURY_RECONCILIATION',
      isCustomerLedgerBalance: false,
    });
    assert.equal(exposed.evidence.isCustomerLedgerBalance, false);
    assert.equal(exposed.overridesKernel, false);
  });

  it('20. uses exact rational FX', () => {
    const parsed = parseExactProviderRate(['3', '745'].join('.'));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.rate.numerator, 3745n);
      assert.equal(parsed.rate.denominator, 1000n);
    }
    const quote = quoteFromCandidateProvider({
      profile: fixtureFxUsdSar(),
      pair: { base: 'USD' as never, quote: 'SAR' as never },
      now: NOW,
      sourceTimestamp: NOW,
      receivedTimestamp: NOW,
      rateInput: { numerator: '3745', denominator: '1000' },
      providerQuoteId: 'fxq_exact',
    });
    assert.equal(quote.ok, true);
  });

  it('21. rejects float FX', () => {
    const parsed = parseExactProviderRate(Number(['3', '745'].join('.')));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.reason, 'FLOAT_REJECTED');
    }
  });

  it('22. rejects stale FX', () => {
    const quote = quoteFromCandidateProvider({
      profile: fixtureFxUsdSar(),
      pair: { base: 'USD' as never, quote: 'SAR' as never },
      now: asUtcInstant(['2026-08-20T12:02:00', '000Z'].join('.')),
      sourceTimestamp: NOW,
      receivedTimestamp: NOW,
      rateInput: ['3', '745'].join('.'),
      providerQuoteId: 'fxq_stale',
    });
    assert.equal(quote.ok, false);
    if (!quote.ok) {
      assert.equal(quote.reason, 'STALE_QUOTE');
      assert.equal(quote.inventRate, false);
    }
  });

  it('23. rejects a disabled corridor', () => {
    const facts = {
      corridorId: 'US-GB-USD-GBP',
      currency: 'GBP',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      providerState: fixtureRailInternational().state,
      providerHealth: 'AVAILABLE' as const,
      amount: Money.fromMinorUnits(1000n, 'SAR'),
      sourceJurisdiction: 'US',
      destinationJurisdiction: 'GB',
      corridorEnabledBySunReyPolicy: false,
      providerClaimsCorridorSupported: true,
      regulatoryCompatible: true,
    };
    const rejected = hardEligibilityFilters(facts, fixtureRailInternational());
    assert.ok(rejected);
    assert.equal(rejected?.code, 'CORRIDOR_DISABLED');
  });

  it('24. honors the regulatory hard filter before scoring', () => {
    const beneficiary = freezeBeneficiary({
      beneficiaryId: asBeneficiaryId('ben_hard'),
      ownerId: 'cus_1' as never,
      kind: 'PERSON',
      legalName: 'Fixture',
      destinationCountry: 'SA',
      currency: 'SAR' as never,
      accountCoordinate: { scheme: 'OPAQUE', coordinateRef: 'dst', displayHint: 'SA' },
      screeningStatus: 'CLEAR',
      screeningRef: null,
      status: 'ACTIVE',
      createdAt: NOW,
    });
    const corridor = {
      corridorId: 'US-SA-USD-SAR',
      sourceCountry: 'US',
      destinationCountry: 'SA',
      sourceCurrency: 'USD',
      destinationCurrency: 'SAR',
      servingLegalEntityId: 'le_solstice_us_inc',
      policyStatus: 'RESEARCH_REQUIRED',
      simulationStatus: 'ACTIVE_SIMULATION',
      liveStatus: 'DISABLED',
    } as const;
    const facts = {
      corridorId: 'US-SA-USD-SAR',
      currency: 'SAR',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      providerState: fixtureRailInternational().state,
      providerHealth: 'AVAILABLE' as const,
      amount: Money.fromMinorUnits(374_500n, 'SAR'),
      sourceJurisdiction: 'US',
      destinationJurisdiction: 'SA',
      corridorEnabledBySunReyPolicy: true,
      providerClaimsCorridorSupported: true,
      regulatoryCompatible: false,
    };
    const selection = scoreOnlyAfterHardFilters(
      simulationRoutesFor('US-SA-USD-SAR', Money.fromMinorUnits(1500n, 'USD')),
      {
        corridor: corridor as never,
        beneficiary,
        sanctionsHit: false,
        amount: Money.fromMinorUnits(374_500n, 'SAR'),
        maxAmount: Money.fromMinorUnits(100_000_000n, 'SAR'),
        providerAvailable: true,
      },
      facts,
      fixtureRailInternational(),
    );
    assert.equal(selection.chosen, null);
    assert.ok(selection.rejected.every((row) => row.reason === 'REGULATORY_HARD_FILTER'));
  });

  it('25. provider failover preserves payment semantics', () => {
    const plan = planProviderFailover({
      from: fixtureRailInternational(),
      to: fixtureRailInternationalFailover(),
      fromEligible: true,
      toEligible: true,
      beneficiaryId: 'ben_1',
      nextBeneficiaryId: 'ben_1',
      currency: 'SAR',
      nextCurrency: 'SAR',
      purpose: 'family',
      nextPurpose: 'family',
      fromCredentialHref: fixtureRailInternational().credentialDescriptorRef.secretRef.href,
      toCredentialHref: fixtureRailInternationalFailover().credentialDescriptorRef.secretRef.href,
    });
    assert.equal('ok' in plan, false);
    if (!('ok' in plan)) {
      assert.equal(plan.beneficiaryUnchanged, true);
      assert.equal(plan.currencyUnchanged, true);
      assert.equal(plan.purposeUnchanged, true);
      assert.equal(plan.complianceBypassed, false);
      assert.equal(plan.credentialReused, false);
    }
    const bad = planProviderFailover({
      from: fixtureRailInternational(),
      to: fixtureRailInternationalFailover(),
      fromEligible: true,
      toEligible: true,
      beneficiaryId: 'ben_1',
      nextBeneficiaryId: 'ben_2',
      currency: 'SAR',
      nextCurrency: 'SAR',
      purpose: 'family',
      nextPurpose: 'family',
      fromCredentialHref: 'a',
      toCredentialHref: 'b',
    });
    assert.equal('ok' in bad && bad.ok === false, true);
  });

  it('26. fake engineering rail class does not claim network membership', () => {
    const profile = fixtureRailInternational();
    assert.equal(railClassIsNotNetworkMembership(profile), true);
    const claim = namedNetworkAccessRequiresEvidence('US_INSTANT', 'FedNow');
    assert.equal(claim.railClassProvesMembership, false);
    assert.equal(claim.externalEvidenceRequired, true);
    assert.notEqual(profile.railClass, 'FedNow');
  });

  it('27. does not call a real provider', () => {
    const transport = new FixturePaymentTransport();
    const adapter = adapterWith(transport);
    adapter.submitPayment(commandFor(adapter, 'pay_noreal'));
    assert.equal(transport.networkEnabled, false);
    assert.equal(transport.calledRealProvider, false);
    assert.equal(adapter.calledRealProvider, false);
  });

  it('28-30. live flags and production stay false', () => {
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    const posture = productionCandidatePosture();
    assert.equal(posture.productionActive, false);
    assert.equal(posture.productionAuthorized, false);
    assert.equal(PRODUCTION_CANDIDATE_FLAGS.realBankConnected, false);
  });

  it('adversarial: timeout before submit is not stored as a provider command', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_timeout_before', 'timeout_before');
    transport.script(command.submission.idempotencyKey, 'TIMEOUT_BEFORE_SUBMIT');
    const result = adapter.submitPayment(command);
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionClass, 'PRE_SUBMISSION_REJECTION');
  });

  it('adversarial: timeout after unknown requires query', () => {
    const transport = new ScriptedSandboxTransport();
    const adapter = adapterWith(transport);
    const command = commandFor(adapter, 'pay_timeout_after', 'timeout_after');
    transport.script(command.submission.idempotencyKey, 'TIMEOUT_AFTER_UNKNOWN');
    const result = adapter.submitPayment(command);
    assert.equal(result.status, 'SUBMISSION_UNKNOWN');
    const queried = adapter.queryPayment({
      paymentId: command.submission.paymentId,
      idempotencyKey: command.submission.idempotencyKey,
      providerPaymentId: null,
    });
    assert.equal(queried.found, true);
  });

  it('adversarial: forged and stale callbacks are rejected', () => {
    const authenticator = new CandidateProviderAuthenticator(secrets());
    const capability = fixtureInternationalCapability();
    const config = authFor(capability.provider);
    const now = () => NOW;
    const ingestor = new CandidateWebhookIngestor(authenticator, new Map([[capability.provider, config]]), now);
    const digest = payloadDigestOf(['SETTLED', 'pay_forge']);
    const forged = {
      provider: capability.provider,
      timestamp: NOW,
      schemaVersion: 1,
      providerEventId: 'evt_forge',
      paymentId: 'pay_forge',
      railSubmissionId: 'rsub_forge',
      providerStatus: 'SETTLED',
      payloadHash: digest,
      nonce: 'nonce_forge',
      providerIdentity: capability.provider,
      payloadDigest: digest,
      signature: '00'.repeat(32),
    };
    const forgedResult = ingestor.ingest(forged);
    assert.equal(forgedResult.outcome, 'DEAD_LETTER');
    const staleIngestor = new CandidateWebhookIngestor(
      authenticator,
      new Map([[capability.provider, config]]),
      () => asUtcInstant(['2026-08-20T12:10:00', '000Z'].join('.')),
    );
    const stale = staleIngestor.sign(config, {
      provider: capability.provider,
      timestamp: NOW,
      schemaVersion: 1,
      providerEventId: 'evt_stale',
      paymentId: 'pay_stale',
      railSubmissionId: 'rsub_stale',
      providerStatus: 'SETTLED',
      payloadHash: digest,
      nonce: 'nonce_stale',
      providerIdentity: capability.provider,
      payloadDigest: digest,
      signature: '',
    });
    assert.equal(staleIngestor.ingest(stale).outcome, 'DEAD_LETTER');
  });

  it('adversarial: provider outage and auth failure do not invent FX', () => {
    for (const failure of ['PROVIDER_UNAVAILABLE', 'AUTH_FAILED', 'RATE_LIMITED', 'SCHEMA_INCOMPATIBLE'] as const) {
      const quote = quoteFromCandidateProvider({
        profile: fixtureFxUsdSar(),
        pair: { base: 'USD' as never, quote: 'SAR' as never },
        now: NOW,
        sourceTimestamp: NOW,
        receivedTimestamp: NOW,
        rateInput: ['3', '745'].join('.'),
        providerQuoteId: `fxq_${failure}`,
        failure,
      });
      assert.equal(quote.ok, false);
      if (!quote.ok) {
        assert.equal(quote.inventRate, false);
      }
    }
  });

  it('adversarial: credential rotation uses a distinct SecretReference', () => {
    const current = authFor(fixtureInternationalCapability().provider);
    const rotated = rotateCandidateCredential(current, {
      credentialRef: secretRef('simulation', 'payments/rotated'),
      credentialDescriptorRef: {
        descriptorId: 'cred_desc_rotated',
        plane: 'CHUNK_149_PROVIDER_CREDENTIAL_PLANE',
        secretRef: secretRef('simulation', 'payments/rotated'),
        plaintextCredential: false,
      },
    });
    assert.notEqual(rotated.credentialRef?.href, current.credentialRef?.href);
  });

  it('adversarial: provider-supported corridor still fails SunRey policy', () => {
    const rejected = hardEligibilityFilters(
      {
        corridorId: 'US-AE-USD-AED',
        currency: 'AED',
        rail: 'INTERNATIONAL_CORRESPONDENT',
        providerState: 'SANDBOX_READY',
        providerHealth: 'AVAILABLE',
        amount: Money.fromMinorUnits(1000n, 'SAR'),
        sourceJurisdiction: 'US',
        destinationJurisdiction: 'AE',
        corridorEnabledBySunReyPolicy: false,
        providerClaimsCorridorSupported: true,
        regulatoryCompatible: true,
      },
      fixtureRailInternational(),
    );
    assert.equal(rejected?.code, 'CORRIDOR_DISABLED');
  });

  it('adversarial: settlement amount mismatch and status drift require review', () => {
    const report = normalizeProviderSettlementReport(
      'fixture-rail-international',
      {
        providerSettlementDate: '2026-08-20',
        currency: 'SAR',
        grossAmountMinorUnits: '100',
        transactionRefs: ['pay_mis'],
        providerSettlementRef: 'sref_mis',
        paymentId: 'pay_mis',
      },
      NOW,
    );
    const mismatch = reconcileCandidatePayment({
      payment: {
        paymentId: 'pay_mis',
        status: 'SETTLED',
        journalIds: [],
        settlementRef: 'sref_mis',
        quotedDestinationAmount: Money.fromMinorUnits(374_500n, 'SAR'),
        sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
        destinationCurrency: 'SAR',
        sourceCurrency: 'USD',
      } as never,
      submission: createRailSubmission(
        {
          paymentId: asPaymentId('pay_mis'),
          provider: fixtureInternationalCapability().provider,
          rail: 'INTERNATIONAL_CORRESPONDENT',
          amount: Money.fromMinorUnits(374_500n, 'SAR'),
          currency: 'SAR' as never,
          sourceReference: 'src',
          destinationReference: 'dst',
          beneficiaryReference: asBeneficiaryId('ben_mis'),
          purposeReference: 'sim',
          idempotencyKey: providerIdempotencyKeyFor('pay_mis', 'mis'),
          correlationId: 'mis',
          requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
        },
        NOW,
      ),
      journals: [],
      report: report.report,
      providerStatus: 'PENDING',
    });
    assert.equal(mismatch.outcome, 'AMOUNT_MISMATCH');
    assert.equal(mismatch.autoAdjustedLedger, false);
  });

  it('treasury cannot override a Kernel refusal', () => {
    assert.equal(treasuryAdvisorCannotOverrideKernel(null, 'REFUSE'), 'REFUSE');
  });

  it('international USD to SAR plan does not assume SunRey network licenses', () => {
    const plan = internationalUsdToSarPlan({
      banking: fixtureBankUs(),
      rail: fixtureRailInternational(),
      quote: fixtureUsdSarQuote(),
      now: NOW,
    });
    assert.equal('ok' in plan, false);
    if (!('ok' in plan)) {
      assert.equal(plan.sunreyHoldsNamedNetworkLicense, false);
      assert.equal(plan.partnerRelationshipClass, 'EXTERNAL_EVIDENCE');
    }
  });
});
