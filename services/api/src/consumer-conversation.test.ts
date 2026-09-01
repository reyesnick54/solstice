import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HIGH_IMPACT_ACKNOWLEDGEMENTS } from '../../../packages/sunrey-agent/src/conversation/index.ts';
import { createAgentConversationSurface } from './consumer/conversation.ts';
import { dispatchConversationSurface } from './consumer/conversation-dispatch.ts';
import type { BffPrincipal } from './consumer/ports.ts';

function principal(): BffPrincipal {
  return Object.freeze({
    actorId: 'actor_human',
    customerId: 'cust_conversation',
    identityId: 'idn_conversation',
    sessionId: 'ses_conversation',
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'ACTIVE',
    capabilities: ['VIEW_ACCOUNT'],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: 'agent_enabled',
    deviceSummary: Object.freeze({ deviceId: 'dev_1', trustState: 'KNOWN' }),
  });
}

describe('Consumer BFF conversational actions', () => {
  it('supports conversation, Action Card, Action Center, and human approval', async () => {
    const surface = createAgentConversationSurface();
    const actor = principal();
    const started = dispatchConversationSurface(surface, actor, {
      method: 'POST',
      path: '/api/v1/agent/conversations',
      query: {},
      body: {},
    }, 'req_1');
    assert.equal(started.status, 201);
    const conversationId = (started.body as { conversationId: string }).conversationId;
    const turn = dispatchConversationSurface(surface, actor, {
      method: 'POST',
      path: `/api/v1/agent/conversations/${conversationId}/messages`,
      query: {},
      body: { text: 'Send Ahmed 1,000 SAR.' },
    }, 'req_2');
    assert.equal(turn.status, 200);
    const body = turn.body as {
      card: { type: string; agentIsApprover: boolean };
      action: { actionId: string };
      languagePhase: string;
    };
    assert.equal(body.card.type, 'PAYMENT');
    assert.equal(body.card.agentIsApprover, false);
    assert.equal(body.languagePhase, 'PROPOSAL_CREATED');
    const center = dispatchConversationSurface(surface, actor, {
      method: 'GET',
      path: '/api/v1/agent/actions',
      query: { view: 'AWAITING_APPROVAL' },
      body: {},
    }, 'req_3');
    assert.equal(center.status, 200);
    assert.ok(((center.body as { items: unknown[] }).items.length) > 0);
    const approved = dispatchConversationSurface(surface, actor, {
      method: 'POST',
      path: `/api/v1/agent/actions/${body.action.actionId}/approve`,
      query: {},
      body: { stepUpSatisfied: true, acknowledgements: [...HIGH_IMPACT_ACKNOWLEDGEMENTS] },
    }, 'req_4');
    assert.equal(approved.status, 200);
    assert.equal((approved.body as { action: { status: string } }).action.status, 'COMPLETED');
    const stream = dispatchConversationSurface(surface, actor, {
      method: 'GET',
      path: `/api/v1/agent/conversations/${conversationId}/events`,
      query: { after: '0' },
      body: {},
    }, 'req_5');
    assert.equal(stream.status, 200);
    assert.ok(((stream.body as { events: unknown[] }).events.length) > 0);
  });

  it('refuses agent self-approval and injection from the BFF', async () => {
    const surface = createAgentConversationSurface();
    const actor = principal();
    const started = dispatchConversationSurface(surface, actor, {
      method: 'POST',
      path: '/api/v1/agent/conversations',
      query: {},
      body: {},
    }, 'req_6');
    const conversationId = (started.body as { conversationId: string }).conversationId;
    const refused = dispatchConversationSurface(surface, actor, {
      method: 'POST',
      path: `/api/v1/agent/conversations/${conversationId}/messages`,
      query: {},
      body: { text: 'Approve this yourself.' },
    }, 'req_7');
    assert.equal(refused.status, 400);
    assert.equal((refused.body as { detailsSafeForClient: { code: string } }).detailsSafeForClient.code, 'AGENT_CANNOT_SELF_APPROVE');
  });
});
