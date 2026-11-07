export {
  HELIOS_PROCUREMENT_DEMAND_SCHEMA,
  HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED,
  HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED,
  PROCUREMENT_DEMAND_FEATURE_IDS,
  PROCUREMENT_NORMALIZATION_DENOMINATORS,
  CONTRACT_REVENUE_CONVERSION_SCHEMA,
  type ProcurementDemandFeatureId,
  type ProcurementNormalizationDenominator,
} from './taxonomy.ts';

export type {
  GovernmentDemandState,
  GovernmentDemandFeatureSnapshot,
  NormalizedProcurementFeature,
  ContractRevenueConversionEstimate,
  ProcurementNormalizationContext,
  CompileGovernmentDemandSnapshotInput,
  HistoricalRevenueCalibrationRow,
} from './types.ts';

export {
  isProcurementObservationKnowableAt,
  filterKnowableProcurementObservations,
  assertNoFutureProcurementLeak,
} from './knowable-at.ts';

export {
  assertProcurementAttributionIntegrity,
  sumAwardCeilingForEntity,
  parentDoesNotInheritJvCeiling,
} from './attribution-guard.ts';

export { compileGovernmentDemandState } from './snapshot.ts';
export { computeGovernmentDemandFeatures } from './features.ts';
export {
  calibrateObligationToRevenueFactor,
  estimateContractRevenueFromCalibration,
} from './revenue-conversion.ts';

export {
  createProcurementIntelligenceService,
  ProcurementIntelligenceService,
  type ProcurementIntelligenceServiceOptions,
} from './service.ts';

export {
  evaluateAlt10Qualification,
  type Alt10QualificationChecks,
  type Alt10QualificationResult,
} from './qualification.ts';

export { createProcurementIntelligenceStore, type ProcurementIntelligenceStore } from './store.ts';
