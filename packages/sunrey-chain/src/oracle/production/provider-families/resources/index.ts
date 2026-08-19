export {
  EXTRACTION_SEMANTICS,
  FORBIDDEN_RESOURCE_FACT_TYPES,
  LEGAL_OWNERSHIP_INFERRED,
  REFERENCE_PRICE_CREATES_OUTPUT,
  RESERVE_ENGINEERING_CLASSES,
  RESERVE_EQUALS_EXTRACTION,
  RESOURCE_CERTIFICATION_AUTHORIZES_MOONREY,
  RESOURCE_FACT_AUTO_MINTS,
  RESOURCE_FACT_TYPES,
  RESOURCE_FABRIC_POLICY_VERSION,
  RESOURCE_FABRIC_SCHEMA_VERSION,
  RESOURCE_INDEPENDENCE_CLASSES,
  RESOURCE_MEASUREMENT_SEMANTICS,
  RESOURCE_PARTY_ROLES,
  RESOURCE_PRODUCTION_ACTIVE,
  RESOURCE_REAL_PROVIDER_CONTACTED,
  RESOURCE_REJECTION_CODES,
  RESOURCE_SOURCE_CLASSES,
  STOCKPILE_MOVEMENT_EQUALS_EXTRACTION,
  certificationCannotAuthorizeMoonRey,
  defaultResourceFabricPolicy,
  isResourceFactType,
  isResourceMeasurementSemantics,
  isResourceSourceClass,
  resourceFactCannotAutoMint,
  resourceProductionIsActive,
  resourceRealProviderContacted,
  unitCodeIsMass,
  unitCodeIsVolume,
} from './types.ts';
export type {
  AssayGradeEvidence,
  EnvironmentalTelemetryEvidence,
  GovernedDensityEvidence,
  NormalizedResourceObservation,
  ReserveEngineeringClass,
  ResourceExtractionEvidenceRecord,
  ResourceFabricPolicy,
  ResourceFactType,
  ResourceGeography,
  ResourceIdentityRefs,
  ResourceIndependenceClass,
  ResourceLineageLink,
  ResourceMeasurementSemantics,
  ResourceParty,
  ResourcePartyRole,
  ResourceQualityInputs,
  ResourceRefusal,
  ResourceRejectionCode,
  ResourceRightsReference,
  ResourceSourceClass,
  ResourceSourceRecord,
} from './types.ts';
export {
  RESOURCE_SOURCE_PROFILES,
  classifyResourceIndependence,
  profileFor as resourceProfileFor,
  resourceQualityToOracleInputs,
  scoreResourceQuality,
} from './profiles.ts';
export type { ResourceSourceProfile } from './profiles.ts';
export { RESOURCE_FEED_SCHEMAS, RESOURCE_SCHEMA_IDS, resourceFeedSchema, resourceSchemaDrift } from './schemas.ts';
export {
  applyExtractionToReserve,
  evaluateStaleReserve,
  materializeReserveEstimate,
  reserveCannotCreateOutput,
  reserveEqualsExtraction,
} from './reserves.ts';
export type { ReserveEstimateRecord } from './reserves.ts';
export {
  clusterExtractionObservations,
  extractionEvidenceOf,
  identityRefsOf,
  refuseDuplicateExtractionMass,
} from './extraction.ts';
export {
  reconcileStockpile,
  stockpileMovementEqualsExtraction,
  stockpileMovementIsNotExtraction,
} from './stockpiles.ts';
export type { StockpileBalance, StockpileReconciliation } from './stockpiles.ts';
export { assayIsNotMass, containedMaterialMass, refuseMassTimesGradeWithoutPolicy } from './assay.ts';
export {
  evaluateExtractionRights,
  fixtureIsNotAuthorization,
  inferLegalOwnerFromOperator,
  legalOwnershipInferred,
  operatorIsNotLegalOwner,
  partiesOf,
  separatePartyRoles,
} from './rights.ts';
export {
  convertVolumeToMass,
  gramsPerKilogram,
  gramsPerTonne,
  normalizeMassQuantity,
  quantityToGrams,
  refuseBlindMassSum,
} from './mass-balance.ts';
export {
  evaluateResourceClaimPath,
  identifyExtractionEvents,
  ingestResourceRecord,
  ingestResourceRecords,
  linkExtractionToProcessing,
  linkExtractionToStockpile,
  processingTransformationEvent,
  referencePriceCreatesOutput,
} from './adapter.ts';
export type { ResourceIngestResult } from './adapter.ts';
export {
  RESOURCE_ADVERSARIAL_SCENARIOS,
  RESOURCE_SANDBOX_FEEDS,
  certifyResourceSandbox,
  evaluateResourceAdversary,
  resourceCertificationCannotAuthorizeMoonRey,
  resourceSandboxSchema,
  resourceSandboxSubject,
} from './certification.ts';
export type { ResourceAdversarialScenario, ResourceSandboxFeed } from './certification.ts';
export {
  RESOURCE_FIXTURE_NOW,
  concentrateRecord,
  haulTelemetryRecord,
  independentAssayRecord,
  kgExtractionRecord,
  mineProductionRecord,
  referencePriceRecord,
  reserveReportRecord,
  resourceRecord,
  simulationPolicy,
  stockpileRecord,
  weighbridgeRecord,
} from './fixtures.ts';
export { runResourceDataFabricDemo } from './demo.ts';
