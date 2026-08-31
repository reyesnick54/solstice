/**
 * Wave 6 — opportunity provider adapters (fixture-backed simulation only).
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityProvider, OpportunityCapability } from '../provider.ts';
import type { JobOpportunity, JobSearchQuery, Occupation, OpportunityServiceResult, PublicIntelligenceObservation, Skill } from '../types.ts';
import {
  BaseOpportunityAdapter,
  buildJobOpportunity,
  buildOccupation,
  buildPublicIntelligence,
  buildSalaryRange,
  buildSkill,
  fail,
  filterJobsByQuery,
  loadOpportunityFixture,
  ok,
} from './base.ts';

export const OPPORTUNITY_ADAPTER_IDS = [
  'arbeitnow',
  'ai-dev-jobs',
  'artificial-intelligence-jobs',
  'freehire',
  'graphql-jobs',
  'techrole-index',
  'open-skills',
  'noozra',
  'datacube-ai',
  'hackernews',
  'bluesky-public',
] as const;

export type OpportunityAdapterId = (typeof OPPORTUNITY_ADAPTER_IDS)[number];

class ArbeitnowAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'arbeitnow';
  readonly capabilities = ['job_search', 'employment_market', 'career_opportunities'] as const;
  readonly geographicScope = ['EU', 'GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('arbeitnow-jobs.json') as { data: Record<string, unknown>[] };
    const jobs = raw.data.map((item) =>
      buildJobOpportunity({
        providerId: this.providerId,
        providerJobId: String(item.slug),
        title: String(item.title),
        employer: String(item.company_name),
        location: String(item.location),
        remoteFlag: Boolean(item.remote),
        employmentType: Array.isArray(item.job_types) ? String(item.job_types[0]) : null,
        description: String(item.description),
        skills: Array.isArray(item.tags) ? item.tags.map(String) : [],
        postedAt: String(item.created_at),
        applicationUrl: String(item.url),
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
    return ok(Object.freeze(filterJobsByQuery(jobs, query)), [this.providerId]);
  }
}

class AiDevJobsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'ai-dev-jobs';
  readonly capabilities = ['job_search', 'career_opportunities'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('ai-dev-jobs.json') as { jobs: Record<string, unknown>[] };
    const jobs = raw.jobs.map((item) =>
      buildJobOpportunity({
        providerId: this.providerId,
        providerJobId: String(item.id),
        title: String(item.title),
        employer: String(item.company),
        location: String(item.location),
        remoteFlag: Boolean(item.remote),
        employmentType: String(item.type),
        skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
        salary: buildSalaryRange({
          min: Number(item.salary_min),
          max: Number(item.salary_max),
          currency: String(item.salary_currency),
          period: String(item.salary_period),
        }),
        postedAt: String(item.posted_at),
        applicationUrl: String(item.apply_url),
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
    return ok(Object.freeze(filterJobsByQuery(jobs, query)), [this.providerId]);
  }
}

class ArtificialIntelligenceJobsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'artificial-intelligence-jobs';
  readonly capabilities = ['job_search', 'career_opportunities'] as const;
  readonly geographicScope = ['GB', 'EU', 'GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('artificial-intelligence-jobs.json') as { results: Record<string, unknown>[] };
    const jobs = raw.results.map((item) =>
      buildJobOpportunity({
        providerId: this.providerId,
        providerJobId: String(item.id),
        title: String(item.role),
        employer: String(item.organisation),
        location: `${item.city}, ${item.country}`,
        remoteStatus: String(item.workplace_type),
        employmentType: String(item.contract_type),
        description: String(item.summary),
        skills: Array.isArray(item.technologies) ? item.technologies.map(String) : [],
        postedAt: String(item.date_posted),
        applicationUrl: String(item.link),
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
    return ok(Object.freeze(filterJobsByQuery(jobs, query)), [this.providerId]);
  }
}

class FreehireAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'freehire';
  readonly capabilities = ['job_search', 'employment_market', 'career_opportunities'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('freehire-jobs.json') as { listings: Record<string, unknown>[] };
    const jobs = raw.listings.map((item) =>
      buildJobOpportunity({
        providerId: this.providerId,
        providerJobId: String(item.job_id),
        title: String(item.position),
        employer: String(item.company),
        location: String(item.city),
        remoteFlag: Boolean(item.is_remote),
        employmentType: String(item.employment),
        skills: Array.isArray(item.tech_stack) ? item.tech_stack.map(String) : [],
        salary: buildSalaryRange({
          min: Number(item.compensation_min),
          max: Number(item.compensation_max),
          currency: String(item.compensation_currency),
          period: String(item.compensation_unit),
        }),
        postedAt: String(item.published),
        applicationUrl: String(item.application_link),
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
    return ok(Object.freeze(filterJobsByQuery(jobs, query)), [this.providerId]);
  }
}

class GraphqlJobsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'graphql-jobs';
  readonly capabilities = ['job_search', 'career_opportunities'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('graphql-jobs.json') as { jobs: Record<string, unknown>[] };
    const jobs = raw.jobs.map((item) =>
      buildJobOpportunity({
        providerId: this.providerId,
        providerJobId: String(item.id),
        title: String(item.title),
        employer: String(item.companyName),
        location: String(item.location),
        remoteFlag: Boolean(item.remoteOk),
        employmentType: String(item.type),
        description: String(item.description),
        skills: Array.isArray(item.tags) ? item.tags.map(String) : [],
        postedAt: String(item.postedAt),
        applicationUrl: String(item.url),
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
    return ok(Object.freeze(filterJobsByQuery(jobs, query)), [this.providerId]);
  }
}

class TechroleIndexAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'techrole-index';
  readonly capabilities = ['occupations', 'skills', 'employment_market', 'salaries'] as const;
  readonly geographicScope = ['US', 'GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async searchOccupations(query: string, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly Occupation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('techrole-index.json') as { roles: Record<string, unknown>[] };
    const occupations = raw.roles
      .filter((r) => !query || String(r.title).toLowerCase().includes(query.toLowerCase()))
      .map((item) =>
        buildOccupation({
          providerId: this.providerId,
          occupationId: String(item.role_id),
          title: String(item.title),
          category: String(item.category),
          skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
          description: String(item.description),
          salary: buildSalaryRange({
            min: Number(item.salary_min),
            max: Number(item.salary_max),
            currency: String(item.salary_currency),
            period: String(item.salary_period),
          }),
          marketDemand: String(item.demand_level),
          geography: String(item.geography),
          authorityClass: 'derived_data',
          raw: item,
          nowUtc,
        }),
      );
    return ok(Object.freeze(occupations), [this.providerId]);
  }

  async getMarketDemand(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly Occupation[]>> {
    return this.searchOccupations('', nowUtc);
  }
}

class OpenSkillsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'open-skills';
  readonly capabilities = ['skills', 'occupations'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async searchSkills(query: string, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly Skill[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('open-skills.json') as { skills: Record<string, unknown>[] };
    const skills = raw.skills
      .filter((s) => !query || String(s.name).toLowerCase().includes(query.toLowerCase()))
      .map((item) =>
        buildSkill({
          providerId: this.providerId,
          skillId: String(item.id),
          name: String(item.name),
          aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
          category: String(item.category),
          description: String(item.description),
          relatedOccupations: Array.isArray(item.related_occupations) ? item.related_occupations.map(String) : [],
          authorityClass: 'community_data',
          raw: item,
          nowUtc,
        }),
      );
    return ok(Object.freeze(skills), [this.providerId]);
  }

  async getSkill(skillId: string, nowUtc: UtcInstant): Promise<OpportunityServiceResult<Skill>> {
    const result = await this.searchSkills('', nowUtc);
    if (!result.ok) return result;
    const skill = result.value.find((s) => s.providerNativeIds.some((n) => n.nativeId === skillId));
    if (!skill) return fail('NOT_FOUND', `skill ${skillId} not found`, this.providerId);
    return ok(skill, [this.providerId]);
  }
}

class NoozraAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'noozra';
  readonly capabilities = ['public_opportunity_data', 'employment_market'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('noozra-intelligence.json') as { articles: Record<string, unknown>[] };
    const observations = raw.articles.map((item) =>
      buildPublicIntelligence({
        providerId: this.providerId,
        observationId: String(item.id),
        title: String(item.headline),
        summary: String(item.summary),
        category: 'JOB_MARKET_NEWS',
        authorityClass: 'derived_data',
        sourceUrl: String(item.url),
        publishedAt: String(item.published_at),
        nowUtc,
      }),
    );
    return ok(Object.freeze(observations), [this.providerId]);
  }
}

class DatacubeAiAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'datacube-ai';
  readonly capabilities = ['public_opportunity_data', 'employment_market'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('datacube-ai-intelligence.json') as { signals: Record<string, unknown>[] };
    const observations = raw.signals.map((item) =>
      buildPublicIntelligence({
        providerId: this.providerId,
        observationId: String(item.id),
        title: String(item.title),
        summary: String(item.description),
        category: 'HIRING_SIGNAL',
        authorityClass: 'derived_data',
        sourceUrl: String(item.source_url),
        publishedAt: String(item.timestamp),
        nowUtc,
      }),
    );
    return ok(Object.freeze(observations), [this.providerId]);
  }
}

class HackernewsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'hackernews';
  readonly capabilities = ['public_opportunity_data', 'employment_market', 'career_opportunities'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('hackernews-hiring.json') as { hits: Record<string, unknown>[] };
    const observations = raw.hits.map((item) =>
      buildPublicIntelligence({
        providerId: this.providerId,
        observationId: String(item.objectID),
        title: String(item.title),
        summary: String(item.story_text ?? item.title),
        category: 'HIRING_SIGNAL',
        authorityClass: 'community_data',
        sourceUrl: String(item.url),
        publishedAt: String(item.created_at),
        nowUtc,
      }),
    );
    return ok(Object.freeze(observations), [this.providerId]);
  }
}

class BlueskyPublicAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'bluesky-public';
  readonly capabilities = ['public_opportunity_data', 'employment_market'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId]);
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture('bluesky-public-feed.json') as { feed: Record<string, unknown>[] };
    const observations = raw.feed.map((item, idx) => {
      const record = item.record as Record<string, unknown> | undefined;
      return buildPublicIntelligence({
        providerId: this.providerId,
        observationId: String(item.uri ?? `bsky-${idx}`),
        title: 'Bluesky career signal',
        summary: String(record?.text ?? ''),
        category: 'HIRING_SIGNAL',
        authorityClass: 'community_data',
        sourceUrl: null,
        publishedAt: record?.createdAt ? String(record.createdAt) : null,
        nowUtc,
      });
    });
    return ok(Object.freeze(observations), [this.providerId]);
  }
}

const ADAPTER_MAP: Record<OpportunityAdapterId, () => OpportunityProvider> = {
  arbeitnow: () => new ArbeitnowAdapter(),
  'ai-dev-jobs': () => new AiDevJobsAdapter(),
  'artificial-intelligence-jobs': () => new ArtificialIntelligenceJobsAdapter(),
  freehire: () => new FreehireAdapter(),
  'graphql-jobs': () => new GraphqlJobsAdapter(),
  'techrole-index': () => new TechroleIndexAdapter(),
  'open-skills': () => new OpenSkillsAdapter(),
  noozra: () => new NoozraAdapter(),
  'datacube-ai': () => new DatacubeAiAdapter(),
  hackernews: () => new HackernewsAdapter(),
  'bluesky-public': () => new BlueskyPublicAdapter(),
};

export function createOpportunityAdapter(id: OpportunityAdapterId): OpportunityProvider {
  return ADAPTER_MAP[id]();
}

export function createAllOpportunityAdapters(): readonly OpportunityProvider[] {
  return Object.freeze(OPPORTUNITY_ADAPTER_IDS.map((id) => createOpportunityAdapter(id)));
}

export function setAdapterScenario(providerId: OpportunityAdapterId, scenario: import('./base.ts').AdapterScenario): void {
  const adapter = createOpportunityAdapter(providerId) as BaseOpportunityAdapter;
  adapter.setScenario(scenario);
}

export {
  ArbeitnowAdapter,
  AiDevJobsAdapter,
  ArtificialIntelligenceJobsAdapter,
  FreehireAdapter,
  GraphqlJobsAdapter,
  TechroleIndexAdapter,
  OpenSkillsAdapter,
  NoozraAdapter,
  DatacubeAiAdapter,
  HackernewsAdapter,
  BlueskyPublicAdapter,
};
