/**
 * Canonical native assets for custody.
 *
 * Reuses SunRey Chain NativeAssetId. Do not invent lowercase
 * duplicates such as sunrey_coin / moonrey_coin.
 */

import {
  NATIVE_ASSET_IDS,
  type NativeAssetId,
} from '../../sunrey-chain/src/protocol/assets.ts';

export const NATIVE_CUSTODY_ASSET_IDS = NATIVE_ASSET_IDS;
export type NativeCustodyAssetId = NativeAssetId;

export function isNativeCustodyAssetId(value: string): value is NativeCustodyAssetId {
  return value === 'SUNREY_COIN' || value === 'MOONREY_COIN';
}

export function assertNativeCustodyAssetId(value: string): NativeCustodyAssetId {
  if (!isNativeCustodyAssetId(value)) {
    throw new Error(`unsupported native custody asset: ${value}`);
  }
  return value;
}

export function ownerAssetPositionKey(ownerId: string, assetId: string): string {
  return `${ownerId}\0${assetId}`;
}

export function addressAssetAttributionKey(address: string, assetId: NativeCustodyAssetId): string {
  return `${address}\0${assetId}`;
}
