import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { UserAgentMandateEngine } from '../../../sunrey-agent/src/engine.ts';
import { AgentConversationRuntime } from '../../../sunrey-agent/src/runtime.ts';
import { InMemoryAgentMandateStore } from '../../../sunrey-agent/src/store.ts';
import { DurableAgentRuntimeStore } from './durable-store.ts';

describe('DurableAgentRuntimeStore', () => {
  it('reopens conversations after a process-style restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-agent-durable-'));
    const memory = new InMemoryAgentMandateStore();
    const clock = new FrozenClock(asUtcInstant('2026-08-23T12:00:00.000Z'));
    const engine = new UserAgentMandateEngine({ clock, store: memory });
    const created = engine.createAgent({
      owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: 'acct_1' },
      label: 'durable',
      modelRef: 'model:sim',
      policyRef: 'policy:sim',
      createdByActorId: 'user_1',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('agent');
    }
    engine.activateAgent({ agentId: created.value.agentId, actorId: 'user_1' });
    const runtime = new AgentConversationRuntime({ engine, clock });
    const conversation = runtime.createConversation({
      ownerId: 'user_1',
      agentId: created.value.agentId,
      title: 'Durable thread',
    });
    assert.equal(conversation.ok, true);
    const durable = new DurableAgentRuntimeStore(dir);
    durable.save(memory);
    const restoredMemory = new InMemoryAgentMandateStore();
    durable.reopen().hydrate(restoredMemory);
    assert.equal(restoredMemory.conversations.size, 1);
    assert.equal([...restoredMemory.conversations.values()][0]?.title, 'Durable thread');
    assert.equal(durable.list().grantsExecutionAuthority, false);
  });
});
