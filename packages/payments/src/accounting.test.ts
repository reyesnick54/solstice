import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '../../money/src/money.ts';
import {
  captureFeePlan,
  capturePrincipalPlan,
  destinationFxPlan,
  feeIncomePlan,
  releasePlan,
  reservePlan,
  returnDestinationFxPlan,
  returnDestinationSettlePlan,
  returnPrincipalPlan,
  returnSourceFxPlan,
  settlePlan,
  sourceFxPlan,
  type PaymentJournalPlan,
} from './accounting.ts';

function assertSingleCurrencyBalanced(plan: PaymentJournalPlan): void {
  const currencies = new Set(plan.postings.map((row) => row.amount.currency));
  assert.equal(currencies.size, 1, `${plan.suffix} mixed currencies`);
  let debits = 0n;
  let credits = 0n;
  for (const posting of plan.postings) {
    if (posting.direction === 'DEBIT') {
      debits += posting.amount.minorUnits;
    } else {
      credits += posting.amount.minorUnits;
    }
  }
  assert.equal(debits, credits, `${plan.suffix} unbalanced`);
}

describe('FX accounting journals', () => {
  const usd = Money.fromMinorUnits(100_000n, 'USD');
  const fee = Money.fromMinorUnits(1_500n, 'USD');
  const debit = Money.fromMinorUnits(101_500n, 'USD');
  const sar = Money.fromMinorUnits(374_500n, 'SAR');

  it('keeps every planned journal balanced in a single currency', () => {
    const plans = [
      reservePlan('acct_us', debit),
      capturePrincipalPlan(usd),
      captureFeePlan(fee),
      feeIncomePlan(fee),
      sourceFxPlan(usd),
      destinationFxPlan(sar),
      settlePlan(sar),
      releasePlan('acct_us', debit),
      returnDestinationSettlePlan(sar),
      returnDestinationFxPlan(sar),
      returnSourceFxPlan(usd),
      returnPrincipalPlan('acct_us', usd),
    ];
    for (const plan of plans) {
      assertSingleCurrencyBalanced(plan);
    }
  });

  it('never posts USD and SAR on the same journal', () => {
    const usdSides = sourceFxPlan(usd).postings.map((row) => row.amount.currency);
    const sarSides = destinationFxPlan(sar).postings.map((row) => row.amount.currency);
    assert.deepEqual([...new Set(usdSides)], ['USD']);
    assert.deepEqual([...new Set(sarSides)], ['SAR']);
  });
});
