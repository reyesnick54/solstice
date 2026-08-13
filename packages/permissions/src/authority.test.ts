import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMs, FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from './execution-authority.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('Execution Authority', () => {
  it('verifies a matching unexpired authority and rejects expired or mis-scoped ones', () => {
    const issuer = new AuthorityIssuer('secret');
    const issued = issuer.issue({
      authorityId: 'ea_1',
      actionType: 'OPEN_ACCOUNT',
      accountId: 'acct_1',
      intentId: 'int_1',
      idempotencyKey: 'int_1',
      amount: null,
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });

    const clock = new FrozenClock(NOW);
    const okResult = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_1' },
      clock,
    );
    assert.equal(isOk(okResult), true);

    const wrongAction = issuer.verify(
      issued,
      { actionType: 'POST_DEPOSIT', accountId: 'acct_1', intentId: 'int_1' },
      clock,
    );
    assert.equal(isErr(wrongAction), true);
    if (isErr(wrongAction)) {
      assert.equal(wrongAction.error.code, 'AUTHORITY_SCOPE_MISMATCH');
    }

    const wrongAccount = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_other', intentId: 'int_1' },
      clock,
    );
    assert.equal(isErr(wrongAccount), true);

    clock.set(addMs(NOW, AUTHORITY_TTL_MS + 1n));
    const expired = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_1' },
      clock,
    );
    assert.equal(isErr(expired), true);
    if (isErr(expired)) {
      assert.equal(expired.error.code, 'AUTHORITY_EXPIRED');
    }
  });
});
