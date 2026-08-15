import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Client } from 'pg';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { Money } from '../../packages/money/src/money.ts';
import {
  persistTreasurySnapshot,
  reserveTreasuryLiquidityPg,
} from '../../packages/persistence/src/treasury/pg-treasury-store.ts';
import { closePersistencePools, createPersistencePools } from '../../packages/persistence/src/postgres/pools.ts';
import { DATABASES } from '../../packages/persistence/src/env.ts';
import { seedTreasuryStore, TREASURY_SEED_IDS } from '../../packages/treasury/src/seed.ts';
import { TreasuryStore } from '../../packages/treasury/src/store.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

describePersistence('treasury persistence', () => {
  it('serializes concurrent SAR reservations so only one can take 4,000 of 5,000', async () => {
    const env = await preparePersistence();
    const store = new TreasuryStore();
    seedTreasuryStore(store);
    const position = store.getPosition(TREASURY_SEED_IDS.saSarPrefund)!;
    store.putPosition({
      ...position,
      settled: Money.fromMinorUnits(500_000n, 'SAR'),
      available: Money.fromMinorUnits(500_000n, 'SAR'),
      reserved: Money.zero('SAR'),
    });
    const pools = createPersistencePools(env);
    await persistTreasurySnapshot(pools.customer, store.snapshot());

    const first = new Client({
      host: env.host,
      port: env.port,
      user: env.customerUser,
      password: env.customerPassword,
      database: DATABASES.customer,
    });
    const second = new Client({
      host: env.host,
      port: env.port,
      user: env.customerUser,
      password: env.customerPassword,
      database: DATABASES.customer,
    });
    await first.connect();
    await second.connect();
    await first.query('BEGIN');
    await second.query('BEGIN');
    const results = await Promise.allSettled([
      reserveTreasuryLiquidityPg(first, {
        treasuryAccountId: TREASURY_SEED_IDS.saSarPrefund,
        reservationId: 'tres_pg_a',
        paymentId: 'pay_pg_a',
        amountMinor: 400_000n,
        currency: 'SAR',
        idempotencyKey: 'pg_a',
        now: NOW,
      }).then(async (result) => {
        if (result.ok) {
          await first.query('COMMIT');
        } else {
          await first.query('ROLLBACK');
        }
        return result;
      }),
      reserveTreasuryLiquidityPg(second, {
        treasuryAccountId: TREASURY_SEED_IDS.saSarPrefund,
        reservationId: 'tres_pg_b',
        paymentId: 'pay_pg_b',
        amountMinor: 400_000n,
        currency: 'SAR',
        idempotencyKey: 'pg_b',
        now: NOW,
      }).then(async (result) => {
        if (result.ok) {
          await second.query('COMMIT');
        } else {
          await second.query('ROLLBACK');
        }
        return result;
      }),
    ]);
    await first.end();
    await second.end();
    const values = results.map((row) => (row.status === 'fulfilled' ? row.value : { ok: false, code: 'rejected' }));
    const okCount = values.filter((row) => row.ok).length;
    const failCount = values.filter((row) => !row.ok).length;
    assert.equal(okCount, 1);
    assert.equal(failCount, 1);
    await closePersistencePools(pools);
  });
});
