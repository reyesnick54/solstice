import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { startConsumerBff } from './consumer/http.ts';

describe('Consumer BFF HTTP adapter', () => {
  it('serves authenticated Home with no-store cache headers', async () => {
    const world = createSandboxWorld();
    const server = await startConsumerBff({
      runtime: {
        bff: world.bff,
        sessions: world.sessions,
        identity: world.runtime.identity.service,
        payments: world.payments,
      },
    });
    try {
      const res = await fetch(`${server.url}/api/v1/me/home`, {
        headers: { authorization: `Bearer ${sandboxToken('basic_verified')}` },
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(res.headers.get('x-sunrey-surface'), 'CONSUMER_BFF');
      const body = (await res.json()) as { schema: string };
      assert.equal(body.schema, 'sunrey.consumer.home.v1');
    } finally {
      await server.close();
    }
  });
});
