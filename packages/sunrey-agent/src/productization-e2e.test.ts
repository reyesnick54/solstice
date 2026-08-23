import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { AgentQualificationPlatform } from './productization/platform.ts';
import { PHASE_F_FLAGS } from './productization/qualification.ts';
import { LOVABLE_AGENT_UI_COMPONENTS } from './productization/taxonomy.ts';

describe('Phase F SDK-shaped Agent E2E and red team', () => {
  it('completes the sandbox payment and growth journey without Agent execution authority', () => {
    const platform = new AgentQualificationPlatform({
      clock: new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z')),
    });
    const user = platform.authenticateSandboxUser('cust_sandbox_agent');
    const agent = platform.createOrGetAgent(user);
    assert.equal(agent.ok, true);
    const convo = platform.openConversation(user);
    assert.equal(convo.ok, true);
    if (!convo.ok) {
      return;
    }
    const snap = platform.chat(user, convo.value.conversationId, 'How am I doing financially?');
    assert.equal(snap.ok && snap.value.toolsUsed.includes('get_financial_snapshot'), true);
    if (!snap.ok) {
      return;
    }
    assert.match(snap.value.text, /ledger-projected total/);
    const pay = platform.chat(user, convo.value.conversationId, 'Send Ahmed 1,000 SAR.');
    assert.equal(pay.ok && pay.value.cards.length === 1, true);
    if (!pay.ok) {
      return;
    }
    const card = pay.value.cards[0];
    assert.ok(card);
    const revised = platform.reviseAction(user, card.actionId, 750_00n);
    assert.equal(revised.ok && revised.value.amountMinor === 750_00n, true);
    const approved = platform.approveAction(user, card.actionId);
    assert.equal(approved.ok, true);
    const stepped = platform.stepUp(user, card.actionId);
    assert.equal(stepped.ok, true);
    const executed = platform.humanExecute(user, card.actionId, 'idem_pay_1');
    assert.equal(executed.ok, true);
    const completed = platform.recordDomainOutcome(user, {
      actionId: card.actionId,
      state: 'COMPLETED',
      ledgerJournalId: 'jnl_sandbox_pay_1',
      providerRef: 'sandbox_rail_a',
      executionAuthorityRef: 'ea_human_sandbox_1',
      kernelDecision: 'ALLOW',
    });
    assert.equal(completed.ok && completed.value.state === 'COMPLETED', true);
    const grow = platform.chat(user, convo.value.conversationId, 'What should I do with $10,000?');
    assert.equal(grow.ok && grow.value.cards[0]?.kind === 'GROWTH', true);
    if (!grow.ok || !grow.value.cards[0]) {
      return;
    }
    const growthId = grow.value.cards[0].actionId;
    assert.equal(platform.approveAction(user, growthId).ok, true);
    assert.equal(platform.stepUp(user, growthId).ok, true);
    const growthExec = platform.humanExecute(user, growthId, 'idem_grow_1');
    assert.equal(growthExec.ok, true);
    const growthDone = platform.recordDomainOutcome(user, {
      actionId: growthId,
      state: 'COMPLETED',
      ledgerJournalId: 'jnl_sandbox_grow_1',
      providerRef: 'sandbox_invest_a',
      executionAuthorityRef: 'ea_human_sandbox_2',
      kernelDecision: 'ALLOW',
    });
    assert.equal(growthDone.ok, true);
    const pref = platform.storePreference(user, 'Please remember I prefer quiet hours.');
    assert.equal(pref.ok && pref.value.memoryClass === 'ELIGIBLE_PREFERENCE', true);
    const closed = platform.closeConversation(user, convo.value.conversationId);
    assert.equal(closed.ok && closed.value.status === 'CLOSED', true);
    const audit = platform.exportAudit(user, card.actionId);
    assert.equal(audit.ok, true);
    if (audit.ok) {
      assert.equal(audit.value.hiddenReasoningIncluded, false);
      assert.equal(audit.value.executionAuthorityRef, 'ea_human_sandbox_1');
      assert.equal(audit.value.ledgerJournalId, 'jnl_sandbox_pay_1');
      assert.ok(audit.value.kernelDecision);
    }
    assert.equal(platform.unauthorizedFinancialExecutions.count, 0);
    assert.equal(platform.markCompleteAsAgent().ok, false);
  });

  it('red-team E2E records zero unauthorized financial executions', () => {
    const platform = new AgentQualificationPlatform({
      clock: new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z')),
    });
    const attacker = platform.authenticateSandboxUser('user_a');
    const victim = platform.authenticateSandboxUser('user_b');
    const result = platform.runRedTeam(attacker, victim);
    assert.equal(result.unauthorizedFinancialExecutions, 0);
    assert.ok(result.blocked >= 8);
  });

  it('supports the Lovable Agent contract and keeps production disabled', () => {
    assert.deepEqual(PHASE_F_FLAGS.lovableComponents, [...LOVABLE_AGENT_UI_COMPONENTS]);
    assert.equal(PHASE_F_FLAGS.PRODUCTION_READY, false);
    assert.equal(PHASE_F_FLAGS.PRODUCTION_ACTIVE, false);
    assert.equal(PHASE_F_FLAGS.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(PHASE_F_FLAGS.REAL_AI_PROVIDER_CONNECTED, false);
    assert.equal(PHASE_F_FLAGS.LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED, false);
    assert.equal(PHASE_F_FLAGS.READY_FOR_PHASE_G, true);
  });
});
