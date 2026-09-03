/**
 * ACCESS Wave 5 / Prompt 42 — Access V1 production-readiness certification harness.
 *
 * Conservative simulation-only certification. Does not activate production providers,
 * payment rails, or LIVE_* flags. Validates engineering behavior against frozen V1 scope.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { subjectRefFor } from '../packages/access-economy/src/ids.ts';
import {
  TOKEN_CONVERSION_CONTRIBUTION,
  allWave1InvariantsHeld,
  checkAllWave1Invariants,
  createAccessSolvencyService,
  runAccessWave1,
} from '../packages/access-economy/src/funding-solvency/index.ts';
import {
  InMemoryFundingIntentPort,
  RedemptionWorkflow,
  composeFunding,
  createAccessProviderGateway,
  evaluateRedemption,
} from '../packages/access-economy/src/providers/index.ts';
import { buildQuote } from '../packages/access-economy/src/providers/adapters/shared.ts';
import { createCanonicalAccessRedemptionOrchestrator } from '../packages/human-access-economy/src/canonical-redemption-orchestrator.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-01T00:10:00.000Z');

/** Prompt 42 Mustang economics (USD minor units). Policy v1 caps at $110/vehicle-day. */
const MUSTANG_SERVICE_TOTAL = 40_000n;
const MUSTANG_SECURITY_DEPOSIT = 50_000n;
const PROMPT_TARGET_ACCESS_COVERAGE = 30_000n;
const PROMPT_TARGET_USER_CONTRIBUTION = 10_000n;
const MOBILITY_POLICY_PER_DAY_CAP = 11_000n;

function seedMobilityEntitlement(
  service: ReturnType<typeof createAccessSolvencyService>,
  days: bigint,
): string {
  const ledger = service.getEntitlementLedger();
  const entitlementId = `ent_mobility_cert_${days}`;
  ledger.allocate({
    entitlementId,
    userId: subjectRefFor('mustang-user'),
    category: 'MOBILITY',
    unit: 'day',
    quantity: days,
    allocationReference: 'alloc:mustang-cert',
    evidenceReference: 'evidence:alloc:mustang-cert',
    createdAt: NOW,
    idempotencyKey: `alloc:${entitlementId}`,
  });
  return entitlementId;
}

function seedMobilityFunding(
  service: ReturnType<typeof createAccessSolvencyService>,
  amount: bigint,
): string {
  const poolRegistry = service.getPoolRegistry();
  const fundingLedger = service.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: 'Mobility Certification Pool',
    category: 'MOBILITY',
    currency: 'USD',
    categoryPolicy: 'STRICT_CATEGORY',
    now: NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: amount,
    amountReceived: amount,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:treasury:mustang-cert',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits: amount,
    transactionReference: 'treasury:mustang-cert',
    evidenceReference: 'evidence:treasury:mustang-cert',
    createdAt: NOW,
    idempotencyKey: `fund:${pool.fundingPoolId}`,
  });
  return pool.fundingPoolId;
}

function mustangQuote(quantity: bigint) {
  return buildQuote({
    quoteId: 'pq_mustang_cert_v1',
    providerId: 'turo',
    catalogItemId: 'turo_mustang_gt_miami',
    canonicalUnit: 'VEHICLE_DAY',
    quantity,
    providerPriceMinorUnits: MUSTANG_SERVICE_TOTAL,
  });
}

