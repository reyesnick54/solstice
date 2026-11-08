import type { UtcInstant } from '@solstice/domain';

import {
  ALPHA_DECAY_SCHEMA,
  type AlphaDecayAttributionClass,
  type AlphaDemotionAction,
  type AlphaHealthState,
  type AlphaMonitoredMetric,
  type ChangeDetectorKind,
} from './taxonomy.ts';

export type AlphaMetricObservation = {
  readonly observedAt: UtcInstant;
  readonly metric: AlphaMonitoredMetric;
  /** Integer observation in metric-native units (bps where suffix says BPS, else count/score). */
  readonly value: number;
};

export type AlphaMetricBaseline = {
  readonly metric: AlphaMonitoredMetric;
  readonly mean: number;
  readonly stdDev: number;
  readonly sampleCount: number;
};

export type DetectorAlarm = {
  readonly detector: ChangeDetectorKind;
  readonly metric: AlphaMonitoredMetric;
  readonly alarmed: boolean;
  readonly score: number;
  readonly threshold: number;
  readonly observationsUsed: number;
};

export type ChangePointEvidence = {
  readonly evidenceId: string;
  readonly metric: AlphaMonitoredMetric;
  readonly detectors: readonly DetectorAlarm[];
  readonly changeDetected: boolean;
  readonly consensusDetectorCount: number;
  readonly earliestSuspectedAt: UtcInstant | null;
  readonly direction: 'NEGATIVE_DRIFT' | 'POSITIVE_DRIFT' | 'LEVEL_SHIFT' | 'UNKNOWN';
};

export type PerformanceDrift = {
  readonly metric: AlphaMonitoredMetric;
  readonly baseline: AlphaMetricBaseline;
  readonly recentMean: number;
  readonly driftBps: number;
  readonly zScoreMilli: number;
  readonly materiallyWorse: boolean;
};

export type AlphaDecayDemotionRecommendation = {
  readonly action: AlphaDemotionAction;
  readonly reason: string;
  /** Research track only — never permits increasing risk or exposure to recover losses. */
  readonly permitsRiskIncrease: false;
  readonly demotionTriggerHint:
    | 'CHAMPION_PERFORMANCE_DECAY'
    | 'CHAMPION_FEATURE_DECAY'
    | 'REGIME_DRIFT_DETECTED'
    | 'CHAMPION_COST_DETERIORATION'
    | 'DATA_QUALITY_PROBLEM'
    | null;
};

export type AlphaDecayState = {
  readonly schema: typeof ALPHA_DECAY_SCHEMA;
  readonly strategyId: string;
  readonly evaluatedAt: UtcInstant;
  readonly health: AlphaHealthState;
  readonly attribution: AlphaDecayAttributionClass;
  readonly drifts: readonly PerformanceDrift[];
  readonly changePoints: readonly ChangePointEvidence[];
  readonly demotion: AlphaDecayDemotionRecommendation;
  readonly grantsFinancialAuthority: false;
};

export type AlphaDecayMonitorInput = {
  readonly strategyId: string;
  readonly evaluatedAt: UtcInstant;
  readonly observations: readonly AlphaMetricObservation[];
  readonly baselines: readonly AlphaMetricBaseline[];
  readonly minimumObservationsPerMetric?: number;
};

export type AlphaDecayQualification = {
  readonly qualified: boolean;
  readonly marker:
    | 'HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED'
    | 'HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED';
  readonly requiredDetectorsPresent: readonly ChangeDetectorKind[];
  readonly grantsFinancialAuthority: false;
  readonly permitsRiskIncrease: false;
};
