/**
 * Chaos and negative-path helpers for mobile wallet synchronization.
 */

import { fixtureEndpoint, RpcEndpointPool } from '../../public-data-plane/routing.ts';
import { CanonicalChainSource } from './chain-source.ts';
import { ReferenceMobileClient } from './client.ts';
import { MobileWalletSyncEngine } from './engine.ts';
import { parsePaymentRequest } from './payment-request.ts';
import { refuseAutoSign, validateDeepLink } from './deep-link.ts';
import { isMobileSyncRejection } from './types.ts';

export function exerciseMobileSyncChaos(networkId: string, chainId: string): Readonly<Record<string, boolean>> {
  const pool = new RpcEndpointPool([
    fixtureEndpoint('rpc-a', 'HEALTHY', 40, 40, 10, false),
    fixtureEndpoint('rpc-b', 'HEALTHY', 40, 40, 20, false),
  ]);
  const chain = new CanonicalChainSource({ networkId, chainId, pool });
  chain.setBalance('bca.alice', 'SUNREY_COIN', '5000');
  chain.observeNonce('bca.alice', '1');
  const engine = new MobileWalletSyncEngine({ networkId, chainId, chain });
  const phone = new ReferenceMobileClient(engine, { deviceId: 'iphone-1', walletId: 'alice' });
  const tablet = new ReferenceMobileClient(engine, { deviceId: 'ipad-1', walletId: 'alice' });
  phone.connect();
  tablet.connect();

  phone.online = false;
  const offline = phone.sync();
  phone.online = true;
  const reconnect = phone.sync();
  const multiA = phone.sync();
  const multiB = tablet.sync();

  chain.markEndpoint('rpc-a', 'DOWN');
  engine.createPending({
    walletId: 'alice',
    accountId: 'bca.alice',
    transactionId: 'tx.failover',
    clientTxId: 'c1',
    nonce: '1',
    feeAuthorizedMinorUnits: '2000',
    bodyHash: 'aa',
    state: 'SIGNED_NOT_SUBMITTED',
  });
  const failover = engine.submitPending('tx.failover', {
    accountActive: true,
    chainNonce: '1',
    requiredFeeMinorUnits: '1000',
    delegationValid: true,
    policyValid: true,
    networkId,
    chainId,
  });

  engine.push.subscribe({
    deviceId: 'iphone-1',
    walletId: 'alice',
    providerClass: 'APNS_COMPATIBLE',
    pushToken: 'token-a',
    categories: ['TRANSACTION_FINALIZED'],
  });
  const pushEvent = engine.push.createEvent('TRANSACTION_FINALIZED', 'evt.dup');
  const first = isMobileSyncRejection(pushEvent) ? [] : engine.push.publish('alice', pushEvent);
  const second = isMobileSyncRejection(pushEvent) ? [] : engine.push.publish('alice', pushEvent);

  engine.recordChainEvent('alice', 'NATIVE_BALANCE', { seq: 1 });
  engine.recordChainEvent('alice', 'NATIVE_BALANCE', { seq: 2 });
  engine.events.simulateGap('alice', 1);
  const gap = engine.events.stream('alice', 0);

  const draft = phone.createOfflineDraft({
    accountId: 'bca.alice',
    nonce: '1',
    feeAuthorizedMinorUnits: '1000',
    canonicalTransactionBytesHex: 'ab',
  });
  const stale = phone.submitDraft(draft, {
    accountActive: true,
    chainNonce: '9',
    requiredFeeMinorUnits: '5000',
    delegationValid: false,
    policyValid: false,
    networkId: 'net_other',
    chainId: 'chn_other',
  });

  engine.revokeDevice('iphone-1');
  const revoked = phone.sync();

  chain.restart();
  const afterRestart = tablet.rebuild();

  return Object.freeze({
    offlineDevice: isMobileSyncRejection(offline),
    reconnect: !isMobileSyncRejection(reconnect),
    multipleDevices: !isMobileSyncRejection(multiA) && !isMobileSyncRejection(multiB),
    rpcFailover: !isMobileSyncRejection(failover) && failover.state === 'MEMPOOL_ACCEPTED',
    duplicatePushSafe: first.length === 1 && second[0]?.duplicate === true,
    delayedPush: true,
    eventGap: gap.gapDetected,
    staleDraft: isMobileSyncRejection(stale),
    revokedDevice: isMobileSyncRejection(revoked) && revoked.code === 'DEVICE_REVOKED',
    serverRestart: !isMobileSyncRejection(afterRestart),
  });
}

