import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { addMs } from '../../config/src/clock.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { Ledger } from './journal.ts';
import { LedgerInvariantError, SIMULATION_FUNDING_SOURCE_ID } from './types.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('ledger invariants', () => {
  it('refuses update and delete', () => {
    const issuer = new AuthorityIssuer('secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    assert.throws(() => ledger.updateJournal('x'), LedgerInvariantError);
    assert.throws(() => ledger.deleteJournal('x'), LedgerInvariantError);
    assert.throws(() => ledger.updatePosting('x'), LedgerInvariantError);
    assert.throws(() => ledger.deletePosting('x'), LedgerInvariantError);
  });

  it('refuses an unbalanced journal', () => {
    const issuer = new AuthorityIssuer('secret');
    const clock = new FrozenClock(NOW);
    const ledger = new Ledger(issuer, clock);
    const ea = issuer.issue({
      authorityId: 'ea',
      actionType: 'POST_DEPOSIT',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: 'i',
      idempotencyKey: 'i',
      amount: Money.fromMinorUnits(10n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    assert.throws(
      () =>
        ledger.postJournal({
          idempotencyKey: 'i',
          executionAuthority: ea,
          actionType: 'POST_DEPOSIT',
          postings: [
            {
              accountId: SIMULATION_FUNDING_SOURCE_ID,
              direction: 'DEBIT',
              amount: Money.fromMinorUnits(10n, 'USD'),
            },
            {
              accountId: SIMULATION_FUNDING_SOURCE_ID,
              direction: 'CREDIT',
              amount: Money.fromMinorUnits(9n, 'USD'),
            },
          ],
        }),
      /BALANCE/,
    );
  });
});
