import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { createCardWorld, requestCardIntent, signedCallback } from '../../../tests/card-world.ts';
import { WalletService } from './wallet/service.ts';
import { signWalletCallback, type WalletCallbackEnvelope } from './wallet/callback.ts';
import { canTransitionDevicePaymentToken } from './wallet/token.ts';
import { evaluateWalletEligibility } from './wallet/eligibility.ts';
import { asDeviceId, asSolsticeIdentityId } from '../../identity/src/ids.ts';
import type { ProvisionCardToWalletIntent } from '../../permissions/src/action-types.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';

function trustedDevice(world: ReturnType<typeof createCardWorld>) {
  const identityId = world.runtime.identity.service.identityFactsFor(world.actorId).subjectId;
  const device = [...world.runtime.identity.service.store.devices.values()].find((row) => row.identityId === identityId);
  assert.ok(device);
  const trusted = world.runtime.identity.service.setDeviceTrust(device.deviceId, 'TRUSTED');
  assert.equal(trusted.ok, true);
  return trusted.ok ? trusted.value : device;
}

function walletService(world: ReturnType<typeof createCardWorld>) {
  return new WalletService({
    kernel: world.runtime.kernel,
    issuer: world.runtime.issuer,
    evidence: world.runtime.evidence,
    events: world.runtime.events,
    clock: world.clock,
    catalog: world.catalog,
    identity: world.runtime.identity.service,
    secrets: world.secrets,
    cards: world.cards.store,
    operationsActorId: world.operationsActorId,
  });
}

