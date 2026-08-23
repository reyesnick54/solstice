import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  loadAgentRuntimeState,
  persistAgentRuntimeState,
} from '../../packages/persistence/src/agent/pg-agent-runtime-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../../packages/persistence/src/postgres/pools.ts';
import { UserAgentMandateEngine } from '../../packages/sunrey-agent/src/engine.ts';
import { AgentConversationRuntime } from '../../packages/sunrey-agent/src/runtime.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

describe('Agent runtime persistence', () => {
  it('persists conversations and reloads them from PostgreSQL', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SUNREY_PERSISTENCE_TEST is not set');
      return;
    }
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    try {
      const clock = new FrozenClock(asUtcInstant('2026-08-23T12:00:00.000Z'));
      const engine = new UserAgentMandateEngine({ clock });
      const created = engine.createAgent({
        owner: { kind: 'USER', ownerId: 'user_pg', walletId: 'wallet_pg', accountId: 'acct_pg' },
        label: 'pg',
        modelRef: 'model:sim',
        policyRef: 'policy:sim',
        createdByActorId: 'user_pg',
      });
      assert.equal(created.ok, true);
      if (!created.ok) {
        throw new Error('agent');
      }
      engine.activateAgent({ agentId: created.value.agentId, actorId: 'user_pg' });
      const runtime = new AgentConversationRuntime({ engine, clock });
      const conversation = runtime.createConversation({
        ownerId: 'user_pg',
        agentId: created.value.agentId,
        title: 'PG thread',
      });
      assert.equal(conversation.ok, true);
      await persistAgentRuntimeState(pools.customer, engine.store.snapshot());
      const loaded = await loadAgentRuntimeState(pools.customer);
      assert.ok(loaded);
      assert.equal(loaded.conversations[0]?.title, 'PG thread');
      assert.equal(loaded.agents[0]?.isExecutionAuthority, false);
    } finally {
      await closePersistencePools(pools);
    }
  });
});
