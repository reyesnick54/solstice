import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/index.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { startConsumerBff } from '../services/api/src/consumer/http.ts';
import type { ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';

describe('Phase H SDK-only Vault / HIN / productive-data E2E', () => {
  it('reads vault, consent, HIN rights, and productive input without issuance', async () => {
    const world = createSandboxWorld();
    const runtime: ConsumerBffRuntime = {
      bff: world.bff,
      sessions: world.sessions,
      identity: world.runtime.identity.service,
      vault: world.vault,
      hin: world.hin,
      hinContributions: world.hinContributions,
      productiveEconomy: world.productiveEconomy,
    };
    const server = await startConsumerBff({ runtime });
    const vaultClient = createSunReyConsumerBffClient({
      baseUrl: server.url,
      getAccessToken: () => sandboxToken('vault_financial'),
    });
    const hinClient = createSunReyConsumerBffClient({
      baseUrl: server.url,
      getAccessToken: () => sandboxToken('basic_verified'),
    });
    try {
      const home = await vaultClient.getVaultHome();
      assert.equal(home.schema, 'sunrey.consumer.vault.home.v1');
      assert.equal(home.productionActive, false);
      assert.equal(home.sunreyOwnsUserData, false);
      const records = await vaultClient.listVaultRecords();
      assert.ok(Array.isArray((records as { items: unknown[] }).items));
      const rights = await hinClient.listHinRights();
      assert.equal((rights as { productionActivated?: boolean }).productionActivated ?? false, false);
      const licenses = await hinClient.listHinLicenses();
      assert.ok(licenses);
      const participation = await hinClient.getHinParticipation();
      assert.ok(participation);
      const productive = await hinClient.getProductiveEconomy();
      assert.ok(productive);
      const input = await hinClient.getMoonReyEconomicInput();
      assert.equal((input as { issuanceEndpoint?: boolean }).issuanceEndpoint ?? false, false);
    } finally {
      await server.close();
    }
  });
});
