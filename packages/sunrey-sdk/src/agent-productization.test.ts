import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { createSunReyAgentClient, PHASE_F_FLAGS } from './agent-productization.ts';

describe('SunRey SDK Agent productization', () => {
  it('exposes a client-safe sandbox Agent journey', () => {
    const client = createSunReyAgentClient({
      clock: new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z')),
    });
    const user = client.authenticateSandboxUser('sdk_user');
    assert.equal(client.createOrGetAgent(user).ok, true);
    const convo = client.openConversation(user);
    assert.equal(convo.ok, true);
    if (!convo.ok) {
      return;
    }
    const snap = client.chat(user, convo.value.conversationId, 'How am I doing financially?');
    assert.equal(snap.ok && snap.value.toolsUsed.includes('get_financial_snapshot'), true);
    const pay = client.chat(user, convo.value.conversationId, 'Send Ahmed 1,000 SAR.');
    assert.equal(pay.ok && pay.value.cards.length === 1, true);
    if (!pay.ok || !pay.value.cards[0]) {
      return;
    }
    const actionId = pay.value.cards[0].actionId;
    assert.equal(client.reviseAction(user, actionId, 750_00n).ok, true);
    assert.equal(client.approveAction(user, actionId).ok, true);
    assert.equal(client.stepUp(user, actionId).ok, true);
    const executed = client.humanExecute(user, actionId, 'sdk_pay_1');
    assert.equal(executed.ok, true);
    assert.equal(PHASE_F_FLAGS.LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED, false);
    assert.equal(PHASE_F_FLAGS.REAL_AI_PROVIDER_CONNECTED, false);
  });
});
