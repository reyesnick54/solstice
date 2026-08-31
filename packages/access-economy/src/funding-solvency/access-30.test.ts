import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import {
  allWave1InvariantsHeld,
  checkAllWave1Invariants,
  createAccessSolvencyService,
  runAccessWave1,
  TOKEN_CONVERSION_CONTRIBUTION,
} from './index.ts';

const NOW = asUtcInstant('2026-08-31T23:59:59.999Z');
const EXPIRES = asUtcInstant('2026-09-01T00:10:00.000Z');
const EXPIRED = asUtcInstant('2025-01-01T00:00:00.000Z');

function seedFundingPool(
  service: ReturnType<typeof createAccessSolvencyService>,
  amount: bigint,
  category: string | null = 'MOBILITY',
): { poolId: string; sourceId: string } {
  const poolRegistry = service.getPoolRegistry();
  const fundingLedger = service.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: `${category ?? 'GLOBAL'} Pool`,
    category,
    currency: 'USD',
    categoryPolicy: category ? 'STRICT_CATEGORY' : 'SHARED_POOL',
    now: NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: amount,
    amountReceived: amount,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:treasury',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits: amount,
    transactionReference: 'treasury:seed',
    evidenceReference: 'evidence:treasury',
    createdAt: NOW,
    idempotencyKey: `fund:${pool.fundingPoolId}`,
  });
  return { poolId: pool.fundingPoolId, sourceId: source.sourceId };
}

function seedEntitlement(
  service: ReturnType<typeof createAccessSolvencyService>,
  quantity: bigint,
  category = 'MOBILITY',
): string {
  const ledger = service.getEntitlementLedger();
  const entitlementId = `ent_${category}_test`;
  ledger.allocate({
    entitlementId,
    userId: subjectRefFor('user-1'),
    category,
    unit: 'day',
    quantity,
    allocationReference: 'alloc:test',
    evidenceReference: 'evidence:alloc',
    createdAt: NOW,
    idempotencyKey: `alloc:${entitlementId}`,
  });
  return entitlementId;
}

describe('ACCESS-30 entitlement ledger', () => {
  it('1. records allocation', () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.equal(balance.allocated, 3n);
    assert.equal(balance.remaining, 3n);
  });

  it('2. records reservation', async () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const result = await service.getEntitlementReservations().reserve({
      entitlementId: id,
      accessTransactionId: 'tx-1',
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 2n,
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:reserve',
      idempotencyKey: 'idem-ent-1',
      now: NOW,
    });
    assert.equal(result.ok, true);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.equal(balance.reserved, 2n);
    assert.equal(balance.remaining, 1n);
  });

  it('3. records release', async () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const reserved = await service.getEntitlementReservations().reserve({
      entitlementId: id,
      accessTransactionId: 'tx-1',
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 2n,
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:reserve',
      idempotencyKey: 'idem-ent-2',
      now: NOW,
    });
    assert.equal(reserved.ok, true);
    const released = await service.getEntitlementReservations().release({
      entitlementReservationId: reserved.reservation!.entitlementReservationId,
      evidenceReference: 'evidence:release',
      idempotencyKey: 'idem-ent-release',
      now: NOW,
    });
    assert.ok(released);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.equal(balance.reserved, 0n);
    assert.equal(balance.remaining, 3n);
  });

  it('4. records redemption', async () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const reserved = await service.getEntitlementReservations().reserve({
      entitlementId: id,
      accessTransactionId: 'tx-2',
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 1n,
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:reserve',
      idempotencyKey: 'idem-ent-3',
      now: NOW,
    });
    const consumed = await service.getEntitlementReservations().consume({
      entitlementReservationId: reserved.reservation!.entitlementReservationId,
      evidenceReference: 'evidence:consume',
      idempotencyKey: 'idem-ent-consume',
      now: NOW,
    });
    assert.ok(consumed);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.equal(balance.consumed, 1n);
    assert.equal(balance.remaining, 2n);
  });

  it('5. records reversal', () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const ledger = service.getEntitlementLedger();
    ledger.reserve({
      entitlementId: id,
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 1n,
      reservationReference: 'res-1',
      transactionReference: 'tx-3',
      evidenceReference: 'evidence:reserve',
      createdAt: NOW,
    });
    ledger.redeem({
      entitlementId: id,
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 1n,
      reservationReference: 'res-1',
      transactionReference: 'tx-3',
      evidenceReference: 'evidence:redeem',
      createdAt: NOW,
    });
    ledger.reverse({
      entitlementId: id,
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 1n,
      transactionReference: 'tx-3-reversal',
      evidenceReference: 'evidence:reversal',
      createdAt: NOW,
    });
    const balance = ledger.getBalance(id)!;
    assert.equal(balance.consumed, 0n);
    assert.equal(balance.remaining, 3n);
  });

  it('6. records expiration', () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    service.getEntitlementLedger().expire({
      entitlementId: id,
      userId: subjectRefFor('user-1'),
      category: 'MOBILITY',
      unit: 'day',
      quantity: 1n,
      transactionReference: 'tx-expire',
      evidenceReference: 'evidence:expire',
      createdAt: NOW,
    });
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.equal(balance.expired, 1n);
    assert.equal(balance.remaining, 2n);
  });
});

