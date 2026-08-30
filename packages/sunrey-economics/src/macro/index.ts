/**
 * Wave 2 Prompt 8 — macroeconomic provider adapters public exports.
 */

export {
  MACRO_CATALOG_ENTRIES,
  MACRO_CATALOG_PROVIDER_IDS,
  type MacroCatalogProviderId,
} from './catalog-entries.ts';

export {
  CANONICAL_INDICATORS,
  PROVIDER_INDICATOR_MAPPINGS,
  getProviderNativeId,
  resolveCanonicalIndicatorId,
  type CanonicalIndicatorId,
} from './indicator-mapping.ts';

export { COUNTRY_ALIASES, normalizeCountryCode } from './country.ts';

export {
  MACRO_INDICATOR_FREQUENCIES,
  MACRO_REVISION_STATUSES,
  MACRO_SEASONAL_ADJUSTMENTS,
  type MacroCountrySnapshot,
  type MacroGlobalSnapshot,
  type MacroIndicator,
  type MacroIndicatorFrequency,
  type MacroProviderCoverage,
  type MacroRevisionStatus,
  type MacroSeasonalAdjustment,
  type MacroServiceResult,
  type MacroTimeSeries,
  type MacroTimeSeriesPoint,
} from './types.ts';

export {
  MACRO_ADAPTER_IDS,
  createMacroAdapter,
  createMacroFixtureTransport,
  createMacroAdapterContext,
  createStandardMacroAdapter,
  FixtureTransport,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
  type MacroAdapterId,
} from './adapters/index.ts';

export { createAllMacroProviders, createMacroProvider, type MacroProviderBundle } from './providers.ts';

export { MACRO_REFRESH_SCHEDULES } from './refresh-schedules.ts';

export {
  assertNoLiveNetwork,
  createMacroProviderRuntime,
  type MacroProviderRuntime,
  type MacroProviderRuntimeMode,
  type MacroProviderRuntimeOptions,
} from './runtime.ts';

export { MacroDataService, createMacroDataService } from './service.ts';

export {
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  bundleMacroObservations,
  macroIndicatorToAgentEvidence,
  macroTimeSeriesToAgentEvidence,
  toAgentEvidenceRef,
  type AgentEvidenceBundle,
  type ExternalObservationEvidenceRef,
} from './agent-evidence.ts';
