import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import {
  AUTHORITY_TTL_MS,
  AuthorityIssuer,
} from '../../permissions/src/execution-authority.ts';
import { addMs } from '../../config/src/clock.ts';
import { asAccountId, openAccount, transitionAccountStatus, ACCOUNT_STATUSES, type Account, type AccountStatus } from './account.ts';
import { asCurrencyCode } from './currency.ts';
import { asCustomerId } from './customer.ts';
import { asJurisdiction } from './jurisdiction.ts';
import { asLegalEntityId } from './legal-entity.ts';
import { asProductId } from './product.ts';
import { isErr, isOk } from './result.ts';
import { asUtcInstant } from './time.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
const OPENED_AT = asUtcInstant('2026-08-13T12:00:00.000Z');

const LEGAL_TRANSITIONS: readonly (readonly [AccountStatus, AccountStatus])[] = [
  ['PENDING_OPEN', 'OPEN'],
  ['PENDING_OPEN', 'CLOSED'],
  ['OPEN', 'FROZEN'],
  ['OPEN', 'CLOSED'],
  ['FROZEN', 'OPEN'],
  ['FROZEN', 'CLOSED'],
];

function isLegalPair(from: AccountStatus, to: AccountStatus): boolean {
  return LEGAL_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

function snapshot(account: Account): Account {
  return {
    id: account.id,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    productId: account.productId,
    legalEntityId: account.legalEntityId,
    jurisdiction: account.jurisdiction,
    currency: account.currency,
    status: account.status,
    openedAt: account.openedAt,
    version: account.version,
  };
}

function issuedOpen(): Account {
  const issuer = new AuthorityIssuer('test-account-domain-secret');
  const clock = new FrozenClock(NOW);
  const accountId = asAccountId('acct_test');
  const issued = issuer.issue({
    authorityId: 'ea_test',
    actionType: 'OPEN_ACCOUNT',
    accountId,
    intentId: 'intent_test',
    idempotencyKey: 'intent_test',
    amount: null,
    issuedAt: NOW,
    expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
  });
  const verified = issuer.verify(
    issued,
    { actionType: 'OPEN_ACCOUNT', accountId, intentId: 'intent_test' },
    clock,
  );
  assert.equal(isOk(verified), true);
  if (!isOk(verified)) {
    throw new Error('expected verified authority');
  }
  const result = openAccount(verified.value, {
    id: accountId,
    ownerId: asCustomerId('cust_test'),
    accountClass: 'DEMAND_DEPOSIT',
    productId: asProductId('prod_demand_usd_gb'),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    currency: asCurrencyCode('USD'),
    openedAt: OPENED_AT,
  });
  assert.equal(isOk(result), true);
  if (!isOk(result)) {
    throw new Error('expected account');
  }
  return result.value;
}

function withStatus(status: AccountStatus, version = 3): Account {
  const base = issuedOpen();
  if (status === 'OPEN' && version === 0) {
    return base;
  }
  return Object.freeze({
    ...base,
    status,
    version,
  });
}

describe('Account domain', () => {
  it('openAccount requires a verified Execution Authority and has no balance field', () => {
    const account = issuedOpen();
    assert.equal(account.status, 'OPEN');
    assert.equal(account.version, 0);
    assert.equal('balance' in account, false);
    assert.equal(Object.hasOwn(account, 'balance'), false);
    assert.ok(Object.isFrozen(account));
  });

  it('rejects an unverified authority at runtime', () => {
    const issuer = new AuthorityIssuer('test-account-domain-secret');
    const accountId = asAccountId('acct_unverified');
    const issued = issuer.issue({
      authorityId: 'ea_raw',
      actionType: 'OPEN_ACCOUNT',
      accountId,
      intentId: 'intent_raw',
      idempotencyKey: 'intent_raw',
      amount: null,
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const result = openAccount(issued as never, {
      id: accountId,
      ownerId: asCustomerId('cust_test'),
      accountClass: 'DEMAND_DEPOSIT',
      productId: asProductId('prod_demand_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
      openedAt: OPENED_AT,
    });
    assert.equal(result.ok, false);
    if (isErr(result)) {
      assert.equal(result.error.code, 'ACCOUNT_OPEN_REQUIRES_VERIFIED_AUTHORITY');
    }
  });

  it('rejects authority scoped to a different action or account', () => {
    const issuer = new AuthorityIssuer('test-account-domain-secret');
    const clock = new FrozenClock(NOW);
    const issued = issuer.issue({
      authorityId: 'ea_wrong',
      actionType: 'POST_DEPOSIT',
      accountId: asAccountId('acct_other'),
      intentId: 'intent_wrong',
      idempotencyKey: 'intent_wrong',
      amount: null,
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const verified = issuer.verify(
      issued,
      { actionType: 'POST_DEPOSIT', accountId: asAccountId('acct_other'), intentId: 'intent_wrong' },
      clock,
    );
    assert.equal(isOk(verified), true);
    if (!isOk(verified)) {
      return;
    }
    const result = openAccount(verified.value, {
      id: asAccountId('acct_target'),
      ownerId: asCustomerId('cust_test'),
      accountClass: 'DEMAND_DEPOSIT',
      productId: asProductId('prod_demand_usd_gb'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
      openedAt: OPENED_AT,
    });
    assert.equal(result.ok, false);
    if (isErr(result)) {
      assert.equal(result.error.code, 'ACCOUNT_OPEN_AUTHORITY_SCOPE_MISMATCH');
    }
  });

  for (const [from, to] of LEGAL_TRANSITIONS) {
    it(`allows ${from} -> ${to}`, () => {
      const account = withStatus(from);
      const before = snapshot(account);
      const result = transitionAccountStatus(account, to, NOW);
      assert.equal(isOk(result), true);
      if (!isOk(result)) {
        return;
      }
      assert.equal(result.value.account.status, to);
      assert.equal(result.value.account.version, account.version + 1);
      assert.equal(result.value.occurredAt, NOW);
      assert.notEqual(result.value.account, account);
      assert.deepEqual(snapshot(account), before);
      assert.ok(Object.isFrozen(result.value.account));
    });
  }

  for (const from of ACCOUNT_STATUSES) {
    for (const to of ACCOUNT_STATUSES) {
      if (isLegalPair(from, to)) {
        continue;
      }
      it(`rejects ${from} -> ${to} as a typed value`, () => {
        const account = withStatus(from);
        const before = snapshot(account);
        const result = transitionAccountStatus(account, to, NOW);
        assert.equal(result.ok, false);
        if (isErr(result)) {
          assert.equal(result.error.code, 'ILLEGAL_ACCOUNT_STATUS_TRANSITION');
          assert.equal(result.error.from, from);
          assert.equal(result.error.to, to);
        }
        assert.deepEqual(snapshot(account), before);
      });
    }
  }

  it('CLOSED -> OPEN is an explicit typed rejection, not an exception', () => {
    const closed = withStatus('CLOSED');
    let thrown: unknown;
    let result: ReturnType<typeof transitionAccountStatus> | undefined;
    try {
      result = transitionAccountStatus(closed, 'OPEN', NOW);
    } catch (error) {
      thrown = error;
    }
    assert.equal(thrown, undefined);
    assert.ok(result);
    assert.equal(result.ok, false);
  });

  it('does not mutate the input account on a legal or illegal transition', () => {
    const open = withStatus('OPEN');
    const beforeOpen = snapshot(open);
    transitionAccountStatus(open, 'FROZEN', NOW);
    assert.deepEqual(snapshot(open), beforeOpen);

    const closed = withStatus('CLOSED');
    const beforeClosed = snapshot(closed);
    transitionAccountStatus(closed, 'OPEN', NOW);
    assert.deepEqual(snapshot(closed), beforeClosed);
  });
});
