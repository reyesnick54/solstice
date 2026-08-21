import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { Money } from '../packages/money/src/money.ts';
import { addMs } from '../packages/config/src/clock.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../packages/permissions/src/execution-authority.ts';
import { Ledger } from '../packages/ledger/src/journal.ts';
import { SIMULATION_FUNDING_SOURCE_ID } from '../packages/ledger/src/types.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe('Phase C Prompt 1 ledger performance baseline', () => {
  it('records non-production posting and lookup samples', () => {
    const issuer = new AuthorityIssuer('perf-secret');
    const ledger = new Ledger(issuer, new FrozenClock(NOW));
    const postSamples: number[] = [];
    const lookupSamples: number[] = [];
    const historySamples: number[] = [];
    let lastId = '';
    for (let i = 0; i < 80; i += 1) {
      const key = `perf_${i}`;
      const ea = issuer.issue({
        authorityId: `ea_${key}`,
        actionType: 'POST_DEPOSIT',
        accountId: SIMULATION_FUNDING_SOURCE_ID,
        intentId: key,
        idempotencyKey: key,
        amount: Money.fromMinorUnits(10n, 'USD'),
        issuedAt: NOW,
        expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
      });
      const start = performance.now();
      const journal = ledger.postJournal({
        idempotencyKey: key,
        executionAuthority: ea,
        actionType: 'POST_DEPOSIT',
        postings: [
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(10n, 'USD') },
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(10n, 'USD') },
        ],
      });
      postSamples.push(performance.now() - start);
      lastId = journal.id;
      const lookupStart = performance.now();
      ledger.getJournal(lastId);
      lookupSamples.push(performance.now() - lookupStart);
      const historyStart = performance.now();
      ledger.history({ limit: 20 });
      historySamples.push(performance.now() - historyStart);
    }
    const balanceStart = performance.now();
    ledger.projectAccountBalance(SIMULATION_FUNDING_SOURCE_ID);
    const balanceMs = performance.now() - balanceStart;
    const posting = median(postSamples);
    const lookup = median(lookupSamples);
    const history = median(historySamples);
    assert.ok(posting < 50, `posting median ${posting}ms exceeded local regression envelope`);
    assert.ok(lookup < 20, `lookup median ${lookup}ms exceeded local regression envelope`);
    assert.ok(history < 20, `history median ${history}ms exceeded local regression envelope`);
    assert.ok(balanceMs < 20, `balance ${balanceMs}ms exceeded local regression envelope`);
    assert.ok(Number.isFinite(posting) && Number.isFinite(lookup) && Number.isFinite(history));
  });
});
