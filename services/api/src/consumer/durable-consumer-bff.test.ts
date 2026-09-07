import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld } from './fixtures.ts';
import { bindDurableFinancialReadModel } from './durable-consumer-bff.ts';

function isError(value: unknown): value is { readonly errorCode: string } {
  return Boolean(value && typeof value === 'object' && 'errorCode' in value);
}

describe('durable consumer financial read binding', () => {
  it('serves account detail and home financial state from the durable runtime', () => {
    const fixture = createSandboxWorld();
    const durable = createSandboxWorld();

    const applied = durable.runtime.accountProduct.applyRestriction({
      accountId: 'acct_sandbox_basic_usd',
      code: 'COMPLIANCE_REVIEW',
      reason: 'durable read binding test',
      actorId: 'operator_1',
    });
    assert.equal(applied.ok, true);

    const bound = bindDurableFinancialReadModel(fixture.bff, durable.runtime);
    const principal = fixture.personas.basic_verified;

    const fixtureAccount = fixture.bff.getAccount(principal, 'acct_sandbox_basic_usd', 'req_fixture');
    assert.equal(isError(fixtureAccount), false);
    if (!isError(fixtureAccount)) {
      assert.equal(fixtureAccount.status, 'ACTIVE');
    }

    const durableAccount = bound.getAccount(principal, 'acct_sandbox_basic_usd', 'req_durable');
    assert.equal(isError(durableAccount), false);
    if (!isError(durableAccount)) {
      assert.equal(durableAccount.status, 'RESTRICTED');
      assert.ok(durableAccount.restrictions.includes('COMPLIANCE_REVIEW'));
    }

    const home = bound.home(principal, 'req_home');
    const fixtureHome = fixture.bff.home(principal, 'req_fixture_home');
    assert.equal(isError(home), false);
    assert.equal(isError(fixtureHome), false);
    if (!isError(home) && !isError(fixtureHome)) {
      const account = home.accounts.value?.find((row) => row.id === 'acct_sandbox_basic_usd');
      assert.ok(account);
      assert.equal(account.status, 'RESTRICTED');
      assert.equal(home.grow.state, fixtureHome.grow.state);
    }
  });
});
