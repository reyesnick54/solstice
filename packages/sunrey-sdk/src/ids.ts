/**
 * Public identifiers shared by TypeScript and Rust SDKs.
 *
 * Tickers remain NOT_ASSIGNED. Do not hard-code Ed25519 as the only suite.
 */

export const PUBLIC_NETWORK_ID = 'net_sunrey_simulation' as const;
export const PUBLIC_CHAIN_ID = 'chn_sunrey_simulation' as const;
export const LOCAL_DEV_NETWORK_ID = 'net_sunrey_local_dev' as const;
export const LOCAL_DEV_CHAIN_ID = 'chn_sunrey_local_dev' as const;
export const PUBLIC_CODEC_ID = 'sunrey.protobuf.canonical.v1' as const;
export const TICKER_STATUS = 'NOT_ASSIGNED' as const;

export const PUBLIC_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type PublicAssetId = (typeof PUBLIC_ASSET_IDS)[number];

export const PUBLIC_CRYPTO_SUITE_IDS = [
  'sunrey-ed25519-v1',
  'sunrey-hybrid-ed25519-mldsa-sim-v1',
  'sunrey-mldsa-65-v1',
] as const;
export type PublicCryptoSuiteId = (typeof PUBLIC_CRYPTO_SUITE_IDS)[number];

export const CLASSICAL_SUITE_ID = 'sunrey-ed25519-v1' as const;
export const HYBRID_SUITE_ID = 'sunrey-hybrid-ed25519-mldsa-sim-v1' as const;
export const PQ_SUITE_ID = 'sunrey-mldsa-65-v1' as const;

export function suiteRank(suiteId: string): number {
  if (suiteId === CLASSICAL_SUITE_ID) {
    return 1;
  }
  if (suiteId === HYBRID_SUITE_ID) {
    return 2;
  }
  if (suiteId === PQ_SUITE_ID) {
    return 3;
  }
  return 0;
}

export function isKnownPublicSuite(suiteId: string): boolean {
  return (PUBLIC_CRYPTO_SUITE_IDS as readonly string[]).includes(suiteId);
}

export function rejectSuiteDowngrade(current: string, next: string): boolean {
  return suiteRank(next) < suiteRank(current);
}
