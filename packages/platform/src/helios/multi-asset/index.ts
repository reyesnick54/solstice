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
export { evaluateMarketState as evaluateMultiAssetMarketState } from './evaluate.ts';
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
export {
  HELIOS_MULTI_ASSET_M03,
  MARKET_STATES,
  MARKET_CALENDAR_ROLL_STATES,
  SESSION_MODES,
  SETTLEMENT_TYPES,
  INSTRUMENT_KINDS,
  VENUE_SIGNAL_KINDS,
  TRADABILITY_OUTCOMES,
  MARKET_CALENDAR_REASON_CODES,
  type MarketState as MarketCalendarState,
  type MarketCalendarRollState,
  type SessionMode,
  type SettlementType,
  type InstrumentKind,
  type VenueSignalKind,
  type TradabilityOutcome,
  type MarketCalendarReasonCode,
} from './market-calendar/taxonomy.ts';
export type {
  LocalTimeOfDay,
  LocalDateKey,
  SessionWindow,
  MaintenanceWindow,
  MarketHoliday,
  MarketCalendarDefinition,
  VenueSignal,
  MarketSessionSnapshot,
  FuturesContractDefinition,
  FuturesContractSnapshot,
  ContinuousSeriesDefinition,
  InstrumentMarketBinding,
  TradabilityAssessment,
  MarketCalendarRegistry,
} from './market-calendar/types.ts';
export {
  localDateTimeParts,
  localDateKey,
  localTimeMinutes,
  timeOfDayToMinutes,
  isWithinWindow,
  daysBetween,
  offsetLabel,
  type LocalDateTimeParts,
} from './market-calendar/timezone.ts';
export { resolveMarketSession, marketStatePermitsExecution } from './market-calendar/calendar.ts';
export {
  evaluateMarketCalendarContract,
  deriveMarketCalendarRollState,
  resolveMarketCalendarFrontContract,
  resolveMarketCalendarNextContract,
} from './market-calendar/contract-lifecycle.ts';
export {
  isContinuousResearchSeries,
  resolveContinuousSeriesContract,
  continuousSeriesBlocksExecution,
} from './market-calendar/continuous-series.ts';
export {
  NYSE_EQUITY_CALENDAR,
  CRYPTO_24_7_CALENDAR,
  CME_CL_FUTURES_CALENDAR,
  FX_WEEKDAY_CALENDAR,
  WTI_CONTRACTS,
  GOLD_CONTRACTS,
  CONTINUOUS_SERIES,
  DEFAULT_HELIOS_MARKET_CALENDARS,
} from './market-calendar/fixtures.ts';
export { createMarketCalendarRegistry } from './market-calendar/registry.ts';
export {
  mapMarketStateToVenueSession,
  assessInstrumentTradability,
  createMarketOpenValidator,
} from './market-calendar/tradability.ts';
export { createMarketAwareOrderValidation } from './market-calendar/order-validation-bridge.ts';
export {
  HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED,
  HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_BLOCKED,
  evaluateMultiAssetM03Qualification,
  type MultiAssetM03QualificationChecks,
  type MultiAssetM03QualificationResult,
} from './market-calendar/qualification.ts';
export {
  HELIOS_MULTI_ASSET_BAR_INTERVALS,
  HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS,
  HELIOS_M09_STRATEGY_FAMILY,
  type HeliosMultiAssetBarInterval,
  type HeliosMultiAssetIndexInstrument,
} from './taxonomy.ts';
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
export * from './correlation/index.ts';
export * from './factor-exposure/index.ts';
