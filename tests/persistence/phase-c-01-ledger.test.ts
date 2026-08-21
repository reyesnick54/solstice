import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asHoldId } from '../../packages/domain/src/hold.ts';
import { Money } from '../../packages/money/src/money.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import { projectBankingPosition } from '../../services/accounts/src/available-funds.ts';
import { isOk } from '../../packages/domain/src/result.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';
import { activateCustomer, openIntent } from '../../services/accounts/src/test-helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('Phase C Prompt 1 ledger persistence', () => {
  it('survives restart for journals, holds, and reversals', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const customer = activateCustomer(durable.runtime, 'cust_pg_c01');
    await durable.saveCustomer(customer);
    const opened = await durable.open(
      openIntent({ id: 'open_pg_c01', accountId: 'acct_pg_c01', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      await durable.close();
      return;
    }
    const funded = await durable.postDeposit({
      id: asIntentId('dep_pg_c01'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_pg_c01',
      actorId: 'operator_1',
      requestedAt: durable.runtime.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(8_000n, 'USD') },
    });
    assert.equal(funded.outcome, 'POSTED');
    if (funded.outcome !== 'POSTED') {
      await durable.close();
      return;
    }
    const hold = await durable.createHold({
      id: asIntentId('hold_pg_c01'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_pg_c01',
      actorId: 'operator_1',
      requestedAt: durable.runtime.clock.now(),
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_pg_c01'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(3_000n, 'USD'),
        holdPurpose: 'WITHDRAWAL',
      },
    });
    assert.equal(hold.outcome, 'COMPLETED');
    const restarted = await durable.restart();
    try {
      const reloaded = restarted.runtime.ledger.getJournal(funded.journal.id);
      assert.ok(reloaded);
      assert.equal(reloaded?.status, 'POSTED');
      const persistedHold = restarted.runtime.holds.get(asHoldId('hold_pg_c01'));
      assert.ok(persistedHold);
      assert.equal(persistedHold?.amountMinorUnits, 3_000n);
      const position = projectBankingPosition(
        restarted.runtime.ledger,
        opened.account,
        restarted.runtime.holds,
        restarted.runtime.clock.now(),
      );
      assert.equal(isOk(position), true);
      if (isOk(position)) {
        assert.equal(position.value.available.minorUnits, 5_000n);
      }
    } finally {
      await restarted.close();
    }
  });
});
