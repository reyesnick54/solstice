/**
 * HELIOS ALT13 — incremental information and signal diagnostics (types).
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  ALT13_INCREMENTAL_METRICS,
  ALT13_CORE_BASELINES,
  ALT13_FORECAST_TARGETS,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED,
  HELIOS_ALT13_SCHEMA,
  Alt13CoreBaseline,
  Alt13ForecastTarget,
  Alt13IncrementalMetric,
} from './taxonomy.ts';

export type AlternativeSignalHypothesisId = string & { readonly __brand: 'AlternativeSignalHypothesisId' };

export type AlternativeSignalHypothesis = {
  readonly hypothesisId: AlternativeSignalHypothesisId;
  readonly featureId: string;
  readonly providerIds: readonly string[];
  readonly target: Alt13ForecastTarget;
  readonly coreBaseline: Alt13CoreBaseline;
  readonly augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL';
  readonly registeredAt: UtcInstant;
  readonly economicJustification: string;
  readonly grantsExecutionAuthority: false;
};

export type IncrementalMetricReading = {
  readonly metric: Alt13IncrementalMetric;
  readonly baseline: Alt13CoreBaseline;
  readonly augmentedBaseline: 'CORE_HELIOS_PLUS_ALT_SIGNAL';
  readonly delta: number;
  readonly rawPValue: number | null;
  readonly fdrAdjustedPValue: number | null;
  readonly incrementallyInformative: boolean;
};

export type IncrementalInformationState = {
  readonly hypothesisId: AlternativeSignalHypothesisId;
  readonly target: Alt13ForecastTarget;
  readonly oosRowCount: number;
  readonly metrics: readonly IncrementalMetricReading[];
  readonly primaryTarget: boolean;
  readonly stockReturnSecondaryOnly: boolean;
  readonly grantsExecutionAuthority: false;
};

export type SignalDecayPoint = {
  readonly lagPeriods: number;
  readonly predictiveUtility: number;
};

export type SignalDecayState = {
  readonly featureId: string;
  readonly lagToUsefulnessPeriods: number | null;
  readonly halfLifePeriods: number | null;
  readonly stableHorizonPeriods: number | null;
  readonly decayCurve: readonly SignalDecayPoint[];
  readonly regimeDependent: boolean;
  readonly grantsExecutionAuthority: false;
};

export type SignalRedundancyCluster = {
  readonly clusterId: string;
  readonly memberFeatureIds: readonly string[];
  readonly latentShockLabel: string;
  readonly maxAbsCorrelation: number;
};

export type SignalRedundancyState = {
  readonly clusters: readonly SignalRedundancyCluster[];
  readonly inflationRisk: boolean;
  readonly grantsExecutionAuthority: false;
};

export type SignalStabilityState = {
  readonly featureId: string;
  readonly rollingUtilityStd: number;
  readonly signFlipRate: number;
  readonly stable: boolean;
  readonly grantsExecutionAuthority: false;
};

export type ProviderDependenceRow = {
  readonly providerId: string;
  readonly metricDeltaWhenExcluded: number;
  readonly operationalConfidenceBps: number;
};

export type ProviderDependenceState = {
  readonly featureId: string;
  readonly rows: readonly ProviderDependenceRow[];
  readonly fragileSingleProvider: boolean;
  readonly grantsExecutionAuthority: false;
};

export type AltFeatureHypothesisTrialRecord = {
  readonly trialId: string;
  readonly hypothesisId: AlternativeSignalHypothesisId;
  readonly featureId: string;
  readonly recordedAt: UtcInstant;
  readonly target: Alt13ForecastTarget;
  readonly rawPValues: readonly number[];
  readonly outcome: 'COMPLETED' | 'FAILED' | 'ABORTED';
};

export type Alt13MultipleTestingSummary = {
  readonly trialCount: number;
  readonly fdrLevel: number;
  readonly adjustedPValues: readonly number[];
  readonly rejectedHypothesisIds: readonly AlternativeSignalHypothesisId[];
  readonly evol09Schema: 'sunrey.helios.strategy-evolution.evol09.v1';
};

export type Alt13IncrementalInformationEvidence = {
  readonly schema: typeof HELIOS_ALT13_SCHEMA;
  readonly qualificationMarker:
    | typeof HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED
    | typeof HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED;
  readonly hypotheses: readonly AlternativeSignalHypothesis[];
  readonly incrementalStates: readonly IncrementalInformationState[];
  readonly decayStates: readonly SignalDecayState[];
  readonly redundancyState: SignalRedundancyState;
  readonly stabilityStates: readonly SignalStabilityState[];
  readonly providerDependence: readonly ProviderDependenceState[];
  readonly multipleTesting: Alt13MultipleTestingSummary;
  readonly blockers: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type Alt13EvaluationRow = {
  readonly periodIndex: number;
  readonly marketFeatures: Readonly<Record<string, number>>;
  readonly fundamentalsFeatures: Readonly<Record<string, number>>;
  readonly earningsFeatures: Readonly<Record<string, number>>;
  readonly valuationFeatures: Readonly<Record<string, number>>;
  readonly altFeatures: Readonly<Record<string, number>>;
  readonly targets: Readonly<Partial<Record<Alt13ForecastTarget, number>>>;
  readonly binaryTargets: Readonly<Partial<Record<Alt13ForecastTarget, boolean>>>;
  readonly regimeId: string;
};

export const ALT13_METRIC_SET = ALT13_INCREMENTAL_METRICS;
export const ALT13_BASELINE_SET = ALT13_CORE_BASELINES;
export const ALT13_TARGET_SET = ALT13_FORECAST_TARGETS;
