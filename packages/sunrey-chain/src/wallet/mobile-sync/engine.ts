/**
 * Mobile wallet synchronization engine.
 *
 * Coordinates sessions, snapshots, deltas, multi-device consistency,
 * pending transactions, offline drafts, push, and device trust.
 * Sync servers never hold self-custody master keys. Projections are
 * rebuildable from Chunk 93 canonical APIs.
 */

import { createHash } from 'node:crypto';

import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../../protocol/constants.ts';
import { evaluateClientCompatibility } from './compatibility.ts';
import { CanonicalChainSource } from './chain-source.ts';
import { createSyncCursor } from './cursor.ts';
import { bindChunk96DeviceTrust, refusePushTokenAuthorization, type WalletDeviceTrustPort } from './devices.ts';
import { WalletEventLog } from './events.ts';
import { WalletFinalityTracker } from './finality.ts';
import { OfflineDraftBook, type OfflineDraftContext } from './offline.ts';
import { PendingTransactionBook } from './pending.ts';
import { WalletProjectionStore } from './projection.ts';
import { MobilePushRouter } from './push.ts';
import {
  MOBILE_SYNC_API_VERSION,
  MOBILE_SYNC_SCHEMA_VERSION,
  MOBILE_SYNC_TOOL_VERSION,
  reject,
  type FiatBalanceProjection,
  type MobileDeviceRegistration,
  type MobileSyncHealth,
  type MobileSyncRejection,
  type NativeBalanceProjection,
  type PendingTransactionState,
  type PushEventCategory,
  type WalletEventStream,
  type WalletPendingTransaction,
  type WalletSyncCursor,
  type WalletSyncReport,
  type WalletSyncSession,
  type WalletSyncSnapshot,
} from './types.ts';

export type SyncResult = {
  readonly session: WalletSyncSession;
  readonly snapshot: WalletSyncSnapshot | null;
  readonly delta: WalletEventStream | null;
  readonly cursor: WalletSyncCursor;
  readonly health: MobileSyncHealth;
};

export class MobileWalletSyncEngine {
  readonly networkId: string;
  readonly chainId: string;
  readonly chain: CanonicalChainSource;
  readonly devices: WalletDeviceTrustPort;
  readonly events = new WalletEventLog();
  readonly projections = new WalletProjectionStore();
  readonly pending = new PendingTransactionBook();
  readonly drafts = new OfflineDraftBook();
  readonly finality = new WalletFinalityTracker();
  readonly push = new MobilePushRouter();
  readonly addressLabels = new Map<string, { addressText: string; label: string; blockchainAuthority: false }>();
  readonly masterKeysOnServer = false;
  private readonly sessions = new Map<string, WalletSyncSession>();
  private readonly lastSync = new Map<string, string>();
  private sequence = 0;

  constructor(input: {
    readonly networkId?: string;
    readonly chainId?: string;
    readonly chain?: CanonicalChainSource;
    readonly devices?: WalletDeviceTrustPort;
  } = {}) {
    this.networkId = input.networkId ?? PROTOCOL_NETWORK_ID;
    this.chainId = input.chainId ?? PROTOCOL_CHAIN_ID;
    this.chain = input.chain ?? new CanonicalChainSource({ networkId: this.networkId, chainId: this.chainId });
    this.devices = bindChunk96DeviceTrust(input.devices);
  }

  nowUtc(): string {
    return '2026-08-18T00:00:00.000Z';
  }

  registerDevice(input: {
    readonly deviceId: string;
    readonly walletId: string;
    readonly platform: MobileDeviceRegistration['platform'];
  }): MobileDeviceRegistration {
    const registration = this.devices.register({ ...input, nowUtc: this.nowUtc() });
    this.events.append({
      kind: 'WALLET_SECURITY',
      walletId: input.walletId,
      networkId: this.networkId,
      chainId: this.chainId,
      finalizedHeight: this.chain.finalizedHeight(),
      occurredAtUtc: this.nowUtc(),
      payload: { deviceId: input.deviceId, action: 'REGISTERED' },
    });
    return registration;
  }

  revokeDevice(deviceId: string): MobileDeviceRegistration | MobileSyncRejection {
    const revoked = this.devices.revoke(deviceId, 'policy');
    if (!revoked) {
      return reject('DEVICE_NOT_REGISTERED', 'device is not registered');
    }
    this.push.unsubscribe(deviceId);
    return revoked;
  }

