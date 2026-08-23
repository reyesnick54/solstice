import type { Pool } from 'pg';

import {
  deserializeAgentRuntimeSnapshot,
  serializeAgentRuntimeSnapshot,
} from '../../../sunrey-agent/src/serialize.ts';
import type { AgentRuntimeSnapshot } from '../../../sunrey-agent/src/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistAgentRuntimeState(pool: Pool, state: AgentRuntimeSnapshot): Promise<void> {
  const serialized = serializeAgentRuntimeSnapshot(state);
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const agent of serialized.agents) {
        await client.query(
          `INSERT INTO agent_runtime.agent
             (agent_id, owner_id, identity_kind, agent_type, name, status, model_ref, policy_ref,
              mandate_id, jurisdiction, risk_policy_id, is_customer, is_execution_authority,
              receives_master_key, created_at, body_canonical)
           VALUES ($1,$2,'SUNREY_AGENT',$3,$4,$5,$6,$7,$8,$9,$10,FALSE,FALSE,FALSE,$11,$12)
           ON CONFLICT (agent_id) DO UPDATE SET
             status = EXCLUDED.status,
             mandate_id = EXCLUDED.mandate_id,
             body_canonical = EXCLUDED.body_canonical`,
          [
            agent.agentId,
            agent.ownerId,
            agent.agentType,
            agent.name,
            agent.status,
            agent.modelRef,
            agent.policyRef,
            agent.mandateId,
            agent.jurisdiction,
            agent.riskPolicy.riskPolicyId,
            agent.createdAt,
            JSON.stringify(agent),
          ],
        );
      }
      for (const conversation of serialized.conversations) {
        await client.query(
          `INSERT INTO agent_runtime.conversation
             (conversation_id, owner_id, agent_id, status, title, context_version,
              is_financial_record, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8)
           ON CONFLICT (conversation_id) DO UPDATE SET
             status = EXCLUDED.status,
             title = EXCLUDED.title,
             context_version = EXCLUDED.context_version,
             updated_at = EXCLUDED.updated_at`,
          [
            conversation.conversationId,
            conversation.ownerId,
            conversation.agentId,
            conversation.status,
            conversation.title,
            conversation.contextVersion,
            conversation.createdAt,
            conversation.updatedAt,
          ],
        );
      }
      for (const message of serialized.messages) {
        await client.query(
          `INSERT INTO agent_runtime.message
             (message_id, conversation_id, role, content, visible, hidden_reasoning,
              proposal_ref, tool_event_id, created_at)
           VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7,$8)
           ON CONFLICT (message_id) DO NOTHING`,
          [
            message.messageId,
            message.conversationId,
            message.role,
            message.content,
            message.visible,
            message.proposalRef,
            message.toolEventId,
            message.createdAt,
          ],
        );
      }
      for (const memory of serialized.memories) {
        await client.query(
          `INSERT INTO agent_runtime.memory
             (memory_id, agent_id, owner_id, category, content, source, confidence,
              user_editable, data_classification, personalization, created_at, updated_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (memory_id) DO UPDATE SET
             content = EXCLUDED.content,
             source = EXCLUDED.source,
             updated_at = EXCLUDED.updated_at`,
          [
            memory.memoryId,
            memory.agentId,
            memory.ownerId,
            memory.category,
            memory.content,
            memory.source,
            memory.confidence,
            memory.userEditable,
            memory.dataClassification,
            memory.personalization,
            memory.createdAt,
            memory.updatedAt,
            memory.expiresAt,
          ],
        );
      }
      await client.query(
        `INSERT INTO agent_runtime.snapshot (snapshot_id, grants_execution_authority, body_canonical, created_at)
         VALUES ('agent_runtime_head', FALSE, $1, NOW())
         ON CONFLICT (snapshot_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical, created_at = EXCLUDED.created_at`,
        [JSON.stringify(serialized)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadAgentRuntimeState(pool: Pool): Promise<AgentRuntimeSnapshot | null> {
  const result = await pool.query<{ body_canonical: string }>(
    `SELECT body_canonical FROM agent_runtime.snapshot WHERE snapshot_id = 'agent_runtime_head'`,
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return deserializeAgentRuntimeSnapshot(JSON.parse(row.body_canonical));
}
