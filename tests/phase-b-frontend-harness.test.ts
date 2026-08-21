import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SunReyConsumerError,
  asConsumerPage,
  createMemoryTokenStore,
  createSunReyConsumerClient,
} from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { startConsumerPlatform } from '../services/consumer-platform/src/index.ts';

describe('Phase B frontend contract harness', () => {
  it('authenticates a sandbox persona and covers bootstrap, home, denial, expiry, pagination, and disabled features', async () => {
    const platform = await startConsumerPlatform({
      allowSandboxPersonas: true,
      integrationEnvironment: 'TEST',
    });
    const auth = createMemoryTokenStore();
    const client = createSunReyConsumerClient({
      baseUrl: platform.url,
      auth,
    });
    try {
      const health = await client.health();
      assert.equal(health.status, 'ok');

      const personas = await client.listSandboxPersonas();
      assert.ok(personas.items.some((row) => row.persona_id === 'alex-ready'));

      const alex = await client.loginSandboxPersona('alex-ready');
      auth.setAccessToken(alex.access_token);
      const bootstrap = await client.bootstrap();
      assert.equal(bootstrap.api_version, 'v1');
      assert.equal(bootstrap.production_active, false);
      const home = await client.home();
      assert.equal(home.environment_banner, 'SIMULATION');
      assert.ok(home.account_count >= 1);
      const accounts = await client.listAccounts();
      assert.ok(accounts.items.length >= 1);
      assert.match(accounts.items[0]?.balance.minor_units ?? '', /^-?\d+$/);

      auth.setAccessToken(undefined);
      const blair = await client.loginSandboxPersona('blair-restricted');
      auth.setAccessToken(blair.access_token);
      await assert.rejects(
        () => client.submitAction({ action_type: 'OPEN_ACCOUNT', idempotency_key: 'deny-1' }),
        (error: unknown) => error instanceof SunReyConsumerError && error.envelope?.error_code === 'CAPABILITY_DENIED',
      );

      const evan = await client.loginSandboxPersona('evan-paged');
      auth.setAccessToken(evan.access_token);
      const first = asConsumerPage(await client.listActivity({ page_size: 10 }));
      assert.equal(first.items.length, 10);
      assert.equal(first.hasMore, true);
      const second = await client.listActivity({ cursor: first.nextCursor ?? undefined, page_size: 10 });
      assert.ok(second.items.length > 0);

      await assert.rejects(
        () => client.getFeature('investments'),
        (error: unknown) => error instanceof SunReyConsumerError && error.envelope?.error_code === 'FEATURE_UNAVAILABLE',
      );

      await client.expireSandboxSession();
      await assert.rejects(
        () => client.home(),
        (error: unknown) => error instanceof SunReyConsumerError && error.envelope?.error_code === 'SESSION_EXPIRED',
      );
    } finally {
      await platform.close();
    }
  });
});
