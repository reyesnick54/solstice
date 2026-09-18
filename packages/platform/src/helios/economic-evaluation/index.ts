export {
  EXPERIMENT_STATES,
  EVALUATION_MODES,
  INTELLIGENCE_BASELINES,
  CHALLENGE_TRACKS,
  RUN_OUTCOMES,
  COST_LABELS,
  RESEARCH_COST_SOURCES,
  BENCHMARK_KINDS,
  MICROCAPITAL_DEFAULTS,
  EVALUATION_RULE_FLAGS,
  type ExperimentState,
  type EvaluationMode,
  type IntelligenceBaseline,
  type ChallengeTrack,
  type RunOutcome,
  type CostLabel,
  type ResearchCostSource,
  type BenchmarkKind,
} from './taxonomy.ts';
export {
  asHeliosExperimentId,
  asHeliosEvaluationRunId,
  asHeliosMicrocapitalChallengeId,
  experimentIdFor,
  evaluationRunIdFor,
  microcapitalChallengeIdFor,
  type HeliosExperimentId,
  type HeliosEvaluationRunId,
  type HeliosMicrocapitalChallengeId,
} from './ids.ts';
export type {
  EvaluationMoney,
  RiskLimitSpec,
  ExecutionAssumptionSpec,
  ExperimentSuccessCriteria,
  FrozenExperimentSpec,
  LatencyPercentiles,
  ContinuousCoverageMetrics,
  DiscoveryLatencyMetrics,
  DecisionLatencyMetrics,
  ExecutionQualityMetrics,
  NetEconomicsBreakdown,
  CapitalEfficiencyMetrics,
  ResearchCostLine,
  BenchmarkComparison,
  IntelligenceComparisonRow,
  CalibrationBin,
  NoActionEvaluation,
  HiddenCapitalFinding,
  EvaluationRunRecord,
  MicrocapitalChallengeSpec,
  TrackBEconomicActivity,
  StatisticalSummary,
  EconomicEvaluationReport,
  EvaluationRunInput,
} from './types.ts';
export {
  evaluationMoney,
  sumMoney,
  subtractMoney,
  addMoney,
  medianMinor,
  meanMinor,
  varianceMinorSquared,
} from './money.ts';
export {
  computeNetEconomics,
  principalExcludedGrowth,
} from './net-economics.ts';
export {
  detectHiddenCapital,
  rejectHiddenCapital,
} from './hidden-capital.ts';
export {
  canonicalExperimentBody,
  freezeExperiment,
  assertExperimentFrozen,
  rejectRetroactiveTargetChange,
  resumeExperiment,
  pauseExperiment,
  type DraftExperimentInput,
} from './experiment.ts';
export {
  buildMicrocapitalChallenge,
  assertRiskLimitsImmutable,
  bindChallengeToExperiment,
  challengeProgressBps,
} from './microcapital-challenge.ts';
export {
  recordEvaluationRun,
  assertRunPersists,
  listRunsForExperiment,
  listRunsForCustomer,
  validateRunForRegistry,
  findRunById,
} from './run-registry.ts';
export {
  allocateResearchCost,
  totalResearchCost,
  splitOperatingAndAllocated,
  normalizeBaselineBudget,
} from './cost-accounting.ts';
export {
  compareToBenchmark,
  buildIntelligenceComparison,
} from './baseline-comparison.ts';
export {
  buildCalibrationBins,
  calibrationDriftBps,
} from './calibration.ts';
export {
  evaluateNoActionValue,
  noActionMustNotInflateNetResult,
} from './no-action.ts';
export {
  buildContinuousCoverage,
  buildDiscoveryLatency,
  buildDecisionLatency,
  buildExecutionQuality,
  buildCapitalEfficiency,
} from './performance-metrics.ts';
export { summarizeRuns } from './statistics.ts';
export {
  buildEconomicEvaluationReport,
  type BuildReportInput,
} from './report.ts';
export {
  InMemoryHeliosEconomicEvaluationStore,
  type EconomicEvaluationStoreSnapshot,
} from './store.ts';
export {
  HeliosEconomicEvaluationService,
  type HeliosEconomicEvaluationPorts,
} from './service.ts';

export const HELIOS_H32_ECONOMIC_EVALUATION = 'HELIOS_H32_ECONOMIC_EVALUATION' as const;
