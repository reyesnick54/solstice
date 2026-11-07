/**
 * HELIOS ALT13 — alternative-data incremental information, signal decay, and feature discovery.
 */

export {
  HELIOS_ALT13_SCHEMA,
  HELIOS_ALT13_AUTHORITY,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
  ALT13_CORE_BASELINES,
  ALT13_FORECAST_TARGETS,
  ALT13_PRIMARY_FORECAST_TARGETS,
  ALT13_INCREMENTAL_METRICS,
  ALT13_DEMAND_PROXY_CHANNELS,
  ALT13_MIN_OOS_ROWS,
  ALT13_REDUNDANCY_CORRELATION_THRESHOLD,
  ALT13_FDR_LEVEL,
} from './taxonomy.ts';

export type {
  AlternativeSignalHypothesisId,
  AlternativeSignalHypothesis,
  IncrementalMetricReading,
  IncrementalInformationState,
  SignalDecayPoint,
  SignalDecayState,
  SignalRedundancyCluster,
  SignalRedundancyState,
  SignalStabilityState,
  ProviderDependenceRow,
  ProviderDependenceState,
  AltFeatureHypothesisTrialRecord,
  Alt13MultipleTestingSummary,
  Alt13IncrementalInformationEvidence,
  Alt13EvaluationRow,
} from './types.ts';
export type { Alt13CoreBaseline, Alt13ForecastTarget, Alt13IncrementalMetric, Alt13DemandProxyChannel } from './taxonomy.ts';

export {
  computeMae,
  computeLogLoss,
  computeBrier,
  partialCorrelation,
  pearsonCorrelation,
  conditionalMutualInformationProxy,
  approximateIncrementalPValue,
} from './metrics.ts';

export {
  evaluateOrthogonalizedResidualPrediction,
  orthogonalPartialCorrelationForAltFeature,
  nuisanceControlsFromRow,
  type OrthogonalResidualPrediction,
} from './orthogonal.ts';

export { detectDemandRedundancy, type DemandProxySeries } from './redundancy.ts';
export { buildSignalDecayState } from './decay.ts';
export { buildSignalStabilityState } from './stability.ts';
export { evaluateProviderDependence } from './provider-dependence.ts';

export {
  registerAlternativeSignalHypothesis,
  evaluateIncrementalInformationState,
  alternativeSignalHypothesisIdFrom,
} from './evaluation.ts';

export {
  createAltFeatureHypothesisTrialRegistry,
  summarizeAltTrialsWithEvol09,
  assertEveryHypothesisTrialRecorded,
  type AltFeatureTrialRegistry,
} from './trial-registry.ts';

export { seedAlt13ReferencePanel, ALT13_REFERENCE_REGISTERED_AT } from './fixtures.ts';
export { buildAlt13IncrementalInformationEvidence } from './evidence.ts';
export {
  evaluateAlt13IncrementalInformationQualification,
  type Alt13QualificationResult,
} from './qualification.ts';
