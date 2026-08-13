import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCustomerId } from '../../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { isOk } from '../../../packages/domain/src/result.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../packages/permissions/src/action-types.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { SIMULATION_FUNDING_SOURCE_ID } from '../../../packages/ledger/src/types.ts';
import { activateCustomer, openIntent } from './test-helpers.ts';
import { createSimulationRuntime } from './runtime.ts';
import { balanceOfAccount } from './balances.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('money movement', () => {
  function openedDemand(runtime: ReturnType<typeof createSimulationRuntime>, accountId: string) {
    const customer = activateCustomer(runtime, `cust_${accountId}`);
    const opened = runtime.accountsService.open(
      openIntent({ id: `open_${accountId}`, accountId, ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      throw new Error('expected OPENED');
    }
    return { customer, account: opened.account };
  }

  it('deposit produces a balanced journal; duplicate key produces one journal', () => {
    const runtime = createSimulationRuntime();
    const { account } = openedDemand(runtime, 'acct_dep');
    const amount = Money.fromMinorUnits(10_000n, 'USD');
    const intent = {
      id: asIntentId('dep_1'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_1',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING' as const,
      payload: { accountId: account.id, amount },
    };
    const first = runtime.money.deposit(intent);
    const replay = runtime.money.deposit(intent);
    assert.equal(first.outcome, 'POSTED');
    assert.equal(replay.outcome, 'POSTED');
    if (first.outcome !== 'POSTED' || replay.outcome !== 'POSTED') {
      return;
    }
    assert.equal(first.journal.id, replay.journal.id);
    assert.equal(runtime.ledger.journalCount(), 1);
    const sides = first.journal.postings.map((p) => `${p.direction}:${p.accountId}`);
    assert.ok(sides.includes(`DEBIT:${SIMULATION_FUNDING_SOURCE_ID}`));
    assert.ok(sides.includes(`CREDIT:${account.id}`));
    const totals = runtime.ledger.totalsByAsset().get('USD');
    assert.ok(totals);
    assert.equal(totals.debits, totals.credits);
    assert.equal(runtime.growth.count(), 0);
  });

  it('withdrawal of more than the balance posts nothing but seals evidence', () => {
    const runtime = createSimulationRuntime();
    const { account } = openedDemand(runtime, 'acct_wd');
    const evidenceBefore = runtime.evidence.count();
    const result = runtime.money.withdraw({
      id: asIntentId('wd_nsf'),
      actionType: ACTION_TYPES.POST_WITHDRAWAL,
      idempotencyKey: 'wd_nsf',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_WITHDRAWAL',
      payload: {
        accountId: account.id,
        amount: Money.fromMinorUnits(1n, 'USD'),
      },
    });
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code, 'INSUFFICIENT_FUNDS');
    }
    assert.equal(runtime.ledger.journalCount(), 0);
    assert.ok(runtime.evidence.count() > evidenceBefore);
  });

  it('withdrawal after deposit is balanced and reverse of the funding journal', () => {
    const runtime = createSimulationRuntime();
    const { account } = openedDemand(runtime, 'acct_wd2');
    runtime.money.deposit({
      id: asIntentId('dep_wd'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_wd',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: { accountId: account.id, amount: Money.fromMinorUnits(5000n, 'USD') },
    });
    const result = runtime.money.withdraw({
      id: asIntentId('wd_ok'),
      actionType: ACTION_TYPES.POST_WITHDRAWAL,
      idempotencyKey: 'wd_ok',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_WITHDRAWAL',
      payload: { accountId: account.id, amount: Money.fromMinorUnits(2000n, 'USD') },
    });
    assert.equal(result.outcome, 'POSTED');
    if (result.outcome !== 'POSTED') {
      return;
    }
    const sides = result.journal.postings.map((p) => `${p.direction}:${p.accountId}`);
    assert.ok(sides.includes(`DEBIT:${account.id}`));
    assert.ok(sides.includes(`CREDIT:${SIMULATION_FUNDING_SOURCE_ID}`));
    const totals = runtime.ledger.totalsByAsset().get('USD');
    assert.equal(totals?.debits, totals?.credits);
    const bal = balanceOfAccount(runtime.ledger, account);
    assert.equal(isOk(bal), true);
    if (isOk(bal)) {
      assert.equal(bal.value.minorUnits, 3000n);
    }
  });

  it('internal transfer same class posts a balanced journal; cross-class without a bridge is refused', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_xfer');
    const demand = runtime.accountsService.open(
      openIntent({ id: 'open_d', accountId: 'acct_d', ownerId: customer.id }),
    );
    const savings = runtime.accountsService.open(
      openIntent({
        id: 'open_s',
        accountId: 'acct_s',
        ownerId: customer.id,
        productId: asProductId('prod_savings_usd_gb'),
        accountClass: 'SAVINGS_DEPOSIT',
      }),
    );
    const digital = runtime.accountsService.open(
      openIntent({
        id: 'open_g',
        accountId: 'acct_g',
        ownerId: customer.id,
        productId: asProductId('prod_digital_usd_gb'),
        accountClass: 'DIGITAL_ASSET_CUSTODY',
      }),
    );
    assert.equal(demand.outcome, 'OPENED');
    assert.equal(savings.outcome, 'OPENED');
    assert.equal(digital.outcome, 'OPENED');

    runtime.money.deposit({
      id: asIntentId('dep_xfer'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'dep_xfer',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_FUNDING',
      payload: {
        accountId: asAccountId('acct_d'),
        amount: Money.fromMinorUnits(8000n, 'USD'),
      },
    });

    const bridged = runtime.money.transfer({
      id: asIntentId('xfer_ok'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'xfer_ok',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: asAccountId('acct_d'),
        destinationAccountId: asAccountId('acct_s'),
        amount: Money.fromMinorUnits(1000n, 'USD'),
      },
    });
    assert.equal(bridged.outcome, 'POSTED');
    if (bridged.outcome === 'POSTED') {
      assert.equal(bridged.journal.classBridgeName, 'DEPOSIT_INTERNAL');
    }

    const journalsBefore = runtime.ledger.journalCount();
    const refused = runtime.money.transfer({
      id: asIntentId('xfer_bad'),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: 'xfer_bad',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: asAccountId('acct_d'),
        destinationAccountId: asAccountId('acct_g'),
        amount: Money.fromMinorUnits(1000n, 'USD'),
      },
    });
    assert.equal(refused.outcome, 'REJECTED');
    if (refused.outcome === 'REJECTED') {
      assert.equal(refused.code, 'CLASS_BRIDGE_UNDEFINED');
    }
    assert.equal(runtime.ledger.journalCount(), journalsBefore);
    const totals = runtime.ledger.totalsByAsset().get('USD');
    assert.equal(totals?.debits, totals?.credits);
    void asCustomerId;
  });
});
