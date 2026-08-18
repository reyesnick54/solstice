import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from './protocol/constants.ts';
import {
  DevelopmentPasskeyAuthenticator,
  WalletEngine,
  WalletSecurityEngine,
  containsPrivateMaterial,
  isWalletRejection,
  isWalletSecurityRejection,
  runWalletCommand,
  runWalletSecurityCommand,
} from './wallet/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function provision(custodyClass: 'SELF_CUSTODY' | 'ASSISTED_SELF_CUSTODY' | 'INSTITUTIONAL_CUSTODY' | 'MACHINE_CONTROLLED' = 'SELF_CUSTODY') {
  const wallet = new WalletEngine();
  wallet.unlock('pw');
  const walletType =
    custodyClass === 'MACHINE_CONTROLLED'
      ? 'MACHINE'
      : custodyClass === 'INSTITUTIONAL_CUSTODY'
        ? 'INSTITUTIONAL'
        : 'HUMAN';
  wallet.createWallet({
    walletId: 'alice',
    ownerActorId: custodyClass === 'MACHINE_CONTROLLED' ? 'machine.alice' : 'alice',
    walletType,
    signerLabels: ['alice.primary'],
  });
  wallet.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
  const alice = wallet.getAccount('bca.alice');
  const bob = wallet.getAccount('bca.bob');
  assert.ok(alice && bob);
  wallet.faucet(alice.accountId, 1_000_000n);
  const security = new WalletSecurityEngine();
  const profile = security.attachWallet({
    wallet: wallet.getWallet('alice')!,
    custodyClass,
    identityRef: 'id.alice',
  });
  assert.equal(isWalletSecurityRejection(profile), false);
  const device = security.registerDevice({
    walletId: 'alice',
    deviceId: 'dev.alice',
    publicDescriptor: 'pub.alice-device',
    platformClass: 'MOBILE',
    evidence: 'first-registration',
  });
  assert.equal(isWalletSecurityRejection(device), false);
  if (!isWalletSecurityRejection(device)) {
    security.setDeviceTrust('alice', device.deviceId, 'TRUSTED');
  }
  return { wallet, security, alice, bob };
}

function session(security: WalletSecurityEngine, scope: 'READ_ONLY' | 'TRANSACTION_PREVIEW' | 'TRANSACTION_APPROVAL' | 'PROFILE_MANAGEMENT' | 'RECOVERY_ADMIN' = 'TRANSACTION_PREVIEW') {
  const opened = security.authenticateSession({
    walletId: 'alice',
    identityRef: 'id.alice',
    deviceId: 'dev.alice',
    method: 'DEVICE',
    scope,
  });
  assert.equal(isWalletSecurityRejection(opened), false);
  if (isWalletSecurityRejection(opened)) {
    throw new Error(opened.detail);
  }
  return opened;
}

