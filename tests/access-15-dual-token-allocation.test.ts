import assert from 'node:assert/strict';

import { invokeConsumerBff } from './consumer-bff-invoke.ts';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';

async function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body?: Record<string, unknown>,
  query: Record<string, string> = {},
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    access: world.access,
  };
  return await invokeConsumerBff(runtime, {
    method,
    path,
    query,
    body: body ?? {},
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
    requestId: `req_${method}_${path.replace(/\//g, '_')}`,
  });
}

describe('ACCESS-15 BFF integration', () => {
  it('exposes epoch and participation read surfaces', async () => {
    const world = createSandboxWorld();
    const epoch = await call(world, 'GET', '/api/v1/access/epoch', 'basic_verified');
    assert.equal(epoch.status, 200);
    const epochBody = epoch.body as { epochId: string; explanation: string; posture: { productionReady: false } };
    assert.ok(epochBody.epochId.length > 0);
    assert.match(epochBody.explanation, /time-weighted SunRey and MoonRey participation/);
    assert.equal(epochBody.posture.productionReady, false);

    const participation = await call(world, 'GET', '/api/v1/access/participation', 'basic_verified');
    assert.equal(participation.status, 200);
    const participationBody = participation.body as { humanScoreExposed: false; explanation: string };
    assert.equal(participationBody.humanScoreExposed, false);
    assert.match(participationBody.explanation, /capacity available this period/);
  });

  it('exposes allocation categories and preview without global distribution', async () => {
    const world = createSandboxWorld();
    const categories = await call(world, 'GET', '/api/v1/access/allocation/categories', 'basic_verified');
    assert.equal(categories.status, 200);
    const categoryBody = categories.body as readonly { category: string; capacityUnit: string }[];
    assert.ok(categoryBody.length >= 9);

    const preview = await call(world, 'POST', '/api/v1/access/allocation/preview', 'basic_verified', {
      categories: ['MOBILITY', 'ENERGY'],
    });
    assert.equal(preview.status, 200);
    const previewBody = preview.body as {
      simulationOnly: true;
      allocations: unknown[];
      categories: { category: string }[];
      explanation: string;
    };
    assert.equal(previewBody.simulationOnly, true);
    assert.ok(previewBody.categories.every((row) => ['MOBILITY', 'ENERGY'].includes(row.category)));
    assert.match(previewBody.explanation, /time-weighted SunRey and MoonRey participation/);
    assert.ok(!('globalDistribution' in previewBody));
  });
});
