/**
 * Capability-specific cache TTL policies for energy and resource providers.
 */

export type CachePolicy = {
  readonly capability: string;
  readonly ttlSeconds: number;
  readonly staleWindowSeconds: number;
  readonly description: string;
};

export const WAVE5_CACHE_POLICIES: readonly CachePolicy[] = Object.freeze([
  {
    capability: 'grid_load',
    ttlSeconds: 120,
    staleWindowSeconds: 300,
    description: 'Real-time grid load — short TTL',
  },
  {
    capability: 'electricity_demand',
    ttlSeconds: 300,
    staleWindowSeconds: 900,
    description: 'Electricity demand — 5 minute TTL',
  },
  {
    capability: 'electricity_generation',
    ttlSeconds: 300,
    staleWindowSeconds: 900,
    description: 'Electricity generation — 5 minute TTL',
  },
  {
    capability: 'carbon_intensity',
    ttlSeconds: 600,
    staleWindowSeconds: 1800,
    description: 'Carbon intensity — 10 minute TTL',
  },
  {
    capability: 'energy_mix',
    ttlSeconds: 900,
    staleWindowSeconds: 3600,
    description: 'Generation mix — 15 minute TTL',
  },
  {
    capability: 'energy_prices',
    ttlSeconds: 3600,
    staleWindowSeconds: 7200,
    description: 'Energy prices — hourly TTL',
  },
  {
    capability: 'commodity_prices',
    ttlSeconds: 3600,
    staleWindowSeconds: 14400,
    description: 'Daily commodity statistics — 1 hour TTL',
  },
  {
    capability: 'agriculture_prices',
    ttlSeconds: 14400,
    staleWindowSeconds: 86400,
    description: 'Daily mandi prices — 4 hour TTL',
  },
  {
    capability: 'resource_data',
    ttlSeconds: 86400,
    staleWindowSeconds: 172800,
    description: 'Static metadata / offset registry — 24 hour TTL',
  },
]);

export function cachePolicyFor(capability: string): CachePolicy {
  return (
    WAVE5_CACHE_POLICIES.find((p) => p.capability === capability) ?? {
      capability,
      ttlSeconds: 3600,
      staleWindowSeconds: 7200,
      description: 'Default hourly TTL',
    }
  );
}
