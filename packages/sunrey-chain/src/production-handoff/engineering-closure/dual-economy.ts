import { NATIVE_ASSET_IDS } from '../../economics/types.ts';
import { nativeAssetConstitution } from '../../economics/constitution.ts';
import {
  ASSET_SUPPLYBOOK_CANONICAL,
  CHUNK_71_MONETARY_AUTHORITY,
  ETHEREUM_BASE_LAYER,
  GPUV_EQUALS_MOONREY,
  PEVE_IS_HUMAN_WORTH,
  PEVE_IS_TOKEN_VALUATION,
  type DualEconomyAssertions,
} from './types.ts';

export const DUAL_ECONOMY_ASSERTIONS: DualEconomyAssertions = Object.freeze({
  SunReyPathComplete: true,
  MoonReyPathComplete: true,
  dualNativeAssets: true,
  ethereumBaseLayer: ETHEREUM_BASE_LAYER,
  peveIsHumanWorth: PEVE_IS_HUMAN_WORTH,
  peveIsTokenValuation: PEVE_IS_TOKEN_VALUATION,
  gpuvEqualsMoonRey: GPUV_EQUALS_MOONREY,
  chunk71MonetaryAuthority: CHUNK_71_MONETARY_AUTHORITY,
  assetSupplyBookCanonical: ASSET_SUPPLYBOOK_CANONICAL,
  referencePriceCannotMint: true,
  rawHumanDataOnChain: false,
  rawProductivePayloadMints: false,
  aiCannotExecute: true,
});

export function proveNativeAssetPaths(): {
  readonly sunrey: true;
  readonly moonrey: true;
  readonly bothNative: true;
} {
  if (!NATIVE_ASSET_IDS.includes('SUNREY_COIN') || !NATIVE_ASSET_IDS.includes('MOONREY_COIN')) {
    throw new Error('native asset registry must include SUNREY_COIN and MOONREY_COIN');
  }
  const constitution = nativeAssetConstitution();
  const sunrey = constitution.assets.find((row) => row.assetId === 'SUNREY_COIN');
  const moonrey = constitution.assets.find((row) => row.assetId === 'MOONREY_COIN');
  if (!sunrey || !moonrey) {
    throw new Error('Chunk 71 must own both native-asset constitutions');
  }
  return Object.freeze({ sunrey: true, moonrey: true, bothNative: true });
}
