export {
  assertSimulationOnly,
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from './flags.ts';

export { addMs, FrozenClock, isExpired, systemClock, utcNowFromDate, type Clock } from './clock.ts';

export {
  currentAiAgentName,
  currentApplicationName,
  currentBlockchainName,
  currentExchangeName,
  currentMasterBrand,
  currentNativeAssetDisplayNames,
  currentNativeAssetProtocolIds,
  currentTechnicalChainName,
  isCurrentProductName,
  isLegacyProductName,
  LEGACY_PRODUCT_IDENTITY,
  LEGACY_PRODUCT_NAMES,
  NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN,
  PRODUCT_IDENTITY,
  PROTOCOL_NATIVE_ASSET_IDS,
  TICKER_STATUS,
  type CanonicalProductIdentity,
  type LegacyProductName,
  type TickerStatus,
} from './product-identity.ts';

export {
  classifyLegacyOccurrence,
  defaultPolicyForClassification,
  extractLegacyTokens,
  isPublicNameClassification,
  MIGRATION_POLICIES,
  NAME_CLASSIFICATIONS,
  PUBLIC_NAME_CLASSIFICATIONS,
  type ClassificationInput,
  type ClassificationResult,
  type MigrationPolicy,
  type NameClassification,
  type PublicNameClassification,
} from './naming-classification.ts';

export {
  allowlistFingerprint,
  matchNamingAllowlist,
  NAMING_ALLOWLIST,
  type NamingAllowlistEntry,
} from './naming-allowlist.ts';

export {
  ENV_REMOVAL_DATE,
  findLegacyEnvironmentVariable,
  LEGACY_ENVIRONMENT_VARIABLES,
  type LegacyEnvironmentVariable,
} from './naming-env-inventory.ts';

export {
  LEGACY_TYPESCRIPT_SYMBOLS,
  PROTOCOL_IDENTIFIERS_MUST_NOT_CHANGE,
  type LegacyTypeScriptSymbol,
} from './naming-symbol-inventory.ts';

export {
  buildNamingInventory,
  collectPublicSurfaceDebt,
  evaluatePublicSurfaceGuard,
  inventoryIsDeterministic,
  NAMING_INVENTORY_JSON,
  NAMING_INVENTORY_MD,
  NAMING_PUBLIC_DEBT_JSON,
  protocolIdentifiersUnchanged,
  renderInventoryMarkdown,
  runNamingAudit,
  scanLegacyOccurrences,
  summarizeOccurrences,
  writeNamingInventory,
  writePublicSurfaceDebt,
  type NamingAuditResult,
  type NamingInventory,
  type NamingOccurrence,
  type PublicSurfaceDebt,
  type PublicSurfaceGuardFinding,
} from './naming-audit.ts';
