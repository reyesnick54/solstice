/**
 * Wave 6 — OpportunityService canonical domain service.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { opportunityCachePolicy, OPPORTUNITY_CACHE_CAPABILITIES } from './cache-policies.ts';
import { detectDuplicateJobs } from './deduplication.ts';
import { matchJobsToUser, assertNoSensitiveDataInQuery } from './matching.ts';
import type { OpportunityProvider } from './provider.ts';
import { createAllOpportunityAdapters } from './adapters/index.ts';
import type {
  JobOpportunity,
  JobSearchQuery,
  Occupation,
  OpportunityServiceResult,
  PublicIntelligenceObservation,
  Skill,
  UserMatchContext,
} from './types.ts';
import { isRecommendableFreshness } from './freshness.ts';

export type OpportunityServiceOptions = {
  readonly nowUtc?: UtcInstant;
  readonly providers?: readonly OpportunityProvider[];
};

type CacheEntry<T> = { readonly value: T; readonly expiresAtMs: number };

export class OpportunityService {
  readonly #providers: readonly OpportunityProvider[];
  readonly #memory = new Map<string, CacheEntry<unknown>>();

  constructor(options: OpportunityServiceOptions = {}) {
    this.#providers = Object.freeze(options.providers ?? createAllOpportunityAdapters());
  }

  listProviders(): readonly OpportunityProvider[] {
    return this.#providers;
  }

  async searchJobs(
    query: JobSearchQuery,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    assertNoSensitiveDataInQuery(query as Record<string, unknown>);
    const cacheKey = `jobs:${JSON.stringify(query)}`;
    const cached = this.#getCache<readonly JobOpportunity[]>(cacheKey);
    if (cached) return { ok: true, value: cached, fromCache: true, providersUsed: [] };

    const allJobs: JobOpportunity[] = [];
    const providersUsed: string[] = [];
    const warnings: string[] = [];

    for (const provider of this.#providers) {
      if (!provider.capabilities.includes('job_search')) continue;
      const result = await provider.searchJobs(query, nowUtc);
      if (result.ok) {
        allJobs.push(...result.value);
        providersUsed.push(...result.providersUsed);
      } else {
        warnings.push(`${provider.providerId}: ${result.message}`);
      }
    }

    if (allJobs.length === 0 && warnings.length > 0) {
      return { ok: false, code: 'NO_PROVIDER', message: warnings.join('; '), providerId: null };
    }

    const deduped = detectDuplicateJobs(allJobs);
    const recommendable = deduped.filter((j) => isRecommendableFreshness(j.freshness));
    this.#setCache(cacheKey, recommendable, OPPORTUNITY_CACHE_CAPABILITIES.jobSearch);
    return { ok: true, value: Object.freeze(recommendable), fromCache: false, providersUsed: Object.freeze(providersUsed) };
  }

  async getJob(
    opportunityId: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<JobOpportunity>> {
    const cacheKey = `job:${opportunityId}`;
    const cached = this.#getCache<JobOpportunity>(cacheKey);
    if (cached) return { ok: true, value: cached, fromCache: true, providersUsed: [] };

    const [providerId, providerJobId] = opportunityId.split(':');
    const provider = this.#providers.find((p) => p.providerId === providerId);
    if (!provider?.getJob) {
      const search = await this.searchJobs({}, nowUtc);
      if (!search.ok) return search;
      const found = search.value.find((j) => j.opportunityId === opportunityId);
      if (!found) return { ok: false, code: 'NOT_FOUND', message: `job ${opportunityId} not found`, providerId };
      return { ok: true, value: found, fromCache: false, providersUsed: search.providersUsed };
    }
    const result = await provider.getJob(providerJobId!, nowUtc);
    if (result.ok) this.#setCache(cacheKey, result.value, OPPORTUNITY_CACHE_CAPABILITIES.jobDetail);
    return result;
  }

  async searchSkills(
    query: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<readonly Skill[]>> {
    const cacheKey = `skills:${query}`;
    const cached = this.#getCache<readonly Skill[]>(cacheKey);
    if (cached) return { ok: true, value: cached, fromCache: true, providersUsed: [] };

    const skills: Skill[] = [];
    const providersUsed: string[] = [];
    for (const provider of this.#providers) {
      if (!provider.searchSkills) continue;
      const result = await provider.searchSkills(query, nowUtc);
      if (result.ok) {
        skills.push(...result.value);
        providersUsed.push(...result.providersUsed);
      }
    }
    const byCanonical = new Map<string, Skill>();
    for (const skill of skills) {
      const existing = byCanonical.get(skill.canonicalName);
      if (!existing) {
        byCanonical.set(skill.canonicalName, skill);
      }
    }
    const merged = Object.freeze([...byCanonical.values()]);
    this.#setCache(cacheKey, merged, OPPORTUNITY_CACHE_CAPABILITIES.skillSearch);
    return { ok: true, value: merged, fromCache: false, providersUsed: Object.freeze(providersUsed) };
  }

  async getSkill(
    skillId: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<Skill>> {
    for (const provider of this.#providers) {
      if (!provider.getSkill) continue;
      const result = await provider.getSkill(skillId, nowUtc);
      if (result.ok) return result;
    }
    const search = await this.searchSkills('', nowUtc);
    if (!search.ok) return search;
    const found = search.value.find((s) => s.skillId === skillId);
    if (!found) return { ok: false, code: 'NOT_FOUND', message: `skill ${skillId} not found`, providerId: null };
    return { ok: true, value: found, fromCache: false, providersUsed: search.providersUsed };
  }

  async searchOccupations(
    query: string,
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<readonly Occupation[]>> {
    const cacheKey = `occupations:${query}`;
    const cached = this.#getCache<readonly Occupation[]>(cacheKey);
    if (cached) return { ok: true, value: cached, fromCache: true, providersUsed: [] };

    const occupations: Occupation[] = [];
    const providersUsed: string[] = [];
    for (const provider of this.#providers) {
      if (!provider.searchOccupations) continue;
      const result = await provider.searchOccupations(query, nowUtc);
      if (result.ok) {
        occupations.push(...result.value);
        providersUsed.push(...result.providersUsed);
      }
    }
    const frozen = Object.freeze(occupations);
    this.#setCache(cacheKey, frozen, OPPORTUNITY_CACHE_CAPABILITIES.occupationSearch);
    return { ok: true, value: frozen, fromCache: false, providersUsed: Object.freeze(providersUsed) };
  }

  async getCareerOpportunities(
    context: UserMatchContext,
    query: JobSearchQuery = {},
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ) {
    const jobs = await this.searchJobs(query, nowUtc);
    if (!jobs.ok) return jobs;
    return Object.freeze({
      ...matchJobsToUser(jobs.value, context),
      advisoryOnly: true as const,
      autoApply: false as const,
      contactEmployer: false as const,
    });
  }

  async getMarketDemand(
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<readonly Occupation[]>> {
    return this.searchOccupations('', nowUtc);
  }

  async getPublicIntelligence(
    nowUtc: UtcInstant = asUtcInstant(new Date().toISOString()),
  ): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const cacheKey = 'intelligence:all';
    const cached = this.#getCache<readonly PublicIntelligenceObservation[]>(cacheKey);
    if (cached) return { ok: true, value: cached, fromCache: true, providersUsed: [] };

    const observations: PublicIntelligenceObservation[] = [];
    const providersUsed: string[] = [];
    for (const provider of this.#providers) {
      if (!provider.getPublicIntelligence) continue;
      const result = await provider.getPublicIntelligence(nowUtc);
      if (result.ok) {
        observations.push(...result.value);
        providersUsed.push(...result.providersUsed);
      }
    }
    const frozen = Object.freeze(observations);
    this.#setCache(cacheKey, frozen, OPPORTUNITY_CACHE_CAPABILITIES.publicIntelligence);
    return { ok: true, value: frozen, fromCache: false, providersUsed: Object.freeze(providersUsed) };
  }

  #getCache<T>(key: string): T | null {
    const entry = this.#memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.#memory.delete(key);
      return null;
    }
    return entry.value;
  }

  #setCache<T>(key: string, value: T, capability: keyof typeof OPPORTUNITY_CACHE_CAPABILITIES): void {
    const policy = opportunityCachePolicy(OPPORTUNITY_CACHE_CAPABILITIES[capability]);
    this.#memory.set(key, { value, expiresAtMs: Date.now() + policy.ttlMs });
  }
}

export function createOpportunityService(options?: OpportunityServiceOptions): OpportunityService {
  return new OpportunityService(options);
}

export function defaultOpportunityNow(): UtcInstant {
  return asUtcInstant('2026-08-31T12:00:00.000Z');
}
