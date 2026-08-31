/**
 * ACCESS Wave 2 Prompt 31 — bounded access discovery query limits.
 */

export const ACCESS_DISCOVERY_QUERY_LIMITS = Object.freeze({
  maxGbfsResults: 50,
  maxParkResults: 50,
  maxRecreationResults: 50,
  maxRadiusKm: 50,
  defaultRadiusKm: 10,
  maxQueryLength: 256,
});

export function clampDiscoveryLimit(requested: number | undefined, max: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) {
    return Math.min(20, max);
  }
  return Math.min(Math.floor(requested), max);
}

export function clampDiscoveryRadius(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 0) {
    return ACCESS_DISCOVERY_QUERY_LIMITS.defaultRadiusKm;
  }
  return Math.min(requested, ACCESS_DISCOVERY_QUERY_LIMITS.maxRadiusKm);
}
