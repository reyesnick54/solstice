/**
 * HELIOS Multi-Asset M13 — deterministic market regime engine.
 */

export {
  MARKET_REGIME_DIMENSIONS,
  MARKET_REGIME_SCOPES,
  MARKET_REGIME_DATA_QUALITY_STATES,
  MARKET_REGIME_METHODOLOGY_VERSION,
  MARKET_REGIME_GATING_STRENGTH_BPS,
  type MarketRegimeDimension,
  type MarketRegimeScope,
  type MarketRegimeDataQualityState,
} from './taxonomy.ts';

export type {
  RegimeBarInput,
  CrossAssetReturnInput,
  CorrelationInput,
  DetectedRegime,
  MarketRegimeObservation,
  MarketRegime,
  MarketRegimeEvaluationInput,
  MarketRegimeEvaluationResult,
  RegimeTransition,
  MarketRegimeStoreSnapshot,
} from './types.ts';

export { evaluateMarketRegime, filterBarsKnowableAt } from './evaluate.ts';
export { InMemoryMarketRegimeStore } from './store.ts';
export { MarketRegimeEngine, type MarketRegimeEnginePorts } from './service.ts';
export {
  bridgeMarketRegimeToResearch,
  mapRegimeToLegacyM09Label,
  type MarketRegimeResearchView,
} from './bridge.ts';
export {
  trendingUpBars,
  trendingDownBars,
  rangeBoundBars,
  highVolatilityBars,
  lowVolatilityBars,
  liquidityStressBars,
  insufficientBars,
  staleFutureBars,
  fixtureNow,
} from './fixtures.ts';
export {
  HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED,
  HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED,
  evaluateMultiAssetM13Qualification,
  type MultiAssetM13QualificationChecks,
  type MultiAssetM13QualificationResult,
} from './qualification.ts';
