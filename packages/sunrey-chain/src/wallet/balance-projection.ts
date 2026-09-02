/**
 * Wave 8 — chain-derived native balance projection.
 *
 * Cached projections may exist for performance. Canonical truth remains
 * blockchain protocol state. Projections are rebuildable and never hold
 * an independent mutable balance field.
 */

import type { FeeAssetId } from '../fees/types.ts';
import type { NativeAssetId } from '../protocol/assets.ts';
import type { WalletEngine } from './engine.ts';
import type { WalletHistory } from './history.ts';
import type { WalletTransactionRecord } from './types.ts';

export type ChainBalanceProjection = {
  readonly accountId: string;
  readonly assetId: NativeAssetId | FeeAssetId;
  readonly availableMinorUnits: bigint;
  readonly authority: 'NATIVE_BLOCKCHAIN_AUTHORITY';
  readonly source: 'CANONICAL_CHAIN' | 'REBUILT_PROJECTION';
  readonly rebuildable: true;
  readonly mutableBalanceFieldIsTruth: false;
};

export function canonicalChainBalance(
  engine: WalletEngine,
  accountId: string,
  assetId: NativeAssetId | FeeAssetId = 'SUNREY_COIN',
): ChainBalanceProjection {
  return Object.freeze({
    accountId,
    assetId,
    availableMinorUnits: engine.balance(accountId, assetId as FeeAssetId),
    authority: 'NATIVE_BLOCKCHAIN_AUTHORITY',
    source: 'CANONICAL_CHAIN',
    rebuildable: true,
    mutableBalanceFieldIsTruth: false,
  });
}

export function rebuildBalanceProjectionFromHistory(input: {
  readonly engine: WalletEngine;
  readonly history: WalletHistory;
  readonly accountId: string;
  readonly assetId: NativeAssetId | FeeAssetId;
  readonly finalizedRecords: readonly WalletTransactionRecord[];
}): ChainBalanceProjection {
  input.history.rebuildFromChain(input.finalizedRecords);
  return Object.freeze({
    accountId: input.accountId,
    assetId: input.assetId,
    availableMinorUnits: input.engine.balance(input.accountId, input.assetId as FeeAssetId),
    authority: 'NATIVE_BLOCKCHAIN_AUTHORITY',
    source: 'REBUILT_PROJECTION',
    rebuildable: true,
    mutableBalanceFieldIsTruth: false,
  });
}

export function projectionMatchesCanonical(
  projection: ChainBalanceProjection,
  engine: WalletEngine,
): boolean {
  const canonical = engine.balance(projection.accountId, projection.assetId as FeeAssetId);
  return projection.availableMinorUnits === canonical;
}
