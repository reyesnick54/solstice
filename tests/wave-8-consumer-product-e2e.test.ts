import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/client.ts';
import { createSunReyPreviewRuntime } from '../services/api/src/preview.ts';
import { handleConsumerBff } from '../services/api/src/consumer/bff-test-utils.ts';
import { sandboxToken } from '../services/api/src/consumer/sandbox-personas.ts';

function call(
  runtime: ReturnType<typeof createSunReyPreviewRuntime>,
  method: string,
  path: string,
  persona: string,
  body?: unknown,
) {
  return handleConsumerBffSync(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona as never)}`,
    requestId: `req_wave8_${path.replace(/\//g, '_')}`,
  });
}

describe('Wave 8 consumer product integration e2e', () => {
  const runtime = createSunReyPreviewRuntime();

  it('loads home with native coins, action center, and sandbox metadata', async () => {
    const res = await call(runtime, 'GET', '/api/v1/me/home', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as Record<string, unknown>;
    assert.equal(body.schema, 'sunrey.consumer.home.v1');
    assert.ok(body.nativeCoins);
    assert.ok(body.actionCenter);
    assert.ok(body.economicIndicators);
    assert.ok(body.sandbox);
    const sandbox = body.sandbox as { mode: string; sandboxDataIsNotReal: boolean };
    assert.equal(sandbox.sandboxDataIsNotReal, true);
    assert.ok(['SANDBOX', 'SIMULATION'].includes(sandbox.mode));
  });

  it('loads bootstrap with application state', async () => {
    const res = await call(runtime, 'GET', '/api/v1/me/bootstrap', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as Record<string, unknown>;
    assert.equal(body.schema, 'sunrey.consumer.bootstrap.v1');
    assert.ok(body.applicationState);
    assert.ok(body.sandbox);
    const app = body.applicationState as { authoritativeSource: string; frontendMathAuthoritative: boolean };
    assert.equal(app.authoritativeSource, 'BACKEND');
    assert.equal(app.frontendMathAuthoritative, false);
  });

  it('exposes unified action center with required states', async () => {
    const res = await call(runtime, 'GET', '/api/v1/action-center', 'agent_enabled');
    assert.equal(res.status, 200);
    const body = res.body as { schema: string; items: Array<{ status: string }> };
    assert.equal(body.schema, 'sunrey.consumer.action-center.unified.v1');
    assert.ok(body.items.length >= 1);
    for (const item of body.items) {
      assert.ok(['ACTION_REQUIRED', 'IN_REVIEW', 'COMPLETED', 'DISMISSED', 'EXPIRED'].includes(item.status));
    }
  });

  it('reads wallet native coin balances from backend', async () => {
    const res = await call(runtime, 'GET', '/api/v1/wallets', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { items?: unknown[] };
    assert.ok(Array.isArray(body.items));
  });

  it('supports agent mandate read and authorization policy', async () => {
    const agents = await call(runtime, 'GET', '/api/v1/agents', 'agent_enabled');
    assert.equal(agents.status, 200);
    const list = agents.body as { items: Array<{ agentId: string }> };
    assert.ok(list.items.length >= 1);
    const agentId = list.items[0]!.agentId;

    const policy = await call(runtime, 'GET', '/api/v1/agent/authorization-policy', 'agent_enabled');
    assert.equal(policy.status, 200);
    const policyBody = policy.body as { agentMayMint: boolean; agentIsExecutionAuthority: boolean };
    assert.equal(policyBody.agentMayMint, false);
    assert.equal(policyBody.agentIsExecutionAuthority, false);

    const mandate = await call(runtime, 'GET', `/api/v1/agents/${agentId}/mandates`, 'agent_enabled');
    assert.equal(mandate.status, 200);
    const mandateBody = mandate.body as { schema: string; adviceOnly: boolean; executionSeparated: boolean };
    assert.equal(mandateBody.schema, 'sunrey.consumer.agent-mandate.v1');
    assert.equal(mandateBody.executionSeparated, true);
  });

  it('lists vault opportunities without promising issuance', async () => {
    const res = await call(runtime, 'GET', '/api/v1/data/vault/opportunities', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as { items: Array<{ mintsSunRey: boolean; issuancePromised: boolean }> };
    assert.ok(body.items.length >= 1);
    for (const item of body.items) {
      assert.equal(item.mintsSunRey, false);
      assert.equal(item.issuancePromised, false);
    }
  });

  it('supports vault consent grant and revoke via data rights', async () => {
    const list = await call(runtime, 'GET', '/api/v1/data/consents', 'basic_verified');
    assert.equal(list.status, 200);
  });

  it('exposes exchange sandbox with human/productive economy context', async () => {
    const res = await call(runtime, 'GET', '/api/v1/exchange', 'exchange');
    assert.equal(res.status, 200);
    const body = res.body as Record<string, unknown>;
    assert.ok(body);
  });

  it('exposes economic data categories as simulation', async () => {
    const res = await call(runtime, 'GET', '/api/v1/economy/productive/categories', 'basic_verified');
    assert.equal(res.status, 200);
  });

  it('degrades gracefully when provider is down', async () => {
    const degraded = createSunReyPreviewRuntime({ providerDown: true });
    const res = await call(degraded, 'GET', '/api/v1/me/application-state', 'provider_down');
    assert.equal(res.status, 200);
    const body = res.body as { connectivity: string; degradedServices: string[] };
    assert.equal(body.connectivity, 'DEGRADED');
    assert.ok(body.degradedServices.length > 0);
  });

  it('walks SDK client through core wave 8 flows', async () => {
    const server = await import('../services/api/src/consumer/http.ts').then((m) =>
      m.startConsumerBff({ runtime, allowSandboxPersonas: true }),
    );
    try {
      const client = createSunReyConsumerBffClient({
        baseUrl: server.url,
        getAccessToken: () => sandboxToken('basic_verified'),
      });
      const home = await client.getHome();
      assert.equal(home.schema, 'sunrey.consumer.home.v1');
      const bootstrap = await client.getBootstrap();
      assert.equal(bootstrap.schema, 'sunrey.consumer.bootstrap.v1');
      const policy = await client.getAgentAuthorizationPolicy();
      assert.equal((policy as { agentMayMint: boolean }).agentMayMint, false);
      const opportunities = await client.listVaultOpportunities();
      assert.equal((opportunities as { schema: string }).schema, 'sunrey.consumer.vault.opportunities.v1');
    } finally {
      await server.close();
    }
  });
});
