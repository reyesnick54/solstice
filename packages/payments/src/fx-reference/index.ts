export {
  FX_REFERENCE_RATE_TYPES,
  FX_REFERENCE_AUTHORITY_CLASSES,
  FX_REFERENCE_FRESHNESS,
  freezeFxReferenceRate,
  type FxReferenceRate,
  type FxReferenceRateType,
  type FxReferenceAuthorityClass,
  type FxReferenceFreshness,
  type FxReferenceRateProvenance,
  type FxReferenceObservation,
  type FxReferenceHistoryPoint,
  type FxReferenceServiceResult,
  type FxExecutionQuote,
  type SettlementFxRate,
} from './types.ts';

export { normalizeFxCurrencyCode, isValidFxCurrencyCode, assertFxCurrencyPair } from './currency.ts';

export {
  parseDecimalRateToRational,
  reduceRational,
  validateRateRational,
  invertReferenceRate,
  crossReferenceRate,
  buildProviderReferenceRate,
  ratesDisagreeBeyondTolerance,
} from './rate-math.ts';

export { type FxReferenceProvider, type FxReferenceProviderPort, type FxReferenceFetchContext } from './provider.ts';

export {
  ALL_FX_REFERENCE_ADAPTERS,
  FRANKFURTER_ADAPTER,
  CURRENCY_API_ADAPTER,
  EXCHANGERATE_DEV_ADAPTER,
  EXCHANGERATE_HOST_ADAPTER,
  ECONOMIA_AWESOME_ADAPTER,
  BANK_OF_RUSSIA_ADAPTER,
  NATIONAL_BANK_POLAND_ADAPTER,
  BLOCKED_CURRENCYAPI_ADAPTER,
  createFixtureFxReferenceAdapter,
  createFailingFxReferenceAdapter,
  createRateLimitedFxReferenceAdapter,
} from './adapters/index.ts';

export {
  FX_REFERENCE_PROVIDER_IDS,
  BLOCKED_FX_REFERENCE_PROVIDER_IDS,
  fixturePayloadForBase,
  type FxReferenceProviderId,
} from './fixtures.ts';

export { FxReferenceService, createFxReferenceService, type FxReferenceServiceOptions } from './service.ts';

export {
  fxReferenceRateToPresentationRate,
  isReferencePresentationRate,
  isExecutionRateSource,
  indicativeConversionEstimate,
  type IndicativeConversionEstimate,
} from './money-bridge.ts';

export { FX_REFERENCE_CATALOG_ENTRIES, FX_REFERENCE_BLOCKED_CATALOG_ENTRY } from './catalog-entries.ts';
