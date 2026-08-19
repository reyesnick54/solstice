export {
  IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION,
  LEGAL_OWNERSHIP_INFERRED,
  QUALITY_CHANGES_PHYSICAL_QUANTITY,
  REFERENCE_PRICE_CREATES_OUTPUT,
  WATER_AVAILABILITY_EQUALS_PRODUCTION,
  WATER_CERTIFICATION_AUTHORIZES_MOONREY,
  WATER_FACT_AUTO_MINTS,
  WATER_FACT_TYPES,
  WATER_FABRIC_POLICY_VERSION,
  WATER_FABRIC_SCHEMA_VERSION,
  WATER_INDEPENDENCE_CLASSES,
  WATER_MEASUREMENT_SEMANTICS,
  WATER_PRODUCTION_ACTIVE,
  WATER_PRODUCTION_SEMANTICS,
  WATER_REAL_PROVIDER_CONTACTED,
  WATER_REJECTION_CODES,
  WATER_SOURCE_CLASSES,
  defaultWaterFabricPolicy,
  irrigationConsumptionEqualsWaterProduction,
  isWaterFactType,
  isWaterMeasurementSemantics,
  isWaterProductionSemantics,
  isWaterSourceClass,
  waterAvailabilityEqualsProduction,
  waterFactCannotAutoMint,
  waterProductionIsActive,
  waterRealProviderContacted,
} from './types.ts';
export type {
  NormalizedWaterObservation,
  WaterFabricPolicy,
  WaterFactType,
  WaterIndependenceClass,
  WaterLineageLink,
  WaterMeasurementSemantics,
  WaterProductionEvidenceRecord,
  WaterRefusal,
  WaterRejectionCode,
  WaterSourceClass,
  WaterSourceRecord,
} from './types.ts';
export {
  WATER_SOURCE_PROFILES,
  classifyWaterIndependence,
  profileFor as waterProfileFor,
  scoreWaterQuality,
} from './profiles.ts';
export { WATER_FEED_SCHEMAS, WATER_SCHEMA_IDS, waterFeedSchema, waterSchemaDrift } from './schemas.ts';
export { deriveWaterInterval, litersPerCubicMeter, normalizeWaterVolume } from './meters.ts';
export {
  availabilityCannotCreateOutput,
  availabilityIsNotProduction,
  waterAvailabilityEqualsProduction as availabilityFlag,
} from './availability.ts';
export {
  clusterWaterProductionObservations,
  identityRefsOf as waterIdentityRefsOf,
  refuseEquatedSemantics,
} from './production.ts';
export {
  defaultWaterQualityEvidence,
  qualityDoesNotChangePhysicalQuantity as waterQualityDoesNotChangePhysicalQuantity,
  qualityIsNotVolume,
  qualityLeavesQuantityUnchanged as waterQualityLeavesQuantityUnchanged,
} from './quality.ts';
export {
  evaluateWaterRights,
  inferLegalOwnerFromOperator as inferWaterLegalOwnerFromOperator,
  legalOwnershipInferred as waterLegalOwnershipInferred,
  operatorIsNotLegalOwner as waterOperatorIsNotLegalOwner,
  separatePartyRoles as separateWaterPartyRoles,
} from './rights.ts';
export {
  evaluateWaterClaimPath,
  identifyWaterProductionEvents,
  ingestWaterRecord,
  ingestWaterRecords,
  irrigationConsumptionEqualsWaterProduction as irrigationEqualsProductionFlag,
  linkWaterProductionToIrrigation,
  referencePriceCreatesOutput as waterReferencePriceCreatesOutput,
} from './adapter.ts';
export type { WaterIngestResult } from './adapter.ts';
export {
  WATER_ADVERSARIAL_SCENARIOS,
  WATER_SANDBOX_FEEDS,
  certifyWaterSandbox,
  evaluateWaterAdversary,
  waterCertificationCannotAuthorizeMoonRey,
  waterSandboxSchema,
  waterSandboxSubject,
} from './certification.ts';
export type { WaterAdversarialScenario, WaterSandboxFeed } from './certification.ts';
export {
  WATER_FIXTURE_NOW,
  cumulativeWaterPair,
  desalinationRecord,
  irrigationConsumptionRecord,
  literProductionRecord,
  reservoirAvailabilityRecord,
  simulationWaterPolicy,
  treatmentMeterRecord,
  waterRecord,
  wellRecord,
} from './fixtures.ts';
export { mapWaterObservationToEconomicAsset, projectWaterMetadata } from './ear.ts';
export { demonstrateWaterTreatmentProduction } from './demo.ts';
