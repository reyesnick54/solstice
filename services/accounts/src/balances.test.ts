import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../packages/permissions/src/action-types.ts';
import { activateCustomer, openIntent } from './test-helpers.ts';
import { createSimulationRuntime } from './runtime.ts';
import { balanceOfAccount, projectCustomerPosition } from './balances.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('balance read model', () => {
  it('account with no postings is zero; deposits sum correctly', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_bal', accountId: 'acct_bal', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    const zero = balanceOfAccount(runtime.ledger, opened.account);
    assert.equal(isOk(zero), true);
    if (isOk(zero)) {
      assert.equal(zero.value.minorUnits, 0n);
    }
    runtime.money.deposit({
      id: asIntentId('d1'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'd1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(1000n, 'USD') },
    });
    runtime.money.deposit({
      id: asIntentId('d2'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'd2',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(2500n, 'USD') },
    });
    const summed = balanceOfAccount(runtime.ledger, opened.account);
    assert.equal(isOk(summed), true);
    if (isOk(summed)) {
      assert.equal(summed.value.minorUnits, 3500n);
    }
  });

  it('per-class breakdown separates classes and exposes no percentage-return field', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_pos');
    runtime.accountsService.open(
      openIntent({ id: 'open_d', accountId: 'acct_d', ownerId: customer.id }),
    );
    runtime.accountsService.open(
      openIntent({
        id: 'open_s',
        accountId: 'acct_s',
        ownerId: customer.id,
        productId: asProductId('prod_savings_usd_gb'),
        accountClass: 'SAVINGS_DEPOSIT',
      }),
    );
    runtime.money.deposit({
      id: asIntentId('pd'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'pd',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: asAccountId('acct_d'), amount: Money.fromMinorUnits(4000n, 'USD') },
    });
    runtime.money.deposit({
      id: asIntentId('ps'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'ps',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: asAccountId('acct_s'), amount: Money.fromMinorUnits(1500n, 'USD') },
    });
    const position = projectCustomerPosition(
      runtime.ledger,
      customer.id,
      runtime.accountsService.listAccounts(),
    );
    assert.equal(isOk(position), true);
    if (!isOk(position)) {
      return;
    }
    assert.equal(position.value.breakdown.deposits.total.minorUnits, 5500n);
    assert.equal(position.value.breakdown.deposits.classification.insurance, 'insured');
    assert.equal(position.value.breakdown.investments.total.minorUnits, 0n);
    assert.equal(position.value.grandTotal.minorUnits, 5500n);
    assert.equal('percentageReturn' in position.value, false);
    assert.equal('yield' in position.value, false);
    assert.equal('apy' in position.value, false);
    assert.equal('growthRate' in position.value, false);
    assert.equal('returnPercentage' in position.value, false);
    assert.ok('breakdown' in position.value);
    assert.ok('grandTotal' in position.value);
  });

  it('mixed currencies without a rate return a typed error', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_fx');
    const usd = runtime.accountsService.open(
      openIntent({ id: 'open_usd', accountId: 'acct_usd', ownerId: customer.id }),
    );
    assert.equal(usd.outcome, 'OPENED');
    if (usd.outcome !== 'OPENED') {
      return;
    }
    const gbpAccount = {
      ...usd.account,
      id: asAccountId('acct_gbp'),
      currency: 'GBP' as typeof usd.account.currency,
    };
    runtime.accounts.put(gbpAccount.id, gbpAccount);
    const result = projectCustomerPosition(runtime.ledger, customer.id, [
      usd.account,
      gbpAccount,
    ]);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'MIXED_CURRENCY_WITHOUT_CONVERSION');
    }
  });
});
