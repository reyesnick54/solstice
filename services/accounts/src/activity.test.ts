import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asCustomerId } from '../../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { freezeHistoryItem } from '../../../packages/domain/src/transaction-history.ts';
import { normalizeActivityItem } from './activity.ts';

describe('activity normalization', () => {
  it('does not treat hex journal ids containing fee as a fee', () => {
    const item = normalizeActivityItem(
      freezeHistoryItem({
        reference: 'aaaaaaaa-bbbb-cccc-fee0-1234567890ab:posting_1',
        accountId: asAccountId('acct_act_fee_id'),
        customerId: asCustomerId('cust_act_fee_id'),
        status: 'COMPLETED',
        direction: 'CREDIT',
        amountMinorUnits: 4_000n,
        currency: asCurrencyCode('USD'),
        description: 'POST_DEPOSIT credit',
        journalId: 'aaaaaaaa-bbbb-cccc-fee0-1234567890ab',
        holdId: null,
        occurredAt: asUtcInstant('2026-08-13T15:00:00.000Z'),
      }),
    );
    assert.equal(item.type, 'DEPOSIT');
    assert.equal(item.status, 'COMPLETED');
    assert.equal(item.direction, 'IN');
  });
});
