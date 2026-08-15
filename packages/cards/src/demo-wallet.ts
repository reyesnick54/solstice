import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { createCardWorld, requestCardIntent, signedCallback } from '../../../tests/card-world.ts';
import { seedSimulationCatalog } from '../../../services/accounts/src/catalog.ts';
import { WalletService } from './wallet/service.ts';
import { signWalletCallback } from './wallet/callback.ts';
import type { WalletProvider } from './wallet/token.ts';

function walletFor(world: ReturnType<typeof createCardWorld>) {
  const seeded = seedSimulationCatalog();
  return new WalletService({
    kernel: world.runtime.kernel,
    issuer: world.runtime.issuer,
    evidence: world.runtime.evidence,
    events: world.runtime.events,
    clock: world.clock,
    catalog: {
      customers: world.runtime.customers,
      accounts: world.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    identity: world.runtime.identity.service,
    secrets: world.secrets,
    cards: world.cards.store,
    operationsActorId: world.operationsActorId,
  });
}

async function runProvider(provider: WalletProvider): Promise<void> {
  const suffix = provider === 'APPLE_WALLET' ? 'apple' : 'google';
  const world = createCardWorld(`demo_${suffix}`, 100_000n);
  const wallet = walletFor(world);

  console.log(`\n=== ${provider} wallet demo ===`);
  console.log('1. Customer authenticates.');
  const session = world.runtime.identity.service.resolveActorContext(world.actorId);
  if (!session.ok) {
    throw new Error('authenticate failed');
  }
  console.log(`   actor=${session.value.actorId} assurance=${world.runtime.identity.service.identityFactsFor(world.actorId).authenticationAssurance}`);

  console.log('2. Active simulated card exists.');
  const requested = world.cards.requestCard(requestCardIntent(world, `card_${suffix}`));
  if (requested.outcome !== 'OK') {
    throw new Error('request card failed');
  }
  const activated = world.cards.activateCard({
    id: asIntentId(`act_${suffix}`),
    actionType: ACTION_TYPES.ACTIVATE_CARD,
    idempotencyKey: `act_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CARD',
    payload: { cardId: requested.value.cardId, accountId: world.account.id },
  });
  if (activated.outcome !== 'OK') {
    throw new Error('activate card failed');
  }
  const card = activated.value;
  console.log(`   card=${card.cardId} status=${card.status}`);

  console.log('3. Trusted device exists.');
  const identityId = world.runtime.identity.service.identityFactsFor(world.actorId).subjectId;
  const device = [...world.runtime.identity.service.store.devices.values()].find((row) => row.identityId === identityId);
  if (!device) {
    throw new Error('device missing');
  }
  const trusted = world.runtime.identity.service.setDeviceTrust(device.deviceId, 'TRUSTED');
  if (!trusted.ok) {
    throw new Error('trust failed');
  }
  console.log(`   device=${device.deviceId} trust=${trusted.value.trustState}`);

  console.log('4. Wallet provisioning requested.');
  const first = wallet.provisionToWallet({
    id: asIntentId(`prov1_${suffix}`),
    actionType: ACTION_TYPES.PROVISION_CARD_TO_WALLET,
    idempotencyKey: `prov1_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_WALLET',
    payload: {
      cardId: card.cardId,
      accountId: world.account.id,
      deviceId: device.deviceId,
      walletProvider: provider,
      tokenId: `dpt_${suffix}_1`,
    },
  });
  if (first.outcome !== 'OK' || !('outcome' in first.value) || first.value.outcome !== 'STEP_UP_REQUIRED') {
    throw new Error('expected STEP_UP_REQUIRED on first request');
  }
  console.log('5. Step-up occurs if required.');
  console.log(`   eligibility=${first.value.outcome}`);

  const subject = world.runtime.identity.service.identityFactsFor(world.actorId).subjectId;
  if (!subject) {
    throw new Error('missing subject');
  }
  const stepped = world.runtime.identity.enrollAndAuthenticate(subject, world.actorId, 'sim-device-1', true);
  if (!stepped.ok) {
    throw new Error('step-up failed');
  }
  console.log(`   renewedAssurance=${world.runtime.identity.service.identityFactsFor(world.actorId).authenticationAssurance}`);

  console.log('6. Kernel authorizes.');
  const provisioned = wallet.provisionToWallet({
    id: asIntentId(`prov2_${suffix}`),
    actionType: ACTION_TYPES.PROVISION_CARD_TO_WALLET,
    idempotencyKey: `prov2_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_WALLET',
    payload: {
      cardId: card.cardId,
      accountId: world.account.id,
      deviceId: device.deviceId,
      walletProvider: provider,
      tokenId: `dpt_${suffix}_2`,
    },
  });
  if (provisioned.outcome !== 'OK' || !('tokenId' in provisioned.value)) {
    throw new Error(`provision failed: ${provisioned.outcome}`);
  }
  console.log(`   kernel=${provisioned.decision.status} token=${provisioned.value.tokenId} status=${provisioned.value.status}`);

  console.log('7. Simulated network-token provisioning occurs.');
  console.log(`   providerRef=${provisioned.value.providerReference} network=${provisioned.value.networkTokenReference}`);

  console.log('8. Token activates.');
  const providerId = provider === 'APPLE_WALLET' ? 'sim-apple-wallet' : 'sim-google-wallet';
  const secret = world.secrets.resolve({
    scheme: 'secret',
    provider: 'simulation',
    path: 'wallet-provider-callback',
    href: 'secret://simulation/wallet-provider-callback',
  });
  if (!secret.ok) {
    throw new Error(secret.error.message);
  }
  const activatedToken = wallet.ingestWalletCallback(
    signWalletCallback(secret.value, {
      providerId,
      eventType: 'TOKEN_ACTIVATED',
      idempotencyKey: `tok_act_${suffix}`,
      nonce: `tok_nonce_${suffix}`,
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: {
        tokenId: provisioned.value.tokenId,
        providerReference: provisioned.value.providerReference,
        deviceId: device.deviceId,
      },
    }),
  );
  if (activatedToken.outcome !== 'OK') {
    throw new Error('token activate failed');
  }
  console.log(`   status=${activatedToken.value.status}`);

  console.log('9. Token binds to device.');
  if (activatedToken.value.deviceId !== device.deviceId) {
    throw new Error('token not bound to device');
  }
  console.log(`   boundDevice=${activatedToken.value.deviceId}`);

  console.log('10. Duplicate callback no-ops.');
  const duplicate = wallet.ingestWalletCallback(
    signWalletCallback(secret.value, {
      providerId,
      eventType: 'TOKEN_ACTIVATED',
      idempotencyKey: `tok_act_${suffix}`,
      nonce: `tok_nonce_${suffix}_dup`,
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: {
        tokenId: provisioned.value.tokenId,
        providerReference: provisioned.value.providerReference,
        deviceId: device.deviceId,
      },
    }),
  );
  if (duplicate.outcome !== 'OK' || duplicate.replay !== true) {
    throw new Error('duplicate callback was not a no-op');
  }
  console.log(`    replay=${duplicate.replay}`);

  console.log('11. Card freeze blocks authorization.');
  const frozen = world.cards.freezeCard({
    id: asIntentId(`freeze_${suffix}`),
    actionType: ACTION_TYPES.FREEZE_CARD,
    idempotencyKey: `freeze_${suffix}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CARD',
    payload: { cardId: card.cardId, accountId: world.account.id },
  });
  if (frozen.outcome !== 'OK') {
    throw new Error('freeze failed');
  }
  const auth = await world.cards.ingestAuthorizationCallback(
    signedCallback(world, 'AUTHORIZATION', `auth_${suffix}`, `auth_nonce_${suffix}`, {
      authorizationId: `auth_${suffix}`,
      cardId: card.cardId,
      processorCardRef: card.processorCardRef,
      merchantRef: 'sim_cafe',
      merchantCategory: '5411',
      amountMinorUnits: '1000',
      currency: 'USD',
      country: 'US',
      ecommerce: true,
      processorReference: `auth_${suffix}`,
    }),
  );
  if (auth.outcome !== 'OK' || auth.value.decision !== 'DECLINE' || auth.value.reasonCode !== 'CARD_FROZEN') {
    throw new Error('frozen card did not block authorization');
  }
  console.log(`    decision=${auth.value.decision} reason=${auth.value.reasonCode}`);

  console.log('12. Device loss suspends token.');
  world.runtime.identity.service.setDeviceTrust(device.deviceId, 'BLOCKED');
  const trustEvents = world.runtime.events.list().filter((event) => event.eventType === 'IdentityDeviceTrustChanged');
  const suspended = wallet.onIdentityDeviceTrustChanged(trustEvents[trustEvents.length - 1]!);
  if (suspended[0]?.outcome !== 'OK' || suspended[0].value.status !== 'SUSPENDED') {
    throw new Error('lost device did not suspend token');
  }
  console.log(`    token=${suspended[0].value.status}`);

  console.log('13. Evidence verifies.');
  const evidence = world.runtime.evidence.verifyChain();
  if (!evidence.ok) {
    throw new Error('evidence chain failed');
  }
  console.log(`    evidenceOk=${evidence.ok} records=${world.runtime.evidence.list().length}`);
}

async function main(): Promise<void> {
  await runProvider('APPLE_WALLET');
  await runProvider('GOOGLE_WALLET');
  console.log('\nWALLET DEMO COMPLETE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
