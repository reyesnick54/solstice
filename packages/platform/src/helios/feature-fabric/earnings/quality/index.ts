export {
  HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA,
  EARN06_QUALITY_FEATURE_IDS,
  EARN06_FORENSIC_SIGNAL_CLASSES,
  EARN06_COMPARISON_BASES,
  EARN06_FORMULA_VERSIONS,
  FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME,
  type Earn06QualityFeatureId,
  type Earn06ForensicSignalClass,
  type Earn06ComparisonBasis,
} from './taxonomy.ts';

export type {
  Earn06FeatureQuality,
  Earn06QuarterFinancials,
  Earn06ManagementGuidance,
  Earn06ComputedFeature,
  Earn06ScorecardInterpretation,
  EarningsQualityScorecardDimension,
  EarningsQualityScorecard,
  ForensicHypothesis,
  ForensicChangeDetectorResult,
  Earn06QualityFeaturePlane,
  ForensicAccountingResearchChallenge,
  ForensicAccountingResearchBrief,
  Earn06QuarterHistory,
} from './types.ts';

export { EARN06_SCORECARD_DIMENSION_LABELS } from './types.ts';
export { growthBps, ratioBps, marginBps } from './math.ts';
export {
  computeEarn06QualityFeatures,
  buildQuarterHistoryAt,
  filterKnowableQuarter,
} from './features.ts';
export { buildEarningsQualityScorecard } from './scorecard.ts';
export { detectForensicAccountingChanges } from './forensic-detector.ts';
export {
  runForensicAccountingResearchAgent,
  type ForensicAccountingResearchAgentInput,
} from './forensic-accounting-research-agent.ts';
export {
  PointInTimeEarningsQualityFabric,
  createPointInTimeEarningsQualityFabric,
  type PointInTimeEarningsQualityFabricOptions,
} from './fabric.ts';
export {
  HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED,
  HELIOS_EARN06_EARNINGS_QUALITY_BLOCKED,
  evaluateEarn06Qualification,
  type Earn06QualificationChecks,
  type Earn06QualificationResult,
} from './qualification.ts';
export {
  EARN06_DEMO_ENTITY_ID,
  earn06ReceivablesDivergenceScenario,
  earn06ManagementGuidanceFixture,
} from './fixtures.ts';
