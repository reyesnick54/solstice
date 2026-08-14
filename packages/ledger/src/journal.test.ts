import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asAccountId,
  asActionIntentId,
  asActorId,
  asCurrencyCode,
  asIdempotencyKey,
  asUtcInstant,
  Money,
  asRational,
} from '@solstice/domain';
import { ComplianceKernel, freezeIntent } from '@solstice/kernel';

import { commitJournal, journalBalances, JournalStore } from './journal.ts';
import { LedgerBooks } from './stores.ts';
import { createAccount } from '@solstice/domain';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

function systemIntent(kind: 'SEED_CREDIT' | 'OPEN_ACCOUNT' | 'FX_CONVERT', id: string) {
  return freezeIntent({
    id: asActionIntentId(id),
    kind,
    actor: { type: 'SYSTEM', id: asActorId('system') },
    payload:
      kind === 'OPEN_ACCOUNT'
        ? {
            accountId: asAccountId('acc_x'),
            ownerCustomerId: 'HOUSE' as const,
            currency: 'USD',
            accountClass: 'house_nostro',
          }
        : kind === 'FX_CONVERT'
          ? {
              sourceAccountId: asAccountId('acc_usd'),
              destinationAccountId: asAccountId('acc_eur'),
              sourceAmount: Money.fromDecimalString('100.00', 'USD'),
            }
          : {
              accountId: asAccountId('acc_usd'),
              amount: Money.fromDecimalString('100.00', 'USD'),
              memo: 'seed',
            },
    idempotencyKey: asIdempotencyKey(`idem_${id}`),
    occurredAt: NOW,
    sourceJurisdiction: 'US',
  });
}

describe('journal balance', () => {
  it('requires each currency to balance independently', () => {
    const usd = Money.fromDecimalString('10.00', 'USD');
    const eur = Money.fromDecimalString('9.00', 'EUR');
    const unbalanced = journalBalances([
      { accountId: asAccountId('a'), direction: 'DEBIT', amount: usd },
      { accountId: asAccountId('b'), direction: 'CREDIT', amount: eur },
    ]);
    assert.equal(unbalanced.ok, false);
  });

  it('FX journal balances both legs', () => {
    const usd = Money.fromDecimalString('100.00', 'USD');
    const eur = Money.fromDecimalString('90.00', 'EUR');
    const balanced = journalBalances([
      { accountId: asAccountId('cust_usd'), direction: 'CREDIT', amount: usd },
      { accountId: asAccountId('house_usd'), direction: 'DEBIT', amount: usd },
      { accountId: asAccountId('house_eur'), direction: 'CREDIT', amount: eur },
      { accountId: asAccountId('cust_eur'), direction: 'DEBIT', amount: eur },
    ]);
    assert.equal(balanced.ok, true);
  });
});

describe('kernel-gated journal commit', () => {
  it('refuses commit without authorization brand', () => {
    const store = new JournalStore();
    assert.throws(() => {
      commitJournal(store, {} as never, {
        intentId: asActionIntentId('x'),
        lines: [],
        memo: 'nope',
        postedAt: NOW,
      });
    }, /Kernel authorization/);
  });

  it('posts a seed credit through the Kernel', () => {
    const kernel = new ComplianceKernel();
    const books = new LedgerBooks(new JournalStore());
    const open = kernel.evaluate(systemIntent('OPEN_ACCOUNT', 'int_open'));
    assert.equal(open.ok && open.value.outcome === 'AUTHORIZED', true);
    if (!open.ok || open.value.outcome !== 'AUTHORIZED') return;

    const account = createAccount({
      id: asAccountId('acc_usd'),
      ownerCustomerId: 'HOUSE',
      accountClass: 'house_nostro',
      currency: asCurrencyCode('USD'),
      openedAt: NOW,
    });
    books.putAccount(open.value.authorization, account);

    const seedIntent = systemIntent('SEED_CREDIT', 'int_seed');
    const seeded = kernel.evaluate(seedIntent);
    assert.equal(seeded.ok && seeded.value.outcome === 'AUTHORIZED', true);
    if (!seeded.ok || seeded.value.outcome !== 'AUTHORIZED') return;

    const amount = Money.fromDecimalString('100.00', 'USD');
    const posted = commitJournal(books.journals, seeded.value.authorization, {
      intentId: seedIntent.id,
      memo: 'seed',
      postedAt: NOW,
      lines: [
        { accountId: account.id, direction: 'DEBIT', amount },
        { accountId: asAccountId('acc_equity'), direction: 'CREDIT', amount },
      ],
    });
    assert.equal(posted.ok, true);
  });
});

describe('multi-currency positions', () => {
  it('refuses to blend USD and EUR without a rate', () => {
    const kernel = new ComplianceKernel();
    const books = new LedgerBooks(new JournalStore());
    const customerId = 'cust_mix' as never;

    const openUsd = kernel.evaluate(systemIntent('OPEN_ACCOUNT', 'int_open_usd'));
    const openEur = kernel.evaluate(systemIntent('OPEN_ACCOUNT', 'int_open_eur'));
    assert.ok(openUsd.ok && openUsd.value.outcome === 'AUTHORIZED');
    assert.ok(openEur.ok && openEur.value.outcome === 'AUTHORIZED');
    if (!openUsd.ok || openUsd.value.outcome !== 'AUTHORIZED') return;
    if (!openEur.ok || openEur.value.outcome !== 'AUTHORIZED') return;

    books.putAccount(
      openUsd.value.authorization,
      createAccount({
        id: asAccountId('mix_usd'),
        ownerCustomerId: customerId,
        accountClass: 'deposits',
        currency: asCurrencyCode('USD'),
        openedAt: NOW,
      }),
    );
    books.putAccount(
      openEur.value.authorization,
      createAccount({
        id: asAccountId('mix_eur'),
        ownerCustomerId: customerId,
        accountClass: 'deposits',
        currency: asCurrencyCode('EUR'),
        openedAt: NOW,
      }),
    );

    const seed = kernel.evaluate(systemIntent('SEED_CREDIT', 'int_mix_seed'));
    assert.ok(seed.ok && seed.value.outcome === 'AUTHORIZED');
    if (!seed.ok || seed.value.outcome !== 'AUTHORIZED') return;

    const usd = Money.fromDecimalString('50.00', 'USD');
    const eur = Money.fromDecimalString('40.00', 'EUR');
    commitJournal(books.journals, seed.value.authorization, {
      intentId: asActionIntentId('int_mix_seed'),
      memo: 'two currencies',
      postedAt: NOW,
      lines: [
        { accountId: asAccountId('mix_usd'), direction: 'DEBIT', amount: usd },
        { accountId: asAccountId('house_usd'), direction: 'CREDIT', amount: usd },
        { accountId: asAccountId('mix_eur'), direction: 'DEBIT', amount: eur },
        { accountId: asAccountId('house_eur'), direction: 'CREDIT', amount: eur },
      ],
      fx: {
        from: asCurrencyCode('USD'),
        to: asCurrencyCode('EUR'),
        rate: asRational(4n, 5n),
        timestamp: NOW,
      },
    });

    const blended = books.blendedTotal(customerId, undefined);
    assert.equal(blended.ok, false);
    if (!blended.ok) {
      assert.equal(blended.error.type, 'MixedCurrencyWithoutConversion');
    }
  });
});
