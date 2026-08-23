import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/index.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { startConsumerBff } from '../services/api/src/consumer/http.ts';
import type { ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';
import { createPhaseHWorld, PHASE_H_TOKEN } from './phase-h-world.ts';

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
      assert.ok(Array.isArray((records as unknown as { items: unknown[] }).items));
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

describe('Phase H SDK-only E2E', () => {
  it('completes Vault/HIN/economy flows through the public Consumer BFF client', async () => {
    const world = createPhaseHWorld();
    const server = await world.startHttp();
    const client = createSunReyConsumerBffClient({
      baseUrl: server.url,
      getAccessToken: () => PHASE_H_TOKEN,
    });
    try {
      const home = await client.getDataVault();
      assert.equal(home.schema, 'sunrey.consumer.vault.home.v1');
      await client.getDataCategories();
      await client.createVaultRecord({ key: 'preferred_currency', value: 'USD', idempotencyKey: 'sdk_pref' });
      const payroll = await client.ingestVaultRecord({ kind: 'PAYROLL', idempotencyKey: 'sdk_pay' });
      assert.ok(payroll.recordId);
      await client.participateHin();
      const contribution = await client.createContribution({ seed: 'sdk-hin' });
      assert.equal((contribution as { mintRefused: boolean }).mintRefused, true);
      const license = await client.requestLicense();
      const licenseId = String((license as { licenseId: string }).licenseId);
      await client.approveLicense(licenseId);
      const paid = await client.payLicense(licenseId);
      assert.equal((paid as { marketplaceCannotMint: boolean }).marketplaceCannotMint, true);
      await client.revokeLicense(licenseId);
      await client.observeProductive('energy');
      const sunrey = await client.getSunreyEconomy();
      assert.equal(sunrey.hinValueSeparatedFromMarketPrice, true);
      const moonrey = await client.getMoonreyEconomy();
      assert.equal(moonrey.productiveDataCannotMint, true);
      const stop = await client.requestHinStop();
      assert.equal(stop.revoked, false);
      const confirmed = await client.confirmHinStop();
      assert.equal(confirmed.confirmed, true);
    } finally {
      await server.close();
    }
  });
});
