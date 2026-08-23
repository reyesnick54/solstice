/**
 * Phase G digital-asset productization taxonomy.
 * Extends the canonical Exchange owner. Not a second Exchange, mint, or ledger.
 * Production remains disabled.
 */

export const PHASE_G_ID = 'sunrey.productization.phase-g.v1' as const;

export const EXCHANGE_LOVABLE_SCREENS = [
  'EXCHANGE_HOME',
  'MARKETS',
  'SUNREY_COIN_DETAIL',
  'MOONREY_COIN_DETAIL',
  'ASSET_CHARTS',
  'ORDER_BOOK',
  'BUY',
  'SELL',
  'ORDER_PREVIEW',
  'ORDER_CONFIRMATION',
  'OPEN_ORDERS',
  'ORDER_HISTORY',
  'FILLS',
  'WALLETS',
  'DEPOSIT',
  'WITHDRAW',
  'TRANSACTIONS',
  'ASSET_ECONOMY',
] as const;
export type ExchangeLovableScreen = (typeof EXCHANGE_LOVABLE_SCREENS)[number];

export const MARKET_DATA_CLIENT_STATUSES = ['LIVE', 'DELAYED', 'SANDBOX', 'UNAVAILABLE', 'STALE'] as const;
export type MarketDataClientStatus = (typeof MARKET_DATA_CLIENT_STATUSES)[number];

export const READINESS_CLASSES = [
  'PRODUCTIZED_INTERNAL',
  'SANDBOX_FUNCTIONAL',
  'TESTNET_DEPLOYABLE',
  'PROVIDER_REQUIRED',
  'GOVERNANCE_REQUIRED',
  'REGULATORY_APPROVAL_REQUIRED',
  'EXTERNAL_SECURITY_REVIEW_REQUIRED',
  'PRODUCTION_READY_PENDING_EXTERNAL_GATES',
] as const;
export type ReadinessClass = (typeof READINESS_CLASSES)[number];

export const PHASE_G_CAPABILITIES = [
  'EXCHANGE_CORE',
  'EXCHANGE_SETTLEMENT',
  'EXCHANGE_SURVEILLANCE',
  'SUNREY_CHAIN',
  'VALIDATORS',
  'RPC',
  'WALLETS',
  'SUNREY_COIN',
  'MOONREY_COIN',
  'CUSTODY_INTEGRATION',
] as const;
export type PhaseGCapability = (typeof PHASE_G_CAPABILITIES)[number];

export const PHASE_G_PRODUCTION_FLAGS = Object.freeze({
  CORE_CODE_COMPLETE_CANDIDATE: true,
  PRODUCTION_READY: false,
  PRODUCTION_ACTIVE: false,
  LIVE_CONNECTIVITY_ENABLED: false,
  ENVIRONMENT: 'simulation',
  LIVE_EXCHANGE_ENABLED: false,
  MAINNET_ACTIVE: false,
  LIVE_NATIVE_ASSET_ISSUANCE_ENABLED: false,
  REAL_CUSTODY_CONNECTED: false,
  REAL_MARKET_DATA_CONNECTED: false,
  REAL_ORACLE_DATA_CONNECTED: false,
});

export const PHASE_G_CLASSIFICATION = Object.freeze({
  EXCHANGE_CORE: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
  ] as const satisfies readonly ReadinessClass[]),
  EXCHANGE_SETTLEMENT: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'PROVIDER_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  EXCHANGE_SURVEILLANCE: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'REGULATORY_APPROVAL_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  SUNREY_CHAIN: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'TESTNET_DEPLOYABLE',
    'GOVERNANCE_REQUIRED',
    'EXTERNAL_SECURITY_REVIEW_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  VALIDATORS: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'TESTNET_DEPLOYABLE',
    'PROVIDER_REQUIRED',
    'GOVERNANCE_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  RPC: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'TESTNET_DEPLOYABLE',
  ] as const satisfies readonly ReadinessClass[]),
  WALLETS: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'PROVIDER_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  SUNREY_COIN: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'GOVERNANCE_REQUIRED',
    'REGULATORY_APPROVAL_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  MOONREY_COIN: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'GOVERNANCE_REQUIRED',
    'REGULATORY_APPROVAL_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
  CUSTODY_INTEGRATION: Object.freeze([
    'PRODUCTIZED_INTERNAL',
    'SANDBOX_FUNCTIONAL',
    'PROVIDER_REQUIRED',
    'REGULATORY_APPROVAL_REQUIRED',
    'EXTERNAL_SECURITY_REVIEW_REQUIRED',
  ] as const satisfies readonly ReadinessClass[]),
});

export function buildingMainnetIsNotActivation(): {
  readonly buildingMainnetSoftware: true;
  readonly activatingMainnet: false;
  readonly activationRequiresSeparateAuthorizedProcess: true;
} {
  return Object.freeze({
    buildingMainnetSoftware: true,
    activatingMainnet: false,
    activationRequiresSeparateAuthorizedProcess: true,
  });
}
