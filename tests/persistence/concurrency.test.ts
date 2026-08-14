import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '../../packages/money/src/money.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import { isOk } from '../../packages/domain/src/result.ts';
import { balanceOfAccount } from '../../services/accounts/src/balances.ts';
import { activateCustomer, openIntent, NOW } from '../../services/accounts/src/test-helpers.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('PostgreSQL concurrency and evidence reconstruction', () => {
  it('serializes concurrent deposits and reconstructs the evidence chain after restart', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    const customer = activateCustomer(first.runtime, 'cust_pg_conc');
    await first.saveCustomer(customer);
    const opened = await first.open(
      openIntent({ id: 'pg_conc_open', accountId: 'pg_conc_d', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }

    const second = await createDurableRuntime(env);
    const deposits = await Promise.all([
      first.deposit({
        id: asIntentId('pg_conc_dep_a'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'pg_conc_dep_a',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(4_000n, 'USD') },
      }),
      second.deposit({
        id: asIntentId('pg_conc_dep_b'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'pg_conc_dep_b',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(6_000n, 'USD') },
      }),
    ]);
    assert.equal(deposits[0]!.outcome, 'POSTED');
    assert.equal(deposits[1]!.outcome, 'POSTED');

    await first.close();
    await second.close();

    const reloaded = await createDurableRuntime(env);
    assert.equal(reloaded.runtime.evidence.verifyChain().ok, true);
    const account = reloaded.runtime.accounts.get(opened.account.id);
    assert.ok(account);
    const balance = balanceOfAccount(reloaded.runtime.ledger, account);
    assert.equal(isOk(balance), true);
    if (isOk(balance)) {
      assert.equal(balance.value.minorUnits, 10_000n);
    }
    await reloaded.close();
  });

  it('serializes concurrent withdrawals so only one can take the same funds', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    const customer = activateCustomer(first.runtime, 'cust_pg_wd');
    await first.saveCustomer(customer);
    const opened = await first.open(
      openIntent({ id: 'pg_wd_open', accountId: 'pg_wd_d', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    const funded = await first.deposit({
      id: asIntentId('pg_wd_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'pg_wd_dep',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(10_000n, 'USD') },
    });
    assert.equal(funded.outcome, 'POSTED');

    const second = await createDurableRuntime(env);
    const withdrawals = await Promise.all([
      first.withdraw({
        id: asIntentId('pg_wd_a'),
        actionType: ACTION_TYPES.POST_WITHDRAWAL,
        idempotencyKey: 'pg_wd_a',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_WITHDRAWAL',
        payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(8_000n, 'USD') },
      }),
      second.withdraw({
        id: asIntentId('pg_wd_b'),
        actionType: ACTION_TYPES.POST_WITHDRAWAL,
        idempotencyKey: 'pg_wd_b',
        actorId: 'operator_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_WITHDRAWAL',
        payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(8_000n, 'USD') },
      }),
    ]);
    const outcomes = withdrawals.map((row) => row.outcome).sort();
    assert.deepEqual(outcomes, ['POSTED', 'REJECTED']);
    const rejected = withdrawals.find((row) => row.outcome === 'REJECTED');
    if (rejected && rejected.outcome === 'REJECTED') {
      assert.equal(rejected.code, 'INSUFFICIENT_FUNDS');
    }

    await first.close();
    await second.close();

    const reloaded = await createDurableRuntime(env);
    const account = reloaded.runtime.accounts.get(opened.account.id);
    assert.ok(account);
    const balance = balanceOfAccount(reloaded.runtime.ledger, account);
    assert.equal(isOk(balance), true);
    if (isOk(balance)) {
      assert.equal(balance.value.minorUnits, 2_000n);
    }
    await reloaded.close();
  });
});
