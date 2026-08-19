export {
  SOURCE_CLAIM_COMPATIBILITY_CODES,
  SOURCE_TAXONOMY_ACTIVE_VERSION,
  SOURCE_TAXONOMY_ID,
  SOURCE_TAXONOMY_SCHEMA_VERSION,
  attributionPolicyComplete,
  claimCandidateAloneCanMint,
  mappingRejection,
  productionActive,
  verifiedFactAloneCanMint,
} from './types.ts';
export type {
  AttributionState,
  CompatibleMapping,
  MappingStatus,
  MappingValidationInput,
  SourceCategoryStatus,
  SourceClaimCompatibilityCode,
  SourceClaimCompatibilityRejection,
  SourceProductiveMapping,
  SourceTaxonomyRegistry,
} from './types.ts';
export {
  CANONICAL_SOURCE_TAXONOMY,
  HISTORICAL_ENERGY_PRODUCTION_MAPPING,
  activeMappings,
  mappingById,
  registryWithRetiredCategory,
} from './registry.ts';
export {
  allProductiveCategoriesMapped,
  historicalMapping,
  validateFeedDefinitionMapping,
  validateSourceFactClaimMapping,
  validateSourceRegistrationMapping,
} from './validator.ts';
export type { MappingValidationResult } from './validator.ts';
export { moonreySourceCoverageReport } from './coverage.ts';
export type { MoonReySourceCoverageReport, ProductiveCategoryCoverage } from './coverage.ts';
export {
  enforceFeedDefinitionMapping,
  enforceFeedSchemaMapping,
  enforceSourceRegistrationMapping,
} from './onboarding.ts';
