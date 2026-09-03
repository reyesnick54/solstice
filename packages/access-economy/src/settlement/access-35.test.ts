import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { providerRefFor, subjectRefFor } from '../ids.ts';
import {
  accessDomainEntitlementIdFor,
  accessDomainQuoteIdFor,
  accessDomainTransactionIdFor,
  accessEvidenceRefFor,
  accessFundingPoolIdFor,
  accessUserIdFor,
} from '../domain/ids.ts';
import { createAccessSolvencyService } from '../funding-solvency/index.ts';
import {
  allocateProportionalRefund,
  buildSettlementPlanFromQuote,
  computeProviderSettlementAmount,
  validateSettlementEquation,
  validateSettlementPlan,
  type AccessCheckoutQuote,
} from './index.ts';
import {
  FiatAccessSettlementOrchestrator,
  createFiatAccessSettlementOrchestrator,
  LAUNCH_TOKEN_CONVERSION_CONTRIBUTION,
  SimulatedAccessPaymentRail,
  SimulatedCanonicalFiatLedgerPort,
  SimulatedComplianceGatePort,
  SimulatedSettlementEvidencePort,
  SimulatedUserFundingPort,
} from './index.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-01T12:00:00.000Z');
const USER = accessUserIdFor('settlement-user');
const PROVIDER = providerRefFor('mobility-provider');
const TX_ID = accessDomainTransactionIdFor('tx-mobility-400');
const POOL_ID = accessFundingPoolIdFor('mobility-pool');
const ENTITLEMENT_ID = accessDomainEntitlementIdFor('ent-mobility-3days');

const PROVIDER_AMOUNT = 40_000n;
const ACCESS_POOL = 30_000n;
const USER_CONTRIBUTION = 10_000n;

let seededPoolId: ReturnType<typeof accessFundingPoolIdFor>;
let seededEntitlementId: ReturnType<typeof accessDomainEntitlementIdFor>;

function fixtureCheckoutQuote(overrides?: Partial<AccessCheckoutQuote>): AccessCheckoutQuote {
  return Object.freeze({
    checkoutQuoteId: accessDomainQuoteIdFor('checkout-mobility-400'),
    userId: USER,
    providerId: PROVIDER,
    category: 'MOBILITY',
    unit: 'VEHICLE_DAY',
    entitlementUnits: 1n,
    entitlementId: seededEntitlementId ?? ENTITLEMENT_ID,
    fundingPoolId: seededPoolId ?? POOL_ID,
    currency: 'USD',
    providerAmount: PROVIDER_AMOUNT,
    accessPoolContribution: ACCESS_POOL,
    userContribution: USER_CONTRIBUTION,
    tokenConversionContribution: 0n,
    otherProgramContribution: 0n,
    expiresAt: EXPIRES,
    evidenceReference: accessEvidenceRefFor('checkout-quote'),
    createdAt: NOW,
    ...overrides,
  });
}

function seedSolvency(service: ReturnType<typeof createAccessSolvencyService>) {
  const poolRegistry = service.getPoolRegistry();
  const fundingLedger = service.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: 'Mobility Pool',
    category: 'MOBILITY',
    currency: 'USD',
    categoryPolicy: 'STRICT_CATEGORY',
    now: NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: 1_000_000n,
    amountReceived: 1_000_000n,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:treasury',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits: 1_000_000n,
    transactionReference: 'treasury:seed',
    evidenceReference: 'evidence:treasury',
    createdAt: NOW,
    idempotencyKey: 'fund:seed',
  });

  const entitlementLedger = service.getEntitlementLedger();
  entitlementLedger.allocate({
    entitlementId: ENTITLEMENT_ID,
    userId: USER,
    category: 'MOBILITY',
    unit: 'VEHICLE_DAY',
    quantity: 3n,
    allocationReference: 'alloc:test',
    evidenceReference: 'evidence:alloc',
    createdAt: NOW,
    idempotencyKey: 'alloc:ent',
  });

  seededPoolId = accessFundingPoolIdFor(pool.fundingPoolId);
  seededEntitlementId = ENTITLEMENT_ID;
  return { poolId: pool.fundingPoolId, entitlementId: ENTITLEMENT_ID };
}

