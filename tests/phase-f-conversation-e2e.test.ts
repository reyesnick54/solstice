import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';

import { HIGH_IMPACT_ACKNOWLEDGEMENTS } from '../packages/sunrey-agent/src/conversation/index.ts';
import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/client.ts';
import { createAgentConversationSurface } from '../services/api/src/consumer/conversation.ts';
import { dispatchConversationSurface } from '../services/api/src/consumer/conversation-dispatch.ts';
import type { BffPrincipal } from '../services/api/src/consumer/ports.ts';

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

describe('Phase F Prompt 4 conversational e2e', () => {
  it('walks payment, growth, FX, and exchange through the BFF SDK', async () => {
    const surface = createAgentConversationSurface();
    const actor = principal();
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk as Buffer));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = raw.length === 0 ? {} : JSON.parse(raw);
        const query = Object.fromEntries(url.searchParams.entries());
        const result = dispatchConversationSurface(
          surface,
          actor,
          { method: req.method ?? 'GET', path: url.pathname, query, body },
          req.headers['x-request-id']?.toString() ?? 'req_e2e',
        );
        res.writeHead(result.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected tcp address');
    }
    try {
      const client = createSunReyConsumerBffClient({
        baseUrl: `http://127.0.0.1:${String(address.port)}`,
        getAccessToken: () => 'sandbox.agent_enabled',
      });

      const payment = await runFlow(client, 'Send Ahmed 1,000 SAR.', 'PAYMENT');
      assert.equal(payment.status, 'COMPLETED');

      const grow = await runFlow(client, 'I have $10,000. How should I grow it?', 'GROWTH', '500');
      assert.equal(grow.status, 'COMPLETED');

      const fx = await runFlow(client, 'Convert $2,000 to Riyals.', 'FX');
      assert.equal(fx.status, 'COMPLETED');

      const exchange = await runFlow(client, 'Buy $500 of SunRey Coin.', 'EXCHANGE');
      assert.equal(exchange.status, 'COMPLETED');

      const center = await client.listAgentActions('COMPLETED');
      assert.ok(center.items.length >= 4);
      assert.equal(center.productionMoneyMovement, false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});

async function runFlow(
  client: ReturnType<typeof createSunReyConsumerBffClient>,
  text: string,
  type: string,
  modifyAmount?: string,
): Promise<{ readonly status: string }> {
  const started = await client.startAgentConversation();
  const turn = await client.sendAgentMessage(started.conversationId, text);
  assert.equal(turn.card?.type, type);
  assert.equal(turn.card?.agentIsApprover, false);
  assert.notEqual(turn.languagePhase, 'COMPLETED');
  let actionId = turn.action?.actionId;
  assert.ok(actionId);
  if (modifyAmount && actionId) {
    const modified = await client.modifyAgentAction(actionId, modifyAmount);
    assert.ok(modified.action?.actionId);
    actionId = modified.action.actionId;
  }
  const approved = await client.approveAgentAction(actionId!, {
    stepUpSatisfied: true,
    acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS,
  });
  assert.equal(approved.agentIsApprover, false);
  assert.equal(approved.productionMoneyMovement, false);
  return { status: approved.action?.status ?? 'UNKNOWN' };
}
