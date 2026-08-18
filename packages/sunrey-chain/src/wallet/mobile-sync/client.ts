/**
 * Minimal reference mobile client harness.
 *
 * Does not require app-store deployment. Holds local signing handles
 * only. The sync server never receives master private keys.
 */

import { bodyHashOf, MobileWalletSyncEngine } from './engine.ts';
import { OfflineDraftBook, signedPayloadComplete, type OfflineDraftContext } from './offline.ts';
import { MobileSecureStorage } from './secure-storage.ts';
import type {
  MobileSyncRejection,
  OfflineSignedPayload,
  OfflineTransactionDraft,
  WalletStateProjection,
  WalletSyncCursor,
} from './types.ts';

export class ReferenceMobileClient {
  readonly deviceId: string;
  readonly walletId: string;
  readonly storage = new MobileSecureStorage();
  readonly localDrafts = new OfflineDraftBook();
  localProjection: WalletStateProjection | null = null;
  cursor: WalletSyncCursor | null = null;
  online = true;
  private sessionId: string | null = null;

  readonly engine: MobileWalletSyncEngine;

  constructor(
    engine: MobileWalletSyncEngine,
    input: { readonly deviceId: string; readonly walletId: string },
  ) {
    this.engine = engine;
    this.deviceId = input.deviceId;
    this.walletId = input.walletId;
    this.storage.store('WALLET_KEY_HANDLE', `${input.walletId}.primary`);
    this.storage.store('DEVICE_REGISTRATION_CREDENTIAL', input.deviceId);
  }

  connect(clientVersion = '1.0.0'): string | MobileSyncRejection {
    this.engine.registerDevice({
      deviceId: this.deviceId,
      walletId: this.walletId,
      platform: 'REFERENCE_HARNESS',
    });
    const session = this.engine.openSession({
      walletId: this.walletId,
      deviceId: this.deviceId,
      clientVersion,
    });
    if ('ok' in session) {
      return session;
    }
    this.sessionId = session.sessionId;
    return session.sessionId;
  }

  sync(): ReturnType<MobileWalletSyncEngine['sync']> {
    if (!this.sessionId) {
      return this.engine.openSession({ walletId: this.walletId, deviceId: this.deviceId, clientVersion: '1.0.0' }) as never;
    }
    if (!this.online) {
      return { ok: false, code: 'DEVICE_UNTRUSTED', message: 'client is offline' };
    }
    const result = this.engine.sync({ sessionId: this.sessionId, cursor: this.cursor ?? undefined });
    if ('ok' in result) {
      return result;
    }
    if (result.snapshot) {
      this.localProjection = result.snapshot.projection;
    }
    this.cursor = result.cursor;
    return result;
  }

  rebuild(): ReturnType<MobileWalletSyncEngine['rebuild']> {
    this.localProjection = null;
    this.cursor = null;
    if (!this.sessionId) {
      return { ok: false, code: 'DEVICE_NOT_REGISTERED', message: 'no session' };
    }
    const result = this.engine.rebuild(this.sessionId);
    if (!('ok' in result)) {
      this.localProjection = result.snapshot?.projection ?? this.localProjection;
      this.cursor = result.cursor;
    }
    return result;
  }

  createOfflineDraft(input: {
    readonly accountId: string;
    readonly nonce: string;
    readonly feeAuthorizedMinorUnits: string;
    readonly canonicalTransactionBytesHex: string;
  }): OfflineTransactionDraft {
    return this.localDrafts.create({
      walletId: this.walletId,
      accountId: input.accountId,
      networkId: this.engine.networkId,
      chainId: this.engine.chainId,
      nonce: input.nonce,
      feeAuthorizedMinorUnits: input.feeAuthorizedMinorUnits,
      canonicalTransactionBytesHex: input.canonicalTransactionBytesHex,
      nowUtc: this.engine.nowUtc(),
      expiresAtUtc: '2026-08-18T01:00:00.000Z',
    });
  }

  signOffline(draftId: string): OfflineSignedPayload | MobileSyncRejection {
    this.storage.unlockWithBiometrics('WALLET_KEY_HANDLE');
    return this.localDrafts.signOffline({
      draftId,
      signatureHex: `sig.${draftId}`,
    });
  }

  submitDraft(draft: OfflineTransactionDraft, context: OfflineDraftContext) {
    const check = this.localDrafts.revalidate(draft, context, this.engine.nowUtc());
    if (check.stale) {
      return { ok: false as const, code: 'STALE_DRAFT' as const, message: check.reasons.join(', ') };
    }
    const pending = this.engine.createPending({
      walletId: this.walletId,
      accountId: draft.accountId,
      transactionId: `tx.${draft.draftId}`,
      clientTxId: draft.draftId,
      nonce: draft.nonce,
      feeAuthorizedMinorUnits: draft.feeAuthorizedMinorUnits,
      bodyHash: bodyHashOf(draft.canonicalTransactionBytesHex),
      state: 'SIGNED_NOT_SUBMITTED',
    });
    return this.engine.submitPending(pending.transactionId, context);
  }

  exportMasterKeyToServer(): MobileSyncRejection {
    return this.engine.assertNoMasterKey();
  }

  signedPayloadReady(payload: OfflineSignedPayload): boolean {
    return signedPayloadComplete(payload);
  }
}
