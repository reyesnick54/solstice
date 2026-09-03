export {
  assertSimulationOnly,
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED,
  LIVE_BANKING_RAILS,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_CRYPTO_ENABLED,
  LIVE_CUSTODY_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED,
  LIVE_EXTERNAL_KYC,
  LIVE_INTEROP_ENABLED,
  LIVE_INTEROP_RELAYERS_ENABLED,
  LIVE_INTEROP_WATCHERS_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  PRODUCTION_HSM_KMS_CONFIGURED,
  REAL_MONEY_ENABLED,
  SIMULATION_MODE,
} from './flags.ts';

export {
  ADR_ENGINEERING_STATUSES,
  ADR_IMPLEMENTATION_STATUSES,
  ADR_LEGAL_CONFIDENCE,
  ADR_PRODUCTION_ACTIVATION,
  ADR_REGISTRY,
  EXTERNAL_APPROVAL_STATES,
  engineeringStatusAllowsProductionActivation,
  findAdrByFile,
  findAdrsByNumber,
  implementedButNotProductionApproved,
  productionActivationAllowed,
  proposedWithProductionCode,
  type AdrEngineeringStatus,
  type AdrImplementationStatus,
  type AdrLegalConfidence,
  type AdrProductionActivation,
  type AdrRecord,
  type ExternalApprovalState,
} from './adr-governance.ts';

export {
  ACTIVATION_GATE_REQUIREMENTS,
  PRODUCTION_ACTIVATION_POLICY_ID,
  REGULATED_FEATURE_FLAGS,
  assertInteropDevelopmentOnly,
  assertProductionActivationSafe,
  assertRegulatedFeaturesFailClosed,
  evaluateActivationGates,
  interopProductionActivationAllowed,
  listEnabledRegulatedFlags,
  type ActivationGateRequirement,
  type ActivationGateViolation,
  type RegulatedFeatureFlag,
} from './activation-gates.ts';

export { DATA_MODE, DATA_MODES, resolveDataMode, type DataMode } from './data-mode.ts';

export { addMs, FrozenClock, isExpired, systemClock, utcNowFromDate, type Clock } from './clock.ts';

export {
  CANONICAL_ENV_PREFIX,
  CANONICAL_PRODUCT_IDENTITY,
  CURRENT_MASTER_BRAND,
  GITHUB_REPOSITORY_PATH,
  GITHUB_REPOSITORY_RENAMED,
  HISTORICAL_HASH_DOMAINS_CHANGED,
  LEGACY_ENV_COMPATIBILITY,
  LEGACY_ENV_PREFIX,
  LEGACY_MASTER_BRAND,
  LEGACY_MASTER_BRAND_ACTIVE,
  PROTOCOL_IDS_CHANGED,
  SUNREY_CHAIN_DISPLAY_NAME,
  SUNREY_EXCHANGE_DISPLAY_NAME,
  SUNREY_EXPLORER_DISPLAY_NAME,
  SUNREY_SDK_DISPLAY_NAME,
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
  LEGACY_ENV_CONFLICT,
  LegacyEnvConflictError,
  PERSISTENCE_ENV_ALIASES,
  formatEnvResolutionDiagnostic,
  isSecretEnvName,
  requireResolvedEnvValue,
  resolveCanonicalEnv,
  isPersistenceTestEnabled,
  type EnvResolution,
  type EnvValueSource,
  type LegacyEnvAlias,
} from './env.ts';

export {
  buildSunReyLegacyCompatibilityReport,
  type LegacyCompatibilityEntry,
  type SunReyLegacyCompatibilityReport,
} from './legacy-compatibility.ts';

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
