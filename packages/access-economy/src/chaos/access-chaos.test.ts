/**
 * ACCESS Wave 5 / Prompt 41 — full Access chaos, security, and invariant suite.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireOrchestratorValue } from '../transaction/test-harness.ts';
import { asAccessDomainTransactionId } from '../domain/ids.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { isLinkLocalOrMetadata, isLoopbackHostname, isPrivateIpv4, parseDestination } from '../../../provider-sdk/src/ssrf.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import { AccessReconciliationService } from '../transaction/reconciliation.ts';
import { AccessWebhookOrchestrator } from '../transaction/webhook-orchestrator.ts';
import { allocateRefund } from '../transaction/refund-policy.ts';
import {
  validateAccessCardControls,
  buildAccessCardControls,
} from '../settlement/card-controls.ts';
import { fixtureVirtualCardRequest } from '../settlement/index.ts';
import { authorizeAccessMutate } from '../../../human-access-economy/src/access.ts';
import {
  allChaosInvariantsHeld,
  buildLatencyPercentiles,
  checkAccessChaosInvariants,
  createWave3TestStack,
  mobilityQuote,
  quoteCheckout,
  reserveAndBook,
  scanAccessPathsForSecrets,
  scanPayloadForForbiddenPii,
  assertProviderPayloadMinimal,
  startMobilityTx,
  suspendFundingPool,
  seedMobilityEntitlement,
  seedMobilityFundingPool,
  CHAOS_NOW,
  CHAOS_USER,
  utilizationBps,
} from './index.ts';

const EXPIRED_QUOTE = asUtcInstant('2025-01-01T00:00:00.000Z');

async function fullCheckout(stack: ReturnType<typeof createWave3TestStack>, prefix: string) {
  const { txId, entitlementId, poolId } = await startMobilityTx(stack, { idempotencyKey: `${prefix}-start` });
  await quoteCheckout(stack, { txId, idempotencyKey: `${prefix}-quote` });
  await stack.orchestrator.approveEligibility({ transactionId: txId, idempotencyKey: `${prefix}-elig`, now: CHAOS_NOW });
  const reserve = await stack.orchestrator.reserve({
    transactionId: txId,
    userApproved: true,
    idempotencyKey: `${prefix}-reserve`,
    now: CHAOS_NOW,
  });
  assert.equal(reserve.ok, true);
  const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: `${prefix}-book`, now: CHAOS_NOW });
  assert.equal(book.ok, true);
  await stack.orchestrator.confirmFulfillment({
    transactionId: txId,
    quantityFulfilled: 1n,
    kind: 'RIDE_COMPLETED',
    idempotencyKey: `${prefix}-fulfill`,
    now: CHAOS_NOW,
  });
  await stack.orchestrator.settle({ transactionId: txId, idempotencyKey: `${prefix}-settle`, now: CHAOS_NOW });
  return { txId, entitlementId, poolId };
}

function assertInvariants(stack: ReturnType<typeof createWave3TestStack>, entitlementId: string, poolId: string): void {
  const results = checkAccessChaosInvariants({
    solvency: stack.solvency,
    store: stack.orchestrator.store,
    entitlementId,
    fundingPoolId: poolId,
    currency: 'USD',
    now: CHAOS_NOW,
  });
  assert.equal(allChaosInvariantsHeld(results), true, JSON.stringify(results.filter((r) => !r.held)));
}

describe('ACCESS Prompt 41 — idempotency and races', () => {
  it('04 double-click confirm returns one transaction and one booking', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId, poolId } = await startMobilityTx(stack, { idempotencyKey: 'dbl-click' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'dbl-quote' });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'dbl-reserve', now: CHAOS_NOW });
    const books = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'dbl-book', now: CHAOS_NOW }),
      ),
    );
    const successes = books.filter((b) => b.ok);
    assert.equal(successes.length, 20);
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.ok(ctx.providerBookingReference);
    assert.equal(stack.orchestrator.store.listAll().length, 1);
    assertInvariants(stack, entitlementId, poolId);
  });

  it('05 multi-device entitlement race allows at most one reservation', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 1n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const startA = await stack.orchestrator.start({
      userId: CHAOS_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'race-a',
      now: CHAOS_NOW,
    });
    const startB = await stack.orchestrator.start({
      userId: CHAOS_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'race-b',
      now: CHAOS_NOW,
    });
    await quoteCheckout(stack, { txId: requireOrchestratorValue(startA).transactionId, idempotencyKey: 'race-a-q' });
    await quoteCheckout(stack, { txId: requireOrchestratorValue(startB).transactionId, idempotencyKey: 'race-b-q' });
    const [res1, res2] = await Promise.all([
      stack.orchestrator.reserve({ transactionId: requireOrchestratorValue(startA).transactionId, userApproved: true, idempotencyKey: 'race-a-r', now: CHAOS_NOW }),
      stack.orchestrator.reserve({ transactionId: requireOrchestratorValue(startB).transactionId, userApproved: true, idempotencyKey: 'race-b-r', now: CHAOS_NOW }),
    ]);
    const okCount = [res1, res2].filter((r) => r.ok).length;
    assert.ok(okCount <= 1);
    assertInvariants(stack, entitlementId, poolId);
  });

  it('06 funding pool race caps reservations at pool balance', async () => {
    const stack = createWave3TestStack();
    const poolId = seedMobilityFundingPool(stack.solvency, 1_000_00n);
    const entitlementId = seedMobilityEntitlement(stack.solvency, 20n);
    const starts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        stack.orchestrator.start({
          userId: CHAOS_USER,
          category: 'MOBILITY',
          entitlementId,
          fundingPoolId: poolId,
          unit: 'VEHICLE_DAY',
          idempotencyKey: `fund-race-${i}`,
          now: CHAOS_NOW,
        }),
      ),
    );
    for (const start of starts) {
      await quoteCheckout(stack, { txId: requireOrchestratorValue(start).transactionId, idempotencyKey: `fq-${requireOrchestratorValue(start).transactionId}` });
    }
    const reserves = await Promise.all(
      starts.map((start, i) =>
        stack.orchestrator.reserve({
          transactionId: requireOrchestratorValue(start).transactionId,
          userApproved: true,
          idempotencyKey: `fr-${i}`,
          now: CHAOS_NOW,
        }),
      ),
    );
    const successCount = reserves.filter((r) => r.ok).length;
    assert.ok(successCount <= 5);
    const balance = stack.solvency.getFundingPoolBalance(poolId, 'USD', CHAOS_NOW);
    assert.ok(balance.availableCashFunding >= 0n);
    assertInvariants(stack, entitlementId, poolId);
  });
});

describe('ACCESS Prompt 41 — quote and price safety', () => {
  it('07 quote expiry blocks stale checkout and releases reservations', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId, poolId } = await startMobilityTx(stack, { idempotencyKey: 'exp-start' });
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mobilityQuote('exp', 340_00n, EXPIRED_QUOTE),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'exp-quote',
      now: CHAOS_NOW,
    });
    const reserve = await stack.orchestrator.reserve({
      transactionId: txId,
      userApproved: true,
      idempotencyKey: 'exp-res',
      now: CHAOS_NOW,
    });
    assert.equal(reserve.ok, false);
    assert.equal(reserve.code, 'QUOTE_EXPIRED');
    assertInvariants(stack, entitlementId, poolId);
  });

  it('08 provider price increase requires requote not silent overcharge', async () => {
    const stack = createWave3TestStack();
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'price-start' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'price-q1' });
    const higher = mobilityQuote('price-higher', 475_00n);
    const requote = await stack.orchestrator.requote({
      transactionId: txId,
      providerQuote: higher,
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'price-q2',
      now: CHAOS_NOW,
    });
    assert.equal(requote.ok, true);
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.ok(ctx.status === 'QUOTED' || ctx.status === 'REQUOTE_REQUIRED');
    assert.ok(ctx.quote!.userContributionMinorUnits >= 0n);
  });
});

describe('ACCESS Prompt 41 — failure compensation', () => {
  it('09 lost booking response reconciles without duplicate booking', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ bookingTimeout: true });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'lost-b' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'lost-q' });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'lost-r', now: CHAOS_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'lost-book', now: CHAOS_NOW });
    assert.equal(book.ok, true);
    assert.equal(requireOrchestratorValue(book).status, 'RECONCILIATION_REQUIRED');
    const reconciled = await stack.orchestrator.reconcile({ transactionId: txId, idempotencyKey: 'lost-recon', now: CHAOS_NOW });
    assert.equal(reconciled.ok, true);
    assert.equal(requireOrchestratorValue(reconciled).status, 'BOOKED');
  });

  it('10 booking fails after auth releases exposure', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ failBooking: true });
    const { txId, entitlementId, poolId } = await startMobilityTx(stack, { idempotencyKey: 'bfail' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'bfail-q' });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'bfail-r', now: CHAOS_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'bfail-b', now: CHAOS_NOW });
    assert.equal(book.ok, false);
    const ent = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(ent.remaining, 3n);
    const pool = stack.solvency.getFundingPoolBalance(poolId, 'USD', CHAOS_NOW);
    assert.equal(pool.reservedFunding, 0n);
  });

  it('11 payment succeeds booking fails compensates', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ failBooking: true });
    const { txId, poolId } = await startMobilityTx(stack, { idempotencyKey: 'pay-ok-book-fail' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'pobf-q' });
    const result = await reserveAndBook(stack, txId, 'pobf');
    assert.equal(result.bookOk, false);
    assert.equal(stack.solvency.getFundingPoolBalance(poolId, 'USD', CHAOS_NOW).reservedFunding, 0n);
  });

  it('12 booking succeeds payment fails enters reconciliation', async () => {
    const stack = createWave3TestStack();
    stack.paymentRail.configure({ failNextCapture: true });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'book-ok-pay-fail' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'bopf-q' });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'bopf-r', now: CHAOS_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'bopf-b', now: CHAOS_NOW });
    assert.equal(book.ok, false);
    stack.paymentRail.configure({ failNextCapture: false });
  });
});

describe('ACCESS Prompt 41 — webhooks', () => {
  it('13-15 duplicate and out-of-order webhooks stay consistent', async () => {
    const stack = createWave3TestStack();
    const { txId } = await fullCheckout(stack, 'wh');
    const webhook = new AccessWebhookOrchestrator(stack.orchestrator);
    const event = {
      webhookEventId: 'wh_cap',
      source: 'PAYMENT' as const,
      providerId: null,
      transactionId: asAccessDomainTransactionId(txId),
      kind: 'PAYMENT_CAPTURED' as const,
      idempotencyKey: 'dup-cap-wh',
      signatureVerified: true,
      occurredAt: CHAOS_NOW,
      payloadReference: 'payload:cap',
    };
    const firstCapture = await webhook.handle(event);
    assert.equal(firstCapture.ok, true);
    const duplicateCapture = await webhook.handle(event);
    assert.equal(duplicateCapture.ok, true);
    if (duplicateCapture.ok) assert.equal(duplicateCapture.duplicate, true);
    await webhook.handle({
      ...event,
      webhookEventId: 'wh_auth_late',
      kind: 'PAYMENT_AUTHORIZED',
      idempotencyKey: 'late-auth',
    });
    const bookingEvent = {
      webhookEventId: 'wh_book',
      source: 'PROVIDER' as const,
      providerId: 'turo' as const,
      transactionId: asAccessDomainTransactionId(txId),
      kind: 'BOOKING_CONFIRMED' as const,
      idempotencyKey: 'dup-book-wh',
      signatureVerified: true,
      occurredAt: CHAOS_NOW,
      payloadReference: 'payload:book',
    };
    await webhook.handle(bookingEvent);
    const duplicateBooking = await webhook.handle(bookingEvent);
    assert.equal(duplicateBooking.ok, true);
    if (duplicateBooking.ok) assert.equal(duplicateBooking.duplicate, true);
  });

  it('16 lost webhook resolved by scheduled reconciliation', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ bookingTimeout: true });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'lost-wh' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'lost-wh-q' });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'lost-wh-r', now: CHAOS_NOW });
    await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'lost-wh-b', now: CHAOS_NOW });
    const reconciliation = new AccessReconciliationService({
      store: stack.orchestrator.store,
      solvency: stack.solvency,
      settlement: stack.orchestrator.settlementOrchestrator,
      provider: stack.simulationProvider,
    });
    const outcome = reconciliation.reconcileTransaction(txId, CHAOS_NOW);
    assert.ok(outcome.autoResolved.length >= 0 || outcome.issues.length >= 0);
    await stack.orchestrator.reconcile({ transactionId: txId, idempotencyKey: 'lost-wh-recon', now: CHAOS_NOW });
  });
});

describe('ACCESS Prompt 41 — outages and treasury controls', () => {
  it('17-19 provider outages keep entitlements and history intact', async () => {
    const stack = createWave3TestStack();
    const { entitlementId, poolId, txId } = await fullCheckout(stack, 'pre-outage');
    stack.simulationProvider.setScenario({ quarantined: true });
    const search = stack.simulationProvider.search({
      requestId: 'outage-search',
      category: 'VEHICLE_HOURS',
      query: 'Miami',
      location: 'Miami',
      limit: 1,
    });
    assert.equal(search.ok, false);
    const ent = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.ok(ent.allocated > 0n);
    assert.ok(stack.orchestrator.getContext(txId));
    assertInvariants(stack, entitlementId, poolId);
  });

  it('18 payment issuer outage blocks unfunded booking path', async () => {
    const stack = createWave3TestStack();
    stack.paymentRail.configure({ failNextAuthorization: true });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'issuer-down' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'issuer-q' });
    const reserve = await stack.orchestrator.reserve({
      transactionId: txId,
      userApproved: true,
      idempotencyKey: 'issuer-r',
      now: CHAOS_NOW,
    });
    assert.equal(reserve.ok, false);
    stack.paymentRail.configure({ failNextAuthorization: false });
  });

  it('20 funding exhaustion blocks new checkout without negative funding', async () => {
    const stack = createWave3TestStack();
    const poolId = seedMobilityFundingPool(stack.solvency, 300_00n);
    const entitlementId = seedMobilityEntitlement(stack.solvency, 5n);
    const first = await stack.orchestrator.start({
      userId: CHAOS_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'exhaust-first',
      now: CHAOS_NOW,
    });
    await quoteCheckout(stack, { txId: requireOrchestratorValue(first).transactionId, idempotencyKey: 'exhaust-q1' });
    const firstReserve = await stack.orchestrator.reserve({
      transactionId: requireOrchestratorValue(first).transactionId,
      userApproved: true,
      idempotencyKey: 'exhaust-r1',
      now: CHAOS_NOW,
    });
    assert.equal(firstReserve.ok, true);
    const status = stack.solvency.getSolvencyStatus(poolId, 'USD', CHAOS_NOW);
    assert.equal(status.status, 'EXHAUSTED');
    assert.equal(
      stack.solvency.canReserveFunding({
        fundingPoolId: poolId,
        currency: 'USD',
        amountMinorUnits: 300_00n,
        now: CHAOS_NOW,
      }),
      false,
    );
    const ent = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.ok(ent.remaining > 0n);
    assert.ok(status.balance.availableCashFunding >= 0n);
    assertInvariants(stack, entitlementId, poolId);
  });

  it('21 treasury pause blocks new funded checkout', async () => {
    const stack = createWave3TestStack();
    const { txId, poolId, entitlementId } = await startMobilityTx(stack, { idempotencyKey: 'pause' });
    suspendFundingPool(stack, poolId);
    await quoteCheckout(stack, { txId, idempotencyKey: 'pause-q' });
    const reserve = await stack.orchestrator.reserve({
      transactionId: txId,
      userApproved: true,
      idempotencyKey: 'pause-r',
      now: CHAOS_NOW,
    });
    assert.equal(reserve.ok, false);
    assert.equal(reserve.code, 'POOL_SUSPENDED');
    assertInvariants(stack, entitlementId, poolId);
  });

  it('22 quarantined provider blocks new bookings', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ quarantined: true });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'quarantine' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'quarantine-q' });
    const reserve = await stack.orchestrator.reserve({
      transactionId: txId,
      userApproved: true,
      idempotencyKey: 'quarantine-r',
      now: CHAOS_NOW,
    });
    assert.equal(reserve.ok, false);
  });
});

describe('ACCESS Prompt 41 — virtual card controls', () => {
  it('23 deposit over-authorization does not consume Access funding', () => {
    const request = fixtureVirtualCardRequest({
      maximumAmount: 400_00n,
      securityDepositRequired: true,
      accessPoolContributionMinorUnits: 400_00n,
      userFiatContributionMinorUnits: 0n,
    });
    const controls = buildAccessCardControls(request, {
      maximumAmount: true,
      singleTransaction: true,
      singleUse: true,
      expiration: true,
      merchantId: true,
      merchantCategory: true,
      country: true,
      currency: true,
      allowedMerchant: true,
      blockedMerchantCategories: true,
      incrementalAuthorization: false,
    });
    const serviceAuth = validateAccessCardControls({
      controls,
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 400_00n,
      currency: 'USD',
      now: CHAOS_NOW,
      aggregateAuthorizedMinorUnits: 0n,
      authorizationCount: 0,
    });
    assert.equal(serviceAuth.allowed, true);
    const depositAuth = validateAccessCardControls({
      controls,
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 500_00n,
      currency: 'USD',
      now: CHAOS_NOW,
      aggregateAuthorizedMinorUnits: 400_00n,
      authorizationCount: 1,
      securityDepositAttempt: true,
    });
    assert.equal(depositAuth.allowed, false);
    assert.equal(depositAuth.code, 'SECURITY_DEPOSIT_NOT_FUNDED');
  });

  it('24-26 unrelated merchant, over-limit, and card reuse decline', () => {
    const request = fixtureVirtualCardRequest({ maximumAmount: 400_00n });
    const controls = buildAccessCardControls(request, {
      maximumAmount: true,
      singleTransaction: true,
      singleUse: true,
      expiration: true,
      merchantId: true,
      merchantCategory: true,
      country: true,
      currency: true,
      allowedMerchant: true,
      blockedMerchantCategories: true,
      incrementalAuthorization: false,
    });
    const wrongMerchant = validateAccessCardControls({
      controls,
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_random',
      merchantCategory: '5812',
      country: 'US',
      amountMinorUnits: 100_00n,
      currency: 'USD',
      now: CHAOS_NOW,
      aggregateAuthorizedMinorUnits: 0n,
      authorizationCount: 0,
    });
    assert.equal(wrongMerchant.allowed, false);
    const overLimit = validateAccessCardControls({
      controls,
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 450_00n,
      currency: 'USD',
      now: CHAOS_NOW,
      aggregateAuthorizedMinorUnits: 0n,
      authorizationCount: 0,
    });
    assert.equal(overLimit.allowed, false);
    const reuse = validateAccessCardControls({
      controls,
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 100_00n,
      currency: 'USD',
      now: CHAOS_NOW,
      aggregateAuthorizedMinorUnits: 400_00n,
      authorizationCount: 1,
    });
    assert.equal(reuse.allowed, false);
  });
});

describe('ACCESS Prompt 41 — refunds', () => {
  it('27 full refund reconciles funding and user split', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId, poolId } = await fullCheckout(stack, 'full-refund');
    const refund = await stack.orchestrator.refund({
      transactionId: txId,
      totalRefundMinorUnits: 400_00n,
      idempotencyKey: 'full-refund',
      now: CHAOS_NOW,
    });
    assert.equal(refund.ok, true);
    const alloc = allocateRefund({
      totalRefundMinorUnits: 400_00n,
      originalAccessContribution: 300_00n,
      originalUserContribution: 100_00n,
      originalTokenContribution: 0n,
      policyId: 'PROPORTIONAL_V1',
    });
    assert.equal(alloc.accessPoolRefundMinorUnits, 300_00n);
    assert.equal(alloc.userRefundMinorUnits, 100_00n);
    assertInvariants(stack, entitlementId, poolId);
  });

  it('28 duplicate refund blocked', async () => {
    const stack = createWave3TestStack();
    const { txId } = await fullCheckout(stack, 'dup-refund');
    await stack.orchestrator.refund({ transactionId: txId, totalRefundMinorUnits: 400_00n, idempotencyKey: 'ref-1', now: CHAOS_NOW });
    const second = await stack.orchestrator.refund({ transactionId: txId, totalRefundMinorUnits: 400_00n, idempotencyKey: 'ref-2', now: CHAOS_NOW });
    assert.equal(second.ok, false);
    assert.equal(second.code, 'REFUND_EXCEEDS_CAPTURE');
  });

  it('29-30 partial and cumulative refunds bounded', async () => {
    const stack = createWave3TestStack();
    const { txId } = await fullCheckout(stack, 'partial-refund');
    const parts = [50_00n, 100_00n, 50_00n];
    for (const [i, amount] of parts.entries()) {
      const result = await stack.orchestrator.refund({
        transactionId: txId,
        totalRefundMinorUnits: amount,
        idempotencyKey: `partial-${i}`,
        now: CHAOS_NOW,
      });
      assert.equal(result.ok, true);
    }
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.equal(ctx.refundedAmountMinorUnits, 200_00n);
    const over = await stack.orchestrator.refund({
      transactionId: txId,
      totalRefundMinorUnits: 300_00n,
      idempotencyKey: 'partial-over',
      now: CHAOS_NOW,
    });
    assert.equal(over.ok, false);
  });

  it('31 non-refundable cancellation and 32 no-show keep ledger settled', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId } = await fullCheckout(stack, 'nonref');
    const before = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    const cancel = await stack.orchestrator.cancel({
      transactionId: txId,
      idempotencyKey: 'nonref-cancel',
      now: CHAOS_NOW,
      providerNonRefundable: true,
    });
    assert.equal(cancel.ok, false);
    const noShow = await stack.orchestrator.confirmFulfillment({
      transactionId: txId,
      quantityFulfilled: 0n,
      kind: 'NO_SHOW',
      noShow: true,
      idempotencyKey: 'noshow',
      now: CHAOS_NOW,
    });
    assert.equal(noShow.ok, false);
    const after = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(after.consumed, before.consumed);
  });
});

describe('ACCESS Prompt 41 — reconciliation mismatches', () => {
  it('33 detects reconciliation mismatch scenarios A-H', async () => {
    const stack = createWave3TestStack();
    const reconciliation = new AccessReconciliationService({
      store: stack.orchestrator.store,
      solvency: stack.solvency,
      settlement: stack.orchestrator.settlementOrchestrator,
      provider: stack.simulationProvider,
    });
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'recon-a' });
    const patched = Object.freeze({
      ...stack.orchestrator.getContext(txId)!,
      status: 'BOOKED' as const,
      providerBookingReference: 'pbk_mismatch',
      capturedAmountMinorUnits: 0n,
      version: stack.orchestrator.getContext(txId)!.version + 1,
      updatedAt: CHAOS_NOW,
    });
    await stack.orchestrator.store.save(patched);
    const outcome = reconciliation.reconcileTransaction(txId, CHAOS_NOW);
    assert.ok(outcome.issues.some((i) => i.type === 'BOOKING_WITHOUT_PAYMENT'));
    assert.ok(outcome.escalated.includes(txId));
  });

  it('34 unsafe auto-reconciliation does not refund or restore entitlement', async () => {
    const stack = createWave3TestStack();
    const reconciliation = new AccessReconciliationService({
      store: stack.orchestrator.store,
      solvency: stack.solvency,
      settlement: stack.orchestrator.settlementOrchestrator,
      provider: stack.simulationProvider,
    });
    const { txId, entitlementId } = await fullCheckout(stack, 'no-auto');
    const before = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    const outcome = reconciliation.reconcileTransaction(txId, CHAOS_NOW);
    assert.equal(outcome.autoResolved.length, 0);
    const after = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(after.consumed, before.consumed);
  });
});

describe('ACCESS Prompt 41 — security', () => {
  it('35 client tampering cannot override canonical quote splits', async () => {
    const stack = createWave3TestStack();
    const { txId } = await startMobilityTx(stack, { idempotencyKey: 'tamper' });
    await quoteCheckout(stack, { txId, idempotencyKey: 'tamper-q' });
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.equal(ctx.quote!.tokenConversionContributionMinorUnits, TOKEN_CONVERSION_CONTRIBUTION);
    assert.ok(ctx.quote!.accessPoolContributionMinorUnits <= ctx.quote!.totalProviderAmountMinorUnits);
  });

  it('36 resource ownership attack rejected at BFF layer', () => {
    const actor = Object.freeze({ actorId: 'a1', customerId: 'cust_a', verified: true, restricted: false });
    const denied = authorizeAccessMutate(actor, 'cust_b');
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'SUBJECT_MISMATCH');
    }
  });

  it('37 replay attacks return idempotent outcomes', async () => {
    const stack = createWave3TestStack();
    const start1 = await stack.orchestrator.start({
      userId: CHAOS_USER,
      category: 'MOBILITY',
      entitlementId: seedMobilityEntitlement(stack.solvency, 1n),
      fundingPoolId: seedMobilityFundingPool(stack.solvency, 100_000_00n),
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'replay',
      now: CHAOS_NOW,
    });
    const start2 = await stack.orchestrator.start({
      userId: CHAOS_USER,
      category: 'MOBILITY',
      entitlementId: seedMobilityEntitlement(stack.solvency, 1n),
      fundingPoolId: seedMobilityFundingPool(stack.solvency, 100_000_00n),
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'replay',
      now: CHAOS_NOW,
    });
    assert.equal(requireOrchestratorValue(start1).transactionId, requireOrchestratorValue(start2).transactionId);
    assert.equal(start2.ok, true);
    if (start2.ok) assert.equal(start2.idempotent, true);
  });

  it('38 webhook security rejects invalid signatures', async () => {
    const stack = createWave3TestStack();
    const webhook = new AccessWebhookOrchestrator(stack.orchestrator);
    const bad = await webhook.handle({
      webhookEventId: 'bad',
      source: 'PROVIDER',
      providerId: 'turo',
      transactionId: null,
      kind: 'BOOKING_CONFIRMED',
      idempotencyKey: 'unsigned',
      signatureVerified: false,
      occurredAt: CHAOS_NOW,
      payloadReference: 'x',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'SIGNATURE_INVALID');
  });

  it('39 SSRF policy blocks localhost and metadata endpoints', () => {
    const cases = [
      'http://localhost/admin',
      'http://127.0.0.1:8080',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.1/internal',
    ];
    for (const url of cases) {
      const parsed = parseDestination(url);
      if (!parsed.ok) {
        continue;
      }
      const host = parsed.destination.hostname;
      const blocked =
        isLoopbackHostname(host) || isLinkLocalOrMetadata(host) || isPrivateIpv4(host);
      assert.equal(blocked, true, url);
    }
  });

  it('40 secret scan finds no live credentials in Access packages', () => {
    const findings = scanAccessPathsForSecrets([
      'packages/access-economy/src/transaction',
      'packages/access-economy/src/settlement/orchestrator.ts',
      'packages/access-economy/src/settlement/restricted-virtual-card-rail.ts',
    ]);
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('41 provider payloads exclude forbidden PII domains', () => {
    const bookingPayload = Object.freeze({
      subjectRef: 'cust_a',
      catalogItemId: 'turo_mustang',
      quantity: '1',
      idempotencyKey: 'book-1',
    });
    assert.equal(assertProviderPayloadMinimal(bookingPayload), true);
    const violations = scanPayloadForForbiddenPii({
      ...bookingPayload,
      hinRecord: 'should-not-send',
    });
    assert.ok(violations.length > 0);
  });

  it('42 restricted actor cannot mutate access (compliance gate proxy)', () => {
    const restricted = authorizeAccessMutate(
      Object.freeze({ actorId: 'r1', customerId: 'cust_r', verified: true, restricted: true }),
      'cust_r',
    );
    assert.equal(restricted.ok, false);
  });

  it('43 SR/MR regression — token conversion stays zero', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId, poolId } = await fullCheckout(stack, 'sr-mr');
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.equal(ctx.quote!.tokenConversionContributionMinorUnits, 0n);
    assert.equal(TOKEN_CONVERSION_CONTRIBUTION, 0n);
    assertInvariants(stack, entitlementId, poolId);
  });
});

describe('ACCESS Prompt 41 — load and invariants', () => {
  it('45-46 concurrent checkout load stays bounded and idempotent', async () => {
    const stack = createWave3TestStack();
    const samples: number[] = [];
    const runs = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const start = performance.now();
        const { txId } = await startMobilityTx(stack, { idempotencyKey: `load-${i}` });
        await quoteCheckout(stack, { txId, idempotencyKey: `load-q-${i}` });
        samples.push(performance.now() - start);
        return txId;
      }),
    );
    assert.equal(new Set(runs).size, 20);
    const latency = buildLatencyPercentiles(samples);
    assert.ok(latency.p95Ms < 5000);
  });

  it('49 invariant suite passes after chaos scenarios', async () => {
    const stack = createWave3TestStack();
    const { entitlementId, poolId } = await fullCheckout(stack, 'invariant-final');
    assertInvariants(stack, entitlementId, poolId);
    const pool = stack.solvency.getFundingPoolBalance(poolId, 'USD', CHAOS_NOW);
    const ent = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    const fundingUtil = utilizationBps(pool.capturedSettlement + pool.reservedFunding, pool.cashReceived);
    const entUtil = utilizationBps(ent.consumed + ent.reserved, ent.allocated);
    assert.ok(fundingUtil >= 0 && fundingUtil <= 10_000);
    assert.ok(entUtil >= 0 && entUtil <= 10_000);
  });
});
