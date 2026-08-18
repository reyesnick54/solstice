/**
 * Mobile-friendly TypeScript interfaces for Chunk 97 wallet synchronization.
 */

import {
  MobileWalletSyncEngine,
  ReferenceMobileClient,
  createPaymentRequest,
  parsePaymentRequest,
  type OfflineDraftContext,
  type SunReyPaymentRequest,
  type WalletPendingTransaction,
  type WalletEventEnvelope,
} from '../../sunrey-chain/src/wallet/mobile-sync/index.ts';

export type MobileSyncClient = {
  readonly engine: MobileWalletSyncEngine;
  readonly client: ReferenceMobileClient;
  syncWallet: typeof syncWallet;
  subscribeWallet: typeof subscribeWallet;
  trackFinality: typeof trackFinality;
  createPaymentRequest: typeof createPaymentRequest;
  parsePaymentRequest: typeof parsePaymentRequest;
  getPendingTransactions: typeof getPendingTransactions;
  getSecurityEvents: typeof getSecurityEvents;
};

export function connectMobileWallet(input: {
  readonly walletId: string;
  readonly deviceId: string;
  readonly networkId?: string;
  readonly chainId?: string;
}): MobileSyncClient {
  const engine = new MobileWalletSyncEngine({
    networkId: input.networkId,
    chainId: input.chainId,
  });
  const client = new ReferenceMobileClient(engine, {
    walletId: input.walletId,
    deviceId: input.deviceId,
  });
  client.connect();
  return Object.freeze({
    engine,
    client,
    syncWallet,
    subscribeWallet,
    trackFinality,
    createPaymentRequest,
    parsePaymentRequest,
    getPendingTransactions,
    getSecurityEvents,
  });
}

export function syncWallet(client: ReferenceMobileClient) {
  return client.sync();
}

export function subscribeWallet(
  engine: MobileWalletSyncEngine,
  input: {
    readonly deviceId: string;
    readonly walletId: string;
    readonly pushToken: string;
  },
) {
  return engine.push.subscribe({
    deviceId: input.deviceId,
    walletId: input.walletId,
    providerClass: 'APNS_COMPATIBLE',
    pushToken: input.pushToken,
    categories: [
      'TRANSACTION_FINALIZED',
      'INCOMING_TRANSFER',
      'SECURITY_EVENT',
      'NEW_DEVICE',
      'EXCHANGE_ORDER_UPDATE',
      'AGENT_MANDATE_ACTION',
    ],
  });
}

export function trackFinality(engine: MobileWalletSyncEngine, transactionId: string) {
  return engine.trackFinality(transactionId);
}

export function getPendingTransactions(engine: MobileWalletSyncEngine, walletId: string): readonly WalletPendingTransaction[] {
  return engine.pending.list(walletId);
}

export function getSecurityEvents(engine: MobileWalletSyncEngine, walletId: string): readonly WalletEventEnvelope[] {
  return engine.events.stream(walletId, 0).events.filter((event) => event.kind === 'WALLET_SECURITY');
}

export function submitOfflineDraft(
  client: ReferenceMobileClient,
  draftId: string,
  context: OfflineDraftContext,
) {
  const draft = client.localDrafts.get(draftId);
  if (!draft) {
    return { ok: false as const, code: 'STALE_DRAFT' as const, message: 'draft not found' };
  }
  return client.submitDraft(draft, context);
}

export type { SunReyPaymentRequest };
export { createPaymentRequest, parsePaymentRequest };