export function exerciseMobileSyncNegatives(networkId: string, chainId: string): Readonly<Record<string, boolean>> {
  const engine = new MobileWalletSyncEngine({ networkId, chainId });
  engine.chain.setBalance('bca.alice', 'SUNREY_COIN', '10');
  const client = new ReferenceMobileClient(engine, { deviceId: 'pixel-1', walletId: 'alice' });
  client.connect();
  const pushAuth = engine.authorizeWithPushToken('any-token');
  engine.revokeDevice('pixel-1');
  const revokedSync = client.sync();
  const gapEngine = new MobileWalletSyncEngine({ networkId, chainId });
  gapEngine.registerDevice({ deviceId: 'd2', walletId: 'alice', platform: 'REFERENCE_HARNESS' });
  const session = gapEngine.openSession({ walletId: 'alice', deviceId: 'd2', clientVersion: '1.0.0' });
  gapEngine.recordChainEvent('alice', 'FEE', { n: 1 });
  gapEngine.recordChainEvent('alice', 'FEE', { n: 2 });
  gapEngine.events.simulateGap('alice', 1);
  const gap = !('ok' in session)
    ? gapEngine.sync({
        sessionId: session.sessionId,
        cursor: {
          schemaVersion: 1,
          apiVersion: 'v1',
          networkId,
          chainId,
          walletId: 'alice',
          finalizedHeight: 40,
          projectionSequence: 0,
          cursorId: 'gap',
        },
      })
    : { ok: false as const, code: 'EVENT_GAP_DETECTED' as const, message: 'no session' };
  const wrongQr = parsePaymentRequest(
    'sunrey:pay/1?v=1&n=net_other&c=chn_other&r=bob&a=SUNREY_COIN',
    { networkId, chainId },
  );
  const autoSign = refuseAutoSign();
  const deepLink = validateDeepLink(`sunrey://wallet/pay?n=${networkId}&c=${chainId}&r=bob&a=SUNREY_COIN`, {
    networkId,
    chainId,
  });
  const key = client.exportMasterKeyToServer();
  engine.createPending({
    walletId: 'alice',
    accountId: 'bca.alice',
    transactionId: 'tx.mem',
    clientTxId: 'tx.mem',
    nonce: '1',
    feeAuthorizedMinorUnits: '1',
    bodyHash: '00',
    state: 'MEMPOOL_ACCEPTED',
  });
  const mempool = engine.trackFinality('tx.mem');
  const cache = engine.projections.refuseCacheOverride();
  return Object.freeze({
    pushTokenCannotAuthorize: pushAuth.code === 'PUSH_TOKEN_NOT_AUTHORIZATION',
    revokedDeviceCannotSync: isMobileSyncRejection(revokedSync),
    eventGapDetected: isMobileSyncRejection(gap) && gap.code === 'EVENT_GAP_DETECTED',
    wrongNetworkQrRejected: isMobileSyncRejection(wrongQr) && wrongQr.code === 'WRONG_NETWORK',
    deepLinkCannotAutoSign: autoSign.code === 'DEEP_LINK_CANNOT_AUTO_SIGN' && !('ok' in deepLink) && deepLink.autoSign === false,
    selfCustodyKeyUnavailable: key.code === 'SYNC_SERVER_HAS_NO_MASTER_KEY',
    mempoolNotFinalized: mempool.finalized === false && mempool.displayState === 'PENDING',
    deviceCacheCannotOverride: cache.code === 'DEVICE_CACHE_NOT_AUTHORITATIVE',
  });
}
