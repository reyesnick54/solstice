/**
 * Rebuildable wallet state projection. Device caches are never
 * authoritative over canonical chain state.
 */

import { createSyncCursor } from './cursor.ts';
import {
  MOBILE_SYNC_SCHEMA_VERSION,
  reject,
  type FiatBalanceProjection,
  type MobileSyncRejection,
  type NativeBalanceProjection,
  type WalletStateProjection,
  type WalletSyncCursor,
  type WalletSyncSnapshot,
} from './types.ts';

export class WalletProjectionStore {
  private readonly projections = new Map<string, WalletStateProjection>();

  project(input: {
    readonly walletId: string;
    readonly networkId: string;
    readonly chainId: string;
    readonly finalizedHeight: number;
    readonly projectionSequence: number;
    readonly nativeBalances: readonly NativeBalanceProjection[];
    readonly fiatBalances?: readonly FiatBalanceProjection[];
    readonly pendingTransactionIds?: readonly string[];
    readonly delegatedKeyIds?: readonly string[];
    readonly securityEventIds?: readonly string[];
    readonly exchangeActivityIds?: readonly string[];
    readonly agentMandateIds?: readonly string[];
  }): WalletStateProjection | MobileSyncRejection {
    if (input.fiatBalances?.some((fiat) => (fiat as { mergedWithNative?: boolean }).mergedWithNative)) {
      return reject('FIAT_NATIVE_MERGE_FORBIDDEN', 'fiat ledger data must not merge with native chain balances');
    }
    const projection: WalletStateProjection = Object.freeze({
      schemaVersion: MOBILE_SYNC_SCHEMA_VERSION,
      walletId: input.walletId,
      networkId: input.networkId,
      chainId: input.chainId,
      finalizedHeight: input.finalizedHeight,
      projectionSequence: input.projectionSequence,
      nativeBalances: Object.freeze([...input.nativeBalances]),
      fiatBalances: Object.freeze([...(input.fiatBalances ?? [])]),
      pendingTransactionIds: Object.freeze([...(input.pendingTransactionIds ?? [])]),
      delegatedKeyIds: Object.freeze([...(input.delegatedKeyIds ?? [])]),
      securityEventIds: Object.freeze([...(input.securityEventIds ?? [])]),
      exchangeActivityIds: Object.freeze([...(input.exchangeActivityIds ?? [])]),
      agentMandateIds: Object.freeze([...(input.agentMandateIds ?? [])]),
      rebuildable: true,
      authoritative: false,
      deviceCacheAuthoritative: false,
    });
    this.projections.set(input.walletId, projection);
    return projection;
  }

  get(walletId: string): WalletStateProjection | undefined {
    return this.projections.get(walletId);
  }

  discard(walletId: string): void {
    this.projections.delete(walletId);
  }

  snapshot(projection: WalletStateProjection, snapshotId: string, createdAtUtc: string): WalletSyncSnapshot {
    const cursor: WalletSyncCursor = createSyncCursor(projection);
    return Object.freeze({
      schemaVersion: MOBILE_SYNC_SCHEMA_VERSION,
      snapshotId,
      cursor,
      projection,
      eventsThroughSequence: projection.projectionSequence,
      createdAtUtc,
      source: 'CANONICAL_CHAIN_APIS',
    });
  }

  refuseCacheOverride(): MobileSyncRejection {
    return reject('DEVICE_CACHE_NOT_AUTHORITATIVE', 'a device cache cannot override canonical chain state');
  }
}
