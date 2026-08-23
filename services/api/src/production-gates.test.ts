import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPlatformApi } from './app.ts';
import { CONSUMER_RESOURCE_CATALOG } from './consumer/resources.ts';

const silent = (): void => undefined;
const TOKEN = 'simulation-internal-operator-token';

async function request(
  url: string,
  init: { readonly headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: 'GET',
    ...(init.headers ? { headers: init.headers } : {}),
  });
  return { status: response.status, body: JSON.parse(await response.text()) };
}

describe('internal production-gate readiness API', () => {
  it('does not expose confidential gate status on public ready or consumer BFF', async () => {
    const api = await createPlatformApi({
      config: { port: 0 },
      internalOperatorToken: TOKEN,
      logSink: silent,
    });
    try {
      const ready = await request(`${api.url}/ready`);
      assert.equal(ready.status, 200);
      const readyBody = ready.body as Record<string, unknown>;
      assert.equal(readyBody.productionReady, false);
      assert.equal(readyBody.productionActive, false);
      assert.equal('registry' in readyBody, false);
      assert.equal('missingExternalGateIds' in readyBody, false);

      const consumer = await request(`${api.url}/api/v1/production-gates`);
      assert.equal(consumer.status, 404);
      assert.equal(
        CONSUMER_RESOURCE_CATALOG.some((row) => row.path.includes('production-gates')),
        false,
      );
    } finally {
      await api.close();
    }
  });

  it('fails closed without an internal operator token and role', async () => {
    const api = await createPlatformApi({
      config: { port: 0 },
      internalOperatorToken: TOKEN,
      logSink: silent,
    });
    try {
      const missing = await request(`${api.url}/internal/v1/production-gates`);
      assert.equal(missing.status, 403);
      const lovable = await request(`${api.url}/internal/v1/production-gates`, {
        headers: {
          'x-sunrey-client': 'lovable',
          'x-sunrey-operator-role': 'GOVERNANCE_ADMIN',
          'x-sunrey-internal-token': TOKEN,
        },
      });
      assert.equal(lovable.status, 403);
    } finally {
      await api.close();
    }
  });

  it('returns the machine-evaluated decision to an internal operator', async () => {
    const api = await createPlatformApi({
      config: { port: 0 },
      internalOperatorToken: TOKEN,
      logSink: silent,
    });
    try {
      const headers = {
        'x-sunrey-operator-role': 'GOVERNANCE_ADMIN',
        'x-sunrey-internal-token': TOKEN,
        'x-sunrey-client': 'ops',
      };
      const body = (await request(`${api.url}/internal/v1/production-gates`, { headers })).body as {
        releaseDecision: string;
        productionActive: boolean;
        backendSoftwareReady: boolean;
        externalGatesMissing: boolean;
        consumerSafe: boolean;
      };
      assert.equal(body.releaseDecision, 'BLOCKED');
      assert.equal(body.productionActive, false);
      assert.equal(body.backendSoftwareReady, true);
      assert.equal(body.externalGatesMissing, true);
      assert.equal(body.consumerSafe, false);
    } finally {
      await api.close();
    }
  });
});
