export {
  CAPACITY_CANNOT_AUTOMATICALLY_PRODUCE_GPUV,
  CAPACITY_EQUALS_REALIZED_USE,
  LISTING_EQUALS_PRODUCTIVE_USE,
  PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE,
  REAL_ESTATE_CERTIFICATION_AUTHORIZES_MOONREY,
  REAL_ESTATE_FACT_AUTO_MINTS,
  REAL_ESTATE_FACT_TYPES,
  REAL_ESTATE_FABRIC_POLICY_VERSION,
  REAL_ESTATE_FABRIC_SCHEMA_VERSION,
  REAL_ESTATE_INDEPENDENCE_CLASSES,
  REAL_ESTATE_PARTY_ROLES,
  REAL_ESTATE_PRODUCTION_ACTIVE,
  REAL_ESTATE_REAL_PROVIDER_CONTACTED,
  REAL_ESTATE_REJECTION_CODES,
  REAL_ESTATE_SOURCE_CLASSES,
  REAL_ESTATE_USAGE_STATES,
  REALIZED_USAGE_STATES,
  VACANCY_EQUALS_PRODUCTIVE_USE,
  capacityCannotAutomaticallyProduceGpuv,
  capacityEqualsRealizedUse,
  certificationCannotAuthorizeMoonRey,
  defaultRealEstateFabricPolicy,
  isRealEstateFactType,
  isRealEstateSourceClass,
  isRealEstateUsageState,
  isRealizedUsageState,
  propertyOwnershipEqualsProductiveUse,
  realEstateFactCannotAutoMint,
  realEstateProductionIsActive,
  realEstateRealProviderContacted,
  vacancyEqualsProductiveUse,
} from './types.ts';
export type {
  NormalizedRealEstateObservation,
  RealEstateEvidenceRecord,
  RealEstateFabricPolicy,
  RealEstateFactType,
  RealEstateIdentityRefs,
  RealEstateIndependenceClass,
  RealEstateParty,
  RealEstatePartyRole,
  RealEstateRefusal,
  RealEstateRejectionCode,
  RealEstateRightsReference,
  RealEstateSourceClass,
  RealEstateSourceRecord,
  RealEstateUsageState,
  UtilizationEvidence,
} from './types.ts';
export { REAL_ESTATE_SOURCE_PROFILES, classifyRealEstateIndependence, profileFor as realEstateProfileFor } from './profiles.ts';
export { REAL_ESTATE_FEED_SCHEMAS, REAL_ESTATE_SCHEMA_IDS, defaultFactFor, realEstateFeedSchema, realEstateSchemaDrift } from './schemas.ts';
export { deriveAreaTime, parseIntegerMantissa, refuseM2AsUsageWithoutDuration } from './usage.ts';
export {
  capacityCannotBecomeUsage,
  listingEqualsProductiveUse,
  listingIsNotUsage,
  ownershipEqualsProductiveUse,
  ownershipIsNotUsage,
  vacancyIsNotUsage,
} from './capacity.ts';
export { evaluateUtilization, refuseInventedDenominator, refuseStaleUtilization } from './utilization.ts';
export { evaluateUseRights, inferOwnerFromOperator, legalOwnershipInferred, separatePartyRoles } from './rights.ts';
export { economicRecordOmitsPersonLevel, refusePersonLevelData } from './privacy.ts';
export {
  evaluateRealEstateClaimPath,
  identifySpaceUseEvents,
  ingestRealEstateRecord,
  ingestRealEstateRecords,
  refuseDuplicateBuildingUsage,
} from './adapter.ts';
export type { RealEstateIngestResult } from './adapter.ts';
export {
  REAL_ESTATE_ADVERSARIAL_SCENARIOS,
  REAL_ESTATE_SANDBOX_FEEDS,
  certifyRealEstateSandbox,
  evaluateRealEstateAdversary,
  realEstateCertificationCannotAuthorizeMoonRey,
  realEstateSandboxSchema,
  realEstateSandboxSubject,
} from './certification.ts';
export type { RealEstateAdversarialScenario, RealEstateSandboxFeed } from './certification.ts';
export {
  REAL_ESTATE_FIXTURE_NOW,
  accessControlRecord,
  bookingSystemRecord,
  independentAttestationRecord,
  listingRecord,
  occupiedSpaceRecord,
  ownedOnlyRecord,
  realEstateRecord,
  simulationPolicy,
  vacantCapacityRecord,
} from './fixtures.ts';
export { mapRealEstateRecordToEconomicAsset, projectRealEstateMetadata } from './ear.ts';
export { runRealEstateInfrastructureDataFabricDemo } from '../real-estate-infrastructure-demo.ts';
