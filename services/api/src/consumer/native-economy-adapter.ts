/**
 * Read-only Consumer BFF adapter for protocol-native asset economics.
 * Orchestration only. Does not mint, burn, or change policy.
 */

import {
  ProtocolNativeSupplyAuthority,
  lovableNativeEconomyContract,
  publicSupplyApi,
  type ClientNativeAssetResource,
  type LovableNativeEconomyContract,
} from '../../../../packages/sunrey-chain/src/native-assets/index.ts';

export type NativeEconomySurface = {
  readonly overview: () => LovableNativeEconomyContract;
  readonly supply: () => ReturnType<typeof publicSupplyApi>;
  readonly asset: (assetId: string) => ClientNativeAssetResource | { readonly error: 'NOT_FOUND' };
};

export function createNativeEconomySurface(
  authority: ProtocolNativeSupplyAuthority = new ProtocolNativeSupplyAuthority(),
): NativeEconomySurface {
  return Object.freeze({
    overview() {
      return lovableNativeEconomyContract({ authority });
    },
    supply() {
      return publicSupplyApi(authority);
    },
    asset(assetId: string) {
      if (assetId !== 'SUNREY_COIN' && assetId !== 'MOONREY_COIN') {
        return { error: 'NOT_FOUND' as const };
      }
      return publicSupplyApi(authority).assets.find((row) => row.asset.assetId === assetId) ?? {
        error: 'NOT_FOUND' as const,
      };
    },
  });
}
