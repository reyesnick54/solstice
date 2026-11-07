export {
  HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA,
  PRODUCT_DEMAND_PROVIDER_KINDS,
  PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES,
  FORBIDDEN_PRODUCT_DEMAND_SOURCE_CLASSES,
  SKU_IDENTIFIER_KINDS,
  SKU_MATCH_CONFIDENCE,
  AVAILABILITY_STATES,
  PROMOTION_KINDS,
  type ProductDemandProviderKind,
  type ProductDemandSourcePermitClass,
  type SkuIdentifierKind,
  type SkuMatchConfidence,
  type ProductAvailabilityState,
  type ProductPromotionKind,
} from './taxonomy.ts';

export type {
  ProductDemandProviderRef,
  ProductDemandObservationProvenance,
  SkuIdentifier,
  ProductVariantFingerprint,
  SkuEntity,
  ProductObservation,
  PriceObservation,
  AvailabilityObservation,
  PromotionObservation,
  AssortmentObservation,
  ProductDemandState,
  SkuMatchResult,
  Alt06ProductDemandObservation,
} from './types.ts';

export { assertPermittedProductDemandSource, isPermittedSourcePermitClass, type SourcePolicyVerdict } from './source-policy.ts';

export {
  normalizeProductTitle,
  variantFingerprintFromTitle,
  normalizedTitleFingerprint,
  matchSkuEntity,
} from './sku-matching.ts';

export {
  createFixtureProductDemandIngestPort,
} from './fixture-adapter.ts';

export {
  partitionProductDemandObservations,
  type ProductDemandIngestPort,
  type ProductDemandObservationBundle,
} from './ports.ts';

export {
  ALT06_FIXTURE_BRAND_NODE,
  ALT06_FIXTURE_SUBSIDIARY_NODE,
  ALT06_FIXTURE_ISSUER_ENTITY,
  ALT06_DEMO_SKU_CLASSIC,
  ALT06_DEMO_SKU_FAMILY,
  ALT06_DEMO_SKU_COMPETITOR,
  alt06DemoSkus,
  alt06DemoProductObservation,
  alt06DemoPriceTimeline,
  alt06DemoAvailabilityTimeline,
  alt06DemoPromotionTimeline,
  alt06DemoAssortmentTimeline,
  alt06DemoObservationBundle,
} from './fixtures/cpg-demo-timeline.ts';
