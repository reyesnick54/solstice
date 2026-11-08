export {
  ALPHA_DECAY_SCHEMA,
  ALPHA_HEALTH_STATES,
  ALPHA_MONITORED_METRICS,
  ALPHA_DECAY_ATTRIBUTION_CLASSES,
  CHANGE_DETECTOR_KINDS,
  REQUIRED_CHANGE_DETECTORS,
  ALPHA_DEMOTION_ACTIONS,
  HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED,
  HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED,
  type AlphaHealthState,
  type AlphaMonitoredMetric,
  type AlphaDecayAttributionClass,
  type ChangeDetectorKind,
  type RequiredChangeDetectorKind,
  type AlphaDemotionAction,
} from './taxonomy.ts';

export type {
  AlphaMetricObservation,
  AlphaMetricBaseline,
  DetectorAlarm,
  ChangePointEvidence,
  PerformanceDrift,
  AlphaDecayDemotionRecommendation,
  AlphaDecayState,
  AlphaDecayMonitorInput,
  AlphaDecayQualification,
} from './types.ts';

export { AlphaDecayMonitor } from './engine.ts';
export { evaluateAlpha11Qualification } from './qualification.ts';
export { attributeAlphaDecay } from './attribution.ts';
export { buildChangePointEvidence } from './change-points.ts';
export { recommendAlphaDemotion } from './demotion-policy.ts';
export {
  alpha11AutomaticDegradationEligible,
  alpha11ToStrategyLabDemotionTrigger,
  alpha11PreferAlpha23FailSafeKill,
} from './strategy-lab-bridge.ts';
export * from './detectors/index.ts';