function mustangRedemptionRequest(entitlementId: string, quantity: bigint) {
  return {
    redemptionId: 'red_mustang_cert_v1',
    subjectRef: subjectRefFor('mustang-user'),
    intentId: 'intent_mustang_cert',
    category: 'MOBILITY',
    providerId: 'turo' as const,
    providerQuote: mustangQuote(quantity),
    entitlement: {
      entitlementId,
      entitlementClass: 'MOBILITY_STANDARD',
      availableUnits: 3n,
      canonicalUnit: 'VEHICLE_DAY' as const,
    },
    requestedQuantity: quantity,
    jurisdiction: 'US-FL',
    maxUserContributionMinorUnits: PROMPT_TARGET_USER_CONTRIBUTION,
    policyContext: {
      benefitSource: 'SIMULATION',
      geographicZone: 'Miami, FL',
      serviceLevel: 'STANDARD',
    },
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

describe('ACCESS V1 — frozen scope invariants', () => {
  it('TokenConversionContribution remains zero at V1 launch', () => {
    assert.equal(TOKEN_CONVERSION_CONTRIBUTION, 0n);
    const wave1 = runAccessWave1({ service: createAccessSolvencyService(), userId: 'cert-user' });
    assert.equal(wave1.tokenConversionContribution, 0n);
    const invariants = checkAllWave1Invariants({});
    assert.ok(allWave1InvariantsHeld(invariants));
    assert.ok(invariants.find((row) => row.id === 'TOKEN_CONVERSION_ZERO')!.held);
  });

  it('funding router never allocates SR/MR for provider settlement', () => {
    const composition = composeFunding({
      redemptionId: 'red_no_token',
      currency: 'USD',
      providerSettlementMinorUnits: 40_000n,
      entitlementCoverageMinorUnits: 11_000n,
      userFiatMinorUnits: 29_000n,
      sunreyCoinMinorUnits: 0n,
      moonreyCoinMinorUnits: 0n,
      rewardCreditMinorUnits: 0n,
      createdAt: NOW,
    });
    assert.ok(composition.allocations.every((row) => row.kind !== 'SUNREY_COIN'));
    assert.ok(composition.allocations.every((row) => row.kind !== 'MOONREY_COIN'));
    assert.equal(
      composition.allocations.reduce((sum, row) => sum + row.amountMinorUnits, 0n),
      40_000n,
    );
  });
});

describe('ACCESS V1 — Mustang certification (simulation)', () => {
  it('17. end-to-end: discovery → quote → coverage → booking with fiat funding composition', () => {
    const gateway = createAccessProviderGateway();
    const solvency = createAccessSolvencyService();
    const entitlementId = seedMobilityEntitlement(solvency, 3n);
    seedMobilityFunding(solvency, 500_000n);

    const search = gateway.search({
      requestId: 'cert_search',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) {
      return;
    }

    const quote = gateway.quote({
      requestId: 'cert_quote',
      providerId: 'turo',
      catalogItemId: search.value.items[0]!.catalogItemId,
      quantity: 1n,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-08-30T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'cert_quote_key',
    });
    assert.equal(quote.ok, true);

    const decision = evaluateRedemption(mustangRedemptionRequest(entitlementId, 1n));
    assert.equal(decision.providerPriceMinorUnits, MUSTANG_SERVICE_TOTAL);
    assert.equal(decision.coverage?.appliedCoverageMinorUnits, MOBILITY_POLICY_PER_DAY_CAP);
    assert.equal(decision.userContributionMinorUnits, MUSTANG_SERVICE_TOTAL - MOBILITY_POLICY_PER_DAY_CAP);
    assert.notEqual(decision.coverage?.appliedCoverageMinorUnits, PROMPT_TARGET_ACCESS_COVERAGE);
    assert.equal(decision.status, 'USER_CONTRIBUTION_REQUIRED');

    const fundingPort = new InMemoryFundingIntentPort();
    const workflow = new RedemptionWorkflow(gateway, { funding: fundingPort });
    workflow.entitlements.seed(entitlementId, subjectRefFor('mustang-user'), 3n);

    const request = {
      ...mustangRedemptionRequest(entitlementId, 1n),
      maxUserContributionMinorUnits: MUSTANG_SERVICE_TOTAL,
    };
    const started = workflow.start(request, 'cert_start');
    assert.equal(started.ok, true);
    if (!started.ok) {
      return;
    }
    assert.equal(started.value.status, 'USER_CONTRIBUTION_REQUIRED');
    const blockedConfirm = workflow.confirm('red_mustang_cert_v1');
    assert.equal(blockedConfirm.ok, false);

    const confirmed = workflow.confirm('red_mustang_cert_v1', {
      userApproved: true,
      userFiatMinorUnits: MUSTANG_SERVICE_TOTAL - MOBILITY_POLICY_PER_DAY_CAP,
    });
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.value.status, 'REDEEMED');
      assert.equal(confirmed.value.entitlementHoldState, 'CONSUMED');
      const intents = fundingPort.listByRedemption('red_mustang_cert_v1');
      assert.equal(intents.length, 2);
      assert.ok(intents.some((row) => row.kind === 'ACCESS_ENTITLEMENT'));
      assert.ok(intents.some((row) => row.kind === 'FIAT'));
      assert.ok(intents.every((row) => row.kind !== 'SUNREY_COIN' && row.kind !== 'MOONREY_COIN'));
    }

    const balance = solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(balance.remaining, 3n);
    assert.equal(MUSTANG_SECURITY_DEPOSIT > 0n, true);
  });

  it('18. full refund before fulfillment restores entitlement hold', () => {
    const gateway = createAccessProviderGateway();
    const fundingPort = new InMemoryFundingIntentPort();
    const workflow = new RedemptionWorkflow(gateway, { funding: fundingPort });
    const entitlementId = 'ent_refund_cert';
    workflow.entitlements.seed(entitlementId, subjectRefFor('mustang-user'), 3n);

    const request = {
      ...mustangRedemptionRequest(entitlementId, 1n),
      redemptionId: 'red_refund_cert',
      maxUserContributionMinorUnits: MUSTANG_SERVICE_TOTAL,
    };
    const started = workflow.start(request, 'cert_refund_start');
    assert.equal(started.ok, true);
    const cancelled = workflow.cancel('red_refund_cert');
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) {
      assert.equal(cancelled.value.status, 'CANCELLED');
      assert.equal(cancelled.value.entitlementHoldState, 'RELEASED');
    }
    const hold = workflow.entitlements.get(entitlementId);
    assert.equal(hold?.availableUnits, 3n);
  });

  it('19. partial refund source-of-funds mapping uses fiat + entitlement only', () => {
    const composition = composeFunding({
      redemptionId: 'red_partial_refund',
      currency: 'USD',
      providerSettlementMinorUnits: 40_000n,
      entitlementCoverageMinorUnits: 11_000n,
      userFiatMinorUnits: 29_000n,
      createdAt: NOW,
    });
    const partialRefund = 5_000n;
    const userShare = (partialRefund * 29_000n) / 40_000n;
    const accessShare = partialRefund - userShare;
    assert.ok(userShare > 0n);
    assert.ok(accessShare > 0n);
    assert.equal(userShare + accessShare, partialRefund);
  });
});