function createOrchestrator(
  service: ReturnType<typeof createAccessSolvencyService>,
  railOptions?: ConstructorParameters<typeof SimulatedAccessPaymentRail>[0],
) {
  const rail = new SimulatedAccessPaymentRail(railOptions);
  return createFiatAccessSettlementOrchestrator({
    solvency: service,
    paymentRail: rail,
    userFunding: new SimulatedUserFundingPort(rail),
    compliance: new SimulatedComplianceGatePort(true),
    fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
    evidence: new SimulatedSettlementEvidencePort(),
  });
}

function buildPlan(quote = fixtureCheckoutQuote()) {
  return buildSettlementPlanFromQuote({
    quote,
    accessTransactionId: TX_ID,
    planId: 'plan-mobility-400',
    paymentRail: 'SIMULATED',
    providerPaymentMethod: 'provider-method-ref',
    userFundingSource: 'user-funding-source-ref',
    settlementStrategy: 'AUTHORIZE_THEN_BOOK_THEN_CAPTURE',
  });
}

describe('ACCESS-35 settlement plan', () => {
  it('1. validates settlement equation', () => {
    const plan = buildPlan();
    assert.equal(validateSettlementPlan(plan), null);
    assert.equal(
      computeProviderSettlementAmount({
        accessPoolContribution: ACCESS_POOL,
        userFiatContribution: USER_CONTRIBUTION,
        tokenConversionContribution: 0n,
        otherProgramContribution: 0n,
        currency: 'USD',
      }),
      PROVIDER_AMOUNT,
    );
  });

  it('2. $300 Access + $100 user = $400 provider', () => {
    const plan = buildPlan();
    assert.equal(plan.accessPoolContribution, 30_000n);
    assert.equal(plan.userContribution, 10_000n);
    assert.equal(plan.providerAmount, 40_000n);
    assert.equal(plan.tokenConversionContribution, 0n);
  });

  it('rejects non-zero token conversion at launch', () => {
    const failure = validateSettlementEquation({
      providerAmount: 40_000n,
      accessPoolContribution: 30_000n,
      userFiatContribution: 10_000n,
      tokenConversionContribution: 1n,
      otherProgramContribution: 0n,
    });
    assert.equal(failure?.code, 'TOKEN_CONVERSION_NON_ZERO');
  });
});