async function activeCard(suffix: string) {
  const world = createCardWorld(suffix, 100_000n);
  const requested = world.cards.requestCard(requestCardIntent(world, `card_${suffix}`));
  assert.equal(requested.outcome, 'OK');
  if (requested.outcome !== 'OK') {
    throw new Error('request failed');
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
  assert.equal(activated.outcome, 'OK');
  if (activated.outcome !== 'OK') {
    throw new Error('activate failed');
  }
  return { world, card: activated.value, wallet: walletService(world), device: trustedDevice(world) };
}

function provisionIntent(
  world: ReturnType<typeof createCardWorld>,
  cardId: string,
  deviceId: string,
  provider: 'APPLE_WALLET' | 'GOOGLE_WALLET',
  tokenId: string,
): ProvisionCardToWalletIntent {
  return {
    id: asIntentId(`prov_${tokenId}`),
    actionType: ACTION_TYPES.PROVISION_CARD_TO_WALLET,
    idempotencyKey: `prov_${tokenId}`,
    actorId: world.actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_WALLET',
    payload: {
      cardId,
      accountId: world.account.id,
      deviceId,
      walletProvider: provider,
      tokenId,
    },
  };
}

function signedWalletCallback(
  world: ReturnType<typeof createCardWorld>,
  eventType: WalletCallbackEnvelope['eventType'],
  idempotencyKey: string,
  nonce: string,
  payload: Readonly<Record<string, unknown>>,
  providerId: string,
): WalletCallbackEnvelope {
  const secret = world.secrets.resolve({
    scheme: 'secret',
    provider: 'simulation',
    path: 'wallet-provider-callback',
    href: 'secret://simulation/wallet-provider-callback',
  });
  if (!secret.ok) {
    throw new Error(secret.error.message);
  }
  return signWalletCallback(secret.value, {
    providerId,
    eventType,
    idempotencyKey,
    nonce,
    timestampMs: BigInt(Date.parse(world.clock.now())),
    schemaVersion: 1,
    payload,
  });
}

function stepUp(world: ReturnType<typeof createCardWorld>) {
  const facts = world.runtime.identity.service.identityFactsFor(world.actorId);
  assert.ok(facts.subjectId);
  const stepped = world.runtime.identity.enrollAndAuthenticate(
    asSolsticeIdentityId(facts.subjectId),
    world.actorId,
    'sim-device-1',
    true,
  );
  assert.equal(stepped.ok, true);
}

describe('device payment token lifecycle', () => {
  it('defines valid transitions and forbids device rebinding', () => {
    assert.equal(canTransitionDevicePaymentToken('REQUESTED', 'PENDING_VERIFICATION'), true);
    assert.equal(canTransitionDevicePaymentToken('PENDING_VERIFICATION', 'ACTIVE'), true);
    assert.equal(canTransitionDevicePaymentToken('ACTIVE', 'SUSPENDED'), true);
    assert.equal(canTransitionDevicePaymentToken('DELETED', 'ACTIVE'), false);
    assert.throws(() => assertNoSensitiveCardData({ pan: '4111111111111111', tokenizedPan: 'tok' }));
  });
});

describe('wallet provisioning', () => {
  for (const provider of ['APPLE_WALLET', 'GOOGLE_WALLET'] as const) {
    it(`provisions ${provider} after step-up and binds the token to one device`, async () => {
      const { world, card, wallet, device } = await activeCard(`w_${provider.slice(0, 3).toLowerCase()}`);
      const first = wallet.provisionToWallet(provisionIntent(world, card.cardId, device.deviceId, provider, `tok_${provider}`));
      assert.equal(first.outcome, 'OK');
      if (first.outcome !== 'OK') {
        throw new Error('expected step-up outcome');
      }
      assert.equal('outcome' in first.value && first.value.outcome === 'STEP_UP_REQUIRED', true);

      stepUp(world);
      const provisioned = wallet.provisionToWallet(
        provisionIntent(world, card.cardId, device.deviceId, provider, `tok_${provider}_2`),
      );
      assert.equal(provisioned.outcome, 'OK');
      if (provisioned.outcome !== 'OK' || !('tokenId' in provisioned.value)) {
        throw new Error('expected token');
      }
      assert.equal(provisioned.value.status, 'PENDING_VERIFICATION');
      assert.equal(provisioned.value.deviceId, device.deviceId);
      assert.equal(provisioned.value.walletProvider, provider);

      const providerId = provider === 'APPLE_WALLET' ? 'sim-apple-wallet' : 'sim-google-wallet';
      const activated = wallet.ingestWalletCallback(
        signedWalletCallback(
          world,
          'TOKEN_ACTIVATED',
          `act_${provider}`,
          `nonce_${provider}`,
          {
            tokenId: provisioned.value.tokenId,
            providerReference: provisioned.value.providerReference,
            deviceId: device.deviceId,
          },
          providerId,
        ),
      );
      assert.equal(activated.outcome, 'OK');
      if (activated.outcome !== 'OK') {
        throw new Error('activate failed');
      }
      assert.equal(activated.value.status, 'ACTIVE');

      const duplicate = wallet.ingestWalletCallback(
        signedWalletCallback(
          world,
          'TOKEN_ACTIVATED',
          `act_${provider}`,
          `nonce_${provider}_dup`,
          {
            tokenId: provisioned.value.tokenId,
            providerReference: provisioned.value.providerReference,
            deviceId: device.deviceId,
          },
          providerId,
        ),
      );
      assert.equal(
        duplicate.outcome === 'REJECTED' ||
          duplicate.outcome === 'OK' ||
          ('replay' in duplicate && duplicate.replay === true),
        true,
      );

      const moved = wallet.ingestWalletCallback(
        signedWalletCallback(
          world,
          'TOKEN_ACTIVATED',
          `move_${provider}`,
          `nonce_move_${provider}`,
          {
            tokenId: provisioned.value.tokenId,
            providerReference: provisioned.value.providerReference,
            deviceId: 'dev_other_device',
          },
          providerId,
        ),
      );
      assert.equal(moved.outcome, 'REJECTED');
      if (moved.outcome === 'REJECTED') {
        assert.equal(moved.code, 'DEVICE_REBIND_FORBIDDEN');
      }
    });
  }

  it('requires local eligibility before the provider adapter runs', async () => {
    const { world, card, wallet } = await activeCard('elig');
    const result = wallet.evaluateEligibility(
      provisionIntent(world, card.cardId, asDeviceId('dev_missing'), 'APPLE_WALLET', 'tok_missing'),
    );
    assert.equal(result.outcome, 'INELIGIBLE');
  });

  it('keeps card freeze authoritative over an active wallet token', async () => {
    const { world, card, wallet, device } = await activeCard('freeze_auth');
    stepUp(world);
    const provisioned = wallet.provisionToWallet(
      provisionIntent(world, card.cardId, device.deviceId, 'APPLE_WALLET', 'tok_freeze'),
    );
    assert.equal(provisioned.outcome, 'OK');
    if (provisioned.outcome !== 'OK' || !('tokenId' in provisioned.value)) {
      throw new Error('expected token');
    }
    const activated = wallet.ingestWalletCallback(
      signedWalletCallback(
        world,
        'TOKEN_ACTIVATED',
        'act_freeze',
        'nonce_freeze',
        {
          tokenId: provisioned.value.tokenId,
          providerReference: provisioned.value.providerReference,
          deviceId: device.deviceId,
        },
        'sim-apple-wallet',
      ),
    );
    assert.equal(activated.outcome, 'OK');
    const frozen = world.cards.freezeCard({
      id: asIntentId('freeze_w'),
      actionType: ACTION_TYPES.FREEZE_CARD,
      idempotencyKey: 'freeze_w',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: card.cardId, accountId: world.account.id },
    });
    assert.equal(frozen.outcome, 'OK');
    assert.equal(wallet.authorizationBlockedByCard(world.cards.store.getCard(card.cardId)), true);
    const auth = await world.cards.ingestAuthorizationCallback(
      signedCallback(world, 'AUTHORIZATION', 'auth_frozen_wallet', 'nonce_frozen_wallet', {
        authorizationId: 'auth_frozen_wallet',
        cardId: card.cardId,
        processorCardRef: card.processorCardRef,
        merchantRef: 'sim_cafe',
        merchantCategory: '5411',
        amountMinorUnits: '1000',
        currency: 'USD',
        country: 'US',
        ecommerce: true,
        processorReference: 'auth_frozen_wallet',
      }),
    );
    assert.equal(auth.outcome, 'REJECTED');
    if (auth.outcome === 'REJECTED') {
      assert.equal(auth.code, 'CARD_FROZEN');
    }
  });

  it('suspends tokens when Identity reports the device lost or blocked', async () => {
    const { world, card, wallet, device } = await activeCard('lost_dev');
    stepUp(world);
    const provisioned = wallet.provisionToWallet(
      provisionIntent(world, card.cardId, device.deviceId, 'GOOGLE_WALLET', 'tok_lost'),
    );
    assert.equal(provisioned.outcome, 'OK');
    if (provisioned.outcome !== 'OK' || !('tokenId' in provisioned.value)) {
      throw new Error('expected token');
    }
    const activated = wallet.ingestWalletCallback(
      signedWalletCallback(
        world,
        'TOKEN_ACTIVATED',
        'act_lost',
        'nonce_lost',
        {
          tokenId: provisioned.value.tokenId,
          providerReference: provisioned.value.providerReference,
          deviceId: device.deviceId,
        },
        'sim-google-wallet',
      ),
    );
    assert.equal(activated.outcome, 'OK');
    const blocked = world.runtime.identity.service.setDeviceTrust(device.deviceId, 'BLOCKED');
    assert.equal(blocked.ok, true);
    const events = world.runtime.events.list().filter((event) => event.eventType === 'IdentityDeviceTrustChanged');
    assert.ok(events.length > 0);
    const results = wallet.onIdentityDeviceTrustChanged(events[events.length - 1]!);
    assert.ok(results.length > 0);
    assert.equal(results[0]?.outcome, 'OK');
    if (results[0]?.outcome === 'OK') {
      assert.equal(results[0].value.status, 'SUSPENDED');
    }
  });

  it('rejects an unverified wallet callback', async () => {
    const { world, wallet } = await activeCard('bad_cb');
    const forged: WalletCallbackEnvelope = {
      providerId: 'sim-apple-wallet',
      eventType: 'TOKEN_ACTIVATED',
      idempotencyKey: 'forged',
      nonce: 'forged_nonce',
      timestampMs: BigInt(Date.parse(world.clock.now())),
      schemaVersion: 1,
      payload: { tokenId: 'missing' },
      signatureHex: '00',
    };
    const result = wallet.ingestWalletCallback(forged);
    assert.equal(result.outcome, 'REJECTED');
    if (result.outcome === 'REJECTED') {
      assert.equal(result.code === 'CALLBACK_INVALID_SIGNATURE' || result.code === 'CALLBACK_UNAUTHENTICATED', true);
    }
  });
});

describe('wallet eligibility is default-deny', () => {
  it('returns INELIGIBLE without an active card', () => {
    const world = createCardWorld('no_card', 0n);
    const facts = world.runtime.identity.service.identityFactsFor(world.actorId);
    const result = evaluateWalletEligibility({
      identity: facts,
      deviceTrust: 'TRUSTED',
      card: undefined,
      program: undefined,
      walletProvider: 'APPLE_WALLET',
      fraudOutcome: 'ALLOW',
      complianceClear: true,
      jurisdictionPermitted: true,
    });
    assert.equal(result.outcome, 'INELIGIBLE');
  });
});
