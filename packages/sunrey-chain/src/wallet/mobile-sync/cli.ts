/**
 * sunrey-wallet sync / push / payment-request / offline-draft / finality commands.
 */

import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../../protocol/constants.ts';
import { ReferenceMobileClient } from './client.ts';
import { evaluateClientCompatibility, minimumVersionMetadata } from './compatibility.ts';
import { MobileWalletSyncEngine } from './engine.ts';
import { createPaymentRequest, encodePaymentRequest, encodeUniversalPaymentLink, parsePaymentRequest } from './payment-request.ts';
import { isMobileSyncRejection } from './types.ts';

export type MobileCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const engines = new Map<string, { engine: MobileWalletSyncEngine; client: ReferenceMobileClient }>();

function harness(walletId = 'alice', deviceId = 'iphone-1'): { engine: MobileWalletSyncEngine; client: ReferenceMobileClient } {
  const key = `${walletId}:${deviceId}`;
  const existing = engines.get(key);
  if (existing) {
    return existing;
  }
  const engine = new MobileWalletSyncEngine();
  engine.chain.setBalance(`bca.${walletId}`, 'SUNREY_COIN', '1000000');
  engine.chain.observeNonce(`bca.${walletId}`, '1');
  const client = new ReferenceMobileClient(engine, { walletId, deviceId });
  const connected = client.connect();
  if (isMobileSyncRejection(connected)) {
    throw new Error(connected.message);
  }
  const created = { engine, client };
  engines.set(key, created);
  return created;
}

export function mobileWalletUsage(): string {
  return [
    'sunrey-wallet sync [walletId] [deviceId]',
    'sunrey-wallet sync-status [walletId] [deviceId]',
    'sunrey-wallet sync-rebuild [walletId] [deviceId]',
    'sunrey-wallet push-test [walletId] [deviceId] [category]',
    'sunrey-wallet payment-request [recipient] [asset] [quantity]',
    'sunrey-wallet offline-draft [walletId] [nonce] [fee]',
    'sunrey-wallet finality [txId]',
  ].join('\n');
}

export function runMobileWalletCommand(args: readonly string[]): MobileCliResult {
  const command = args[0] ?? '';
  switch (command) {
    case 'sync': {
      const { client, engine } = harness(args[1] ?? 'alice', args[2] ?? 'iphone-1');
      const result = client.sync();
      if (isMobileSyncRejection(result)) {
        return { ok: false, command, payload: result };
      }
      return {
        ok: true,
        command,
        payload: {
          snapshot: Boolean(result.snapshot),
          cursor: result.cursor,
          height: engine.chain.finalizedHeight(),
          authoritativeProjection: false,
        },
      };
    }
    case 'sync-status': {
      const { client, engine } = harness(args[1] ?? 'alice', args[2] ?? 'iphone-1');
      client.sync();
      return {
        ok: true,
        command,
        payload: {
          health: engine.health(client.cursor ? `sess.${args[2] ?? 'iphone-1'}.${args[1] ?? 'alice'}` : `sess.iphone-1.alice`),
          network: engine.chain.networkStatus(),
          compatibility: minimumVersionMetadata(),
        },
      };
    }
    case 'sync-rebuild': {
      const { client } = harness(args[1] ?? 'alice', args[2] ?? 'iphone-1');
      const result = client.rebuild();
      return { ok: !isMobileSyncRejection(result), command, payload: result };
    }
    case 'push-test': {
      const { engine } = harness(args[1] ?? 'alice', args[2] ?? 'iphone-1');
      engine.push.subscribe({
        deviceId: args[2] ?? 'iphone-1',
        walletId: args[1] ?? 'alice',
        providerClass: 'APNS_COMPATIBLE',
        pushToken: 'token-not-authorization',
        categories: ['TRANSACTION_FINALIZED', 'SECURITY_EVENT'],
      });
      const event = engine.push.createEvent(
        (args[3] as 'TRANSACTION_FINALIZED') ?? 'TRANSACTION_FINALIZED',
        'evt.test',
      );
      if (isMobileSyncRejection(event)) {
        return { ok: false, command, payload: event };
      }
      const deliveries = engine.push.publish(args[1] ?? 'alice', event);
      return {
        ok: true,
        command,
        payload: {
          event,
          deliveries,
          pushTokenIsAuthorization: false,
          sensitiveDetailIncluded: event.sensitiveDetailIncluded,
        },
      };
    }
    case 'payment-request': {
      const request = createPaymentRequest({
        networkId: PROTOCOL_NETWORK_ID,
        chainId: PROTOCOL_CHAIN_ID,
        recipient: args[1] ?? 'srdev1alice',
        assetId: args[2] ?? 'SUNREY_COIN',
        quantityMinorUnits: args[3],
      });
      const encoded = encodePaymentRequest(request);
      const parsed = parsePaymentRequest(encoded, { networkId: PROTOCOL_NETWORK_ID, chainId: PROTOCOL_CHAIN_ID });
      return {
        ok: true,
        command,
        payload: {
          request,
          qr: encoded,
          universal: encodeUniversalPaymentLink(request),
          parsed,
          previewOnly: true,
        },
      };
    }
    case 'offline-draft': {
      const { client } = harness(args[1] ?? 'alice', args[2] ?? 'iphone-1');
      const draft = client.createOfflineDraft({
        accountId: `bca.${args[1] ?? 'alice'}`,
        nonce: args[3] ?? '1',
        feeAuthorizedMinorUnits: args[4] ?? '2000',
        canonicalTransactionBytesHex: 'cafebabe',
      });
      const signed = client.signOffline(draft.draftId);
      return {
        ok: true,
        command,
        payload: {
          draft,
          signed,
          authorization: false,
          compatibility: evaluateClientCompatibility('1.0.0'),
        },
      };
    }
    case 'finality': {
      const { engine } = harness();
      const txId = args[1] ?? 'tx.demo';
      engine.createPending({
        walletId: 'alice',
        accountId: 'bca.alice',
        transactionId: txId,
        clientTxId: txId,
        nonce: '1',
        feeAuthorizedMinorUnits: '2000',
        bodyHash: '00',
        state: 'MEMPOOL_ACCEPTED',
      });
      const mempool = engine.trackFinality(txId);
      engine.finalizePending(txId);
      const finalized = engine.trackFinality(txId);
      return {
        ok: true,
        command,
        payload: {
          mempool: { ...mempool, mempoolAcceptanceIsFinality: false },
          finalized,
          confirmationCountUi: false,
        },
      };
    }
    default:
      return { ok: false, command, payload: { error: 'unknown mobile sync command', usage: mobileWalletUsage() } };
  }
}
