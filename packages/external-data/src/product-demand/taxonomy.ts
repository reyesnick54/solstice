/**
 * HELIOS ALT06 — licensed/public product economics observation taxonomy.
 */

export const HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA =
  'sunrey.external.product-demand-observation.v1' as const;

export const PRODUCT_DEMAND_PROVIDER_KINDS = [
  'licensed_retail_api',
  'licensed_syndicated_panel',
  'public_product_feed',
  'simulation_fixture',
] as const;
export type ProductDemandProviderKind = (typeof PRODUCT_DEMAND_PROVIDER_KINDS)[number];

export const PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES = [
  'licensed_api',
  'public_permitted',
  'simulation_fixture',
] as const;
export type ProductDemandSourcePermitClass = (typeof PRODUCT_DEMAND_SOURCE_PERMIT_CLASSES)[number];

/** Ingestion rejects any adapter that declares unauthorized retail scraping. */
export const FORBIDDEN_PRODUCT_DEMAND_SOURCE_CLASSES = [
  'unauthorized_retail_scrape',
  'unsanctioned_crawl',
] as const;

export const SKU_IDENTIFIER_KINDS = [
  'gtin',
  'upc',
  'ean',
  'manufacturer_sku',
  'deterministic_product_id',
  'normalized_title_fingerprint',
] as const;
export type SkuIdentifierKind = (typeof SKU_IDENTIFIER_KINDS)[number];

export const SKU_MATCH_CONFIDENCE = ['deterministic', 'probabilistic', 'rejected_variant_mismatch'] as const;
export type SkuMatchConfidence = (typeof SKU_MATCH_CONFIDENCE)[number];

export const AVAILABILITY_STATES = [
  'in_stock',
  'limited',
  'out_of_stock',
  'unknown',
  'discontinued',
] as const;
export type ProductAvailabilityState = (typeof AVAILABILITY_STATES)[number];

export const PROMOTION_KINDS = ['price_cut', 'multi_buy', 'coupon', 'clearance', 'bundle'] as const;
export type ProductPromotionKind = (typeof PROMOTION_KINDS)[number];
