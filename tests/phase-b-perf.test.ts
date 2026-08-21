import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryTokenStore, createSunReyConsumerClient } from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { startConsumerPlatform } from '../services/consumer-platform/src/index.ts';

async function time(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe('Phase B performance baseline', () => {
  it('records local read latency without inventing SLAs', async () => {
    const platform = await startConsumerPlatform({
      allowSandboxPersonas: true,
      integrationEnvironment: 'TEST',
    });
    const auth = createMemoryTokenStore();
    const client = createSunReyConsumerClient({ baseUrl: platform.url, auth });
    try {
      const session = await client.loginSandboxPersona('alex-ready');
      auth.setAccessToken(session.access_token);
      await client.health();
      await client.bootstrap();
      const samples = {
        health: await time(() => client.health()),
        bootstrap: await time(() => client.bootstrap()),
        home: await time(() => client.home()),
        accounts: await time(() => client.listAccounts()),
      };
      assert.ok(samples.health < 1000, `health ${samples.health}`);
      assert.ok(samples.bootstrap < 1000, `bootstrap ${samples.bootstrap}`);
      assert.ok(samples.home < 1000, `home ${samples.home}`);
      assert.ok(samples.accounts < 1000, `accounts ${samples.accounts}`);
    } finally {
      await platform.close();
    }
  });
});
