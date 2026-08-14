import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMs, FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
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

  it('issues and verifies through the canonical KeyProvider, including rotation', () => {
    const keys = createSimulationKeyProvider();
    const issuer = new AuthorityIssuer(keys);
    const issued = issuer.issue({
      authorityId: 'ea_rot',
      actionType: 'OPEN_ACCOUNT',
      accountId: 'acct_1',
      intentId: 'int_rot',
      idempotencyKey: 'int_rot',
      amount: null,
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const clock = new FrozenClock(NOW);
    const first = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_rot' },
      clock,
    );
    assert.equal(isOk(first), true);

    const rotated = keys.rotateKey('EXECUTION_AUTHORITY_SIGNING');
    assert.equal(rotated.ok, true);
    const historical = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_rot' },
      clock,
    );
    assert.equal(isOk(historical), true);

    const next = issuer.issue({
      authorityId: 'ea_rot2',
      actionType: 'OPEN_ACCOUNT',
      accountId: 'acct_1',
      intentId: 'int_rot2',
      idempotencyKey: 'int_rot2',
      amount: null,
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    assert.equal(isOk(issuer.verify(next, { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_rot2' }, clock)), true);

    keys.revokeKey('EXECUTION_AUTHORITY_SIGNING', 1);
    const revoked = issuer.verify(
      issued,
      { actionType: 'OPEN_ACCOUNT', accountId: 'acct_1', intentId: 'int_rot' },
      clock,
    );
    assert.equal(isErr(revoked), true);
  });
});
