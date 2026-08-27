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

  it('adapts ProductGrowthService to the Lovable Grow lifecycle for the multi-currency preview persona', async () => {
    const server = await startSunReyPreview({ host: '127.0.0.1', port: 0 });
    const authorization = `Bearer ${sandboxToken('multi_currency')}`;
    try {
      const before = await fetch(`${server.url}/api/v1/grow/plan`, { headers: { authorization } });
      assert.equal(before.status, 200);
      const beforeBody = (await before.json()) as { exists: boolean; state: string };
      assert.equal(beforeBody.exists, false);
      assert.equal(beforeBody.state, 'NOT_REQUESTED');

      const requested = await fetch(`${server.url}/api/v1/grow/plan/request`, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(requested.status, 200);
      const requestedBody = (await requested.json()) as {
        exists: boolean;
        planId: string;
        productionMoneyMovement: boolean;
        guaranteedOutcome: boolean;
      };
      assert.equal(requestedBody.exists, true);
      assert.ok(requestedBody.planId.startsWith('gmp_'));
      assert.equal(requestedBody.productionMoneyMovement, false);
      assert.equal(requestedBody.guaranteedOutcome, false);

      const after = await fetch(`${server.url}/api/v1/grow/plan`, { headers: { authorization } });
      assert.equal(after.status, 200);
      const afterBody = (await after.json()) as { exists: boolean; planId: string };
      assert.equal(afterBody.exists, true);
      assert.equal(afterBody.planId, requestedBody.planId);

      const snapshot = await fetch(`${server.url}/api/v1/grow/snapshot`, { headers: { authorization } });
      assert.equal(snapshot.status, 200);
      const snapshotBody = (await snapshot.json()) as {
        ledgerWins: boolean;
        liquidAssetsByCurrency: { currency: string; minorUnits: string }[];
      };
      assert.equal(snapshotBody.ledgerWins, true);
      assert.ok(snapshotBody.liquidAssetsByCurrency.some((row) => row.currency === 'USD' && row.minorUnits === '200000'));
    } finally {
      await server.close();
    }
  });
});
