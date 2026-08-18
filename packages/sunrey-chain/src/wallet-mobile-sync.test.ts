import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from './protocol/constants.ts';
import { runWalletCommand } from './wallet/cli.ts';
import {
  CanonicalChainSource,
  MobileSecureStorage,
  MobileWalletSyncEngine,
  ReferenceMobileClient,
  applyDeviceRiskSignal,
  createPaymentRequest,
  createSyncCursor,
  cursorBindsRequiredFields,
  encodePaymentRequest,
  encodeUniversalPaymentLink,
  evaluateClientCompatibility,
  exerciseMobileSyncChaos,
  exerciseMobileSyncNegatives,
  parsePaymentRequest,
  refuseAutoSign,
  signedPayloadComplete,
  transportIsAuthenticated,
  validateDeepLink,
} from './wallet/mobile-sync/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 97 mobile wallet synchronization', () => {
  it('keeps simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
  });

  it('opens a snapshot then incremental delta across devices', () => {
    const engine = new MobileWalletSyncEngine();
    engine.chain.setBalance('bca.alice', 'SUNREY_COIN', '42');
    const phone = new ReferenceMobileClient(engine, { deviceId: 'iphone', walletId: 'alice' });
    const tablet = new ReferenceMobileClient(engine, { deviceId: 'ipad', walletId: 'alice' });
    assert.equal(typeof phone.connect(), 'string');
    assert.equal(typeof tablet.connect(), 'string');
    const first = phone.sync();
    assert.equal('ok' in first, false);
    if ('ok' in first) {
      return;
    }
    assert.ok(first.snapshot);
    assert.equal(first.snapshot.projection.authoritative, false);
    assert.equal(first.snapshot.projection.nativeBalances[0]?.availableMinorUnits, '42');
    assert.equal(cursorBindsRequiredFields(first.cursor), true);
    engine.recordChainEvent('alice', 'NATIVE_BALANCE', { available: '43' });
    const delta = phone.sync();
    assert.equal('ok' in delta, false);
    if ('ok' in delta) {
      return;
    }
    assert.equal(delta.snapshot, null);
    assert.ok(delta.delta);
    assert.equal(delta.delta.gapDetected, false);
    const other = tablet.rebuild();
    assert.equal('ok' in other, false);
    if ('ok' in other) {
      return;
    }
    assert.ok(other.snapshot);
    assert.equal(other.snapshot.projection.deviceCacheAuthoritative, false);
  });

  it('tracks BFT finality and never presents mempool as finalized', () => {
    const engine = new MobileWalletSyncEngine();
    engine.createPending({
      walletId: 'alice',
      accountId: 'bca.alice',
      transactionId: 'tx.1',
      clientTxId: 'c.1',
      nonce: '1',
      feeAuthorizedMinorUnits: '2000',
      bodyHash: 'aa',
      state: 'MEMPOOL_ACCEPTED',
    });
    const mempool = engine.trackFinality('tx.1');
    assert.equal(mempool.finalized, false);
    assert.equal(mempool.displayState, 'PENDING');
    assert.equal(mempool.mempoolAcceptanceIsFinality, false);
    assert.equal(mempool.confirmationCountUi, false);
    assert.ok(engine.finality.refuseMempoolAsFinality('MEMPOOL_ACCEPTED'));
    engine.finalizePending('tx.1');
    const done = engine.trackFinality('tx.1');
    assert.equal(done.finalized, true);
    assert.equal(done.displayState, 'FINALIZED');
    assert.equal(done.source, 'CANONICAL_CHAIN');
  });

  it('constructs and revalidates offline drafts before submission', () => {
    const engine = new MobileWalletSyncEngine();
    const client = new ReferenceMobileClient(engine, { deviceId: 'pixel', walletId: 'alice' });
    client.connect();
    const draft = client.createOfflineDraft({
      accountId: 'bca.alice',
      nonce: '1',
      feeAuthorizedMinorUnits: '2000',
      canonicalTransactionBytesHex: 'cafebabe',
    });
    assert.equal(draft.authorization, false);
    const signed = client.signOffline(draft.draftId);
    assert.equal('ok' in signed, false);
    if ('ok' in signed) {
      return;
    }
    assert.equal(signedPayloadComplete(signed), true);
    const stale = client.submitDraft(draft, {
      accountActive: true,
      chainNonce: '2',
      requiredFeeMinorUnits: '5000',
      delegationValid: true,
      policyValid: true,
      networkId: engine.networkId,
      chainId: engine.chainId,
    });
    assert.equal('ok' in stale && stale.ok === false, true);
    const fresh = client.submitDraft(draft, {
      accountActive: true,
      chainNonce: '1',
      requiredFeeMinorUnits: '1000',
      delegationValid: true,
      policyValid: true,
      networkId: engine.networkId,
      chainId: engine.chainId,
    });
    assert.equal('ok' in fresh, false);
    if ('ok' in fresh) {
      return;
    }
    assert.equal(fresh.state === 'MEMPOOL_ACCEPTED' || fresh.state === 'SUBMITTED', true);
    assert.equal(fresh.uiFinalized, false);
  });

  it('fails over RPC endpoints and retries by canonical transaction id', () => {
    const source = new CanonicalChainSource({
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
    });
    source.markEndpoint('rpc-a', 'DOWN');
    const first = source.submit('tx.retry');
    assert.equal(first.state, 'ACCEPTED_FOR_MEMPOOL');
    assert.equal(first.finalized, false);
    const retry = source.submit('tx.retry');
    assert.equal(retry.state, 'ALREADY_KNOWN');
    source.markEndpoint('rpc-b', 'DOWN');
    source.markEndpoint('rpc-archive', 'DOWN');
    const down = source.submit('tx.other');
    assert.equal(down.state, 'TEMPORARILY_UNAVAILABLE');
  });

  it('delivers privacy-safe push through provider ports', () => {
    const engine = new MobileWalletSyncEngine();
    engine.registerDevice({ deviceId: 'iphone', walletId: 'alice', platform: 'IOS' });
    engine.push.subscribe({
      deviceId: 'iphone',
      walletId: 'alice',
      providerClass: 'APNS_COMPATIBLE',
      pushToken: 'token',
      categories: ['TRANSACTION_FINALIZED', 'SECURITY_EVENT'],
    });
    const event = engine.push.createEvent('SECURITY_EVENT', 'sec.1');
    assert.equal('ok' in event, false);
    if ('ok' in event) {
      return;
    }
    assert.equal(event.sensitiveDetailIncluded, false);
    assert.equal(event.privateKey, false);
    assert.equal(event.kycPayload, false);
    const deliveries = engine.push.publish('alice', event);
    assert.equal(deliveries[0]?.accepted, true);
    const again = engine.push.publish('alice', event);
    assert.equal(again[0]?.duplicate, true);
    assert.equal(engine.authorizeWithPushToken('token').code, 'PUSH_TOKEN_NOT_AUTHORIZATION');
  });

  it('rejects a wrong-network QR and refuses deep-link auto-sign', () => {
    const request = createPaymentRequest({
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
      recipient: 'srdev1bob',
      assetId: 'SUNREY_COIN',
      quantityMinorUnits: '100',
    });
    const qr = encodePaymentRequest(request);
    const parsed = parsePaymentRequest(qr, { networkId: PROTOCOL_NETWORK_ID, chainId: PROTOCOL_CHAIN_ID });
    assert.equal('ok' in parsed, false);
    const wrong = parsePaymentRequest(qr, { networkId: 'net_other', chainId: PROTOCOL_CHAIN_ID });
    assert.equal('ok' in wrong && wrong.ok === false && wrong.code === 'WRONG_NETWORK', true);
    const universal = encodeUniversalPaymentLink(request);
    assert.equal(universal.startsWith('https://wallet.sunrey.test/pay/1?'), true);
    const link = validateDeepLink(`sunrey://wallet/pay?n=${PROTOCOL_NETWORK_ID}&c=${PROTOCOL_CHAIN_ID}&r=srdev1bob&a=SUNREY_COIN`, {
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
    });
    assert.equal('ok' in link, false);
    if ('ok' in link) {
      return;
    }
    assert.equal(link.autoSign, false);
    assert.equal(refuseAutoSign().code, 'DEEP_LINK_CANNOT_AUTO_SIGN');
  });

  it('keeps secure storage and biometrics on device', () => {
    const storage = new MobileSecureStorage();
    storage.store('WALLET_KEY_HANDLE', 'alice.primary');
    const unlock = storage.unlockWithBiometrics('WALLET_KEY_HANDLE');
    assert.equal(unlock.biometricLeftDevice, false);
    assert.equal(storage.refusePlaintextExport().code, 'SELF_CUSTODY_KEY_UNAVAILABLE');
    assert.equal(transportIsAuthenticated().customProtocol, false);
    const engine = new MobileWalletSyncEngine();
    assert.equal(engine.assertNoMasterKey().code, 'SYNC_SERVER_HAS_NO_MASTER_KEY');
    engine.labelAddress('srdev1bob', 'Bob');
    assert.equal(engine.addressLabels.get('srdev1bob')?.blockchainAuthority, false);
  });

  it('consumes device trust and treats risk as one input', () => {
    const engine = new MobileWalletSyncEngine();
    const registration = engine.registerDevice({
      deviceId: 'watch',
      walletId: 'alice',
      platform: 'IOS',
    });
    const risky = applyDeviceRiskSignal(registration, 'ROOTED_OR_JAILBROKEN');
    assert.equal(risky.riskSignal, 'ROOTED_OR_JAILBROKEN');
    engine.revokeDevice('watch');
    const session = engine.openSession({ walletId: 'alice', deviceId: 'watch', clientVersion: '1.0.0' });
    assert.equal('ok' in session && session.ok === false, true);
  });

  it('requires an upgrade for protocol-critical old clients', () => {
    const denied = evaluateClientCompatibility('0.9.0');
    assert.equal(denied.allowed, false);
    assert.equal(denied.compatibility, 'UPGRADE_REQUIRED');
    const ok = evaluateClientCompatibility('1.0.0');
    assert.equal(ok.allowed, true);
    const cursor = createSyncCursor({
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
      walletId: 'alice',
      finalizedHeight: 40,
      projectionSequence: 3,
    });
    assert.equal(cursor.schemaVersion, 1);
  });

  it('exposes public network status from the Chunk 93 source', () => {
    const engine = new MobileWalletSyncEngine();
    const status = engine.chain.networkStatus();
    assert.equal(status.networkId, PROTOCOL_NETWORK_ID);
    assert.equal(status.chainId, PROTOCOL_CHAIN_ID);
    assert.equal(status.environment, 'simulation');
    assert.ok(status.finalizedHeight >= 0);
  });

  it('runs CLI sync, payment-request, offline-draft, and finality commands', () => {
    const sync = runWalletCommand(['sync', 'alice', 'cli-phone']);
    assert.equal(sync.ok, true);
    const status = runWalletCommand(['sync-status', 'alice', 'cli-phone']);
    assert.equal(status.ok, true);
    const rebuild = runWalletCommand(['sync-rebuild', 'alice', 'cli-phone']);
    assert.equal(rebuild.ok, true);
    const push = runWalletCommand(['push-test', 'alice', 'cli-phone']);
    assert.equal(push.ok, true);
    const pay = runWalletCommand(['payment-request', 'srdev1bob', 'SUNREY_COIN', '10']);
    assert.equal(pay.ok, true);
    const draft = runWalletCommand(['offline-draft', 'alice', 'cli-phone', '1', '2000']);
    assert.equal(draft.ok, true);
    const finality = runWalletCommand(['finality', 'tx.cli']);
    assert.equal(finality.ok, true);
  });

  it('exercises chaos and mandatory negatives', () => {
    const chaos = exerciseMobileSyncChaos(PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID);
    assert.equal(chaos.offlineDevice, true);
    assert.equal(chaos.reconnect, true);
    assert.equal(chaos.multipleDevices, true);
    assert.equal(chaos.rpcFailover, true);
    assert.equal(chaos.duplicatePushSafe, true);
    assert.equal(chaos.eventGap, true);
    assert.equal(chaos.staleDraft, true);
    assert.equal(chaos.revokedDevice, true);
    assert.equal(chaos.serverRestart, true);
    const negatives = exerciseMobileSyncNegatives(PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID);
    assert.equal(negatives.pushTokenCannotAuthorize, true);
    assert.equal(negatives.revokedDeviceCannotSync, true);
    assert.equal(negatives.eventGapDetected, true);
    assert.equal(negatives.wrongNetworkQrRejected, true);
    assert.equal(negatives.deepLinkCannotAutoSign, true);
    assert.equal(negatives.selfCustodyKeyUnavailable, true);
    assert.equal(negatives.mempoolNotFinalized, true);
    assert.equal(negatives.deviceCacheCannotOverride, true);
  });

  it('does not create a competing wallet package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/wallet/mobile-sync/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/mobile-wallet-sync')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-mobile-sync')), false);
    assert.equal(existsSync(join(ROOT, 'packages/wallet-sync')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-push')), false);
  });
});
