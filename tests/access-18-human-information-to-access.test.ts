import assert from 'node:assert/strict';

import { invokeConsumerBff } from './consumer-bff-invoke.ts';
import { describe, it } from 'node:test';

import { handleConsumerBff, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>): ConsumerBffRuntime {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    dataRights: world.dataRights,
    hinAccess: world.hinAccess,
    vault: world.vault,
    access: world.access,
  };
}

async function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body?: unknown,
) {
  return await invokeConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: 'req_access18',
  });
}

describe('ACCESS-18 BFF integration', () => {
  it('lists funded data opportunities without raw PDV', async () => {
    const world = createSandboxWorld();
    const response = await call(world, 'GET', '/api/v1/data/opportunities', 'basic_verified');
    assert.equal(response.status, 200);
    const body = response.body as { readonly schema?: string }[];
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0]?.schema, 'sunrey.consumer.data.opportunity.v1');
    assert.equal((body[0] as { rawPdvExposed: boolean }).rawPdvExposed, false);
  });

  it('returns participation and compensation history surfaces', async () => {
    const world = createSandboxWorld();
    const participation = await call(world, 'GET', '/api/v1/data/participation/history', 'basic_verified');
    assert.equal(participation.status, 200);
    assert.equal(
      (participation.body as { schema: string }).schema,
      'sunrey.consumer.data.participation.history.v1',
    );
    const compensation = await call(world, 'GET', '/api/v1/data/compensation/history', 'basic_verified');
    assert.equal(compensation.status, 200);
    assert.equal(
      (compensation.body as { schema: string }).schema,
      'sunrey.consumer.data.compensation.history.v1',
    );
    const consent = await call(world, 'GET', '/api/v1/data/consent/status', 'basic_verified');
    assert.equal(consent.status, 200);
    assert.equal((consent.body as { schema: string }).schema, 'sunrey.consumer.data.consent.status.v1');
    assert.equal((consent.body as { rawPdvExposed: boolean }).rawPdvExposed, false);
  });

  it('records opt-in without exposing vault contents', async () => {
    const world = createSandboxWorld();
    const listed = await call(world, 'GET', '/api/v1/data/opportunities', 'basic_verified');
    const opportunityId = (listed.body as { opportunityId: string }[])[0]!.opportunityId;
    const optedIn = await call(world, 'POST', `/api/v1/data/opportunities/${opportunityId}/opt-in`, 'basic_verified', {});
    assert.equal(optedIn.status, 201);
    const history = optedIn.body as { items: { action: string; dataUsedForAccessWeighting: false }[] };
    assert.ok(history.items.some((row) => row.action === 'OPTED_IN'));
    assert.equal(history.items[0]?.dataUsedForAccessWeighting, false);
  });
});