  openSession(input: {
    readonly walletId: string;
    readonly deviceId: string;
    readonly clientVersion: string;
  }): WalletSyncSession | MobileSyncRejection {
    const compatibility = evaluateClientCompatibility(input.clientVersion);
    if (!compatibility.allowed) {
      return reject(
        compatibility.compatibility === 'UPGRADE_REQUIRED' ? 'CLIENT_UPGRADE_REQUIRED' : 'CLIENT_VERSION_UNSUPPORTED',
        compatibility.reason,
      );
    }
    const auth = this.devices.authorizeSync(input.deviceId, input.walletId);
    if (!auth.allowed) {
      return reject(auth.reason as 'DEVICE_REVOKED' | 'DEVICE_UNTRUSTED' | 'DEVICE_NOT_REGISTERED', 'device is not authorized to sync protected data');
    }
    const session: WalletSyncSession = Object.freeze({
      sessionId: `sess.${input.deviceId}.${input.walletId}`,
      walletId: input.walletId,
      deviceId: input.deviceId,
      networkId: this.networkId,
      chainId: this.chainId,
      clientVersion: input.clientVersion,
      apiVersion: MOBILE_SYNC_API_VERSION,
      authenticated: true,
      createdAtUtc: this.nowUtc(),
    });
    this.sessions.set(session.sessionId, session);
    return session;
  }

  authorizeWithPushToken(_token: string): MobileSyncRejection {
    return refusePushTokenAuthorization();
  }

  sync(input: {
    readonly sessionId: string;
    readonly cursor?: WalletSyncCursor;
    readonly accountId?: string;
    readonly fiat?: readonly FiatBalanceProjection[];
  }): SyncResult | MobileSyncRejection {
    const session = this.requireSession(input.sessionId);
    if ('ok' in session) {
      return session;
    }
    if (input.cursor && (input.cursor.networkId !== this.networkId || input.cursor.chainId !== this.chainId)) {
      return reject('WRONG_NETWORK', 'cursor does not bind this network and chain');
    }
    const native = this.nativeBalances(session.walletId, input.accountId ?? `bca.${session.walletId}`);
    this.sequence += 1;
    const projection = this.projections.project({
      walletId: session.walletId,
      networkId: this.networkId,
      chainId: this.chainId,
      finalizedHeight: this.chain.finalizedHeight(),
      projectionSequence: this.sequence,
      nativeBalances: native,
      ...(input.fiat === undefined ? {} : { fiatBalances: input.fiat }),
      pendingTransactionIds: this.pending.list(session.walletId).map((tx) => tx.transactionId),
      delegatedKeyIds: [],
      securityEventIds: [],
      exchangeActivityIds: [],
      agentMandateIds: [],
    });
    if ('ok' in projection && projection.ok === false) {
      return projection;
    }
    const snapshotNeeded = !input.cursor;
    const snapshot = snapshotNeeded
      ? this.projections.snapshot(projection, `snap.${session.walletId}.${this.sequence}`, this.nowUtc())
      : null;
    const fromSequence = input.cursor?.projectionSequence ?? 0;
    const delta = snapshotNeeded ? null : this.events.stream(session.walletId, fromSequence);
    if (delta?.gapDetected) {
      return reject('EVENT_GAP_DETECTED', 'event gap detected; rebuild from snapshot');
    }
    const cursor = createSyncCursor({
      networkId: this.networkId,
      chainId: this.chainId,
      walletId: session.walletId,
      finalizedHeight: this.chain.finalizedHeight(),
      projectionSequence: this.sequence,
    });
    this.lastSync.set(session.sessionId, this.nowUtc());
    return Object.freeze({
      session,
      snapshot,
      delta,
      cursor,
      health: this.health(session.sessionId),
    });
  }

  rebuild(sessionId: string, accountId?: string): SyncResult | MobileSyncRejection {
    const session = this.requireSession(sessionId);
    if ('ok' in session) {
      return session;
    }
    this.projections.discard(session.walletId);
    return accountId === undefined ? this.sync({ sessionId }) : this.sync({ sessionId, accountId });
  }

  recordChainEvent(walletId: string, kind: Parameters<WalletEventLog['append']>[0]['kind'], payload: Readonly<Record<string, unknown>>): void {
    this.events.append({
      kind,
      walletId,
      networkId: this.networkId,
      chainId: this.chainId,
      finalizedHeight: this.chain.finalizedHeight(),
      occurredAtUtc: this.nowUtc(),
      payload,
    });
  }

  createPending(input: {
    readonly walletId: string;
    readonly accountId: string;
    readonly transactionId: string;
    readonly clientTxId: string;
    readonly nonce: string;
    readonly feeAuthorizedMinorUnits: string;
    readonly bodyHash: string;
    readonly state?: PendingTransactionState;
  }): WalletPendingTransaction {
    return this.pending.upsert({
      transactionId: input.transactionId,
      clientTxId: input.clientTxId,
      walletId: input.walletId,
      accountId: input.accountId,
      networkId: this.networkId,
      chainId: this.chainId,
      state: input.state ?? 'LOCAL_DRAFT',
      bodyHash: input.bodyHash,
      nonce: input.nonce,
      feeAuthorizedMinorUnits: input.feeAuthorizedMinorUnits,
      mempoolAcceptanceIsFinality: false,
      uiFinalized: false,
    });
  }

