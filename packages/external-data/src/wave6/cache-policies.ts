/**
 * Wave 6 — cache policies for opportunity intelligence data.
 */

export const OPPORTUNITY_CACHE_CAPABILITIES = Object.freeze({
  jobSearch: 'job_search',
  jobDetail: 'job_detail',
  skillSearch: 'skill_search',
  skillDetail: 'skill_detail',
  occupationSearch: 'occupation_search',
  occupationDetail: 'occupation_detail',
  marketDemand: 'market_demand',
  publicIntelligence: 'public_intelligence',
} as const);

export type OpportunityCacheCapability = (typeof OPPORTUNITY_CACHE_CAPABILITIES)[keyof typeof OPPORTUNITY_CACHE_CAPABILITIES];

const TTL_MS: Record<OpportunityCacheCapability, number> = {
  job_search: 15 * 60 * 1000,
  job_detail: 30 * 60 * 1000,
  skill_search: 24 * 60 * 60 * 1000,
  skill_detail: 24 * 60 * 60 * 1000,
  occupation_search: 24 * 60 * 60 * 1000,
  occupation_detail: 24 * 60 * 60 * 1000,
  market_demand: 6 * 60 * 60 * 1000,
  public_intelligence: 10 * 60 * 1000,
};

export function opportunityCachePolicy(capability: OpportunityCacheCapability): {
  readonly ttlMs: number;
  readonly capability: OpportunityCacheCapability;
} {
  return Object.freeze({ ttlMs: TTL_MS[capability], capability });
}