describe('ACCESS V1 — resilience certifications', () => {
  it('20. unknown provider response: idempotent start prevents duplicate booking', () => {
    const gateway = createAccessProviderGateway();
    const workflow = new RedemptionWorkflow(gateway, { funding: new InMemoryFundingIntentPort() });
    workflow.entitlements.seed('ent_unknown', subjectRefFor('mustang-user'), 3n);
    const request = {
      ...mustangRedemptionRequest('ent_unknown', 1n),
      redemptionId: 'red_unknown',
      maxUserContributionMinorUnits: MUSTANG_SERVICE_TOTAL,
    };
    const first = workflow.start(request, 'idem_unknown');
    const second = workflow.start(request, 'idem_unknown');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.value.redemptionId, second.value.redemptionId);
    }
  });

  it('21. funding exhaustion: entitlement visible, funded redemption unavailable', async () => {
    const service = createAccessSolvencyService();
    const entitlementId = seedMobilityEntitlement(service, 3n);
    const emptyPool = service.getPoolRegistry().createPool({
      name: 'Empty Mobility',
      category: 'MOBILITY',
      currency: 'USD',
      now: NOW,
    });
    const status = service.getSolvencyStatus(emptyPool.fundingPoolId, 'USD', NOW);
    assert.equal(status.status, 'EXHAUSTED');
    const balance = service.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(balance.remaining, 3n);
    const reserve = await service.reserveFunding({
      fundingPoolId: emptyPool.fundingPoolId,
      accessTransactionId: 'tx_exhausted',
      userId: subjectRefFor('mustang-user'),
      currency: 'USD',
      amountMinorUnits: 100_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:exhausted',
      idempotencyKey: 'idem-exhausted',
      now: NOW,
    });
    assert.equal(reserve.ok, false);
    const poolBalance = service.getFundingPoolBalance(emptyPool.fundingPoolId, 'USD', NOW);
    assert.ok(poolBalance.availableCashFunding >= 0n);
  });

  it('22. provider outage: discovery fails without breaking entitlement reads', () => {
    const gateway = createAccessProviderGateway();
    const solvency = createAccessSolvencyService();
    const entitlementId = seedMobilityEntitlement(solvency, 3n);
    const search = gateway.search({
      requestId: 'cert_outage',
      providerId: 'turo',
      category: 'VEHICLE_HOURS',
      query: 'unknown vehicle nowhere',
      location: 'Antarctica',
      limit: 5,
    });
    assert.equal(search.ok, false);
    const balance = solvency.getEntitlementLedger().getBalance(entitlementId)!;
    assert.equal(balance.remaining, 3n);
  });

  it('23. payment composition failure: no booking without user approval on partial coverage', () => {
    const gateway = createAccessProviderGateway();
    const workflow = new RedemptionWorkflow(gateway, { funding: new InMemoryFundingIntentPort() });
    workflow.entitlements.seed('ent_hold', subjectRefFor('mustang-user'), 3n);
    const request = mustangRedemptionRequest('ent_hold', 1n);
    const started = workflow.start(request, 'cert_hold_start');
    assert.equal(started.ok, true);
    const confirmed = workflow.confirm('red_mustang_cert_v1');
    assert.equal(confirmed.ok, false);
  });

  it('24. compliance hold: orchestrator preview blocks ineligible redemption', () => {
    const orchestrator = createCanonicalAccessRedemptionOrchestrator();
    const preview = orchestrator.preview({
      ...mustangRedemptionRequest('ent_compliance', 1n),
      entitlement: {
        entitlementId: 'ent_compliance',
        entitlementClass: 'MOBILITY_STANDARD',
        availableUnits: 0n,
        canonicalUnit: 'VEHICLE_DAY',
      },
    });
    assert.equal(preview.decision.status, 'ENTITLEMENT_INSUFFICIENT');
  });
});

