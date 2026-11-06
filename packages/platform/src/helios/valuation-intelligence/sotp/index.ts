export {
  VAL09_SOTP_SCHEMA,
  VAL09_SOTP_MODULE,
  HELIOS_VAL09_SOTP_QUALIFIED,
  HELIOS_VAL09_SOTP_BLOCKED,
  SEGMENT_VALUATION_METHODS,
  SEGMENT_LIFECYCLE_EVENTS,
  CORPORATE_ADJUSTMENT_KINDS,
  INTERSEGMENT_FLOW_KINDS,
  type SegmentValuationMethod,
  type SegmentLifecycleEventKind,
  type CorporateAdjustmentKind,
  type IntersegmentFlowKind,
} from './taxonomy.ts';

export type {
  BusinessSegment,
  SegmentEconomicProfile,
  SegmentForecast,
  SegmentValuation,
  SegmentValueDistribution,
  CorporateAdjustment,
  SotpValuation,
  SotpBridge,
  SotpIntrinsicValueDistribution,
  SegmentContributionMap,
  SegmentValueConcentration,
  CorporateAdjustmentBridge,
  ObservedConglomerateDiscountState,
  IntersegmentFlow,
  SegmentIdentityBinding,
  SecSegmentObservationSource,
  SegmentValuationSpec,
  RunSotpValuationInput,
} from './types.ts';

export {
  evaluateVal09SotpQualification,
  type Val09SotpQualificationChecks,
  type Val09SotpQualificationResult,
} from './qualification.ts';

export { runSotpValuationEngine } from './engine.ts';
export { createHeliosVal09SotpService, type HeliosVal09SotpService } from './service.ts';

export {
  VAL09_SEC_SEGMENT_BRIDGE_VERSION,
  bindSecSegmentObservationSource,
  countDistinctReportingSegmentsAtEvaluation,
} from './sec-segment-bridge.ts';

export {
  filterKnowableSegmentObservations,
  bindSegmentIdentities,
  segmentProfilesFromObservations,
  resolveStableKeyAtEvaluation,
} from './segment-identity.ts';

export { reconcileIntersegmentFlows, perSegmentIntersegmentAdjustment } from './intersegment.ts';
export { buildCorporateAdjustmentBridge } from './corporate-bridge.ts';
export {
  computeObservedConglomerateDiscountState,
  emptyObservedConglomerateDiscountState,
} from './conglomerate-discount.ts';
export { buildSegmentContributionMap, computeSegmentValueConcentration } from './contribution.ts';
export { valueSegment } from './segment-valuation.ts';

export {
  VAL09_FIXTURE_AS_OF,
  VAL09_FIXTURE_ENTITY_ID,
  val09FixtureSegmentObservations,
  val09FixtureSegmentSpecs,
  fixtureSotpValuationInput,
} from './fixtures.ts';
