import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asHoldId } from '../packages/domain/src/hold.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { bookRoleForAccountClass } from '../packages/ledger/src/book-role.ts';
import { projectBankingPosition } from '../services/accounts/src/available-funds.ts';
import { createSimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, NOW, openIntent } from '../services/accounts/src/test-helpers.ts';
import { isOk } from '../packages/domain/src/result.ts';

const ROOT = join(import.meta.dirname, '..');

function deposit(runtime: ReturnType<typeof createSimulationRuntime>, accountId: string, amount: bigint, key: string) {
  return runtime.money.deposit({
    id: asIntentId(key),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: key,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: accountId as never, amount: Money.fromMinorUnits(amount, 'USD') },
  });
}

describe('Phase C Prompt 1 production ledger', () => {
  it('keeps production flags disabled and does not create a second ledger', () => {
    const freeze = readFileSync(join(ROOT, 'docs/productization/sunrey-architecture-freeze.json'), 'utf8');
    assert.match(freeze, /"PRODUCTION_READY": false/);
    assert.match(freeze, /"PRODUCTION_ACTIVE": false/);
    assert.match(freeze, /"LIVE_CONNECTIVITY_ENABLED": false/);
    assert.equal(bookRoleForAccountClass('DEMAND_DEPOSIT'), 'CUSTOMER_LIABILITY');
  });

  it('frontend and consumer SDK cannot import privileged ledger posting', () => {
    const sdk = readFileSync(join(ROOT, 'packages/sunrey-sdk/src/consumer-platform/index.ts'), 'utf8');
    const client = readFileSync(join(ROOT, 'packages/sunrey-sdk/src/consumer-platform/client.ts'), 'utf8');
    const bff = readFileSync(join(ROOT, 'services/consumer-platform/src/index.ts'), 'utf8');
    for (const source of [sdk, client, bff]) {
      assert.equal(source.includes('postJournal('), false);
      assert.equal(source.includes('new Ledger('), false);
      assert.equal(source.includes('AuthorityIssuer'), false);
    }
  });

  it('emits JournalPosted after a committed deposit and keeps holds off the books', async () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime, 'cust_c01');
    const opened = runtime.accountsService.open(
      openIntent({ id: 'open_c01', accountId: 'acct_c01', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') return;
    const funded = deposit(runtime, opened.account.id, 15_000n, 'dep_c01');
    assert.equal(funded.outcome, 'POSTED');
    if (funded.outcome !== 'POSTED') return;
    assert.equal(funded.journal.status, 'POSTED');
    assert.equal(funded.journal.sourceDomain, 'accounts');
    assert.ok(runtime.events.list().some((event) => event.eventType === 'JournalPosted'));

    const hold = await runtime.banking.createHold({
      id: asIntentId('hold_c01'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_c01',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_c01'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(5_000n, 'USD'),
        holdPurpose: 'WITHDRAWAL',
      },
    });
    assert.equal(hold.outcome, 'COMPLETED');
    const position = projectBankingPosition(runtime.ledger, opened.account, runtime.holds, NOW);
    assert.equal(isOk(position), true);
    if (isOk(position)) {
      assert.equal(position.value.ledgerBalance.minorUnits, 15_000n);
      assert.equal(position.value.held.minorUnits, 5_000n);
      assert.equal(position.value.available.minorUnits, 10_000n);
    }
    const insufficient = deposit(runtime, opened.account.id, 1n, 'dep_ok');
    assert.equal(insufficient.outcome, 'POSTED');
    const overHold = await runtime.banking.createHold({
      id: asIntentId('hold_nsf'),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: 'hold_nsf',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId('hold_nsf'),
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(20_000n, 'USD'),
        holdPurpose: 'WITHDRAWAL',
      },
    });
    assert.equal(overHold.outcome, 'REJECTED');
  });
});