  submitPending(transactionId: string, context: OfflineDraftContext): WalletPendingTransaction | MobileSyncRejection {
    const current = this.pending.get(transactionId);
    if (!current) {
      return reject('STALE_DRAFT', 'pending transaction is unknown');
    }
    const draft = this.drafts.get(`draft.${current.walletId}.${current.nonce}`);
    if (draft) {
      const check = this.drafts.revalidate(draft, context, this.nowUtc());
      if (check.stale) {
        return reject('STALE_DRAFT', `stale transaction draft: ${check.reasons.join(', ')}`);
      }
    }
    const submitted = this.chain.submit(transactionId);
    if (submitted.state === 'TEMPORARILY_UNAVAILABLE') {
      return this.pending.transition(transactionId, 'SUBMISSION_UNKNOWN') ?? current;
    }
    const next = this.pending.transition(transactionId, submitted.state === 'ACCEPTED_FOR_MEMPOOL' || submitted.state === 'ALREADY_KNOWN' ? 'MEMPOOL_ACCEPTED' : 'SUBMITTED');
    return next ?? current;
  }

  finalizePending(transactionId: string): WalletPendingTransaction | undefined {
    this.chain.finalize(transactionId);
    const next = this.pending.transition(transactionId, 'FINALIZED');
    const current = next ?? this.pending.get(transactionId);
    if (current) {
      this.recordChainEvent(current.walletId, 'FINALITY', { transactionId });
      const event = this.push.createEvent('TRANSACTION_FINALIZED', `evt.${transactionId}`);
      if (!('ok' in event)) {
        this.push.publish(current.walletId, event);
      }
    }
    return next;
  }

  trackFinality(transactionId: string) {
    const pending = this.pending.get(transactionId);
    const chain = this.chain.finality(transactionId);
    return this.finality.project({
      transactionId,
      chainState: chain.state,
      pendingState: pending?.state ?? 'SUBMISSION_UNKNOWN',
    });
  }

  labelAddress(addressText: string, label: string): { addressText: string; label: string; blockchainAuthority: false } {
    const entry = Object.freeze({ addressText, label, blockchainAuthority: false as const });
    this.addressLabels.set(addressText, entry);
    return entry;
  }

  health(sessionId: string): MobileSyncHealth {
    const session = this.sessions.get(sessionId);
    const status = this.chain.networkStatus();
    return Object.freeze({
      sessionId,
      deviceId: session?.deviceId ?? '',
      walletId: session?.walletId ?? '',
      online: status.rpcStatus !== 'DOWN',
      lastSuccessfulSyncUtc: this.lastSync.get(sessionId) ?? null,
      lastCursor: session
        ? createSyncCursor({
            networkId: this.networkId,
            chainId: this.chainId,
            walletId: session.walletId,
            finalizedHeight: this.chain.finalizedHeight(),
            projectionSequence: this.sequence,
          })
        : null,
      rpcHealth: status.rpcStatus,
      eventGap: false,
      upgradeRequired: false,
    });
  }

  report(): WalletSyncReport {
    return Object.freeze({
      schemaVersion: MOBILE_SYNC_SCHEMA_VERSION,
      toolVersion: MOBILE_SYNC_TOOL_VERSION,
      sessions: this.sessions.size,
      devices: this.devices.list().length,
      snapshots: this.sequence,
      events: this.events.headSequence(),
      pending: [...this.sessions.values()].reduce((count, session) => count + this.pending.list(session.walletId).length, 0),
      drafts: [...this.sessions.values()].reduce((count, session) => count + this.drafts.list(session.walletId).length, 0),
      pushDeliveries: this.push.deliveries.length,
      selfCustodyKeyOnSyncServer: false,
      mempoolPresentedAsFinality: false,
      deviceCacheAuthoritative: false,
      fiatMergedWithNative: false,
    });
  }

  assertNoMasterKey(): MobileSyncRejection {
    return reject('SYNC_SERVER_HAS_NO_MASTER_KEY', 'backend sync servers must not obtain self-custody master private keys');
  }

  private requireSession(sessionId: string): WalletSyncSession | MobileSyncRejection {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return reject('DEVICE_NOT_REGISTERED', 'sync session is not authenticated');
    }
    const auth = this.devices.authorizeSync(session.deviceId, session.walletId);
    if (!auth.allowed) {
      this.sessions.delete(sessionId);
      return reject('DEVICE_REVOKED', 'revoked device cannot sync protected data');
    }
    return session;
  }

  private nativeBalances(walletId: string, accountId: string): readonly NativeBalanceProjection[] {
    const holding = this.chain.balance(accountId) ?? {
      assetId: 'SUNREY_COIN',
      available: '0',
      reserved: '0',
      locked: '0',
    };
    return Object.freeze([
      Object.freeze({
        accountId,
        assetId: holding.assetId,
        availableMinorUnits: holding.available,
        reservedMinorUnits: holding.reserved,
        lockedMinorUnits: holding.locked,
        source: 'CANONICAL_CHAIN' as const,
        authoritative: true as const,
      }),
    ]);
  }
}

export function bodyHashOf(bytesHex: string): string {
  return createHash('sha256').update(bytesHex).digest('hex');
}

export type { PushEventCategory };
