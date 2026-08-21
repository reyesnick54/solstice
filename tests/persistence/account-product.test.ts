import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '../../packages/money/src/money.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import { isOk } from '../../packages/domain/src/result.ts';
import { activateCustomer, openIntent, NOW } from '../../services/accounts/src/test-helpers.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('Account product restart persistence', () => {
  it('rehydrates restrictions, overlays, and ledger-derived balances after restart', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    const customer = activateCustomer(first.runtime, 'cust_pg_product');
    await first.saveCustomer(customer);
    const opened = await first.open(
      openIntent({ id: 'pg_prod_open', accountId: 'acct_pg_prod', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      await first.close();
      return;
    }
    const deposited = await first.postDeposit({
      id: asIntentId('pg_prod_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'pg_prod_dep',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(9_000n, 'USD') },
    });
    assert.equal(deposited.outcome, 'POSTED');
    first.runtime.accountProduct.applyRestriction({
      accountId: opened.account.id,
      code: 'TRANSFER_BLOCKED',
      reason: 'restart fixture',
      actorId: 'operator_1',
    });
    await first.persistProductState();
    const restarted = await first.restart();
    const financial = restarted.runtime.accountProduct.get('acct_pg_prod');
    assert.ok(financial);
    assert.equal(financial.status, 'RESTRICTED');
    const balance = restarted.runtime.accountProduct.balanceOf('acct_pg_prod');
    assert.equal(isOk(balance), true);
    if (isOk(balance)) {
      assert.equal(balance.value.posted.minorUnits, 9_000n);
    }
    await restarted.close();
  });
});
