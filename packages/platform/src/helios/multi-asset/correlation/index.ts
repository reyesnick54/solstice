/**
 * HELIOS Multi-Asset M17 — Dynamic Cross-Asset Correlation Engine.
 */

export {
  CORRELATION_METHODOLOGIES,
  CORRELATION_WINDOW_HORIZONS,
  CORRELATION_RELATIONSHIP_STATES,
  CORRELATION_DATA_QUALITY_BANDS,
  CORRELATION_CHANGE_KINDS,
  CORRELATION_BPS_SCALE,
  ELEVATED_CORRELATION_THRESHOLD_BPS,
  CLUSTER_CORRELATION_THRESHOLD_BPS,
  CORRELATION_BREAKDOWN_DELTA_BPS,
  type CorrelationMethodology,
  type CorrelationWindowHorizon,
  type CorrelationRelationshipState,
  type CorrelationDataQualityBand,
  type CorrelationChangeKind,
} from './taxonomy.ts';

export {
  HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA,
  createCorrelationContextInput,
  type CorrelationContextInput,
  type CorrelationPairExposure,
  type CorrelationBarObservation,
  type CorrelationWindowConfig,
  type CorrelationSourceBarRef,
  type CorrelationArtifact,
  type CorrelationMatrixCell,
  type CorrelationMatrix,
  type CorrelationCluster,
  type CorrelationChangeEvent,
  type PortfolioExposurePosition,
  type PortfolioCorrelationLookup,
  type CorrelationEngineSnapshot,
} from './types.ts';

export {
  resolveCorrelationWindowConfig,
  lookbackForHorizon,
  mergeCorrelationWindowConfig,
} from './windows.ts';

export {
  alignBarPairs,
  pearsonCorrelationBps,
  barsKnowableAsOf,
  tailBars,
  latestKnowableMs,
  type AlignedReturnPair,
} from './compute.ts';

export {
  assessDataQuality,
  classifyRelationshipState,
  isMaterialCorrelationIncrease,
} from './detection.ts';

export {
  InMemoryCorrelationEngineStore,
  type CorrelationEngineStorePort,
} from './store.ts';

export {
  DynamicCrossAssetCorrelationEngine,
  type DynamicCrossAssetCorrelationEngineOptions,
  type InstrumentMetadata,
} from './engine.ts';

export { queryPortfolioCorrelation } from './portfolio-query.ts';

export {
  publishCorrelationArtifactToOpportunityGraph,
  publishCorrelationChangeToOpportunityGraph,
} from './opportunity-graph-bridge.ts';

export {
  HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED,
  HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_BLOCKED,
  evaluateMultiAssetM17Qualification,
  type MultiAssetM17QualificationChecks,
  type MultiAssetM17QualificationResult,
} from './qualification.ts';

export {
  M17_SPY,
  M17_QQQ,
  M17_BTC,
  M17_ETH,
  M17_GLD,
  M17_USO,
  M17_EURUSD,
  M17_INSTRUMENT_METADATA,
  M17_DEFAULT_AS_OF,
  syntheticHighCorrelationSpyQqqSeries,
  syntheticUnrelatedPairSeries,
  syntheticNegativeCorrelationSeries,
  syntheticChangingCorrelationSeries,
  syntheticInsufficientHistorySeries,
  syntheticStaleObservationSeries,
  syntheticStaleAsOf,
  syntheticFutureLeakBar,
} from './fixtures.ts';
