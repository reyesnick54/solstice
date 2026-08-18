/**
 * SunRey explorer vocabulary.
 *
 * The explorer is a rebuildable projection. Canonical authority remains
 * finalized SunRey Blockchain state. This package never mutates chain
 * state, the financial Ledger, or custody workflows.
 */

export const EXPLORER_SCHEMA_VERSION = 1 as const;
export const EXPLORER_INDEXER_SCHEMA_VERSION = 1 as const;
export const EXPLORER_POLICY_VERSION = 'explorer.exposure.v1' as const;
export const PUBLIC_TICKER_STATUS = 'NOT_ASSIGNED' as const;

export const NETWORK_CLASSES = ['DEVELOPMENT', 'TESTNET', 'PRODUCTION'] as const;
export type NetworkClass = (typeof NETWORK_CLASSES)[number];

export const ACTIVE_NETWORK_CLASS: NetworkClass = 'DEVELOPMENT';
export const NETWORK_ENVIRONMENT_LABEL = 'DEVELOPMENT' as const;
export const NETWORK_ID = 'net_sunrey_simulation' as const;
export const CHAIN_ID = 'chn_sunrey_simulation' as const;

export const EXPOSURE_CLASSES = [
  'PUBLIC',
  'PUBLIC_DERIVED',
  'AUTHENTICATED_ONLY',
  'PRIVATE',
  'FORBIDDEN',
] as const;
export type ExposureClass = (typeof EXPOSURE_CLASSES)[number];

export const INDEXED_ENTITY_KINDS = [
  'BLOCK',
  'TRANSACTION',
  'ACCOUNT',
  'ASSET',
  'VALIDATOR',
  'GOVERNANCE',
  'ORACLE_FACT',
  'ORACLE_PROVIDER',
  'ORACLE_FEED',
  'PRODUCTIVE_OBJECT',
  'PRODUCTIVE_CONTRIBUTION',
  'MOONREY_ISSUANCE',
  'MACHINE',
  'INTEROP_PACKET',
  'EXCHANGE_SETTLEMENT',
  'EVIDENCE',
] as const;
export type IndexedEntityKind = (typeof INDEXED_ENTITY_KINDS)[number];

export const NATIVE_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type NativeAssetId = (typeof NATIVE_ASSET_IDS)[number];

export const NATIVE_ASSET_INTERNAL_IDS: { readonly [K in NativeAssetId]: string } = {
  SUNREY_COIN: 'sunrey.asset.sunrey_coin',
  MOONREY_COIN: 'sunrey.asset.moonrey_coin',
};

export const NATIVE_ASSET_DISPLAY_NAMES: { readonly [K in NativeAssetId]: string } = {
  SUNREY_COIN: 'SunRey Coin',
  MOONREY_COIN: 'MoonRey Coin',
};

export const NATIVE_ASSET_PRECISION = 0 as const;

export const EXPLORER_ACCOUNT_CLASSES = [
  'SINGLE_KEY_ACCOUNT',
  'POLICY_ACCOUNT',
  'MULTI_AUTH_ACCOUNT',
  'MACHINE_ACCOUNT',
  'INSTITUTIONAL_ACCOUNT',
  'WATCH_ONLY_ACCOUNT',
] as const;
export type ExplorerAccountClass = (typeof EXPLORER_ACCOUNT_CLASSES)[number];

export const FINALITY_STATUSES = ['FINALIZED'] as const;
export type FinalityStatus = (typeof FINALITY_STATUSES)[number];

export const TRANSACTION_STATUSES = ['FINALIZED', 'REJECTED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const FORBIDDEN_FIELD_NAMES = [
  'privateKey',
  'private_key',
  'secret',
  'seed',
  'mnemonic',
  'passphrase',
  'keystore',
  'pdvRaw',
  'personalDataVault',
  'cleanRoomRow',
  'kycRecord',
  'screeningResult',
  'consentDetail',
  'walletKey',
  'controllerSecret',
  'mandateSecret',
  'securityCredential',
  'orderAccountPrivate',
  'validatorInfrastructure',
  'walletDeviceBinding',
  'walletSession',
  'walletRecoveryRequest',
  'walletRecoveryEvidence',
  'walletRecoveryChallenge',
  'sessionToken',
] as const;

export const SEARCH_MAX_QUERY_BYTES = 128 as const;
export const SEARCH_MAX_RESULTS = 20 as const;
export const DEFAULT_PAGE_LIMIT = 25 as const;
export const MAX_PAGE_LIMIT = 100 as const;
