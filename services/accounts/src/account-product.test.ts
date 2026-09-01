import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { asHoldId, freezeHold } from '../../../packages/domain/src/hold.ts';
import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type PostWithdrawalIntent } from '../../../packages/permissions/src/action-types.ts';
import { parseActivityFilter } from './activity.ts';
import { activateCustomer, NOW, openIntent } from './test-helpers.ts';
import { createTestRuntime } from './test-helpers.ts';

describe('Account product service', () => {
  it('derives lifecycle, ownership, and activation events from Kernel-gated open', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'intent_prod_open', accountId: 'acct_prod_1', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    const financial = runtime.accountProduct.get('acct_prod_1');
    assert.ok(financial);
    assert.equal(financial.status, 'ACTIVE');
    assert.equal(financial.domainStatus, 'OPEN');
    assert.equal(financial.productType, 'CHECKING_PAYMENT');
    assert.equal(financial.productConfiguration.liveBanking, false);
    assert.equal(financial.productConfiguration.licensingClaim, 'NOT_A_LICENSED_BANK_ACCOUNT');
    assert.ok(runtime.events.list().some((event) => event.eventType === 'AccountOpened'));
    assert.ok(runtime.events.list().some((event) => event.eventType === 'AccountActivated'));
  });

  it('refuses a client-declared ACTIVE transition that is not server-legal', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    runtime.accountsService.open(openIntent({ id: 'intent_prod_open_2', accountId: 'acct_prod_2', ownerId: customer.id }));
    const again = runtime.accountProduct.transitionLifecycle({
      accountId: 'acct_prod_2',
      to: 'ACTIVE',
      actorId: 'operator_1',
    });
    assert.equal(isErr(again), true);
  });

  it('applies restrictions that block withdrawals without posting', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'intent_prod_r', accountId: 'acct_prod_r', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('dep_r'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_r',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(10_000n, 'USD') },
    });
    const restricted = runtime.accountProduct.applyRestriction({
      accountId: 'acct_prod_r',
      code: 'WITHDRAWAL_BLOCKED',
      reason: 'compliance review',
      actorId: 'operator_1',
    });
    assert.equal(isOk(restricted), true);
    const view = runtime.accountProduct.get('acct_prod_r');
    assert.equal(view?.status, 'RESTRICTED');
    const withdraw: PostWithdrawalIntent = {
      id: asIntentId('wd_r'),
      actionType: ACTION_TYPES.POST_WITHDRAWAL,
      idempotencyKey: 'wd_r',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_WITHDRAWAL',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(1_000n, 'USD') },
    };
    const posted = runtime.money.withdraw(withdraw);
    assert.equal(posted.outcome, 'REJECTED');
    if (posted.outcome === 'REJECTED') {
      assert.equal(posted.code, 'ACCOUNT_RESTRICTED');
    }
    const journals = runtime.ledger.listJournals().filter((row) => row.actionType === 'POST_WITHDRAWAL');
    assert.equal(journals.length, 0);
    assert.ok(runtime.events.list().some((event) => event.eventType === 'AccountRestricted'));
  });

  it('derives posted/pending/held/available from the ledger and holds', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'intent_prod_b', accountId: 'acct_prod_b', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('dep_b'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_b',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(10_000n, 'USD') },
    });
    runtime.holds.put(
      freezeHold({
        id: asHoldId('hold_b'),
        accountId: opened.account.id,
        currency: asCurrencyCode('USD'),
        amountMinorUnits: 2_500n,
        purpose: 'OUTGOING_TRANSFER',
        state: 'ACTIVE',
        idempotencyKey: 'hold_b',
        createdAt: NOW,
        updatedAt: NOW,
        expiresAt: null,
        captureJournalId: null,
        epoch: 1,
      }),
    );
    const balance = runtime.accountProduct.balanceOf('acct_prod_b');
    assert.equal(isOk(balance), true);
    if (!isOk(balance)) {
      return;
    }
    assert.equal(balance.value.posted.minorUnits, 10_000n);
    assert.equal(balance.value.held.minorUnits, 2_500n);
    assert.equal(balance.value.available.minorUnits, 7_500n);
    assert.equal(balance.value.pending.minorUnits, 0n);
    assert.equal(JSON.stringify(balance.value).includes('yield'), false);
  });

  it('keeps USD and SAR as separate positions and refuses blended wealth without FX', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    runtime.accountsService.open(openIntent({ id: 'intent_usd', accountId: 'acct_usd', ownerId: customer.id }));
    const sarOpen = runtime.accountsService.open({
      ...openIntent({ id: 'intent_sar', accountId: 'acct_sar', ownerId: customer.id }),
      payload: {
        ...openIntent({ id: 'intent_sar', accountId: 'acct_sar', ownerId: customer.id }).payload,
        currency: asCurrencyCode('SAR'),
        productId: asProductId('prod_demand_sar_gb'),
      },
    });
    assert.equal(sarOpen.outcome, 'OPENED');
    const wealth = runtime.accountProduct.wealth(customer.id, 'USD');
    assert.equal(wealth.kind, 'UNAVAILABLE');
    assert.equal(wealth.valuationStatus, 'UNAVAILABLE');
    assert.ok(wealth.currencies.includes('USD'));
    assert.ok(wealth.currencies.includes('SAR'));
  });

  it('normalizes activity and applies safe filters', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'intent_act', accountId: 'acct_act', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('dep_act'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_act',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(4_000n, 'USD') },
    });
    const items = runtime.accountProduct.activity(customer.id, 'acct_act', { type: 'DEPOSIT', status: 'COMPLETED' });
    assert.ok(items.length >= 1);
    assert.equal(items.every((item) => item.type === 'DEPOSIT'), true);
    assert.equal(items.every((item) => item.status === 'COMPLETED'), true);
    assert.equal(items[0]?.direction, 'IN');
    const bad = parseActivityFilter({ status: 'DROP TABLE' });
    assert.equal('error' in bad, true);
  });

  it('builds statement opening and closing from ledger postings', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(
      openIntent({ id: 'intent_stmt', accountId: 'acct_stmt', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('dep_stmt'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_stmt',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(6_000n, 'USD') },
    });
    const statement = runtime.accountProduct.statement({
      accountId: 'acct_stmt',
      periodStart: asUtcInstant('2026-08-01T00:00:00.000Z'),
      periodEnd: asUtcInstant('2026-08-31T23:59:59.000Z'),
    });
    assert.equal(isOk(statement), true);
    if (!isOk(statement)) {
      return;
    }
    assert.equal(statement.value.openingMinorUnits, 0n);
    assert.equal(statement.value.closingMinorUnits, 6_000n);
    assert.ok(statement.value.lines.length >= 1);
  });

  it('refuses to close an account that still has a posted ledger balance', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    const opened = runtime.accountsService.open(openIntent({ id: 'intent_close_bal', accountId: 'acct_close_bal', ownerId: customer.id }));
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    runtime.money.deposit({
      id: asIntentId('dep_close_bal'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_close_bal',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(500n, 'USD') },
    });
    const closed = runtime.accountProduct.transitionLifecycle({
      accountId: 'acct_close_bal',
      to: 'CLOSED',
      actorId: 'operator_1',
    });
    assert.equal(isErr(closed), true);
    if (isErr(closed)) {
      assert.equal(closed.error.code, 'ACCOUNT_HAS_BALANCE');
    }
    assert.equal(runtime.accountProduct.get('acct_close_bal')?.status, 'ACTIVE');
  });

  it('closes an account through server-controlled lifecycle and emits AccountClosed', () => {
    const runtime = createTestRuntime();
    const customer = activateCustomer(runtime);
    runtime.accountsService.open(openIntent({ id: 'intent_close', accountId: 'acct_close', ownerId: customer.id }));
    const closed = runtime.accountProduct.transitionLifecycle({
      accountId: 'acct_close',
      to: 'CLOSED',
      actorId: 'operator_1',
    });
    assert.equal(isOk(closed), true);
    if (!isOk(closed)) {
      return;
    }
    assert.equal(closed.value.status, 'CLOSED');
    assert.ok(closed.value.closedAt);
    assert.ok(runtime.events.list().some((event) => event.eventType === 'AccountClosed'));
  });

  it('denies cross-customer reads', () => {
    const runtime = createTestRuntime();
    const owner = activateCustomer(runtime, 'cust_owner');
    activateCustomer(runtime, 'cust_other');
    runtime.accountsService.open(openIntent({ id: 'intent_own', accountId: 'acct_own', ownerId: owner.id }));
    const denied = runtime.accountProduct.authorizeRead('acct_own', 'cust_other', null);
    assert.equal(isErr(denied), true);
    if (isErr(denied)) {
      assert.equal(denied.error.code, 'RESOURCE_NOT_OWNED');
    }
    const allowed = runtime.accountProduct.authorizeRead('acct_own', owner.id, null);
    assert.equal(isOk(allowed), true);
  });
});
