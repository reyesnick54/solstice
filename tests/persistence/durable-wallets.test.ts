import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureDurableSandboxCoreState } from '../../services/api/src/consumer/durable-account-state.ts';
import { DurableWalletSurface } from '../../services/api/src/consumer/durable-wallets.ts';
import type { BffPrincipal } from '../../services/api/src/consumer/ports.ts';
import {
  createDurableRuntime,
  persistenceAvailable,
  preparePersistence,
} from './helpers.ts';

const principal: BffPrincipal = Object.freeze({
  actorId: 'actor_sandbox_grow',
  customerId: 'cust_sandbox_grow',
  identityId: 'idn_sandbox_grow',
  sessionId: 'test-session-wallet',
  jurisdiction: 'GB',
  verification: 'VERIFIED',
  customerStatus: 'ACTIVE',
  identityStatus: 'ACTIVE',
  capabilities: Object.freeze(['VIEW_ACCOUNT', 'SUNREY_COIN_VIEW', 'EXCHANGE_VIEW']),
  risk: 'LOW',
  restricted: false,
  sandboxPersona: 'grow',
  deviceSummary: Object.freeze({ deviceId: null, trustState: 'KNOWN' }),
});

test(
  'durable SunRey native wallet survives restart and idempotent replay creates no duplicate',
  { skip: !persistenceAvailable() },
  async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);
    await ensureDurableSandboxCoreState(durable);

    let surface = await DurableWalletSurface.create(durable);
    assert.equal(surface.bindingReport.hydratedWallets, 0);
    assert.equal(surface.bindingReport.productionMoneyMovement, false);
    assert.equal(surface.bindingReport.productionSigningAuthorized, false);
    assert.equal(surface.bindingReport.mainnetActive, false);

    const first = await surface.createWallet(principal, {
      assetId: 'SUNREY_COIN',
      idempotencyKey: 'idem_persistence_wallet_1',
    });
    assert.equal(first.outcome, 'OK');
    if (first.outcome !== 'OK') throw new Error('wallet did not provision');
    assert.equal(first.replay, false);
    assert.equal(first.value.ownerId, principal.customerId);
    assert.equal(first.value.assetId, 'SUNREY_COIN');
    assert.equal(first.value.networkId, 'SUNREY_CHAIN');
    assert.equal(first.value.custodyModel, 'SUNREY_NATIVE');
    assert.equal(first.value.productionMoneyMovement, false);
    assert.equal(first.value.productionSigningAuthorized, false);

    const addressBeforeRestart = surface.product.depositAddress(
      principal.customerId,
      first.value.walletId,
    );
    assert.equal(addressBeforeRestart.ok, true);
    if (!addressBeforeRestart.ok) throw new Error('wallet deposit address missing');
    assert.match(addressBeforeRestart.value.address, /^sr1/);

    durable = await durable.restart();
    surface = await DurableWalletSurface.create(durable);
    assert.equal(surface.bindingReport.hydratedWallets, 1);

    const persisted = surface.product.getWallet(principal.customerId, first.value.walletId);
    assert.equal(persisted.ok, true);
    if (!persisted.ok) throw new Error('wallet did not hydrate after restart');
    assert.equal(persisted.value.walletId, first.value.walletId);
    assert.equal(persisted.value.assetId, 'SUNREY_COIN');

    const addressAfterRestart = surface.product.depositAddress(
      principal.customerId,
      first.value.walletId,
    );
    assert.equal(addressAfterRestart.ok, true);
    if (!addressAfterRestart.ok) throw new Error('wallet address did not hydrate after restart');
    assert.equal(addressAfterRestart.value.address, addressBeforeRestart.value.address);

    const replay = await surface.createWallet(principal, {
      assetId: 'SUNREY_COIN',
      idempotencyKey: 'idem_persistence_wallet_1',
    });
    assert.equal(replay.outcome, 'OK');
    if (replay.outcome !== 'OK') throw new Error('wallet replay was rejected');
    assert.equal(replay.replay, true);
    assert.equal(replay.value.walletId, first.value.walletId);

    const listed = surface.product.listWallets(principal.customerId);
    assert.equal(listed.filter((wallet) => wallet.assetId === 'SUNREY_COIN').length, 1);

    await durable.close();
  },
);
