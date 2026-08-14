import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../packages/domain/src/account.ts';
import { asCustomerId, createProspect, notStartedVerification } from '../../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../packages/domain/src/legal-entity.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { isOk } from '../../packages/domain/src/result.ts';
import { Money } from '../../packages/money/src/money.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import { isReadOnlyViolation } from '../../packages/persistence/src/index.ts';
import {
  balanceOfAccount,
  projectCustomerPosition,
} from '../../services/accounts/src/balances.ts';
import { activateCustomer, openIntent } from '../../services/accounts/src/test-helpers.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('Chunk 2 exit criterion — PostgreSQL persistence fabric', () => {
  it('empty database → migrate → open → deposit → restart → reconstruct → idempotent replay → mutation refused', async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);

    const customer = activateCustomer(durable.runtime, 'cust_pg_exit');
    await durable.saveCustomer(customer);

    const opened = await durable.open(
      openIntent({ id: 'pg_exit_open', accountId: 'pg_exit_d', ownerId: customer.id }),
    );
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    assert.equal('balance' in opened.account, false);

    const depositIntent = {
      id: asIntentId('pg_exit_dep'),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey: 'pg_exit_dep',
      actorId: 'operator_1',
      requestedAt: asUtcInstant('2026-08-14T09:00:00.000Z'),
      purpose: 'CUSTOMER_FUNDING' as const,
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(10_000n, 'USD'),
      },
    };
    const posted = await durable.deposit(depositIntent);
    assert.equal(posted.outcome, 'POSTED');
    if (posted.outcome !== 'POSTED') {
      return;
    }
    assert.equal(posted.journal.postings.length >= 2, true);
    const journalDebits = posted.journal.postings
      .filter((p) => p.direction === 'DEBIT')
      .reduce((sum, p) => sum + p.amount.minorUnits, 0n);
    const journalCredits = posted.journal.postings
      .filter((p) => p.direction === 'CREDIT')
      .reduce((sum, p) => sum + p.amount.minorUnits, 0n);
    assert.equal(journalDebits, journalCredits);
    assert.ok(durable.runtime.evidence.count() > 0);
    assert.equal(durable.runtime.evidence.verifyChain().ok, true);

    const journalsBefore = durable.runtime.ledger.journalCount();
    const evidenceBefore = durable.runtime.evidence.count();
    await durable.close();

    durable = await createDurableRuntime(env);
    const reloadedCustomer = durable.runtime.customers.get(asCustomerId('cust_pg_exit'));
    assert.ok(reloadedCustomer);
    assert.equal(reloadedCustomer.status, 'ACTIVE');
    const reloadedAccount = durable.runtime.accounts.get(asAccountId('pg_exit_d'));
    assert.ok(reloadedAccount);
    assert.equal('balance' in reloadedAccount, false);
    assert.equal(durable.runtime.ledger.journalCount(), journalsBefore);
    assert.equal(durable.runtime.evidence.count(), evidenceBefore);
    assert.equal(durable.runtime.evidence.verifyChain().ok, true);

    const balance = balanceOfAccount(durable.runtime.ledger, reloadedAccount);
    assert.equal(isOk(balance), true);
    if (isOk(balance)) {
      assert.equal(balance.value.minorUnits, 10_000n);
    }
    const position = projectCustomerPosition(
      durable.runtime.ledger,
      reloadedCustomer.id,
      durable.runtime.accountsService.listAccounts(),
    );
    assert.equal(isOk(position), true);
    if (isOk(position)) {
      assert.equal(position.value.grandTotal.minorUnits, 10_000n);
      assert.equal(position.value.breakdown.deposits.total.minorUnits, 10_000n);
      assert.equal('percentageReturn' in position.value, false);
    }

    const replay = await durable.deposit(depositIntent);
    assert.equal(replay.outcome, 'POSTED');
    if (replay.outcome === 'POSTED') {
      assert.equal(replay.replay, true);
      assert.equal(replay.journal.id, posted.journal.id);
    }
    assert.equal(durable.runtime.ledger.journalCount(), journalsBefore);

    const conflict = {
      ...depositIntent,
      id: asIntentId('pg_exit_dep_conflict'),
      payload: {
        accountId: opened.account.id,
        amount: Money.fromMinorUnits(1n, 'USD'),
      },
    };
    await assert.rejects(() => durable.deposit(conflict), /IDEMPOTENCY/);
    assert.equal(durable.runtime.ledger.journalCount(), journalsBefore);

    assert.throws(() => durable.runtime.ledger.updateJournal(posted.journal.id), /IMMUTABILITY/);
    assert.throws(() => durable.runtime.ledger.deleteJournal(posted.journal.id), /IMMUTABILITY/);

    const journalId = posted.journal.id;
    await assert.rejects(async () => {
      await durable.session.pools.ledger.query('UPDATE ledger.journal SET memo = $1 WHERE id = $2', [
        'tamper',
        journalId,
      ]);
    }, isReadOnlyViolation);
    await assert.rejects(async () => {
      await durable.session.pools.ledger.query('DELETE FROM ledger.journal WHERE id = $1', [journalId]);
    }, isReadOnlyViolation);
    await assert.rejects(async () => {
      await durable.session.pools.ledger.query(
        'UPDATE ledger.posting SET minor_units = 1 WHERE journal_id = $1',
        [journalId],
      );
    }, isReadOnlyViolation);

    const evidenceId = durable.runtime.evidence.list()[0]!.evidenceId;
    await assert.rejects(async () => {
      await durable.session.pools.evidence.query(
        'UPDATE evidence.evidence_record SET kind = $1 WHERE evidence_id = $2',
        ['tamper', evidenceId],
      );
    }, isReadOnlyViolation);
    await assert.rejects(async () => {
      await durable.session.pools.evidence.query(
        'DELETE FROM evidence.evidence_record WHERE evidence_id = $1',
        [evidenceId],
      );
    }, isReadOnlyViolation);

    const prospect = createProspect({
      id: asCustomerId('cust_pg_exit_prospect'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    await durable.saveCustomer(prospect);
    const accountsBefore = durable.runtime.accountsService.listAccounts().length;
    const refused = await durable.open(
      openIntent({ id: 'pg_exit_refused', accountId: 'pg_exit_refused', ownerId: prospect.id }),
    );
    assert.equal(refused.outcome, 'KERNEL_REFUSED');
    assert.equal(durable.runtime.accountsService.listAccounts().length, accountsBefore);

    await durable.close();
  });
});
