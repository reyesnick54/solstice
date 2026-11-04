export {
  HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA,
  EARNINGS_FEATURE_IDS,
  EARNINGS_FEATURE_FORMULA_VERSION,
  type EarningsFeatureId,
} from './taxonomy.ts';

export type { EarningsFeatureValue, EarningsFeaturePlaneSnapshot } from './types.ts';

export {
  earningsObservationsToContributions,
  compileEarningsFeaturePlaneFromManifest,
} from './bridge.ts';

export * from './quality/index.ts';
