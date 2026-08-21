import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SunReyConsumerError,
  createMemoryTokenStore,
  createSunReyConsumerClient,
} from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { startConsumerPlatform } from '../services/consumer-platform/src/index.ts';

describe('Phase B end-to-end platform scenario', () => {
  it('runs server start through logout without live providers', async () => {
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
      assert.equal(health.production_active, false);

      const casey = await client.loginSandboxPersona('casey-capable');
      auth.setAccessToken(casey.access_token);
      assert.equal(casey.session.revocation_state, 'ACTIVE');

      const bootstrap = await client.bootstrap();
      assert.equal(bootstrap.me.actor_id, casey.session.actor_id);
      assert.ok(bootstrap.capabilities.some((row) => row.capability === 'ACCOUNT_OPEN_REQUEST'));

      const home = await client.home();
      assert.equal(typeof home.account_count, 'number');

      const accounts = await client.listAccounts();
      assert.equal(Array.isArray(accounts.items), true);

      auth.setAccessToken((await client.loginSandboxPersona('blair-restricted')).access_token);
      await assert.rejects(
        () => client.submitAction({ action_type: 'OPEN_ACCOUNT', idempotency_key: 'e2e-denied' }),
        (error: unknown) => error instanceof SunReyConsumerError && error.status === 403,
      );

      auth.setAccessToken(casey.access_token);
      const opened = await client.submitAction({
        action_type: 'OPEN_ACCOUNT',
        idempotency_key: 'e2e-open-1',
        account_id: 'acct_e2e_casey',
      });
      assert.equal(opened.state, 'ALLOW');
      assert.ok(opened.evidence_record_id);
      assert.equal(opened.account_id, 'acct_e2e_casey');

      const evidence = platform.runtime.evidence.list();
      assert.ok(evidence.some((row) => row.kind === 'KERNEL_DECISION' || row.kind === 'ACCOUNT_OPENED' || row.evidenceId === opened.evidence_record_id));
      const events = platform.runtime.events.list();
      assert.ok(events.some((row) => row.eventType === 'AccountOpened' || row.eventType === 'KernelDecisionRecorded'));

      const typed = await client.getAccount('acct_e2e_casey');
      assert.equal(typed.account_id, 'acct_e2e_casey');
      assert.match(typed.balance.minor_units, /^-?\d+$/);

      await client.logout();
      await assert.rejects(
        () => client.bootstrap(),
        (error: unknown) => error instanceof SunReyConsumerError && error.status === 401,
      );
    } finally {
      await platform.close();
    }
  });
});
