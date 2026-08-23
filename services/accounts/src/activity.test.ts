import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asCustomerId } from '../../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { freezeHistoryItem } from '../../../packages/domain/src/transaction-history.ts';
import { normalizeActivityItem, parseActivityFilter } from './activity.ts';

describe('account activity classification', () => {
  it('does not treat a UUID substring FEE as a fee posting', () => {
    const item = normalizeActivityItem(
      freezeHistoryItem({
        reference: '4feeaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:abfee001-0000-0000-0000-000000000001',
        accountId: asAccountId('acct_act_uuid'),
        customerId: asCustomerId('cust_act_uuid'),
        status: 'COMPLETED',
        direction: 'CREDIT',
        amountMinorUnits: 4_000n,
        currency: asCurrencyCode('USD'),
        description: 'POST_DEPOSIT credit',
        journalId: '4feeaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        holdId: null,
        occurredAt: asUtcInstant('2026-08-13T15:00:00.000Z'),
      }),
    );
    assert.equal(item.type, 'DEPOSIT');
    assert.equal(item.status, 'COMPLETED');
    assert.equal(item.direction, 'IN');
  });

  it('still classifies an explicit fee posting as FEE', () => {
    const item = normalizeActivityItem(
      freezeHistoryItem({
        reference: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:00000000-0000-0000-0000-000000000001',
        accountId: asAccountId('acct_fee'),
        customerId: asCustomerId('cust_fee'),
        status: 'COMPLETED',
        direction: 'DEBIT',
        amountMinorUnits: 150n,
        currency: asCurrencyCode('USD'),
        description: 'POST_FEE debit',
        journalId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        holdId: null,
        occurredAt: asUtcInstant('2026-08-13T15:00:00.000Z'),
      }),
    );
    assert.equal(item.type, 'FEE');
  });

  it('rejects an unsafe status filter', () => {
    const bad = parseActivityFilter({ status: 'DROP TABLE' });
    assert.equal('error' in bad, true);
  });
});