describe('ACCESS-30 funding ledger', () => {
  it('7. records funding received', () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 100_000_00n);
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.totalReceived, 100_000_00n);
    assert.equal(balance.availableCashFunding, 100_000_00n);
  });

  it('8. records funding reserve', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const result = await service.reserveFunding({
      fundingPoolId: poolId,
      accessTransactionId: 'tx-fund-1',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 300_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:fund-reserve',
      idempotencyKey: 'idem-fund-1',
      now: NOW,
    });
    assert.equal(result.ok, true);
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.availableCashFunding, 700_00n);
  });

  it('9. records funding release', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const reserved = await service.reserveFunding({
      fundingPoolId: poolId,
      accessTransactionId: 'tx-fund-2',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 300_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:fund-reserve',
      idempotencyKey: 'idem-fund-2',
      now: NOW,
    });
    await service.releaseFunding({
      fundingReservationId: reserved.reservation!.fundingReservationId,
      evidenceReference: 'evidence:fund-release',
      idempotencyKey: 'idem-fund-release',
      now: NOW,
    });
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.availableCashFunding, 1_000_00n);
  });

  it('10. records funding consume', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const reserved = await service.reserveFunding({
      fundingPoolId: poolId,
      accessTransactionId: 'tx-fund-3',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 300_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:fund-reserve',
      idempotencyKey: 'idem-fund-3',
      now: NOW,
    });
    const consumed = await service.consumeFunding({
      fundingReservationId: reserved.reservation!.fundingReservationId,
      evidenceReference: 'evidence:fund-consume',
      idempotencyKey: 'idem-fund-consume',
      now: NOW,
    });
    assert.ok(consumed);
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.capturedSettlement, 300_00n);
    assert.equal(balance.availableCashFunding, 700_00n);
    assert.ok(service.getFundingLedger().listEntries(poolId).length > 0);
  });

  it('11. records refund', () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    service.getFundingLedger().recordRefund({
      fundingPoolId: poolId,
      currency: 'USD',
      amountMinorUnits: 50_00n,
      transactionReference: 'refund:1',
      evidenceReference: 'evidence:refund',
      createdAt: NOW,
      idempotencyKey: 'refund:1',
    });
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.totalReceived, 1_050_00n);
  });
});