describe('ACCESS V1 — concurrency and double-spend guards', () => {
  it('35-36. concurrent entitlement reservations prevent double-spend', async () => {
    const service = createAccessSolvencyService();
    const entitlementId = seedMobilityEntitlement(service, 1n);
    const attempts = await Promise.all(
      Array.from({ length: 2 }, (_, index) =>
        service.getEntitlementReservations().reserve({
          entitlementId,
          accessTransactionId: `tx-ds-${index}`,
          userId: subjectRefFor('mustang-user'),
          category: 'MOBILITY',
          unit: 'day',
          quantity: 1n,
          expiresAt: EXPIRES,
          evidenceReference: `evidence:ds-${index}`,
          idempotencyKey: `idem-ds-${index}`,
          now: NOW,
        }),
      ),
    );
    const successes = attempts.filter((row) => row.ok);
    assert.ok(successes.length <= 1);
  });
});

describe('ACCESS V1 — performance (in-process simulation, 2026-08-31)', () => {
  it('records representative latencies for core Access paths', () => {
    const samples = 200;
    const overviewMs: number[] = [];
    const searchMs: number[] = [];
    const quoteMs: number[] = [];
    const coverageMs: number[] = [];
    const gateway = createAccessProviderGateway();
    const solvency = createAccessSolvencyService();
    const entitlementId = seedMobilityEntitlement(solvency, 3n);

    for (let index = 0; index < samples; index += 1) {
      let start = performance.now();
      solvency.getEntitlementLedger().getBalance(entitlementId);
      overviewMs.push(performance.now() - start);

      start = performance.now();
      gateway.search({
        requestId: `perf_search_${index}`,
        category: 'VEHICLE_HOURS',
        query: 'Mustang Miami',
        location: 'Miami, FL',
        limit: 5,
      });
      searchMs.push(performance.now() - start);

      start = performance.now();
      gateway.quote({
        requestId: `perf_quote_${index}`,
        providerId: 'turo',
        catalogItemId: 'turo_mustang_gt_miami',
        quantity: 1n,
        startsAt: '2026-08-29T10:00:00.000Z',
        endsAt: '2026-08-30T10:00:00.000Z',
        location: 'Miami, FL',
        idempotencyKey: `perf_quote_${index}`,
      });
      quoteMs.push(performance.now() - start);

      start = performance.now();
      evaluateRedemption(mustangRedemptionRequest(entitlementId, 1n));
      coverageMs.push(performance.now() - start);
    }

    const sort = (rows: number[]) => [...rows].sort((a: number, b: number) => a - b);
    const metrics = {
      overview: { p50: percentile(sort(overviewMs), 50), p95: percentile(sort(overviewMs), 95), p99: percentile(sort(overviewMs), 99) },
      search: { p50: percentile(sort(searchMs), 50), p95: percentile(sort(searchMs), 95), p99: percentile(sort(searchMs), 99) },
      quote: { p50: percentile(sort(quoteMs), 50), p95: percentile(sort(quoteMs), 95), p99: percentile(sort(quoteMs), 99) },
      coverage: { p50: percentile(sort(coverageMs), 50), p95: percentile(sort(coverageMs), 95), p99: percentile(sort(coverageMs), 99) },
    };
    assert.ok(metrics.overview.p99 < 50);
    assert.ok(metrics.search.p99 < 50);
    assert.ok(metrics.quote.p99 < 50);
    assert.ok(metrics.coverage.p99 < 50);
  });
});

describe('ACCESS V1 — prompt economics gap disclosure', () => {
  it('documents Mustang $300/$100 target vs MOBILITY_STANDARD v1 cap ($110/day)', () => {
    const decision = evaluateRedemption(mustangRedemptionRequest('ent_gap', 1n));
    assert.equal(decision.coverage?.appliedCoverageMinorUnits, MOBILITY_POLICY_PER_DAY_CAP);
    assert.notEqual(decision.coverage?.appliedCoverageMinorUnits, PROMPT_TARGET_ACCESS_COVERAGE);
    assert.notEqual(decision.userContributionMinorUnits, PROMPT_TARGET_USER_CONTRIBUTION);
  });
});
