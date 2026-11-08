/**
 * HELIOS Market Data MD12 — data quality, anomaly, and microstructure engine.
 */

export {
  HELIOS_MD12_SCHEMA,
  HELIOS_MD12_AUTHORITY,
  MD12_MARKET_EVENT_KINDS,
  MD12_ANOMALY_KINDS,
  MD12_ANOMALY_CLASSIFICATIONS,
  MD12_MICROSTRUCTURE_FEATURES,
  MD12_QUALITY_BANDS,
  MD12_LIQUIDITY_REGIMES,
  MD12_DEFAULT_POLICY,
  type Md12MarketEventKind,
  type Md12AnomalyKind,
  type Md12AnomalyClassification,
  type Md12MicrostructureFeatureName,
  type Md12QualityBand,
  type Md12LiquidityRegime,
} from './taxonomy.ts';

export type {
  Md12MarketEventRef,
  Md12BookLevel,
  Md12MarketEvent,
  MarketDataAnomaly,
  Md12MicrostructureFeature,
  MicrostructureState,
  LiquidityState,
  MarketDataQualityScoreComponents,
  MarketDataQualityState,
  Md12AnomalyStoreSnapshot,
} from './types.ts';

export { createMd12AnomalyStore, md12AnomalyId, type Md12AnomalyStore } from './store.ts';
export { detectMarketDataAnomalies, type Md12DetectionContext } from './detect.ts';
export { computeMicrostructureState, computeLiquidityState } from './microstructure.ts';
export { buildMarketDataQualityState } from './quality-score.ts';
export {
  createMd12EngineState,
  processMd12MarketEvent,
  type Md12EngineState,
  type Md12ProcessResult,
} from './engine.ts';
export {
  HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_QUALIFIED,
  HELIOS_MD12_DATA_QUALITY_MICROSTRUCTURE_BLOCKED,
  evaluateMd12Qualification,
  type Md12QualificationChecks,
  type Md12QualificationResult,
} from './qualification.ts';
export {
  toStrategyLabMd12ResearchPeriodSample,
  toStrategyLabMd12QualitySnapshot,
  type StrategyLabMd12ResearchPeriodSample,
} from './strategy-lab-bridge.ts';
export {
  HELIOS_ALPHA01_MARKET_DATA_FORWARD_BRIDGE_SCHEMA,
  attestAlpha01ChronologicalMarketData,
  type Alpha01ChronologicalMarketDataAttestation,
} from '../alpha01-forward-evidence-bridge.ts';
