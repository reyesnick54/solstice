export const NATIVE_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type NativeAssetId = (typeof NATIVE_ASSET_IDS)[number];

export const NATIVE_ASSET_PROTO_IDS: { readonly [K in NativeAssetId]: number } = {
  SUNREY_COIN: 1,
  MOONREY_COIN: 2,
};

export const NATIVE_ASSET_PROTOCOL_KEYS: { readonly [K in NativeAssetId]: string } = {
  SUNREY_COIN: 'sunrey.asset.sunrey_coin',
  MOONREY_COIN: 'sunrey.asset.moonrey_coin',
};

export const NATIVE_ASSET_TICKER_STATUS = 'NOT_ASSIGNED' as const;

export const NATIVE_ASSET_OPERATION = {
  TRANSFER: 'TRANSFER',
  ISSUE: 'ISSUE',
  BURN: 'BURN',
} as const;
export type NativeAssetOperation = (typeof NATIVE_ASSET_OPERATION)[keyof typeof NATIVE_ASSET_OPERATION];

export const NATIVE_ASSET_OPERATION_IDS: { readonly [K in NativeAssetOperation]: number } = {
  TRANSFER: 1,
  ISSUE: 2,
  BURN: 3,
};

export function nativeAssetIdFromProto(id: number): NativeAssetId | null {
  if (id === 1) {
    return 'SUNREY_COIN';
  }
  if (id === 2) {
    return 'MOONREY_COIN';
  }
  return null;
}

export function nativeAssetOperationFromId(id: number): NativeAssetOperation | null {
  if (id === 1) {
    return 'TRANSFER';
  }
  if (id === 2) {
    return 'ISSUE';
  }
  if (id === 3) {
    return 'BURN';
  }
  return null;
}

export function moonreyIssuanceActivated(): false {
  return false;
}
