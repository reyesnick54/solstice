import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_EXTERNAL_EXECUTION,
  LIVE_FLAGS,
  LIVE_LLM_ENFORCEMENT,
  LIVE_MERCHANT_NETWORK,
  LIVE_MONEY_MOVEMENT,
  LIVE_SUBSCRIPTION_MUTATION,
  REAL_MONEY_ENABLED,
} from '../packages/platform/src/flags/live.ts';
import { EVENT_CATALOG } from '../packages/contracts/src/events-catalog.ts';

describe('LIVE_* flags', () => {
  it('are all false and frozen', () => {
    assert.equal(LIVE_MONEY_MOVEMENT, false);
    assert.equal(LIVE_EXTERNAL_EXECUTION, false);
    assert.equal(LIVE_SUBSCRIPTION_MUTATION, false);
    assert.equal(LIVE_LLM_ENFORCEMENT, false);
    assert.equal(LIVE_MERCHANT_NETWORK, false);
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.ok(Object.isFrozen(LIVE_FLAGS));
    for (const value of Object.values(LIVE_FLAGS)) {
      assert.equal(value, false);
    }
  });
});

describe('event catalog', () => {
  it('includes agent, mandate, growth, and kernel events', () => {
    assert.ok(EVENT_CATALOG.includes('agent.proposal.emitted'));
    assert.ok(EVENT_CATALOG.includes('agent.proposal.allowed'));
    assert.ok(EVENT_CATALOG.includes('agent.proposal.refused'));
    assert.ok(EVENT_CATALOG.includes('agent.proposal.blocked_by_token'));
    assert.ok(EVENT_CATALOG.includes('mandate.set'));
    assert.ok(EVENT_CATALOG.includes('growth.entry.recorded'));
    assert.ok(EVENT_CATALOG.includes('kernel.intent.submitted'));
    assert.ok(EVENT_CATALOG.includes('execution_authority.issued'));
    assert.ok(EVENT_CATALOG.length >= 20);
  });
});
