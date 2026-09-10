/**
 * SunRey Internal Alpha network identity for Exchange clearing runtime.
 *
 * Internal Alpha is a canonical deployable simulation network. It is not
 * mainnet. ENVIRONMENT remains simulation. LIVE_* flags stay false.
 */

export const SUNREY_INTERNAL_ALPHA_DISPLAY_NAME = 'SunRey Internal Alpha Network' as const;
export const SUNREY_INTERNAL_ALPHA_BANNER = 'SUNREY INTERNAL ALPHA' as const;

export const SUNREY_INTERNAL_ALPHA_NETWORK_ID = 'net_sunrey_internal_alpha' as const;
export const SUNREY_INTERNAL_ALPHA_CHAIN_ID = 'chn_sunrey_internal_alpha' as const;

export const INTERNAL_ALPHA_ADDRESS_HRP = 'srtst' as const;
export const INTERNAL_ALPHA_NETWORK_CLASS = 'RESERVED_TEST' as const;

export const INTERNAL_ALPHA_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const INTERNAL_ALPHA_ENVIRONMENT = 'simulation' as const;
export const INTERNAL_ALPHA_PRODUCTION_NETWORK_ENABLED = false as const;

export function isInternalAlphaNetworkId(networkId: string): boolean {
  return networkId === SUNREY_INTERNAL_ALPHA_NETWORK_ID;
}

export function isInternalAlphaChainId(chainId: string): boolean {
  return chainId === SUNREY_INTERNAL_ALPHA_CHAIN_ID;
}
