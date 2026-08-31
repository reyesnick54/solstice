/**
 * Health reference query limits and privacy-safe constraints.
 */

export const HEALTH_QUERY_LIMITS = Object.freeze({
  maxFoodResults: 50,
  maxDrugResults: 25,
  maxTrialResults: 25,
  maxProviderResults: 25,
  maxGeneticsResults: 20,
  defaultLimit: 10,
});

export function clampResultLimit(limit: number | undefined, max: number): number {
  if (limit === undefined) return HEALTH_QUERY_LIMITS.defaultLimit;
  return Math.max(1, Math.min(limit, max));
}

/** Fields safe to log — no user health data. */
export function privacySafeLogFields(input: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowed = ['providerId', 'capability', 'queryLength', 'resultCount', 'stale', 'degraded'];
  for (const key of allowed) {
    if (key in input) safe[key] = input[key];
  }
  return safe;
}

/** Agent must not infer health conditions from reference data. */
export function agentHealthInferenceBlocked(): { readonly inferHealthCondition: false } {
  return { inferHealthCondition: false };
}