describe('ACCESS-30 category and expiration', () => {
  it('12. enforces category-specific pool', async () => {
    const service = createAccessSolvencyService();
    const mobility = seedFundingPool(service, 100_000_00n, 'MOBILITY');
    seedFundingPool(service, 50_000_00n, 'STAY');

    const ok = await service.reserveFunding({
      fundingPoolId: mobility.poolId,
      accessTransactionId: 'tx-cat-1',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 100_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:cat',
      idempotencyKey: 'idem-cat-ok',
      now: NOW,
    });
    assert.equal(ok.ok, true);

    const bad = await service.reserveFunding({
      fundingPoolId: mobility.poolId,
      accessTransactionId: 'tx-cat-2',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 100_00n,
      category: 'STAY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:cat',
      idempotencyKey: 'idem-cat-bad',
      now: NOW,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.code, 'CATEGORY_MISMATCH');
    }
  });

  it('13. excludes expired funding', () => {
    const service = createAccessSolvencyService();
    const poolRegistry = service.getPoolRegistry();
    const pool = poolRegistry.createPool({
      name: 'Promo Pool',
      category: 'MOBILITY',
      currency: 'USD',
      now: NOW,
    });
    poolRegistry.addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'PROMOTIONAL_BUDGET',
      currency: 'USD',
      amountCommitted: 10_000_00n,
      amountReceived: 10_000_00n,
      effectiveFrom: asUtcInstant('2025-01-01T00:00:00.000Z'),
      expiresAt: EXPIRED,
      evidenceReference: 'evidence:promo',
    });
    service.getFundingLedger().recordFundingReceived({
      fundingPoolId: pool.fundingPoolId,
      sourceId: 'src-promo',
      currency: 'USD',
      amountMinorUnits: 10_000_00n,
      transactionReference: 'promo:1',
      evidenceReference: 'evidence:promo',
      createdAt: NOW,
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    assert.equal(balance.cashReceived, 0n);
    assert.equal(balance.availableFunding, 0n);
  });

  it('14. distinguishes provider discount from cash', () => {
    const service = createAccessSolvencyService();
    const poolRegistry = service.getPoolRegistry();
    const pool = poolRegistry.createPool({
      name: 'Discount Pool',
      category: 'MOBILITY',
      currency: 'USD',
      now: NOW,
    });
    poolRegistry.addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'PROVIDER_DISCOUNT',
      currency: 'USD',
      amountCommitted: 20_000_00n,
      amountReceived: 20_000_00n,
      effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      evidenceReference: 'evidence:discount',
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    assert.equal(balance.discountCapacity, 20_000_00n);
    assert.equal(balance.cashReceived, 0n);
    assert.equal(balance.availableCashFunding, 0n);
    assert.equal(balance.availableDiscountCapacity, 20_000_00n);
  });
});

describe('ACCESS-30 concurrency', () => {
  it('15. concurrent funding reservations never oversubscribe', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        service.reserveFunding({
          fundingPoolId: poolId,
          accessTransactionId: `tx-concurrent-${index}`,
          userId: subjectRefFor('user-1'),
          currency: 'USD',
          amountMinorUnits: 200_00n,
          category: 'MOBILITY',
          expiresAt: EXPIRES,
          evidenceReference: `evidence:concurrent-${index}`,
          idempotencyKey: `idem-concurrent-${index}`,
          now: NOW,
        }),
      ),
    );

    const successes = attempts.filter((row) => row.ok);
    const totalReserved = successes.reduce(
      (sum, row) => sum + (row.ok ? row.reservation.amountMinorUnits : 0n),
      0n,
    );
    assert.ok(successes.length <= 5);
    assert.ok(totalReserved <= 1_000_00n);
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.ok(balance.availableCashFunding >= 0n);
  });

  it('16. concurrent entitlement reservations prevent double-spend', async () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);

    const attempts = await Promise.all(
      Array.from({ length: 2 }, (_, index) =>
        service.getEntitlementReservations().reserve({
          entitlementId: id,
          accessTransactionId: `tx-ent-${index}`,
          userId: subjectRefFor('user-1'),
          category: 'MOBILITY',
          unit: 'day',
          quantity: 2n,
          expiresAt: EXPIRES,
          evidenceReference: `evidence:ent-${index}`,
          idempotencyKey: `idem-ent-concurrent-${index}`,
          now: NOW,
        }),
      ),
    );

    const successes = attempts.filter((row) => row.ok);
    const totalReserved = successes.reduce(
      (sum, row) => sum + (row.ok ? row.reservation.quantity : 0n),
      0n,
    );
    assert.ok(successes.length <= 1);
    assert.ok(totalReserved <= 3n);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    assert.ok(balance.remaining >= 0n);
  });
});

