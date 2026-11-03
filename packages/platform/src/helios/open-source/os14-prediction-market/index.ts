/**
 * HELIOS Open-Source Integration OS14 — prediction-market microstructure research.
 */

export {
  HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
  HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
  HELIOS_OS14_FEATURE_FABRIC_SCHEMA,
  PREDICTION_OUTCOME_SIDES,
  PREDICTION_MARKET_CATEGORIES,
  PREDICTION_MARKET_RESOLUTION_STATES,
  PREDICTION_OBSERVATION_KINDS,
  RESEARCH_SIGNAL_KINDS,
  CROSS_OUTCOME_CONSISTENCY_CODES,
  HELIOS_OS14,
  type PredictionOutcomeSide,
  type PredictionMarketCategory,
  type PredictionMarketResolutionState,
  type PredictionObservationKind,
  type ResearchSignalKind,
  type CrossOutcomeConsistencyCode,
} from './taxonomy.ts';

export {
  OS14_UPSTREAM_REPOSITORY,
  OS14_UPSTREAM_REFERENCE_SHA,
  OS14_UPSTREAM_LICENSE,
  OS14_UPSTREAM_PORTED_MODULES,
} from './upstream.ts';

export {
  PROBABILITY_PPM_SCALE,
  USDC_MINOR_SCALE,
  assertProbabilityPpm,
  midImpliedMarketProbabilityPpm,
  spreadPpm,
  researchEdgeVsImpliedMarketPpm,
  feeAdjustedResearchEdgePpm,
  bookImbalancePpm,
} from './probability.ts';

export type {
  PredictionMarketResolutionMetadata,
  PredictionMarketInstrument,
  PredictionOutcome,
  PredictionBookLevel,
  PredictionOrderBookSide,
  PredictionOrderBook,
  PredictionMicrostructureMetrics,
  PredictionMarketProvenance,
  PredictionMarketObservation,
  PredictionMarketState,
  ProbabilityEdgeObservation,
  PredictionMarketFeatureSnapshot,
  SealedPredictionMarketObservation,
  IngestPredictionMarketObservationInput,
  IngestPredictionMarketObservationResult,
  PredictionMarketStoreSnapshot,
} from './types.ts';

export {
  normalizeBookSide,
  buildPredictionOrderBook,
  assessCrossOutcomeConsistency,
  computeMicrostructureMetrics,
  type RawBookLevel,
} from './order-book.ts';

export {
  canonicalPredictionMarketInstrumentId,
  outcomeIdFor,
  resolvePredictionMarketEntity,
  buildInstrumentMetadata,
  type PredictionMarketEntityBinding,
} from './entity-resolution.ts';

export {
  demoPredictionMarkets,
  demoPredictionMarketInstrument,
  demoPredictionOrderBook,
  demoPrimaryMarketFixture,
  OS14_FIXTURE_VENUE_ID,
  OS14_FIXTURE_NOW,
} from './fixtures.ts';

export { buildPredictionMarketFeatureSnapshot } from './features.ts';

export {
  DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG,
  researchProbEdgeSignal,
  researchImbalanceSignal,
  researchLiquiditySignal,
  buildProbabilityEdgeObservation,
  evaluateResearchSignals,
  type Os14ResearchSignalConfig,
  type ResearchSignalAnnotation,
} from './research-signals.ts';

export {
  createPredictionMarketResearchStore,
  type PredictionMarketResearchStore,
} from './store.ts';

export {
  PredictionMarketResearchFabric,
  createPredictionMarketResearchFabric,
  type PredictionMarketResearchFabricOptions,
} from './fabric.ts';

export {
  sealOs14PredictionMarketObservation,
  sealOs14ProbabilityEdgeObservation,
  sealOs14FeatureSnapshot,
} from './evidence.ts';

export {
  HELIOS_OS14_STRATEGY_LAB_BRIDGE_SCHEMA,
  toStrategyLabOs14MicrostructureInput,
  type StrategyLabOs14MicrostructureInput,
} from './strategy-research-bridge.ts';

export {
  HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED,
  HELIOS_OS14_PREDICTION_MARKET_RESEARCH_BLOCKED,
  evaluateOs14PredictionMarketQualification,
  type Os14PredictionMarketQualificationChecks,
  type Os14PredictionMarketQualificationResult,
} from './qualification.ts';
