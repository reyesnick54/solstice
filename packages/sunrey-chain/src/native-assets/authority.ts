export const CURRENT_APPLICATION_AUTHORITY = 'CURRENT_APPLICATION_AUTHORITY' as const;
export const NATIVE_BLOCKCHAIN_AUTHORITY = 'NATIVE_BLOCKCHAIN_AUTHORITY' as const;

export type AssetAuthority =
  | typeof CURRENT_APPLICATION_AUTHORITY
  | typeof NATIVE_BLOCKCHAIN_AUTHORITY;

export type NativeAssetAuthorityBoundary = {
  readonly application: typeof CURRENT_APPLICATION_AUTHORITY;
  readonly nativeChain: typeof NATIVE_BLOCKCHAIN_AUTHORITY;
  readonly applicationSupplyImported: false;
  readonly productionMigrationPerformed: false;
  readonly developmentNetworkDistinct: true;
};

export function nativeAssetAuthorityBoundary(): NativeAssetAuthorityBoundary {
  return Object.freeze({
    application: CURRENT_APPLICATION_AUTHORITY,
    nativeChain: NATIVE_BLOCKCHAIN_AUTHORITY,
    applicationSupplyImported: false,
    productionMigrationPerformed: false,
    developmentNetworkDistinct: true,
  });
}