describe('ACCESS-30 invariants and idempotency', () => {
  it('17. no negative funding', () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    const results = checkAllWave1Invariants({ fundingBalance: balance });
    assert.ok(allWave1InvariantsHeld(results));
  });

  it('18. no negative entitlement', () => {
    const service = createAccessSolvencyService();
    const id = seedEntitlement(service, 3n);
    const balance = service.getEntitlementLedger().getBalance(id)!;
    const results = checkAllWave1Invariants({ entitlementBalance: balance });
    assert.ok(allWave1InvariantsHeld(results));
  });

  it('19. idempotency prevents double reservation', async () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const input = {
      fundingPoolId: poolId,
      accessTransactionId: 'tx-idem',
      userId: subjectRefFor('user-1'),
      currency: 'USD',
      amountMinorUnits: 200_00n,
      category: 'MOBILITY',
      expiresAt: EXPIRES,
      evidenceReference: 'evidence:idem',
      idempotencyKey: 'same-key',
      now: NOW,
    };
    const first = await service.reserveFunding(input);
    const second = await service.reserveFunding(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'IDEMPOTENT');
    }
    const balance = service.getFundingPoolBalance(poolId, 'USD', NOW);
    assert.equal(balance.availableCashFunding, 800_00n);
  });

  it('20. evidence references on ledger entries', () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 1_000_00n);
    const entries = service.getFundingLedger().listEntries(poolId);
    assert.ok(entries.every((row) => row.evidenceReference.startsWith('evidence:')));
  });

  it('21-23. token conversion remains zero', () => {
    assert.equal(TOKEN_CONVERSION_CONTRIBUTION, 0n);
    const result = checkAllWave1Invariants({});
    assert.ok(result.find((row) => row.id === 'TOKEN_CONVERSION_ZERO')!.held);
  });
});

describe('ACCESS-30 solvency service', () => {
  it('distinguishes healthy vs exhausted', () => {
    const service = createAccessSolvencyService();
    const { poolId } = seedFundingPool(service, 100_000_00n);
    const healthy = service.getSolvencyStatus(poolId, 'USD', NOW);
    assert.equal(healthy.status, 'HEALTHY');
    assert.ok(healthy.balance.availableFunding > 0n);

    const emptyPool = service.getPoolRegistry().createPool({
      name: 'Empty',
      category: 'FOOD',
      currency: 'USD',
      now: NOW,
    });
    const exhausted = service.getSolvencyStatus(emptyPool.fundingPoolId, 'USD', NOW);
    assert.equal(exhausted.status, 'EXHAUSTED');
  });

  it('canReserveFunding checks available cash only', () => {
    const service = createAccessSolvencyService();
    const poolRegistry = service.getPoolRegistry();
    const pool = poolRegistry.createPool({
      name: 'Discount Only',
      category: 'MOBILITY',
      currency: 'USD',
      now: NOW,
    });
    poolRegistry.addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'PROVIDER_DISCOUNT',
      currency: 'USD',
      amountCommitted: 5_000_00n,
      amountReceived: 5_000_00n,
      effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      evidenceReference: 'evidence:discount-only',
    });
    assert.equal(
      service.canReserveFunding({
        fundingPoolId: pool.fundingPoolId,
        currency: 'USD',
        amountMinorUnits: 100_00n,
        now: NOW,
      }),
      false,
    );
  });
});

describe('ACCESS-30 Wave 1 end-to-end', () => {
  it('30. complete Wave 1 simulation', () => {
    const service = createAccessSolvencyService();
    const result = runAccessWave1({ service, userId: 'participant-a' });

    assert.ok(result.entitlements.length > 0);
    assert.ok(result.fundingPools.length >= 2);
    assert.equal(result.tokenConversionContribution, 0n);
    assert.ok(result.evidenceReferences.length > 0);

    const mobility = result.entitlements.find((row) => row.category === 'MOBILITY');
    const stay = result.entitlements.find((row) => row.category === 'STAY');
    assert.ok(mobility);
    assert.ok(stay);
    assert.ok(mobility!.quantity > 0n);
    assert.ok(stay!.quantity > 0n);

    const mobilityPool = result.fundingPools.find((row) => row.category === 'MOBILITY');
    const stayPool = result.fundingPools.find((row) => row.category === 'STAY');
    assert.equal(mobilityPool!.availableFundingMinorUnits, 100_000_00n);
    assert.equal(stayPool!.availableFundingMinorUnits, 50_000_00n);
  });
});
