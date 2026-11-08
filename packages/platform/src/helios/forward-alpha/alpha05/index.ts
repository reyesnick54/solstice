export {
  ALPHA05_RULE_FLAGS,
  ALPHA_DECOMPOSITION_BUCKETS,
  FORWARD_BENCHMARK_KINDS,
  HELIOS_ALPHA05_AUTHORITY,
  HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED,
  HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED,
  HELIOS_ALPHA05_SCHEMA,
  NON_ALPHA_DECOMPOSITION_BUCKETS,
  SKILL_ALPHA_BUCKETS,
  type Alpha05QualificationMarker,
  type AlphaDecompositionBucket,
  type ForwardBenchmarkKind,
  type NonAlphaDecompositionBucket,
  type SkillAlphaBucket,
} from './taxonomy.ts';

export type {
  AlphaAttribution,
  AlphaDecomposition,
  AlphaDecompositionLine,
  BenchmarkComparison,
  BenchmarkPortfolio,
  BenchmarkPriceObservation,
  ForwardBenchmark,
  ReturnAttributionMetrics,
} from './types.ts';

export {
  sealForwardBenchmark,
  validateForwardBenchmarkSelectionTiming,
  type ForwardBenchmarkSealFailure,
  type ForwardBenchmarkSealResult,
  type SealForwardBenchmarkInput,
} from './forward-benchmark.ts';

export { buildBenchmarkPortfolio, type BuildBenchmarkPortfolioInput } from './benchmark-portfolio.ts';

export { buildBenchmarkComparison, type BuildBenchmarkComparisonInput } from './benchmark-comparison.ts';

export { buildAlphaAttribution, type BuildAlphaAttributionInput } from './alpha-attribution.ts';

export {
  buildAlphaDecomposition,
  validateAlphaDecompositionLines,
  type AlphaDecompositionInput,
} from './alpha-decomposition.ts';

export {
  evaluateAlpha05BenchmarkAttributionQualification,
  type Alpha05BenchmarkAttributionQualificationInput,
  type Alpha05BenchmarkAttributionQualificationResult,
} from './qualification.ts';

export {
  activeReturnRatio,
  alignActivePeriodReturns,
  informationRatio,
  periodReturnsFromEquity,
  sumRatioUnits,
  totalReturnRatio,
  trackingErrorFromActiveSeries,
} from './numeric.ts';
