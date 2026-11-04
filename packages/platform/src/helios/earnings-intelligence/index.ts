export {
  HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
  HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED,
  HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED,
  EARN_WORK_PACKAGES,
  EARNINGS_BENCHMARK_STRATEGIES,
  EARNINGS_REALITY_GATE_STATUSES,
  EARNINGS_REGIME_SLICES,
  MINIMUM_HOLDOUT_EVENTS_FOR_FORECASTING,
  MINIMUM_SAMPLE_FOR_RETURN_SIGNIFICANCE,
  EVENT_EMBARGO_DAYS,
  type EarnWorkPackageId,
  type EarningsBenchmarkStrategy,
  type EarningsRealityGateStatus,
  type EarningsRegimeSlice,
} from './taxonomy.ts';

export { trialIdFor, trialIdFromConfig, type TrialId } from './ids.ts';

export type {
  EarningsIssuerProfile,
  EarningsCalendarEvent,
  EarningsEventGraphNode,
  SurpriseTensorCell,
  EarningsForecast,
  EarningsTrialRecord,
  ForecastMetrics,
  InvestmentResearchMetrics,
  AntiOverfittingDiagnostics,
  RegimeSliceReport,
  BenchmarkComparisonRow,
  EarningsValidationReport,
  ChronologySummary,
  EarnWorkPackageRow,
  EarningsPipelineStageResult,
  EarningsPipelineResult,
} from './types.ts';

export { normalizeEarningsDomain, EARN01_DOMAIN_MODULE } from './earn01-domain.ts';
export { buildEarningsEventGraph, EARN02_EVENT_GRAPH_MODULE } from './earn02-event-graph.ts';
export { buildSurpriseTensor, EARN03_SURPRISE_TENSOR_MODULE } from './earn03-surprise-tensor.ts';
export { reviseAnalystConsensus, EARN04_ANALYST_EXPECTATIONS_MODULE } from './earn04-analyst-expectations.ts';
export { scoreTranscriptTone, EARN05_TRANSCRIPT_INTELLIGENCE_MODULE } from './earn05-transcript-intelligence.ts';
export { assessEarningsQuality, EARN06_EARNINGS_QUALITY_MODULE } from './earn06-earnings-quality.ts';
export { inferOptionsImpliedMoveBps, EARN07_OPTIONS_INTELLIGENCE_MODULE } from './earn07-options-intelligence.ts';
export { peerReadThroughSignal, EARN08_PEER_ATTENTION_PEAD_MODULE } from './earn08-peer-attention-pead.ts';
export { estimateEarningsDistribution, EARN09_PROBABILISTIC_ESTIMATOR_MODULE } from './earn09-probabilistic-estimator.ts';
export { aggregateCommitteeForecast, EARN10_AGENT_COMMITTEE_MODULE, type CommitteeVote } from './earn10-agent-committee.ts';
export {
  materializeEarningsGenome,
  EARN11_STRATEGY_GENOME_MODULE,
  type EarningsStrategyGenome,
} from './earn11-strategy-genome.ts';

export {
  createEarningsTrialRegistry,
  assertTrialRegistryAppendOnly,
  type EarningsTrialRegistry,
  type EarningsTrialRegistrySnapshot,
} from './trial-registry.ts';

export {
  computeDeflatedSharpeRatio,
  computeProbabilityOfBacktestOverfitting,
  buildAntiOverfittingDiagnostics,
} from './anti-overfitting.ts';

export {
  splitChronologicalEarnings,
  chronologySplitValid,
  type ChronologicalEarningsObservation,
  type ChronologySplit,
} from './chronology.ts';

export {
  computeForecastMetrics,
  computeInvestmentResearchMetrics,
  forecastingMetricsQualified,
} from './metrics.ts';

export {
  runEarningsBenchmark,
  compareAllBenchmarks,
  epsMaeImprovementBps,
  type LabeledEarningsOutcome,
} from './benchmarks.ts';

export { buildRegimeSliceReports, type RegimeTaggedOutcome } from './regime-slices.ts';
export { resolveEarningsRealityGate, architectureImpliesAlpha, type RealityGateInput } from './reality-gate.ts';
export { buildFixtureEarningsUniverse, FIXTURE_ISSUER } from './fixtures.ts';
export { buildEarningsValidationReport } from './validation-report.ts';
export {
  runEarningsIntelligencePipeline,
  type EarningsIntelligencePipelineInput,
  type EarningsExternalIntegrationGates,
} from './pipeline.ts';
export {
  buildEarnWorkPackageRegistry,
  earnWorkPackagesQualified,
  earnWorkPackageBlockers,
} from './work-package-registry.ts';
export {
  evaluateEarningsIntelligenceQualification,
  type EarningsIntelligenceQualificationInput,
  type EarningsIntelligenceQualificationResult,
} from './qualification.ts';
export {
  appendEarningsValidationEvidence,
  earningsValidationContentHash,
  HELIOS_EARNINGS_INTELLIGENCE_EVIDENCE_KIND,
} from './evidence.ts';