describe('ACCESS-35 settlement orchestrator', () => {
  it('3. entitlement reservation', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-1',
      now: NOW,
    });
    assert.equal(prepared.ok, true);
    const reserved = await orchestrator.reserve({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'reserve-1',
      now: NOW,
    });
    assert.equal(reserved.ok, true);
    assert.ok(reserved.settlement!.entitlementReservationId);
    const balance = service.getEntitlementLedger().getBalance(seededEntitlementId)!;
    assert.equal(balance.reserved, 1n);
    assert.equal(balance.remaining, 2n);
  });

  it('4. funding reservation', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-2',
      now: NOW,
    });
    const reserved = await orchestrator.reserve({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'reserve-2',
      now: NOW,
    });
    assert.equal(reserved.ok, true);
    assert.ok(reserved.settlement!.fundingReservationId);
    assert.equal(reserved.settlement!.status, 'FUNDING_RESERVED');
  });

  it('5. concurrent funding reservation safety', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedSolvency(service);
    const poolRegistry = service.getPoolRegistry();
    const fundingLedger = service.getFundingLedger();
    const smallPool = poolRegistry.createPool({
      name: 'Small Pool',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const source = poolRegistry.addSource({
      fundingPoolId: smallPool.fundingPoolId,
      sourceType: 'TREASURY',
      currency: 'USD',
      amountCommitted: 50_000n,
      amountReceived: 50_000n,
      effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      evidenceReference: 'evidence:small',
    });
    fundingLedger.recordFundingReceived({
      fundingPoolId: smallPool.fundingPoolId,
      sourceId: source.sourceId,
      currency: 'USD',
      amountMinorUnits: 50_000n,
      transactionReference: 'treasury:small',
      evidenceReference: 'evidence:small',
      createdAt: NOW,
      idempotencyKey: 'fund:small',
    });

    const orchestrator = createOrchestrator(service);
    const quote = fixtureCheckoutQuote({
      fundingPoolId: accessFundingPoolIdFor(smallPool.fundingPoolId),
      accessPoolContribution: 30_000n,
      userContribution: 10_000n,
      providerAmount: 40_000n,
    });
    const plan = buildPlan(quote);

    const prep1 = orchestrator.prepareSettlement({ plan, idempotencyKey: 'c-prep-1', now: NOW });
    const prep2 = orchestrator.prepareSettlement({
      plan: buildPlan(fixtureCheckoutQuote({
        ...quote,
        checkoutQuoteId: accessDomainQuoteIdFor('checkout-2'),
      })),
      idempotencyKey: 'c-prep-2',
      now: NOW,
    });

    const [r1, r2] = await Promise.all([
      orchestrator.reserve({
        settlementId: prep1.settlement!.settlementId,
        idempotencyKey: 'c-res-1',
        now: NOW,
      }),
      orchestrator.reserve({
        settlementId: prep2.settlement!.settlementId,
        idempotencyKey: 'c-res-2',
        now: NOW,
      }),
    ]);

    const successes = [r1, r2].filter((r) => r.ok).length;
    assert.equal(successes, 1, 'only one concurrent reservation should succeed against limited pool');
    void poolId;
  });

  it('6. user contribution authorization', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-auth',
      now: NOW,
    });
    await orchestrator.reserve({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'reserve-auth',
      now: NOW,
    });
    const authorized = await orchestrator.authorize({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'auth-1',
      now: NOW,
    });
    assert.equal(authorized.ok, true);
    assert.ok(authorized.settlement!.userPaymentReference);
    assert.equal(authorized.settlement!.status, 'AUTHORIZED');
  });

  it('7. provider authorization', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-prov',
      now: NOW,
    });
    await orchestrator.reserve({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'reserve-prov',
      now: NOW,
    });
    const authorized = await orchestrator.authorize({
      settlementId: prepared.settlement!.settlementId,
      idempotencyKey: 'auth-prov',
      now: NOW,
    });
    assert.equal(authorized.ok, true);
    assert.ok(authorized.settlement!.providerPaymentReference);
  });

  it('8. capture', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const fiatLedger = new SimulatedCanonicalFiatLedgerPort();
    const rail = new SimulatedAccessPaymentRail();
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: rail,
      userFunding: new SimulatedUserFundingPort(rail),
      compliance: new SimulatedComplianceGatePort(),
      fiatLedger,
      evidence: new SimulatedSettlementEvidencePort(),
    });

    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-cap',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-cap', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-cap', now: NOW });
    const captured = await orchestrator.capture({
      settlementId,
      idempotencyKey: 'cap-1',
      now: NOW,
    });
    assert.equal(captured.ok, true);
    assert.equal(captured.settlement!.status, 'CAPTURED');
    assert.ok(captured.settlement!.canonicalJournalId);
    assert.equal(fiatLedger.getJournals().length, 1);
  });

  it('9. void', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-void',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-void', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-void', now: NOW });
    const voided = await orchestrator.void({
      settlementId,
      idempotencyKey: 'void-1',
      now: NOW,
    });
    assert.equal(voided.ok, true);
    assert.equal(voided.settlement!.status, 'VOIDED');
    const balance = service.getEntitlementLedger().getBalance(seededEntitlementId)!;
    assert.equal(balance.reserved, 0n);
  });

  it('10. failed authorization', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const providerRail = new SimulatedAccessPaymentRail({ failAuthorize: true });
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: providerRail,
      userFunding: new SimulatedUserFundingPort(new SimulatedAccessPaymentRail()),
      compliance: new SimulatedComplianceGatePort(true),
      fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-fail',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-fail', now: NOW });
    const authorized = await orchestrator.authorize({
      settlementId,
      idempotencyKey: 'auth-fail',
      now: NOW,
    });
    assert.equal(authorized.ok, false);
    assert.equal(authorized.settlement!.status, 'FAILED');
    assert.equal(authorized.failure?.code, 'PROVIDER_AUTHORIZATION_FAILED');
  });

  it('11. timeout unknown state', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const providerRail = new SimulatedAccessPaymentRail({ timeoutOnAuthorize: true });
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: providerRail,
      userFunding: new SimulatedUserFundingPort(new SimulatedAccessPaymentRail()),
      compliance: new SimulatedComplianceGatePort(true),
      fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-timeout',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-timeout', now: NOW });
    const authorized = await orchestrator.authorize({
      settlementId,
      idempotencyKey: 'auth-timeout',
      now: NOW,
    });
    assert.equal(authorized.ok, false);
    assert.equal(authorized.settlement!.status, 'RECONCILIATION_REQUIRED');
  });

  it('12. reconciliation-required state', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const providerRail = new SimulatedAccessPaymentRail({ timeoutOnAuthorize: true });
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: providerRail,
      userFunding: new SimulatedUserFundingPort(new SimulatedAccessPaymentRail()),
      compliance: new SimulatedComplianceGatePort(true),
      fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-recon',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-recon', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-recon', now: NOW });
    const settlement = orchestrator.getSettlement(settlementId);
    assert.equal(settlement?.status, 'RECONCILIATION_REQUIRED');
  });

  it('13. duplicate authorization prevention', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-dup-auth',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-dup', now: NOW });
    const first = await orchestrator.authorize({
      settlementId,
      idempotencyKey: 'auth-dup',
      now: NOW,
    });
    const second = await orchestrator.authorize({
      settlementId,
      idempotencyKey: 'auth-dup',
      now: NOW,
    });
    assert.equal(first.settlement!.providerPaymentReference, second.settlement!.providerPaymentReference);
  });

  it('14. duplicate capture prevention', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const fiatLedger = new SimulatedCanonicalFiatLedgerPort();
    const rail = new SimulatedAccessPaymentRail();
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: rail,
      userFunding: new SimulatedUserFundingPort(rail),
      compliance: new SimulatedComplianceGatePort(),
      fiatLedger,
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-dup-cap',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-dup-cap', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-dup-cap', now: NOW });
    await orchestrator.capture({ settlementId, idempotencyKey: 'cap-dup', now: NOW });
    await orchestrator.capture({ settlementId, idempotencyKey: 'cap-dup', now: NOW });
    assert.equal(fiatLedger.getJournals().length, 1);
  });

  it('15. source-of-funds accounting', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service);
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-sof',
      now: NOW,
    });
    const sof = prepared.settlement!.sourceOfFunds;
    assert.equal(sof.accessPoolContribution, 30_000n);
    assert.equal(sof.userFiatContribution, 10_000n);
    assert.equal(sof.tokenConversionContribution, 0n);
    assert.equal(
      computeProviderSettlementAmount(sof),
      prepared.settlement!.plan.providerAmount,
    );
  });

  it('16. full refund mapping', async () => {
    const allocation = allocateProportionalRefund({
      totalRefundAmount: 40_000n,
      original: {
        accessPoolContribution: 30_000n,
        userFiatContribution: 10_000n,
        tokenConversionContribution: 0n,
        otherProgramContribution: 0n,
        currency: 'USD',
      },
      evidenceReference: 'evidence:refund-full',
    });
    assert.equal(allocation.accessPoolRefund, 30_000n);
    assert.equal(allocation.userRefund, 10_000n);
    assert.equal(allocation.tokenConversionRefund, 0n);
  });

  it('17. partial refund metadata', async () => {
    const allocation = allocateProportionalRefund({
      totalRefundAmount: 20_000n,
      original: {
        accessPoolContribution: 30_000n,
        userFiatContribution: 10_000n,
        tokenConversionContribution: 0n,
        otherProgramContribution: 0n,
        currency: 'USD',
      },
      evidenceReference: 'evidence:refund-partial',
    });
    assert.equal(allocation.policy, 'PROPORTIONAL');
    assert.equal(allocation.accessPoolRefund, 15_000n);
    assert.equal(allocation.userRefund, 5_000n);
    assert.equal(
      allocation.accessPoolRefund + allocation.userRefund,
      allocation.totalRefundAmount,
    );
  });

  it('18. compliance gate called', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const compliance = new SimulatedComplianceGatePort(true);
    const rail = new SimulatedAccessPaymentRail();
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: rail,
      userFunding: new SimulatedUserFundingPort(rail),
      compliance,
      fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-compliance',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-compliance', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-compliance', now: NOW });
    assert.equal(compliance.getCalls().length, 1);
  });

  it('19. canonical fiat ledger integration', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const fiatLedger = new SimulatedCanonicalFiatLedgerPort();
    const rail = new SimulatedAccessPaymentRail();
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: rail,
      userFunding: new SimulatedUserFundingPort(rail),
      compliance: new SimulatedComplianceGatePort(),
      fiatLedger,
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-ledger',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-ledger', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-ledger', now: NOW });
    const captured = await orchestrator.capture({
      settlementId,
      idempotencyKey: 'cap-ledger',
      now: NOW,
    });
    assert.ok(captured.settlement!.canonicalJournalId);
    assert.ok(captured.settlement!.evidence.canonicalLedgerRef);
  });

  it('20. failed transaction releases safe reservations', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const orchestrator = createOrchestrator(service, { failAuthorize: true });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-release',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-release', now: NOW });
    await orchestrator.authorize({ settlementId, idempotencyKey: 'auth-release', now: NOW });
    const balance = service.getEntitlementLedger().getBalance(seededEntitlementId)!;
    assert.equal(balance.reserved, 0n);
    assert.equal(balance.remaining, 3n);
  });

  it('21. SR/MR unchanged — token conversion zero', () => {
    assert.equal(LAUNCH_TOKEN_CONVERSION_CONTRIBUTION, 0n);
    const plan = buildPlan();
    assert.equal(plan.tokenConversionContribution, 0n);
  });

  it('22. token conversion remains zero enforced', () => {
    assert.throws(() => {
      buildSettlementPlanFromQuote({
        quote: fixtureCheckoutQuote({ tokenConversionContribution: 100n }),
        accessTransactionId: TX_ID,
        planId: 'bad-plan',
        paymentRail: 'SIMULATED',
        providerPaymentMethod: 'pm',
        userFundingSource: 'uf',
        settlementStrategy: 'BOOK_THEN_PAY',
      });
    });
  });

  it('23. no raw payment credentials logged', () => {
    const evidence = new SimulatedSettlementEvidencePort();
    const ref = evidence.seal({
      kind: 'TEST',
      settlementId: 'acew1s_test',
      accessTransactionId: 'acew1t_test',
      payload: {
        pan: '4111111111111111',
        cardNumber: 'secret',
        amount: 100,
      },
      now: NOW,
    });
    assert.ok(ref);
    assert.equal(String(ref).includes('4111111111111111'), false);
  });
});

describe('ACCESS-35 compliance refusal', () => {
  it('refuses when compliance gate denies', async () => {
    const service = createAccessSolvencyService();
    seedSolvency(service);
    const compliance = new SimulatedComplianceGatePort(false);
    const rail = new SimulatedAccessPaymentRail();
    const orchestrator = createFiatAccessSettlementOrchestrator({
      solvency: service,
      paymentRail: rail,
      userFunding: new SimulatedUserFundingPort(rail),
      compliance,
      fiatLedger: new SimulatedCanonicalFiatLedgerPort(),
      evidence: new SimulatedSettlementEvidencePort(),
    });
    const prepared = orchestrator.prepareSettlement({
      plan: buildPlan(),
      idempotencyKey: 'prep-deny',
      now: NOW,
    });
    const settlementId = prepared.settlement!.settlementId;
    await orchestrator.reserve({ settlementId, idempotencyKey: 'res-deny', now: NOW });
    const authorized = await orchestrator.authorize({
      settlementId,
      idempotencyKey: 'auth-deny',
      now: NOW,
    });
    assert.equal(authorized.ok, false);
    assert.equal(authorized.failure?.code, 'COMPLIANCE_REFUSED');
  });
});