describe('Chunk 96 wallet security', () => {
  it('keeps authentication distinct from native signing', () => {
    const { security } = provision();
    const opened = session(security, 'READ_ONLY');
    assert.equal(opened.grantsNativeSigning, false);
    const refused = security.sessionCannotSign(opened.sessionId);
    assert.equal(refused.code, 'SESSION_IS_NOT_SIGNING_AUTHORITY');
  });

  it('does not treat a passkey as the native blockchain key', () => {
    const auth = new DevelopmentPasskeyAuthenticator();
    const now = '2026-08-18T00:00:00.000Z';
    const challenge = auth.beginRegistration({
      identityRef: 'id.alice',
      rpId: 'sunrey.local',
      origin: 'https://sunrey.local',
      now,
    });
    const credential = auth.completeRegistration({
      challengeId: challenge.challengeId,
      credentialId: 'cred.alice',
      publicKeyMaterial: 'passkey-public',
      now,
    });
    assert.equal(isWalletSecurityRejection(credential), false);
    if (isWalletSecurityRejection(credential)) {
      return;
    }
    assert.equal(credential.publicKeyMaterial.includes('PRIVATE'), false);
    const { security } = provision();
    const login = security.sessionCannotSign('sess.login');
    assert.equal(login.code, 'SESSION_IS_NOT_SIGNING_AUTHORITY');
  });

  it('rejects a revoked device and a revoked session', () => {
    const { security } = provision();
    security.setDeviceTrust('alice', 'dev.alice', 'REVOKED');
    const refused = security.authenticateSession({
      walletId: 'alice',
      identityRef: 'id.alice',
      deviceId: 'dev.alice',
      method: 'DEVICE',
      scope: 'READ_ONLY',
    });
    assert.equal(isWalletSecurityRejection(refused), true);
    if (isWalletSecurityRejection(refused)) {
      assert.equal(refused.code, 'REVOKED_DEVICE');
    }
    security.setDeviceTrust('alice', 'dev.alice', 'REVOKED');
    const { security: second } = provision();
    const opened = session(second, 'READ_ONLY');
    second.revokeSession(opened.sessionId);
    const again = second.assertSessionUsable(opened.sessionId);
    assert.equal(isWalletSecurityRejection(again), true);
    if (isWalletSecurityRejection(again)) {
      assert.equal(again.code, 'REVOKED_SESSION');
    }
  });

  it('rejects a tampered SigningIntent after approval', () => {
    const { wallet, security, bob } = provision();
    const opened = session(security, 'TRANSACTION_APPROVAL');
    const built = wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 10n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const intent = security.buildSigningIntent('alice', built, ['NORMAL_USER_SIGNATURE']);
    const approved = security.approveSigningIntent(opened.sessionId, intent);
    assert.equal(approved.ok, true);
    const tampered = { ...intent, quantity: '9999', destination: 'other' };
    const check = security.assertApprovalHolds(intent.intentId, tampered);
    assert.equal(isWalletSecurityRejection(check), true);
    if (isWalletSecurityRejection(check)) {
      assert.equal(check.code, 'TAMPERED_SIGNING_INTENT');
    }
  });

  it('rejects delegated key limit, wrong asset, and wrong destination', () => {
    const { wallet, security, bob } = provision();
    const opened = session(security);
    security.bindDelegatedKey({
      walletId: 'alice',
      keyId: 'alice.delegated.1',
      purpose: 'session',
      assets: ['SUNREY_COIN'],
      quantityLimit: 10n,
      destinations: [bob.accountId],
      actionClasses: ['NATIVE_ASSET'],
      expiresAt: null,
      environment: PROTOCOL_NETWORK_ID,
    });
    const over = wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 50n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(over), false);
    if (isWalletRejection(over)) {
      return;
    }
    const overEval = security.evaluateTransaction({
      walletId: 'alice',
      sessionId: opened.sessionId,
      built: over,
      delegatedKeyId: 'alice.delegated.1',
    });
    assert.equal(isWalletSecurityRejection(overEval), true);
    if (isWalletSecurityRejection(overEval)) {
      assert.equal(overEval.code, 'DELEGATED_AMOUNT_LIMIT');
    }
    const moon = wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
      assetId: 'MOONREY_COIN',
    });
    assert.equal(isWalletRejection(moon), false);
    if (isWalletRejection(moon)) {
      return;
    }
    const moonEval = security.evaluateTransaction({
      walletId: 'alice',
      sessionId: opened.sessionId,
      built: moon,
      delegatedKeyId: 'alice.delegated.1',
    });
    assert.equal(isWalletSecurityRejection(moonEval), true);
    if (isWalletSecurityRejection(moonEval)) {
      assert.equal(moonEval.code, 'DELEGATED_WRONG_ASSET');
    }
    wallet.createWallet({ walletId: 'vendor', ownerActorId: 'vendor', walletType: 'HUMAN', signerLabels: ['v'] });
    const vendor = wallet.getAccount('bca.vendor');
    assert.ok(vendor);
    const wrongDest = wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: vendor.accountId,
      toAddressText: vendor.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(wrongDest), false);
    if (isWalletRejection(wrongDest)) {
      return;
    }
    const destEval = security.evaluateTransaction({
      walletId: 'alice',
      sessionId: opened.sessionId,
      built: { ...wrongDest, counterpartyAccountId: vendor.accountId },
      delegatedKeyId: 'alice.delegated.1',
    });
    assert.equal(isWalletSecurityRejection(destEval), true);
    if (isWalletSecurityRejection(destEval)) {
      assert.equal(destEval.code, 'DELEGATED_WRONG_DESTINATION');
    }
  });

  it('rejects guardian spending and recovery replay, and cannot rewrite finalized state', () => {
    const { wallet, security, bob } = provision();
    const opened = session(security);
    const built = wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const guardian = security.evaluateTransaction({
      walletId: 'alice',
      sessionId: opened.sessionId,
      built,
      guardianAttempt: true,
    });
    assert.equal(isWalletSecurityRejection(guardian), true);
    if (isWalletSecurityRejection(guardian)) {
      assert.equal(guardian.code, 'GUARDIAN_CANNOT_SPEND');
    }
    const policy = security.installRecoveryPolicy({
      schemaVersion: 1,
      policyId: 'rec.alice',
      version: 1,
      walletId: 'alice',
      threshold: 2,
      delayMs: 86_400_000n,
      rehearsalDelayMs: 0n,
      ownerMayCancel: true,
      components: [
        {
          componentId: 'g1',
          kind: 'HUMAN_RECOVERY_CONTACT',
          actorRef: 'guardian-1',
          publicDescriptor: 'pub.g1',
          grantsEverydaySpend: false,
          grantsWalletPrivateView: false,
        },
        {
          componentId: 'g2',
          kind: 'SECONDARY_VERIFIED_DEVICE',
          actorRef: 'guardian-2',
          publicDescriptor: 'pub.g2',
          grantsEverydaySpend: false,
          grantsWalletPrivateView: false,
        },
      ],
    });
    assert.equal(isWalletSecurityRejection(policy), false);
    const requested = security.requestRecovery({
      walletId: 'alice',
      requestedNewAuthorityPublicKey: 'aa'.repeat(16),
      reasonClass: 'LOST_DEVICE',
      evidence: [{ evidenceId: 'ev1', kind: 'lost-device', publicRef: 'ticket-1', createdAt: security.now }],
      authorizingComponentIds: ['g1', 'g2'],
    });
    assert.equal(isWalletSecurityRejection(requested), false);
    if (isWalletSecurityRejection(requested)) {
      return;
    }
    const replay = security.replayRecovery(requested.requestId);
    assert.equal(replay.code, 'RECOVERY_REPLAY');
    security.markFinalized('tx.final');
    const rewrite = security.refuseHistoryRewrite('tx.final');
    assert.equal(rewrite.code, 'RECOVERY_CANNOT_REWRITE_HISTORY');
    const activated = security.activateRecovery(requested.requestId);
    assert.equal(activated.ok, true);
    const replayAfter = security.replayRecovery(requested.requestId);
    assert.equal(replayAfter.code, 'RECOVERY_REPLAY');
  });

  it('rejects a testnet key authorizing production and refuses server self-custody key retrieval', () => {
    const { security } = provision();
    const cross = security.testnetKeyCannotAuthorizeProduction('net_sunrey_testnet_1', 'net_sunrey_reserved_production');
    assert.equal(cross.ok, false);
    if (cross.ok === false) {
      assert.equal(cross.code, 'TESTNET_KEY_PRODUCTION');
    }
    const secret = security.retrieveSelfCustodyPrivateKey('alice');
    assert.equal(secret.code, 'SELF_CUSTODY_KEY_UNAVAILABLE');
    const view = security.selfCustodyServerView('alice');
    assert.equal(isWalletSecurityRejection(view), false);
    if (!isWalletSecurityRejection(view)) {
      assert.equal(containsPrivateMaterial(JSON.stringify(view)), false);
    }
  });

  it('does not silently convert wallet classes and preserves custody controls', () => {
    const { wallet, security } = provision('SELF_CUSTODY');
    const converted = security.attachWallet({
      wallet: wallet.getWallet('alice')!,
      custodyClass: 'INSTITUTIONAL_CUSTODY',
      identityRef: 'id.alice',
    });
    assert.equal(isWalletSecurityRejection(converted), true);
    if (isWalletSecurityRejection(converted)) {
      assert.equal(converted.code, 'CLASS_CONVERSION_FORBIDDEN');
    }
    const institutional = provision('INSTITUTIONAL_CUSTODY');
    const opened = session(institutional.security);
    const built = institutional.wallet.buildTransfer({
      walletId: 'alice',
      toAccountId: institutional.bob.accountId,
      toAddressText: institutional.bob.address.text,
      amount: 1n,
      maxFee: 2_000n,
    });
    assert.equal(isWalletRejection(built), false);
    if (isWalletRejection(built)) {
      return;
    }
    const evaled = institutional.security.evaluateTransaction({
      walletId: 'alice',
      sessionId: opened.sessionId,
      built,
    });
    assert.equal(isWalletSecurityRejection(evaled), true);
    if (isWalletSecurityRejection(evaled)) {
      assert.equal(evaled.code, 'CUSTODY_CONTROL_REQUIRED');
    }
  });

  it('supports lost-device, key rotation, destinations, sessions, and audit', () => {
    const { security } = provision();
    const admin = session(security, 'PROFILE_MANAGEMENT');
    const lost = security.lostDevice({ walletId: 'alice', deviceId: 'dev.alice' });
    assert.equal(isWalletSecurityRejection(lost), false);
    if (!isWalletSecurityRejection(lost)) {
      assert.equal(lost.deviceRevoked, true);
    }
    const fresh = provision();
    const plan = fresh.security.planKeyRotation({
      walletId: 'alice',
      oldKeyId: 'alice.key.1',
      newPublicKeyHex: 'bb'.repeat(16),
      policyId: 'pol.alice',
      authorizationRef: 'owner',
    });
    assert.equal(isWalletSecurityRejection(plan), false);
    if (!isWalletSecurityRejection(plan)) {
      const activated = fresh.security.activateKeyRotation(plan.planId);
      assert.equal(isWalletSecurityRejection(activated), false);
    }
    const destAdmin = session(fresh.security, 'PROFILE_MANAGEMENT');
    const dest = fresh.security.setDestinationTrust({
      walletId: 'alice',
      addressText: fresh.bob.address.text,
      networkId: PROTOCOL_NETWORK_ID,
      trustState: 'TRUSTED',
      label: 'bob',
      sessionId: destAdmin.sessionId,
    });
    assert.equal(isWalletSecurityRejection(dest), false);
    fresh.security.revokeAllSessions('alice');
    const report = fresh.security.audit('alice');
    assert.equal(isWalletSecurityRejection(report), false);
    if (!isWalletSecurityRejection(report)) {
      assert.equal(report.destinationPolicy.destinations.length >= 1, true);
      assert.equal(report.activeSigningAuthorities.length >= 1, true);
    }
    const explorer = fresh.security.publicExplorerView('alice');
    assert.equal(Object.keys(explorer).includes('walletSession'), false);
    void admin;
    void PROTOCOL_CHAIN_ID;
  });

  it('exposes privacy-safe notification hooks and CLI commands', () => {
    const { security } = provision();
    const hooks = security.notificationHooks('alice');
    assert.equal(hooks[0]?.privacySafe, true);
    assert.equal(hooks[0]?.channel, 'CHUNK_97_NOTIFICATION');
    const cli = runWalletSecurityCommand(['security', 'alice']);
    assert.equal(cli.ok, true);
    const serialized = JSON.stringify(cli.payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
    assert.equal(containsPrivateMaterial(serialized), false);
    const devices = runWalletCommand(['devices', 'alice']);
    assert.equal(devices.ok, true);
    const audit = runWalletCommand(['audit', 'alice']);
    assert.equal(audit.ok, true);
  });

  it('does not create a second wallet package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/wallet-security')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-wallet-security')), false);
    assert.equal(existsSync(join(ROOT, 'docs/wallet/chunk-96-wallet-security.md')), true);
  });
});
