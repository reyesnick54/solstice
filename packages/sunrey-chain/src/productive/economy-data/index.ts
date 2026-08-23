/**
 * Productized Productive Economy Data Platform.
 *
 * Extends packages/sunrey-chain productive / oracle / unit / GPUV owners.
 * Do not create packages/productive-economy-data or packages/moonrey-data-fabric.
 */

export {
  CANONICAL_GPUV,
  CANONICAL_GPUV_ID,
  CATEGORY_TO_PRODUCTIVE,
  CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED,
  GPUV_IS_NOT_MARKET_PRICE,
  GPUV_IS_NOT_MOONREY,
  LIVE_PROVIDER_CONNECTED,
  LOVABLE_CATEGORY_SECTIONS,
  OBSERVATION_CANNOT_MINT,
  OBSERVATION_CANNOT_SET_MARKET_PRICE,
  PRODUCTION_ACTIVE,
  PRODUCTIVE_ECONOMY_CATEGORIES,
  PRODUCTIVE_ECONOMY_DATA_SCHEMA,
  PRODUCTIVE_ECONOMY_PLATFORM_ID,
  SINGLE_SOURCE_IS_NOT_CONSENSUS,
  UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH,
  VERIFICATION_STATUSES,
  isProductiveEconomyCategory,
} from './types.ts';
export type {
  EconomicObservation,
  EconomyResult,
  FreshnessAssessment,
  ObservationDraft,
  ProductiveEconomyCategory,
  ProductiveResourceRecord,
  ProductiveValueMethodology,
  VerificationStatus,
} from './types.ts';
export { ProductiveAssetRegistry, createResource, redactLocation } from './registry.ts';
export { CATEGORY_UNIT_FAMILIES, normalizeEconomyQuantity, refuseIncompatibleMix } from './units.ts';
export { DEFAULT_FRESHNESS_POLICY, assessFreshness, refuseStaleForValuation } from './freshness.ts';
export { AI_CANNOT_VERIFY_OUTLIER, detectOutlier, refuseAiOutlierPromotion } from './outliers.ts';
export {
  VERIFICATION_IS_NOT_MINT,
  refuseFakeConsensus,
  verificationEligibleForValuation,
  verifyObservation,
} from './verification.ts';
export { ingestObservation } from './ingestion.ts';
export { derivePublicMetric, publicMetricAllowed, rawObservationPubliclyExposable } from './licensing.ts';
export {
  METHODOLOGY_REGISTRY_ID,
  ProductiveValueMethodologyRegistry,
  canonicalGpuvProductization,
  simulationMethodology,
} from './methodology.ts';
export { aggregateObservations } from './aggregation.ts';
export type { ProductiveAggregate } from './aggregation.ts';
export {
  ORACLE_CANNOT_MINT,
  observationsToOracleQuality,
  proposeMoonReyIssuanceFromObservations,
  separateEconomyPlanes,
} from './issuance-interface.ts';
export {
  SANDBOX_DRAFTS,
  SANDBOX_NOW_UTC,
  SANDBOX_RESOURCES,
  sandboxMethodologies,
  seedSandboxResources,
} from './fixtures.ts';
export { ProductiveEconomyDataPlatform, createProductiveEconomyDataPlatform } from './platform.ts';
export {
  AGENT_PRODUCTIVE_ECONOMY_PERMISSIONS,
  PRODUCTIVE_ECONOMY_CLIENT_SCHEMA,
  authorizeAgentProductiveEconomyAction,
  categoryBreakdown,
  lovableProductiveEconomyContract,
  metricHistory,
  moonreyEconomicInputSummary,
  sourceFreshnessSummary,
} from './client-surface.ts';
export type { AgentProductiveEconomyAction, LovableProductiveEconomyContract } from './client-surface.ts';
