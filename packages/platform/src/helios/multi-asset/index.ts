/**
 * HELIOS Multi-Asset Expansion — shared module exports (M04 market state, M08 energy, futures).
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

export * from './types.ts';
export * from './futures/index.ts';
export * from './energy/wti/index.ts';
export { generateM05M08CoverageReport, type M05M08CoverageReport, type AssetClassCoverage } from './data-coverage/m05-m08-report.ts';
