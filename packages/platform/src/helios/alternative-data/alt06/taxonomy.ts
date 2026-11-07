/**
 * HELIOS ALT06 — product demand feature taxonomy.
 */

export const HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA =
  'sunrey.helios.alt06.product-demand-plane.v1' as const;

export const ALT06_FEATURE_IDS = [
  'alt06.price_level',
  'alt06.price_change',
  'alt06.discount_depth',
  'alt06.promotion_frequency',
  'alt06.stock_availability',
  'alt06.stockout_frequency',
  'alt06.assortment_breadth',
  'alt06.new_product_introduction',
  'alt06.product_removal',
  'alt06.relative_price_vs_category',
  'alt06.relative_price_vs_competitor',
] as const;

export type Alt06FeatureId = (typeof ALT06_FEATURE_IDS)[number];

export const ALT06_FORMULA_VERSION = 'alt06.product-demand.v1' as const;

export const HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED = 'HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED' as const;

export const HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED = 'HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED' as const;

export const DEMAND_SUPPLY_IMBALANCE_KINDS = [
  'rising_demand_declining_availability',
  'promotion_heavy_inventory_clearing',
  'price_increase_stable_availability',
  'insufficient_calibration',
] as const;

export type DemandSupplyImbalanceKind = (typeof DEMAND_SUPPLY_IMBALANCE_KINDS)[number];

export const PRICING_POWER_SIGNAL_KINDS = [
  'empirical_pricing_power',
  'insufficient_evidence',
  'price_increase_only_rejected',
] as const;

export type PricingPowerSignalKind = (typeof PRICING_POWER_SIGNAL_KINDS)[number];
