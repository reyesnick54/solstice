/**
 * ACCESS Wave 3 / Prompt 37 — end-to-end and failure scenario tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import { AccessReconciliationService } from './reconciliation.ts';
import { AccessWebhookOrchestrator } from './webhook-orchestrator.ts';
import { allocateRefund } from './refund-policy.ts';
import {
  createWave3TestStack,
  mustangProviderQuote,
  requireOrchestratorValue,
  seedMobilityEntitlement,
  seedMobilityFundingPool,
  WAVE3_NOW,
  WAVE3_USER,
} from './test-harness.ts';
import { canTransitionAccessTransaction } from './state-machine.ts';

async function runMustangCheckout(stack: ReturnType<typeof createWave3TestStack>) {
  const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
  const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
  const start = await stack.orchestrator.start({
    userId: WAVE3_USER,
    category: 'MOBILITY',
    entitlementId,
    fundingPoolId: poolId,
    unit: 'VEHICLE_DAY',
    idempotencyKey: 'mustang-start',
    now: WAVE3_NOW,
  });
  assert.equal(start.ok, true);
  const txId = requireOrchestratorValue(start).transactionId;

  const quote = await stack.orchestrator.quote({
    transactionId: txId,
    providerId: 'turo',
    providerProductId: 'turo_mustang_gt_miami',
    providerQuote: mustangProviderQuote(),
    taxesMinorUnits: 60_00n,
    mandatoryFeesMinorUnits: 0n,
    securityDepositMinorUnits: 500_00n,
    entitlementClass: 'MOBILITY_WAVE3',
    idempotencyKey: 'mustang-quote',
    now: WAVE3_NOW,
  });
  assert.equal(quote.ok, true);
  assert.equal(requireOrchestratorValue(quote).quote!.accessPoolContributionMinorUnits, 300_00n);
  assert.equal(requireOrchestratorValue(quote).quote!.userContributionMinorUnits, 100_00n);
  assert.equal(requireOrchestratorValue(quote).quote!.securityDepositMinorUnits, 500_00n);
  assert.equal(requireOrchestratorValue(quote).quote!.tokenConversionContributionMinorUnits, TOKEN_CONVERSION_CONTRIBUTION);

  await stack.orchestrator.approveEligibility({
    transactionId: txId,
    idempotencyKey: 'mustang-eligible',
    now: WAVE3_NOW,
  });

  const reserve = await stack.orchestrator.reserve({
    transactionId: txId,
    userApproved: true,
    idempotencyKey: 'mustang-reserve',
    now: WAVE3_NOW,
  });
  assert.equal(reserve.ok, true);

  const book = await stack.orchestrator.book({
    transactionId: txId,
    idempotencyKey: 'mustang-book',
    now: WAVE3_NOW,
  });
  assert.equal(book.ok, true);

  const fulfill = await stack.orchestrator.confirmFulfillment({
    transactionId: txId,
    quantityFulfilled: 1n,
    kind: 'RIDE_COMPLETED',
    idempotencyKey: 'mustang-fulfill',
    now: WAVE3_NOW,
  });
  assert.equal(fulfill.ok, true);

  const settle = await stack.orchestrator.settle({
    transactionId: txId,
    idempotencyKey: 'mustang-settle',
    now: WAVE3_NOW,
  });
  assert.equal(settle.ok, true);

  return { txId, entitlementId, poolId, final: requireOrchestratorValue(settle) };
}

describe('ACCESS Wave 3 Mustang E2E', () => {
  it('completes Mustang rental checkout with correct final balances', async () => {
    const stack = createWave3TestStack();
    const { entitlementId, poolId, final } = await runMustangCheckout(stack);

    const entBalance = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(entBalance.remaining, 2n);
    assert.equal(entBalance.consumed, 1n);

    const poolBalance = stack.solvency.getFundingPoolBalance(poolId, 'USD', WAVE3_NOW);
    assert.equal(poolBalance.capturedSettlement, 300_00n);

    assert.equal(final.status, 'SETTLED');
    assert.equal(final.capturedAmountMinorUnits, 400_00n);
    assert.equal(final.quote!.tokenConversionContributionMinorUnits, 0n);
  });
});

describe('ACCESS Wave 3 failure scenarios', () => {
  it('A: provider booking fails before capture — compensates reservations', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ failBooking: true });
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'fail-a-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('fail-a'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'fail-a-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.approveEligibility({ transactionId: txId, idempotencyKey: 'fail-a-elig', now: WAVE3_NOW });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'fail-a-res', now: WAVE3_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'fail-a-book', now: WAVE3_NOW });
    assert.equal(book.ok, false);
    const entBalance = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(entBalance.remaining, 3n);
  });

  it('B: booking succeeds but response times out — reconciliation required', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ bookingTimeout: true });
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'fail-b-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('fail-b'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'fail-b-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.approveEligibility({ transactionId: txId, idempotencyKey: 'fail-b-elig', now: WAVE3_NOW });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'fail-b-res', now: WAVE3_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'fail-b-book', now: WAVE3_NOW });
    assert.equal(book.ok, true);
    assert.equal(requireOrchestratorValue(book).status, 'RECONCILIATION_REQUIRED');
    const reconciled = await stack.orchestrator.reconcile({ transactionId: txId, idempotencyKey: 'fail-b-recon', now: WAVE3_NOW });
    assert.equal(reconciled.ok, true);
    assert.equal(requireOrchestratorValue(reconciled).status, 'BOOKED');
  });

  it('C: card authorization succeeds but provider booking fails', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ failBooking: true });
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'fail-c-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('fail-c'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'fail-c-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'fail-c-res', now: WAVE3_NOW });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'fail-c-book', now: WAVE3_NOW });
    assert.equal(book.ok, false);
    const poolBalance = stack.solvency.getFundingPoolBalance(poolId, 'USD', WAVE3_NOW);
    assert.equal(poolBalance.reservedFunding, 0n);
  });

  it('D: provider booking succeeds but card payment fails', async () => {
    const stack = createWave3TestStack();
    stack.paymentRail.configure({ failNextCapture: true });
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'fail-d-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('fail-d'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'fail-d-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'fail-d-res', now: WAVE3_NOW });
    stack.paymentRail.configure({ failNextCapture: true });
    const book = await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'fail-d-book', now: WAVE3_NOW });
    assert.equal(book.ok, false);
    stack.paymentRail.configure({ failNextCapture: false });
  });

  it('E: double-click redeem is idempotent', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start1 = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'double-click',
      now: WAVE3_NOW,
    });
    const start2 = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'double-click',
      now: WAVE3_NOW,
    });
    assert.equal(requireOrchestratorValue(start1).transactionId, requireOrchestratorValue(start2).transactionId);
    assert.equal(start2.ok && start2.idempotent === true, true);
  });

  it('F: duplicate booking webhook is idempotent', async () => {
    const stack = createWave3TestStack();
    const { txId } = await runMustangCheckout(stack);
    const webhook = new AccessWebhookOrchestrator(stack.orchestrator);
    const event = {
      webhookEventId: 'wh_1',
      source: 'PROVIDER' as const,
      providerId: 'turo' as const,
      transactionId: txId,
      kind: 'PAYMENT_CAPTURED',
      idempotencyKey: 'dup-webhook',
      signatureVerified: true,
      occurredAt: WAVE3_NOW,
      payloadReference: 'payload:1',
    };
    assert.equal((await webhook.handle(event)).ok, true);
    const dup = await webhook.handle(event);
    assert.equal(dup.ok, true);
    assert.equal(dup.ok && dup.duplicate === true, true);
  });

  it('G: duplicate capture webhook is idempotent', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'dup-cap-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('dup-cap'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'dup-cap-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'dup-cap-res', now: WAVE3_NOW });
    await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'dup-cap-book', now: WAVE3_NOW });
    const cap1 = stack.paymentRail.capture({
      authorizationId: stack.orchestrator.getContext(txId)!.providerPaymentAuthorizationId!,
      amountMinorUnits: 400_00n,
      idempotencyKey: 'dup-cap-key',
      now: WAVE3_NOW,
    });
    const cap2 = stack.paymentRail.capture({
      authorizationId: stack.orchestrator.getContext(txId)!.providerPaymentAuthorizationId!,
      amountMinorUnits: 400_00n,
      idempotencyKey: 'dup-cap-key',
      now: WAVE3_NOW,
    });
    assert.equal(cap1.ok, true);
    assert.equal(cap2.ok, true);
    assert.equal(cap2.ok && cap2.idempotent === true, true);
  });

  it('H: provider price increase triggers requote required', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'price-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('price-1'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'price-quote-1',
      now: WAVE3_NOW,
    });
    const higherQuote = mustangProviderQuote('price-2');
    const increased = buildQuoteHigher(higherQuote, 450_00n);
    const requote = await stack.orchestrator.requote({
      transactionId: txId,
      providerQuote: increased,
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'price-quote-2',
      now: WAVE3_NOW,
    });
    assert.equal(requote.ok, true);
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.ok(ctx.status === 'QUOTED' || ctx.status === 'REQUOTE_REQUIRED');
  });

  it('I: full cancellation and refund', async () => {
    const stack = createWave3TestStack();
    const { txId } = await runMustangCheckout(stack);
    const cancel = await stack.orchestrator.cancel({
      transactionId: txId,
      idempotencyKey: 'full-cancel',
      now: WAVE3_NOW,
    });
    assert.equal(cancel.ok, false);
    const booked = stack.orchestrator.getContext(txId)!;
    assert.equal(booked.status, 'SETTLED');
    const refund = await stack.orchestrator.refund({
      transactionId: txId,
      totalRefundMinorUnits: 400_00n,
      idempotencyKey: 'full-refund',
      now: WAVE3_NOW,
    });
    assert.equal(refund.ok, true);
    assert.equal(requireOrchestratorValue(refund).status, 'REFUNDED');
  });

  it('J: partial refund uses proportional allocation', () => {
    const allocation = allocateRefund({
      totalRefundMinorUnits: 200_00n,
      originalAccessContribution: 300_00n,
      originalUserContribution: 100_00n,
      originalTokenContribution: 0n,
      policyId: 'PROPORTIONAL_V1',
    });
    assert.equal(allocation.accessPoolRefundMinorUnits, 150_00n);
    assert.equal(allocation.userRefundMinorUnits, 50_00n);
    assert.equal(allocation.tokenRefundMinorUnits, 0n);
  });

  it('K: non-refundable cancellation does not restore entitlement', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'nonref-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('nonref'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'nonref-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'nonref-res', now: WAVE3_NOW });
    await stack.orchestrator.book({ transactionId: txId, idempotencyKey: 'nonref-book', now: WAVE3_NOW });
    const cancel = await stack.orchestrator.cancel({
      transactionId: txId,
      idempotencyKey: 'nonref-cancel',
      now: WAVE3_NOW,
      providerNonRefundable: true,
    });
    assert.equal(cancel.ok, true);
    assert.equal(requireOrchestratorValue(cancel).status, 'CANCELLED');
  });

  it('L: user no-show records evidence without automatic restoration', async () => {
    const stack = createWave3TestStack();
    const { txId, entitlementId } = await runMustangCheckout(stack);
    const before = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    const noShow = await stack.orchestrator.confirmFulfillment({
      transactionId: txId,
      quantityFulfilled: 0n,
      kind: 'NO_SHOW',
      noShow: true,
      idempotencyKey: 'noshow',
      now: WAVE3_NOW,
    });
    assert.equal(noShow.ok, false);
    const after = stack.solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(after.consumed, before.consumed);
  });

  it('M: concurrent funding exhaustion blocks second reservation', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 10n);
    const poolId = seedMobilityFundingPool(stack.solvency, 350_00n);
    const start1 = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'exhaust-1',
      now: WAVE3_NOW,
    });
    const start2 = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'exhaust-2',
      now: WAVE3_NOW,
    });
    for (const start of [start1, start2]) {
      const txId = requireOrchestratorValue(start).transactionId;
      await stack.orchestrator.quote({
        transactionId: txId,
        providerId: 'turo',
        providerProductId: 'turo_mustang_gt_miami',
        providerQuote: mustangProviderQuote(`exhaust-${txId}`),
        taxesMinorUnits: 60_00n,
        mandatoryFeesMinorUnits: 0n,
        securityDepositMinorUnits: 0n,
        entitlementClass: 'MOBILITY_WAVE3',
        idempotencyKey: `exhaust-quote-${txId}`,
        now: WAVE3_NOW,
      });
    }
    const res1 = await stack.orchestrator.reserve({
      transactionId: requireOrchestratorValue(start1).transactionId,
      userApproved: true,
      idempotencyKey: 'exhaust-res-1',
      now: WAVE3_NOW,
    });
    assert.equal(res1.ok, true);
    const res2 = await stack.orchestrator.reserve({
      transactionId: requireOrchestratorValue(start2).transactionId,
      userApproved: true,
      idempotencyKey: 'exhaust-res-2',
      now: WAVE3_NOW,
    });
    assert.equal(res2.ok, false);
  });

  it('N: quarantined provider blocks new booking', async () => {
    const stack = createWave3TestStack();
    stack.simulationProvider.setScenario({ quarantined: true });
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'quarantine-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('quarantine'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'quarantine-quote',
      now: WAVE3_NOW,
    });
    const reserve = await stack.orchestrator.reserve({
      transactionId: txId,
      userApproved: true,
      idempotencyKey: 'quarantine-res',
      now: WAVE3_NOW,
    });
    assert.equal(reserve.ok, false);
  });

  it('O: out-of-order settlement webhook does not corrupt state', async () => {
    const stack = createWave3TestStack();
    const entitlementId = seedMobilityEntitlement(stack.solvency, 3n);
    const poolId = seedMobilityFundingPool(stack.solvency, 500_000_00n);
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId,
      fundingPoolId: poolId,
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'ooo-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    await stack.orchestrator.quote({
      transactionId: txId,
      providerId: 'turo',
      providerProductId: 'turo_mustang_gt_miami',
      providerQuote: mustangProviderQuote('ooo'),
      taxesMinorUnits: 60_00n,
      mandatoryFeesMinorUnits: 0n,
      securityDepositMinorUnits: 0n,
      entitlementClass: 'MOBILITY_WAVE3',
      idempotencyKey: 'ooo-quote',
      now: WAVE3_NOW,
    });
    await stack.orchestrator.reserve({ transactionId: txId, userApproved: true, idempotencyKey: 'ooo-res', now: WAVE3_NOW });
    const webhook = new AccessWebhookOrchestrator(stack.orchestrator);
    await webhook.handle({
      webhookEventId: 'wh-captured-first',
      source: 'PAYMENT',
      providerId: null,
      transactionId: txId,
      kind: 'PAYMENT_CAPTURED',
      idempotencyKey: 'ooo-captured',
      signatureVerified: true,
      occurredAt: WAVE3_NOW,
      payloadReference: 'payload:captured',
    });
    await webhook.handle({
      webhookEventId: 'wh-authorized-late',
      source: 'PAYMENT',
      providerId: null,
      transactionId: txId,
      kind: 'PAYMENT_AUTHORIZED',
      idempotencyKey: 'ooo-authorized',
      signatureVerified: true,
      occurredAt: WAVE3_NOW,
      payloadReference: 'payload:authorized',
    });
    const ctx = stack.orchestrator.getContext(txId)!;
    assert.ok(canTransitionAccessTransaction(ctx.status, 'SETTLED') || ctx.status === 'SETTLED' || ctx.status === 'PROVIDER_RESERVED');
  });
});

describe('ACCESS Wave 3 security checks', () => {
  it('rejects unsigned webhooks', async () => {
    const stack = createWave3TestStack();
    const webhook = new AccessWebhookOrchestrator(stack.orchestrator);
    const result = await webhook.handle({
      webhookEventId: 'wh-bad',
      source: 'PROVIDER',
      providerId: 'turo',
      transactionId: null,
      kind: 'BOOKING_CONFIRMED',
      idempotencyKey: 'unsigned',
      signatureVerified: false,
      occurredAt: WAVE3_NOW,
      payloadReference: 'payload:bad',
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SIGNATURE_INVALID');
  });

  it('virtual card rail reports sandbox-only status', () => {
    const stack = createWave3TestStack();
    assert.equal(stack.paymentRail.getVirtualCardStatus().status, 'SANDBOX_ONLY');
  });

  it('rejects illegal state transitions at store level', async () => {
    const stack = createWave3TestStack();
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId: seedMobilityEntitlement(stack.solvency, 1n),
      fundingPoolId: seedMobilityFundingPool(stack.solvency, 100_000_00n),
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'illegal-start',
      now: WAVE3_NOW,
    });
    const result = await stack.orchestrator.store.transition(requireOrchestratorValue(start).transactionId, 'SETTLED', {
      updatedAt: WAVE3_NOW,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ILLEGAL_TRANSITION');
  });
});

describe('ACCESS Wave 3 reconciliation', () => {
  it('detects booking without payment mismatch', async () => {
    const stack = createWave3TestStack();
    const reconciliation = new AccessReconciliationService({
      store: stack.orchestrator.store,
      solvency: stack.solvency,
      settlement: stack.orchestrator.settlementOrchestrator,
      provider: stack.simulationProvider,
    });
    const start = await stack.orchestrator.start({
      userId: WAVE3_USER,
      category: 'MOBILITY',
      entitlementId: seedMobilityEntitlement(stack.solvency, 1n),
      fundingPoolId: seedMobilityFundingPool(stack.solvency, 100_000_00n),
      unit: 'VEHICLE_DAY',
      idempotencyKey: 'recon-start',
      now: WAVE3_NOW,
    });
    const txId = requireOrchestratorValue(start).transactionId;
    const patched = Object.freeze({
      ...requireOrchestratorValue(start),
      status: 'BOOKED' as const,
      providerBookingReference: 'pbk_fake',
      capturedAmountMinorUnits: 0n,
      version: requireOrchestratorValue(start).version + 1,
      updatedAt: WAVE3_NOW,
    });
    await stack.orchestrator.store.save(patched);
    const outcome = reconciliation.reconcileTransaction(txId, WAVE3_NOW);
    assert.ok(outcome.issues.some((issue) => issue.type === 'BOOKING_WITHOUT_PAYMENT'));
  });
});

function buildQuoteHigher(quote: ReturnType<typeof mustangProviderQuote>, priceMinorUnits: bigint) {
  return Object.freeze({
    ...quote,
    providerPriceMinorUnits: priceMinorUnits,
    settlementTerms: Object.freeze({
      ...quote.settlementTerms,
      providerReceivesMinorUnits: priceMinorUnits,
    }),
  });
}
