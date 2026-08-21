import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import { Money } from '../../money/src/money.ts';
import { addMs } from '../../config/src/clock.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { bookRoleForAccountClass, bookRoleForLedgerAccount } from './book-role.ts';
import { Ledger } from './journal.ts';
import { journalHistory, projectPostedBalance } from './read-model.ts';
import { planReversal } from './reversal.ts';
import { LedgerInvariantError, SIMULATION_FUNDING_SOURCE_ID } from './types.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

function issue(issuer: AuthorityIssuer, key: string, accountId = SIMULATION_FUNDING_SOURCE_ID) {
  return issuer.issue({
    authorityId: `ea_${key}`,
    actionType: 'POST_DEPOSIT',
    accountId,
    intentId: key,
    idempotencyKey: key,
    amount: Money.fromMinorUnits(10n, 'USD'),
    issuedAt: NOW,
    expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
  });
}

describe('production ledger core', () => {
  it('enforces debits equal credits and refuses float-shaped construction', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const ea = issue(issuer, 'unbalanced');
    assert.throws(
      () =>
        ledger.postJournal({
          idempotencyKey: 'unbalanced',
          executionAuthority: ea,
          actionType: 'POST_DEPOSIT',
          postings: [
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(10n, 'USD') },
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(9n, 'USD') },
          ],
        }),
      /BALANCE/,
    );
  });

  it('posts a balanced multi-currency-capable journal with production metadata', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const ea = issue(issuer, 'meta');
    const journal = ledger.postJournal({
      idempotencyKey: 'meta',
      executionAuthority: ea,
      actionType: 'POST_DEPOSIT',
      reference: 'ref_meta',
      correlationId: 'corr_1',
      causationId: 'cause_1',
      sourceDomain: 'accounts',
      evidenceRecordId: 'ev_1',
      postings: [
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(25n, 'USD') },
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(25n, 'USD') },
      ],
    });
    assert.equal(journal.status, 'POSTED');
    assert.equal(journal.reference, 'ref_meta');
    assert.equal(journal.correlationId, 'corr_1');
    assert.equal(journal.evidenceRecordId, 'ev_1');
    assert.equal(ledger.lookupByReference('ref_meta')?.id, journal.id);
    const page = journalHistory(ledger.listJournals(), { limit: 10 });
    assert.equal(page.items.length, 1);
  });

  it('replays identical idempotent posts and conflicts on a different fingerprint', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const ea = issue(issuer, 'idem');
    const request = {
      idempotencyKey: 'idem',
      executionAuthority: ea,
      actionType: 'POST_DEPOSIT' as const,
      postings: [
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT' as const, amount: Money.fromMinorUnits(10n, 'USD') },
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT' as const, amount: Money.fromMinorUnits(10n, 'USD') },
      ],
    };
    const first = ledger.postJournal(request);
    const second = ledger.postJournal(request);
    assert.equal(first.id, second.id);
    assert.equal(ledger.journalCount(), 1);
    assert.throws(
      () =>
        ledger.postJournal({
          ...request,
          postings: [
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(11n, 'USD') },
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(11n, 'USD') },
          ],
        }),
      /IDEMPOTENCY/,
    );
  });

  it('refuses a second full reversal of the same journal', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const firstEa = issue(issuer, 'orig');
    const original = ledger.postJournal({
      idempotencyKey: 'orig',
      executionAuthority: firstEa,
      actionType: 'POST_DEPOSIT',
      postings: [
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(40n, 'USD') },
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(40n, 'USD') },
      ],
    });
    const plan = planReversal(original.id, original.postings, 'FULL');
    const revEa = issuer.issue({
      authorityId: 'ea_rev',
      actionType: 'POST_REVERSAL',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: 'rev1',
      idempotencyKey: 'rev1',
      amount: Money.fromMinorUnits(40n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const reversal = ledger.postJournal({
      idempotencyKey: 'rev1',
      executionAuthority: revEa,
      actionType: 'POST_REVERSAL',
      reversesJournalId: original.id,
      reversalKind: 'FULL',
      postings: plan.postings,
    });
    assert.equal(reversal.reversesJournalId, original.id);
    assert.equal(ledger.isFullyReversed(original.id), true);
    const rev2 = issuer.issue({
      authorityId: 'ea_rev2',
      actionType: 'POST_REVERSAL',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: 'rev2',
      idempotencyKey: 'rev2',
      amount: Money.fromMinorUnits(40n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    assert.throws(
      () =>
        ledger.postJournal({
          idempotencyKey: 'rev2',
          executionAuthority: rev2,
          actionType: 'POST_REVERSAL',
          reversesJournalId: original.id,
          reversalKind: 'FULL',
          postings: plan.postings,
        }),
      LedgerInvariantError,
    );
  });

  it('supports an explicit partial reversal and refuses over-reversal', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const ea = issue(issuer, 'part_orig');
    const original = ledger.postJournal({
      idempotencyKey: 'part_orig',
      executionAuthority: ea,
      actionType: 'POST_DEPOSIT',
      postings: [
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(100n, 'USD') },
        { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(100n, 'USD') },
      ],
    });
    const plan = planReversal(original.id, original.postings, 'PARTIAL', Money.fromMinorUnits(40n, 'USD'));
    const revEa = issuer.issue({
      authorityId: 'ea_part',
      actionType: 'POST_REVERSAL',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: 'part_rev',
      idempotencyKey: 'part_rev',
      amount: Money.fromMinorUnits(40n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    ledger.postJournal({
      idempotencyKey: 'part_rev',
      executionAuthority: revEa,
      actionType: 'POST_REVERSAL',
      reversesJournalId: original.id,
      reversalKind: 'PARTIAL',
      postings: plan.postings,
    });
    assert.equal(ledger.reversedScaled(original.id), 40n);
    assert.throws(
      () => planReversal(original.id, original.postings, 'PARTIAL', Money.fromMinorUnits(100n, 'USD')),
      /strictly less/,
    );
  });

  it('maps customer products to GL book roles without inventing a second taxonomy', () => {
    assert.equal(bookRoleForAccountClass('DEMAND_DEPOSIT'), 'CUSTOMER_LIABILITY');
    assert.equal(bookRoleForAccountClass('PENDING_SETTLEMENT'), 'SETTLEMENT');
    assert.equal(bookRoleForAccountClass('BROKERAGE_CASH'), 'INVESTMENT');
    assert.equal(bookRoleForAccountClass('DIGITAL_ASSET_CUSTODY'), 'CUSTODY_BRIDGE');
    assert.equal(
      bookRoleForLedgerAccount({
        id: 'SIMULATION.FEE_COLLECTOR.USD',
        name: 'fees',
        accountClass: 'SIMULATED_FUNDING_SOURCE',
        currency: 'USD',
      }),
      'FEES',
    );
  });

  it('projects posted balance from journals and refuses unauthorized mutation', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const balance = projectPostedBalance(ledger.listJournals(), {
      id: SIMULATION_FUNDING_SOURCE_ID,
      currency: 'USD',
    });
    assert.equal(balance.posted.minorUnits, 0n);
    assert.throws(
      () =>
        ledger.postJournal({
          idempotencyKey: 'no_ea',
          executionAuthority: undefined as never,
          actionType: 'POST_DEPOSIT',
          postings: [
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(1n, 'USD') },
            { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(1n, 'USD') },
          ],
        }),
      /AUTHORITY/,
    );
  });

  it('randomized balanced journals stay debit-equal-credit', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    for (let i = 0; i < 32; i += 1) {
      const amount = BigInt(1 + ((i * 17) % 10_000));
      const key = `rand_${i}`;
      const ea = issue(issuer, key);
      const journal = ledger.postJournal({
        idempotencyKey: key,
        executionAuthority: ea,
        actionType: 'POST_DEPOSIT',
        postings: [
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(amount, 'USD') },
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(amount, 'USD') },
        ],
      });
      const debits = journal.postings.filter((p) => p.direction === 'DEBIT').reduce((s, p) => s + ledgerScaledUnits(p.amount), 0n);
      const credits = journal.postings.filter((p) => p.direction === 'CREDIT').reduce((s, p) => s + ledgerScaledUnits(p.amount), 0n);
      assert.equal(debits, credits);
    }
    const totals = ledger.totalsByAsset().get('USD');
    assert.ok(totals);
    assert.equal(totals!.debits, totals!.credits);
  });
});
