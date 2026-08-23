import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/index.ts';
import { createPhaseHWorld, PHASE_H_TOKEN } from './phase-h-world.ts';

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
