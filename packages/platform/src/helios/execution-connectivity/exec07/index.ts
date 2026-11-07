/**
 * HELIOS EXEC07 — transaction cost analysis and execution quality intelligence.
 */

export {
  HELIOS_EXEC07_TCA_SCHEMA,
  EXECUTION_BENCHMARK_KINDS,
  EXECUTION_ALGORITHM_KINDS,
  EXEC07_EVIDENCE_KINDS,
  HELIOS_EXEC07_TCA_QUALIFIED,
  HELIOS_EXEC07_TCA_BLOCKED,
  EXEC07_RULE_FLAGS,
  type ExecutionBenchmarkKind,
  type ExecutionAlgorithmKind,
  type Exec07EvidenceKind,
} from './taxonomy.ts';

export type {
  ExecutionBenchmark,
  ExecutionOperationalMetrics,
  TransactionCostAnalysis,
  ExecutionQualityReport,
  VenueExecutionProfile,
  AlgorithmExecutionProfile,
  StrategyExecutionAlphaDecomposition,
  Exec07RouterLearningHint,
  Exec07ExecutionPolicyNicheEvidence,
} from './types.ts';

export {
  buildExecutionBenchmarks,
  pickPrimaryBenchmark,
  benchmarkConstructionComplete,
  type ExecutionBenchmarkPriceInput,
} from './benchmarks.ts';

export {
  computeExec07TransactionCostAnalysis,
  aggregateCostBps,
  type Exec07TransactionCostInput,
} from './analysis.ts';

export {
  buildExecutionQualityReport,
  validateExecutionQualityReport,
} from './quality-report.ts';

export { buildVenueExecutionProfile, buildAlgorithmExecutionProfile } from './profiles.ts';

export {
  decomposeStrategyAndExecutionAttribution,
  strategyCreditAllowed,
  crossCheckSlippage,
  type AlphaDecompositionInput,
} from './alpha-decomposition.ts';

export {
  buildExec05RouterLearningHints,
  buildEvol13ExecutionPolicyNicheEvidence,
  summarizeVenueForRouter,
} from './learning-bridge.ts';

export {
  evaluateExec07TcaQualification,
  type Exec07TcaQualificationChecks,
  type Exec07TcaQualificationResult,
} from './qualification.ts';

export {
  EXEC07_FIXTURE_AS_OF,
  EXEC07_FIXTURE_ARRIVAL,
  EXEC07_FIXTURE_DECISION,
  exec07FixtureBenchmarkPrices,
  exec07IncompleteBenchmarkPrices,
} from './fixtures.ts';
