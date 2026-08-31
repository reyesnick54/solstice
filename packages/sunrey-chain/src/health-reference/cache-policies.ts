/**
 * Wave 6 health reference cache TTL policies (seconds).
 */

export const HEALTH_CACHE_POLICIES = Object.freeze({
  food_product: 86_400, // moderate/long — 24h
  nutrition_government: 604_800, // longer — 7d for USDA
  nutrition_community: 86_400, // moderate — 24h for OFF
  drug_reference: 43_200, // moderate — 12h
  device_reference: 43_200,
  recall_enforcement: 21_600, // shorter/moderate — 6h
  clinical_trial: 86_400, // moderate — 24h
  provider_directory: 604_800, // moderate/long — 7d
  genetics_educational: 2_592_000, // long — 30d
  public_health: 86_400,
  wellness_reference: 604_800,
} as const);

export type HealthCacheCapability = keyof typeof HEALTH_CACHE_POLICIES;

export function cacheTtlFor(capability: string): number {
  if (capability in HEALTH_CACHE_POLICIES) {
    return HEALTH_CACHE_POLICIES[capability as HealthCacheCapability];
  }
  return HEALTH_CACHE_POLICIES.food_product;
}
