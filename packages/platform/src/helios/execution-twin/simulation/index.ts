/**
 * HELIOS OS03 — institutional paper execution and order-book simulation.
 */

export {
  MARKET_DATA_INPUT_GRANULARITIES,
  EXECUTION_FIDELITY_LEVELS,
  BAR_EXECUTION_MODES,
  OHLC_PATH_SEQUENCES,
  SIMULATED_ORDER_SIDES,
  SIMULATED_ORDER_STATUSES,
  LIQUIDITY_ROLES,
  FILL_MODEL_VERSION,
  FEE_MODEL_VERSION,
  LATENCY_MODEL_VERSION,
  SLIPPAGE_MODEL_VERSION,
  MATCHING_ENGINE_VERSION,
  EXECUTION_MODEL_VERSION,
  SIMULATION_SCHEMA,
  EXECUTION_ORDER_TYPES,
  EXECUTION_TIME_IN_FORCE,
  type MarketDataInputGranularity,
  type ExecutionFidelityLevel,
  type BarExecutionMode,
  type OhlcPathSequence,
  type SimulatedOrderSide,
  type SimulatedOrderStatus,
  type SimulatedOrderType,
  type SimulatedTimeInForce,
  type LiquidityRole,
} from './taxonomy.ts';

export type {
  ObservationRef,
  SimulatedFillEvidence,
  SimulatedFill,
  SimulatedWorkingOrder,
  BarObservation,
  QuoteObservation,
  TradeObservation,
  Level2Snapshot,
  MarketUpdate,
  PerpetualInstrumentSpec,
  FundingEvent,
  MarginAccountSnapshot,
  LiquidationOutcome,
  SubmitOrderRequest,
  SubmitOrderResult,
  CancelOrderResult,
  ReplaceOrderRequest,
  ReplaceOrderResult,
} from './types.ts';

export { bookLevel, consumeLevel, type BookLevel } from './book-level.ts';
export {
  marketBookFromLevel2,
  marketBookFromQuote,
  bestBid,
  bestAsk,
  midPriceMinor,
  spreadMinor,
  isBookStale,
  walkBookForSide,
  availableLiquidityUnits,
  type MarketBook,
} from './market-book.ts';

export {
  DEFAULT_LATENCY_MODEL,
  latencyAssumptionLabel,
  effectiveSubmitAt,
  effectiveCancelAt,
  effectiveReplaceAt,
  type LatencyModelConfig,
} from './latency-model.ts';

export { DEFAULT_FEE_MODEL, computeFeeMinor, feeAssumptionLabel, type FeeModelConfig } from './fee-model.ts';
export {
  DEFAULT_SLIPPAGE_MODEL,
  slippageAssumptionLabel,
  applySlippageToPrice,
  type SlippageModelConfig,
} from './slippage-model.ts';

export {
  DEFAULT_FILL_MODEL,
  matchAgainstBook,
  buildFillEvidence,
  materializeFill,
  availableAtLevelAfterQueue,
  type FillModelConfig,
  type ProposedFillSlice,
} from './fill-model.ts';

export {
  matchOrderAgainstLevel2,
  matchOrderAgainstQuote,
  matchOrderAgainstTrade,
  matchOrderAgainstBar,
  type MatchingContext,
} from './matching-engine.ts';

export { computeFundingPayment, fundingEvent, type FundingAccrual } from './funding-model.ts';
export {
  marginFromFuturesMetadata,
  marginFromPerpetualSpec,
  buildMarginSnapshot,
  isUnderMaintenanceMargin,
} from './margin-model.ts';
export { evaluateLiquidation } from './liquidation-model.ts';

export { SimulatedVenue, type SimulatedVenueConfig } from './simulated-venue.ts';

export {
  OS03_FIXTURE_NOW,
  thinLevel2Snapshot,
  gapLevel2Snapshot,
  deepLevel2Snapshot,
  staleLevel2Snapshot,
  sampleQuote,
  sampleBar,
  samplePerpetualSpec,
} from './fixtures.ts';

export {
  HELIOS_OS03_EXECUTION_SIMULATION_QUALIFIED,
  HELIOS_OS03_EXECUTION_SIMULATION_BLOCKED,
  evaluateOs03ExecutionSimulationQualification,
  type Os03QualificationChecks,
  type Os03QualificationResult,
} from './qualification.ts';

export {
  SIMULATION_FIDELITY_LEVELS,
  simulationFidelityFromEngineLevel,
  barFidelityEquivalentToOrderBook,
  assertBarNotClaimedAsOrderBook,
  type SimulationFidelityLevel,
} from './fidelity.ts';

export { bookStateFromMarketBook, type BookStateSnapshot } from './book-state.ts';

export {
  HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED,
  HELIOS_NATIVE_MATCHING_ENGINE_BLOCKED,
  evaluateNative04MatchingEngineQualification,
  type Native04QualificationChecks,
  type Native04QualificationResult,
} from './native04-qualification.ts';
