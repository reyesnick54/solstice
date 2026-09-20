export * from './types.ts';
export * from './futures/index.ts';
export * from './energy/wti/index.ts';
export { generateM05M08CoverageReport, type M05M08CoverageReport, type AssetClassCoverage } from './data-coverage/m05-m08-report.ts';
export * from './market-calendar/index.ts';

/**
 * HELIOS Multi-Asset Expansion M04 — canonical market state and tradability engine.
 */

export {
  TRADABILITY_STATES,
  MARKET_SESSION_STATES,
  MARKET_FRESHNESS_STATES,
  MARKET_DATA_QUALITY_STATES,
  MARKET_DATA_QUALITY_DIMENSIONS,
  MARKET_VOLATILITY_STATES,
  MARKET_LIQUIDITY_STATES,
  MARKET_ENTITLEMENT_STATES,
  MARKET_PROVIDER_HEALTH_STATES,
  MARKET_EXECUTION_CAPABILITY_STATES,
  MARKET_CONFIDENCE_BANDS,
  FUTURES_ROLL_STATES,
  BAR_TIMEFRAMES,
  RESEARCH_CONSUMER_SYSTEMS,
  TRADABILITY_REASON_CODES,
  HELIOS_MULTI_ASSET_BAR_INTERVALS,
  HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS,
  HELIOS_M09_STRATEGY_FAMILY,
  type TradabilityState,
  type MarketSessionState,
  type MarketFreshnessState,
  type MarketDataQualityState,
  type MarketDataQualityDimension,
  type MarketVolatilityState,
  type MarketLiquidityState,
  type MarketEntitlementState,
  type MarketProviderHealthState,
  type MarketExecutionCapabilityState,
  type MarketConfidenceBand,
  type FuturesRollState,
  type BarTimeframe,
  type ResearchConsumerSystem,
  type TradabilityReasonCode,
  type HeliosMultiAssetBarInterval,
  type HeliosMultiAssetIndexInstrument,
} from './taxonomy.ts';

export type {
  MultiAssetInstrumentRecord,
  MultiAssetInstrumentMode,
  MultiAssetVenueRecord,
} from './m01/types.ts';
export { MULTI_ASSET_INSTRUMENT_MODES } from './m01/types.ts';

export type {
  MultiAssetPriceQuote,
  MultiAssetQuoteObservation,
  MultiAssetBarObservation,
  MultiAssetObservationBundle,
} from './m02/types.ts';

export type { MultiAssetSessionContractRecord } from './m03/types.ts';

export type {
  MarketState,
  MarketStateEvidenceRef,
  MarketDataQualityAssessment,
  MarketCapabilityFlags,
  MarketTradabilityDecision,
  MarketStateEvaluationInput,
  MarketStateEvaluationResult,
} from './market-state-types.ts';

export { assessMarketDataQuality, computeSpreadBps, EXTREME_SPREAD_BPS } from './data-quality.ts';
export { evaluateTradability } from './tradability.ts';
export { evaluateMarketState } from './evaluate.ts';
export {
  bridgeMarketStateToResearch,
  bridgeMarketStateToAllResearch,
  DEFAULT_ADMISSION,
  type MarketStateResearchView,
  type MarketStateBridgeAdmissionPolicy,
} from './bridge.ts';
export {
  HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED,
  HELIOS_MULTI_ASSET_M04_MARKET_STATE_BLOCKED,
  evaluateMultiAssetM04Qualification,
  type MultiAssetM04QualificationChecks,
  type MultiAssetM04QualificationResult,
} from './qualification.ts';
export {
  buildHeliosCryptoSpotM04MarketState,
  type CryptoSpotM04BridgeBar,
  type CryptoSpotM04BridgeInput,
  type CryptoSpotM04BridgeQuote,
  type CryptoSpotM04BridgeSession,
  type HeliosCryptoSpotM04MarketState,
} from './crypto-spot-bridge.ts';

export type {
  HeliosBar15mObservation,
  HeliosMultiAssetBarStorePort,
  HeliosMultiAssetBarStoreSnapshot,
} from './index-bars.ts';
export { InMemoryHeliosMultiAssetBarStore } from './bar-store.ts';
