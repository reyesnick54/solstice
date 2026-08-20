/**
 * Canonical current-product identity.
 *
 * Brand display is not protocol identity. Network IDs, chain IDs, asset
 * IDs, hash domains, event schema refs, and the GitHub repository path
 * stay on their historical values.
 */

export const CURRENT_MASTER_BRAND = 'SunRey' as const;
export const LEGACY_MASTER_BRAND = 'Solstice' as const;
export const LEGACY_MASTER_BRAND_ACTIVE = false as const;

export const CANONICAL_ENV_PREFIX = 'SUNREY_' as const;
export const LEGACY_ENV_PREFIX = 'SOLSTICE_' as const;
export const LEGACY_ENV_COMPATIBILITY = true as const;

export const PROTOCOL_IDS_CHANGED = false as const;
export const HISTORICAL_HASH_DOMAINS_CHANGED = false as const;
export const GITHUB_REPOSITORY_RENAMED = false as const;
export const GITHUB_REPOSITORY_PATH = 'reyesnick54/solstice' as const;

export const SUNREY_SDK_DISPLAY_NAME = 'SunRey SDK' as const;
export const SUNREY_CHAIN_DISPLAY_NAME = 'SunRey Chain' as const;
export const SUNREY_EXCHANGE_DISPLAY_NAME = 'SunRey Exchange' as const;
export const SUNREY_EXPLORER_DISPLAY_NAME = 'SunRey Explorer' as const;

export const CANONICAL_PRODUCT_IDENTITY = Object.freeze({
  currentMasterBrand: CURRENT_MASTER_BRAND,
  legacyMasterBrand: LEGACY_MASTER_BRAND,
  legacyMasterBrandActive: LEGACY_MASTER_BRAND_ACTIVE,
  canonicalEnvPrefix: CANONICAL_ENV_PREFIX,
  legacyEnvPrefix: LEGACY_ENV_PREFIX,
  legacyEnvCompatibility: LEGACY_ENV_COMPATIBILITY,
  protocolIdsChanged: PROTOCOL_IDS_CHANGED,
  historicalHashDomainsChanged: HISTORICAL_HASH_DOMAINS_CHANGED,
  githubRepositoryRenamed: GITHUB_REPOSITORY_RENAMED,
  githubRepositoryPath: GITHUB_REPOSITORY_PATH,
  sdkDisplayName: SUNREY_SDK_DISPLAY_NAME,
  chainDisplayName: SUNREY_CHAIN_DISPLAY_NAME,
  exchangeDisplayName: SUNREY_EXCHANGE_DISPLAY_NAME,
  explorerDisplayName: SUNREY_EXPLORER_DISPLAY_NAME,
});
