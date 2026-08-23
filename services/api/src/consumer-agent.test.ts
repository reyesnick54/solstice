import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body: unknown = {},
  query: Record<string, string> = {},
) {
  return handleConsumerBff(
    {
      bff: world.bff,
      sessions: world.sessions,
      identity: world.runtime.identity.service,
      payments: world.payments,
      agentRuntime: world.agentRuntime,
    },
    {
      method,
      path,
      query,
      body,
      authorization: auth(persona),
    },
  );
}

describe('Consumer BFF Agent runtime', () => {
  it('lists the sandbox agent and denies cross-user access', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/agents', 'agent_enabled');
    assert.equal(listed.status, 200);
    const items = (listed.body as { items: { agentId: string; canIssueAuthority: false }[] }).items;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.canIssueAuthority, false);
    const other = call(world, 'GET', `/api/v1/agents/${items[0]?.agentId}`, 'basic_verified');
    assert.equal(other.status, 403);
    const pausedByOther = call(world, 'POST', `/api/v1/agents/${items[0]?.agentId}/pause`, 'basic_verified');
    assert.equal(pausedByOther.status, 403);
  });

  it('creates a conversation, streams a message, and keeps financial state unchanged', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/agents', 'agent_enabled');
    const agentId = (listed.body as { items: { agentId: string }[] }).items[0]?.agentId ?? '';
    const created = call(world, 'POST', `/api/v1/agents/${agentId}/conversations`, 'agent_enabled', {
      title: 'Home chat',
    });
    assert.equal(created.status, 201);
    const conversationId = (created.body as { conversationId: string }).conversationId;
    const posted = call(
      world,
      'POST',
      `/api/v1/agents/${agentId}/conversations/${conversationId}/messages`,
      'agent_enabled',
      { text: 'Hello' },
      { stream: '1' },
    );
    assert.equal(posted.status, 200);
    assert.equal(posted.headers['content-type'], 'text/event-stream');
    assert.ok(posted.eventStream?.includes('event: token'));
    assert.equal((posted.body as { financialStateChanged: boolean }).financialStateChanged, false);
  });

  it('supports memory controls and pause', () => {
    const world = createSandboxWorld();
    const agentId = (call(world, 'GET', '/api/v1/agents', 'agent_enabled').body as { items: { agentId: string }[] }).items[0]
      ?.agentId ?? '';
    const memory = call(world, 'POST', `/api/v1/agents/${agentId}/memories`, 'agent_enabled', {
      category: 'USER_PREFERENCE',
      content: 'User prefers explanations in simple language.',
      source: 'USER_DECLARED',
    });
    assert.equal(memory.status, 201);
    const paused = call(world, 'POST', `/api/v1/agents/${agentId}/pause`, 'agent_enabled');
    assert.equal(paused.status, 200);
    assert.equal((paused.body as { status: string }).status, 'PAUSED');
  });
});
