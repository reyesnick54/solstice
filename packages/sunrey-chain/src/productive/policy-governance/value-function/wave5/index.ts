/**
 * Wave 5 — Productive Economic Value and GPUV formalization.
 *
 * Clean transition:
 *   Verified Productive Event
 *   → ProductiveEconomicContribution
 *   → ProductiveValueEngine
 *   → GPUV
 */

export {
  PRODUCTIVE_ECONOMIC_CONTRIBUTION_SCHEMA_VERSION,
  PRODUCTIVE_CONTRIBUTION_REJECTION_CODES,
  acceptProductiveEconomicContribution,
} from './contribution.ts';
export type {
  AcceptContributionInput,
  AcceptContributionResult,
  EconomicClaimReference,
  EvidenceProofReference,
  InformationConsensusReceipt,
  ProductiveAssetReference,
  ProductiveContributionRejectionCode,
  ProductiveEconomicContribution,
  RightsLicenseProofReference,
} from './contribution.ts';

export {
  GPUV_DEFINITION,
  GPUV_DEFINITION_ID,
  GPUV_DEFINITION_VERSION,
  GPUV_DOES_NOT_MEASURE,
  GPUV_MEASURES,
  GPUV_OUTPUT_UNIT,
  GPUV_PRECISION_SCALE,
  gpuvQuantityFromProductiveValue,
} from './gpuv.ts';
export type { GpuvDefinition } from './gpuv.ts';

export {
  PRODUCTIVE_VALUATION_METHODOLOGY_SCHEMA_VERSION,
  SIMULATION_METHODOLOGY_ID,
  domainBindingForCategory,
  methodologyFromPolicy,
  methodologyReferenceFromPolicy,
} from './methodology.ts';
export type {
  DomainMethodologyBinding,
  MethodologyReference,
  ProductiveValuationMethodology,
} from './methodology.ts';

export {
  MARKET_PRICE_COUPLING_FORBIDDEN,
  auditMarketPriceSeparation,
  exchangeApiUnavailableDoesNotAlterGpuv,
  referenceFactUsesMoonReyMarketPrice,
} from './market-separation.ts';
export type { MarketPriceCouplingViolation, MarketSeparationAudit } from './market-separation.ts';

export {
  PRODUCTIVE_VALUATION_RESULT_SCHEMA_VERSION,
  PRODUCTIVE_VALUE_RECEIPT_SCHEMA_VERSION,
  buildProductiveValuationResult,
  buildProductiveValueReceipt,
  digestValuationResult,
  valuationIdFromDigest,
} from './valuation-result.ts';
export type { ProductiveValuationResult, ProductiveValueReceipt } from './valuation-result.ts';

export {
  PRODUCTIVE_VALUE_ENGINE_BOUNDARY_ID,
  PRODUCTIVE_VALUE_ENGINE_CAPABILITIES,
  ProductiveValueEngine,
  createProductiveValueEngine,
} from './engine.ts';
export type {
  ProductiveValueEngineCapabilities,
  ProductiveValueEngineContext,
  ProductiveValueEngineEvaluation,
  ValuationRejectionCode,
} from './engine.ts';
