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

/**
 * Chunk 141 — Canonical SunRey product identity.
 *
 * Display names only. Protocol asset IDs stay SUNREY_COIN / MOONREY_COIN.
 * Tickers stay NOT_ASSIGNED. This module is not packages/domain Brand.
 */

export const TICKER_STATUS = 'NOT_ASSIGNED' as const;
export type TickerStatus = typeof TICKER_STATUS;

export const PROTOCOL_NATIVE_ASSET_IDS = Object.freeze({
  sunReyCoin: 'SUNREY_COIN',
  moonReyCoin: 'MOONREY_COIN',
});

export const LEGACY_PRODUCT_NAMES = ['SOLSTICE', 'Solstice', 'solstice'] as const;
export type LegacyProductName = (typeof LEGACY_PRODUCT_NAMES)[number];

export type CanonicalProductIdentity = {
  readonly masterBrand: 'SunRey';
  readonly applicationName: 'SunRey';
  readonly blockchainName: 'SunRey Blockchain';
  readonly technicalChainName: 'SunRey Chain';
  readonly sunReyCoinDisplayName: 'SunRey Coin';
  readonly moonReyCoinDisplayName: 'MoonRey Coin';
  readonly exchangeName: 'SunRey Exchange';
  readonly aiAgentName: 'SunRey AI Agent';
  readonly tickerStatus: TickerStatus;
  readonly sunReyCoinProtocolId: 'SUNREY_COIN';
  readonly moonReyCoinProtocolId: 'MOONREY_COIN';
  readonly legacyNames: readonly LegacyProductName[];
};

export const PRODUCT_IDENTITY: CanonicalProductIdentity = Object.freeze({
  masterBrand: 'SunRey',
  applicationName: 'SunRey',
  blockchainName: 'SunRey Blockchain',
  technicalChainName: 'SunRey Chain',
  sunReyCoinDisplayName: 'SunRey Coin',
  moonReyCoinDisplayName: 'MoonRey Coin',
  exchangeName: 'SunRey Exchange',
  aiAgentName: 'SunRey AI Agent',
  tickerStatus: TICKER_STATUS,
  sunReyCoinProtocolId: PROTOCOL_NATIVE_ASSET_IDS.sunReyCoin,
  moonReyCoinProtocolId: PROTOCOL_NATIVE_ASSET_IDS.moonReyCoin,
  legacyNames: LEGACY_PRODUCT_NAMES,
});

export const LEGACY_PRODUCT_IDENTITY = Object.freeze({
  status: 'LEGACY' as const,
  current: false,
  names: LEGACY_PRODUCT_NAMES,
  masterBrand: 'Solstice',
  applicationName: 'Solstice',
  markers: Object.freeze({
    screaming: 'SOLSTICE',
    display: 'Solstice',
    slug: 'solstice',
  }),
});

/** New public runtime surfaces must use SunRey. Historical identifiers may remain. */
export const NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN = true as const;

export function currentMasterBrand(): CanonicalProductIdentity['masterBrand'] {
  return PRODUCT_IDENTITY.masterBrand;
}

export function currentApplicationName(): CanonicalProductIdentity['applicationName'] {
  return PRODUCT_IDENTITY.applicationName;
}

export function currentBlockchainName(): CanonicalProductIdentity['blockchainName'] {
  return PRODUCT_IDENTITY.blockchainName;
}

export function currentTechnicalChainName(): CanonicalProductIdentity['technicalChainName'] {
  return PRODUCT_IDENTITY.technicalChainName;
}

export function currentExchangeName(): CanonicalProductIdentity['exchangeName'] {
  return PRODUCT_IDENTITY.exchangeName;
}

export function currentAiAgentName(): CanonicalProductIdentity['aiAgentName'] {
  return PRODUCT_IDENTITY.aiAgentName;
}

export function currentNativeAssetDisplayNames(): {
  readonly sunReyCoin: CanonicalProductIdentity['sunReyCoinDisplayName'];
  readonly moonReyCoin: CanonicalProductIdentity['moonReyCoinDisplayName'];
} {
  return Object.freeze({
    sunReyCoin: PRODUCT_IDENTITY.sunReyCoinDisplayName,
    moonReyCoin: PRODUCT_IDENTITY.moonReyCoinDisplayName,
  });
}

export function currentNativeAssetProtocolIds(): {
  readonly sunReyCoin: 'SUNREY_COIN';
  readonly moonReyCoin: 'MOONREY_COIN';
} {
  return Object.freeze({
    sunReyCoin: PRODUCT_IDENTITY.sunReyCoinProtocolId,
    moonReyCoin: PRODUCT_IDENTITY.moonReyCoinProtocolId,
  });
}

export function isLegacyProductName(value: string): value is LegacyProductName {
  return (LEGACY_PRODUCT_NAMES as readonly string[]).includes(value);
}

export function isCurrentProductName(value: string): boolean {
  return value === PRODUCT_IDENTITY.masterBrand || value === PRODUCT_IDENTITY.applicationName;
}
