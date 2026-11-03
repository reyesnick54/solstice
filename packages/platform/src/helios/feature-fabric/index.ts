export {
  HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
  FUNDAMENTAL_FEATURE_IDS,
  type FundamentalFeatureId,
  type FundamentalFeatureValue,
  type PointInTimeFundamentalSnapshot,
} from './types.ts';

export {
  createFundamentalObservationStore,
  effectiveFactsAt,
  type FundamentalObservationStore,
} from './store.ts';

export {
  buildPointInTimeFundamentalSnapshot,
  assertNoFutureFundamentalLeak,
  parseEvaluationUtc,
} from './features.ts';

export { createHeliosFundamentalFeatureFabric, type HeliosFundamentalFeatureFabric } from './service.ts';
export { bindSecObservationsToAaf, type SecFundamentalAafBinding } from './aaf-bridge.ts';

export {
  HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED,
  HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED,
  evaluateHeliosOs10PointInTimeFundamentalsQualification,
  type HeliosOs10QualificationResult,
} from './qualification.ts';
