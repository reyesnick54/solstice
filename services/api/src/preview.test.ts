import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sandboxToken } from './consumer/index.ts';
import { startSunReyPreview } from './preview.ts';

describe('SunRey deployable preview', () => {
  it('serves health and authenticated Consumer BFF Home from one runtime', async () => {
    const server = await startSunReyPreview({ host: '127.0.0.1', port: 0 });
    try {
      const health = await fetch(`${server.url}/health`);
      assert.equal(health.status, 200);
      const healthBody = (await health.json()) as { productionActive: boolean; liveConnectivityEnabled: boolean };
      assert.equal(healthBody.productionActive, false);
      assert.equal(healthBody.liveConnectivityEnabled, false);

      const home = await fetch(`${server.url}/api/v1/me/home`, {
        headers: { authorization: `Bearer ${sandboxToken('basic_verified')}` },
      });
      assert.equal(home.status, 200);
      assert.equal(home.headers.get('x-sunrey-surface'), 'CONSUMER_BFF');
      const body = (await home.json()) as { schema: string };
      assert.equal(body.schema, 'sunrey.consumer.home.v1');
    } finally {
      await server.close();
    }
  });

  it('allows configured frontend CORS and rejects unknown origins', async () => {
    const server = await startSunReyPreview({
      host: '127.0.0.1',
      port: 0,
      allowedOrigins: ['https://preview.sunrey.xyz'],
      allowLocalOrigins: false,
    });
    try {
      const allowed = await fetch(`${server.url}/health`, {
        headers: { origin: 'https://preview.sunrey.xyz' },
      });
      assert.equal(allowed.status, 200);
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://preview.sunrey.xyz');

      const forbidden = await fetch(`${server.url}/health`, {
        headers: { origin: 'https://evil.example' },
      });
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
    } finally {
      await server.close();
    }
  });

  it('does not expose sandbox persona discovery unless explicitly enabled', async () => {
    const hidden = await startSunReyPreview({ host: '127.0.0.1', port: 0 });
    try {
      const res = await fetch(`${hidden.url}/api/v1/sandbox/personas`);
      assert.equal(res.status, 404);
    } finally {
      await hidden.close();
    }

    const visible = await startSunReyPreview({
      host: '127.0.0.1',
      port: 0,
      allowSandboxPersonas: true,
    });
    try {
      const res = await fetch(`${visible.url}/api/v1/sandbox/personas`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { production: boolean; items: { id: string; token: string }[] };
      assert.equal(body.production, false);
      assert.ok(body.items.some((row) => row.id === 'basic_verified' && row.token === 'sandbox.basic_verified'));
    } finally {
      await visible.close();
    }
  });
});
