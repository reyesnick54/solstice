/**
 * Wave 6 — opportunity provider adapters with live HTTP + fixture simulation.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityProvider, OpportunityCapability } from '../provider.ts';
import type {
  JobOpportunity,
  JobSearchQuery,
  Occupation,
  OpportunityServiceResult,
  PublicIntelligenceObservation,
  Skill,
} from '../types.ts';
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
  simulationProvenance,
} from './base.ts';
import { LiveJobOpportunityAdapter } from './live-adapter.ts';
import type { OpportunityHttpClientOptions } from '../http/client.ts';
import { OpportunityHttpClient } from '../http/client.ts';
import { LIVE_OPPORTUNITY_ENDPOINTS } from '../http/endpoints.ts';
import {
  parseArbeitnowJobs,
  parseHackernewsIntelligence,
  parseHimalayasJobs,
  parseJobicyJobs,
  parseRemotiveJobs,
  parseRemoteOkJobs,
  validateArbeitnowPayload,
  validateHackernewsPayload,
  validateHimalayasPayload,
  validateJobicyPayload,
  validateRemotivePayload,
  validateRemoteOkPayload,
} from '../http/parsers.ts';
import { cacheProvenance, readOpportunityHttpCache, writeOpportunityHttpCache } from '../http/cache.ts';

export const OPPORTUNITY_ADAPTER_IDS = [
  'arbeitnow',
  'remoteok',
  'remotive',
  'jobicy',
  'himalayas',
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

export type OpportunityAdapterFactoryOptions = OpportunityHttpClientOptions;

function createArbeitnowAdapter(options?: OpportunityAdapterFactoryOptions): OpportunityProvider {
  const inner = new LiveJobOpportunityAdapter(
    {
      providerId: 'arbeitnow',
      fixtureFile: 'arbeitnow-jobs.json',
      endpointKey: 'arbeitnow',
      validate: validateArbeitnowPayload,
      parse: (raw, providerId, nowUtc) => parseArbeitnowJobs(raw as { data?: readonly Record<string, unknown>[] }, providerId, nowUtc),
    },
    options,
  );
  return wrapLiveJobAdapter(inner, ['job_search', 'employment_market', 'career_opportunities'], ['EU', 'GLOBAL']);
}

function createRemoteOkAdapter(options?: OpportunityAdapterFactoryOptions): OpportunityProvider {
  const inner = new LiveJobOpportunityAdapter(
    {
      providerId: 'remoteok',
      fixtureFile: 'remoteok-jobs.json',
      endpointKey: 'remoteok',
      validate: validateRemoteOkPayload,
      parse: (raw, providerId, nowUtc) => parseRemoteOkJobs(raw as readonly Record<string, unknown>[], providerId, nowUtc),
    },
    options,
  );
  return wrapLiveJobAdapter(inner, ['job_search', 'employment_market', 'career_opportunities'], ['GLOBAL']);
}

function createRemotiveAdapter(options?: OpportunityAdapterFactoryOptions): OpportunityProvider {
  const inner = new LiveJobOpportunityAdapter(
    {
      providerId: 'remotive',
      fixtureFile: 'remotive-jobs.json',
      endpointKey: 'remotive',
      validate: validateRemotivePayload,
      parse: (raw, providerId, nowUtc) => parseRemotiveJobs(raw as { jobs?: readonly Record<string, unknown>[] }, providerId, nowUtc),
      liveQuery: (query) => ({ limit: query.limit ?? 50 }),
    },
    options,
  );
  return wrapLiveJobAdapter(inner, ['job_search', 'employment_market', 'career_opportunities'], ['GLOBAL']);
}

function createJobicyAdapter(options?: OpportunityAdapterFactoryOptions): OpportunityProvider {
  const inner = new LiveJobOpportunityAdapter(
    {
      providerId: 'jobicy',
      fixtureFile: 'jobicy-jobs.json',
      endpointKey: 'jobicy',
      validate: validateJobicyPayload,
      parse: (raw, providerId, nowUtc) => parseJobicyJobs(raw as { jobs?: readonly Record<string, unknown>[] }, providerId, nowUtc),
      liveQuery: (query) => ({ count: query.limit ?? 50 }),
    },
    options,
  );
  return wrapLiveJobAdapter(inner, ['job_search', 'career_opportunities'], ['GLOBAL']);
}

function createHimalayasAdapter(options?: OpportunityAdapterFactoryOptions): OpportunityProvider {
  const inner = new LiveJobOpportunityAdapter(
    {
      providerId: 'himalayas',
      fixtureFile: 'himalayas-jobs.json',
      endpointKey: 'himalayas',
      validate: validateHimalayasPayload,
      parse: (raw, providerId, nowUtc) => parseHimalayasJobs(raw as { jobs?: readonly Record<string, unknown>[] }, providerId, nowUtc),
      liveQuery: (query) => ({ limit: query.limit ?? 50 }),
    },
    options,
  );
  return wrapLiveJobAdapter(inner, ['job_search', 'career_opportunities'], ['GLOBAL']);
}

function wrapLiveJobAdapter(
  inner: LiveJobOpportunityAdapter,
  capabilities: readonly OpportunityCapability[],
  geographicScope: readonly string[],
): OpportunityProvider {
  return Object.freeze({
    providerId: inner.providerId,
    capabilities,
    geographicScope,
    productionAuthorized: false as const,
    liveCapable: inner.liveCapable,
    searchJobs: (query: JobSearchQuery, nowUtc: UtcInstant) => inner.searchJobs(query, nowUtc),
    setScenario: (scenario: import('./base.ts').AdapterScenario) => inner.setScenario(scenario),
  });
}

class FixtureOnlyJobAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly #providerId: string;
  get providerId(): string {
    return this.#providerId;
  }
  readonly capabilities: readonly OpportunityCapability[];
  readonly geographicScope: readonly string[];
  readonly productionAuthorized = false as const;
  readonly liveCapable = false as const;
  readonly #fixtureFile: string;
  readonly #mapper: (raw: unknown, nowUtc: UtcInstant) => readonly JobOpportunity[];

  constructor(
    providerId: string,
    fixtureFile: string,
    capabilities: readonly OpportunityCapability[],
    geographicScope: readonly string[],
    mapper: (raw: unknown, nowUtc: UtcInstant) => readonly JobOpportunity[],
  ) {
    super();
    this.#providerId = providerId;
    this.#fixtureFile = fixtureFile;
    this.capabilities = capabilities;
    this.geographicScope = geographicScope;
    this.#mapper = mapper;
  }

  async searchJobs(query: JobSearchQuery, nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture(this.#fixtureFile);
    const jobs = this.#mapper(raw, nowUtc);
    return ok(Object.freeze(filterJobsByQuery([...jobs], query)), [this.providerId], false, simulationProvenance());
  }
}

class UnavailableJobAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly #providerId: string;
  get providerId(): string {
    return this.#providerId;
  }
  readonly capabilities: readonly OpportunityCapability[];
  readonly geographicScope: readonly string[];
  readonly productionAuthorized = false as const;
  readonly liveCapable = false as const;
  readonly #reason: string;

  constructor(
    providerId: string,
    reason: string,
    capabilities: readonly OpportunityCapability[],
    geographicScope: readonly string[],
  ) {
    super();
    this.#providerId = providerId;
    this.#reason = reason;
    this.capabilities = capabilities;
    this.geographicScope = geographicScope;
  }

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    return fail('PROVIDER_UNAVAILABLE', this.#reason, this.providerId);
  }
}

class HackernewsAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'hackernews';
  readonly capabilities = ['public_opportunity_data', 'employment_market', 'career_opportunities'] as const;
  readonly geographicScope = ['GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveCapable = true as const;
  readonly #http: OpportunityHttpClient;

  constructor(options?: OpportunityAdapterFactoryOptions) {
    super();
    this.#http = new OpportunityHttpClient(options);
  }

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId], false, simulationProvenance());
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;

    if (this.#http.mode === 'simulation') {
      const raw = loadOpportunityFixture('hackernews-hiring.json');
      const observations = parseHackernewsIntelligence(raw as { hits?: readonly Record<string, unknown>[] }, this.providerId, nowUtc);
      return ok(Object.freeze(observations), [this.providerId], false, simulationProvenance());
    }

    const cacheKey = 'hackernews:intelligence';
    const cached = readOpportunityHttpCache<readonly PublicIntelligenceObservation[]>(cacheKey);
    if (cached) {
      return ok(cached.value, [this.providerId], true, cacheProvenance(cached.retrievedAtUtc));
    }

    const response = await this.#http.getJson<{ hits?: readonly Record<string, unknown>[] }>(LIVE_OPPORTUNITY_ENDPOINTS.hackernews, {
      query: 'hiring',
      tags: 'story',
      hitsPerPage: 20,
    });
    if (!response.ok) {
      return fail(response.code, response.message, this.providerId, response.provenance);
    }
    if (!validateHackernewsPayload(response.data)) {
      return fail('INVALID_PAYLOAD', 'unexpected HN response', this.providerId, response.provenance);
    }
    const observations = Object.freeze(parseHackernewsIntelligence(response.data, this.providerId, nowUtc));
    writeOpportunityHttpCache(cacheKey, observations, 'publicIntelligence', nowUtc);
    return ok(observations, [this.providerId], false, response.provenance);
  }
}

class TechroleIndexAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly providerId = 'techrole-index';
  readonly capabilities = ['occupations', 'skills', 'employment_market', 'salaries'] as const;
  readonly geographicScope = ['US', 'GLOBAL'] as const;
  readonly productionAuthorized = false as const;
  readonly liveCapable = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId], false, simulationProvenance());
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
    return ok(Object.freeze(occupations), [this.providerId], false, simulationProvenance());
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
  readonly liveCapable = false as const;

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId], false, simulationProvenance());
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
    return ok(Object.freeze(skills), [this.providerId], false, simulationProvenance());
  }

  async getSkill(skillId: string, nowUtc: UtcInstant): Promise<OpportunityServiceResult<Skill>> {
    const result = await this.searchSkills('', nowUtc);
    if (!result.ok) return result;
    const skill = result.value.find((s) => s.providerNativeIds.some((n) => n.nativeId === skillId));
    if (!skill) return fail('NOT_FOUND', `skill ${skillId} not found`, this.providerId);
    return ok(skill, [this.providerId], false, simulationProvenance());
  }
}

class IntelligenceFixtureAdapter extends BaseOpportunityAdapter implements OpportunityProvider {
  readonly #providerId: string;
  get providerId(): string {
    return this.#providerId;
  }
  readonly capabilities: readonly OpportunityCapability[];
  readonly geographicScope: readonly string[];
  readonly productionAuthorized = false as const;
  readonly liveCapable = false as const;
  readonly #fixtureFile: string;
  readonly #mapper: (raw: unknown, nowUtc: UtcInstant) => readonly PublicIntelligenceObservation[];

  constructor(
    providerId: string,
    fixtureFile: string,
    capabilities: readonly OpportunityCapability[],
    geographicScope: readonly string[],
    mapper: (raw: unknown, nowUtc: UtcInstant) => readonly PublicIntelligenceObservation[],
  ) {
    super();
    this.#providerId = providerId;
    this.#fixtureFile = fixtureFile;
    this.capabilities = capabilities;
    this.geographicScope = geographicScope;
    this.#mapper = mapper;
  }

  async searchJobs(): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    return ok(Object.freeze([]), [this.providerId], false, simulationProvenance());
  }

  async getPublicIntelligence(nowUtc: UtcInstant): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>> {
    const blocked = this.checkAvailability();
    if (blocked) return blocked;
    const raw = loadOpportunityFixture(this.#fixtureFile);
    return ok(Object.freeze(this.#mapper(raw, nowUtc)), [this.providerId], false, simulationProvenance());
  }
}

const ADAPTER_MAP: Record<OpportunityAdapterId, (options?: OpportunityAdapterFactoryOptions) => OpportunityProvider> = {
  arbeitnow: createArbeitnowAdapter,
  remoteok: createRemoteOkAdapter,
  remotive: createRemotiveAdapter,
  jobicy: createJobicyAdapter,
  himalayas: createHimalayasAdapter,
  'ai-dev-jobs': () =>
    new FixtureOnlyJobAdapter(
      'ai-dev-jobs',
      'ai-dev-jobs.json',
      ['job_search', 'career_opportunities'],
      ['GLOBAL'],
      (raw, nowUtc) => {
        const payload = raw as { jobs: Record<string, unknown>[] };
        return payload.jobs.map((item) =>
          buildJobOpportunity({
            providerId: 'ai-dev-jobs',
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
      },
    ),
  'artificial-intelligence-jobs': () =>
    new UnavailableJobAdapter(
      'artificial-intelligence-jobs',
      'catalog endpoint returned HTTP 404 during live verification',
      ['job_search', 'career_opportunities'],
      ['GB', 'EU', 'GLOBAL'],
    ),
  freehire: () =>
    new FixtureOnlyJobAdapter(
      'freehire',
      'freehire-jobs.json',
      ['job_search', 'employment_market', 'career_opportunities'],
      ['GLOBAL'],
      (raw, nowUtc) => {
        const payload = raw as { listings: Record<string, unknown>[] };
        return payload.listings.map((item) =>
          buildJobOpportunity({
            providerId: 'freehire',
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
      },
    ),
  'graphql-jobs': () =>
    new UnavailableJobAdapter(
      'graphql-jobs',
      'DNS resolution failed for graphql.jobs during live verification',
      ['job_search', 'career_opportunities'],
      ['GLOBAL'],
    ),
  'techrole-index': () => new TechroleIndexAdapter(),
  'open-skills': () => new OpenSkillsAdapter(),
  noozra: () =>
    new IntelligenceFixtureAdapter(
      'noozra',
      'noozra-intelligence.json',
      ['public_opportunity_data', 'employment_market'],
      ['GLOBAL'],
      (raw, nowUtc) => {
        const payload = raw as { articles: Record<string, unknown>[] };
        return payload.articles.map((item) =>
          buildPublicIntelligence({
            providerId: 'noozra',
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
      },
    ),
  'datacube-ai': () =>
    new IntelligenceFixtureAdapter(
      'datacube-ai',
      'datacube-ai-intelligence.json',
      ['public_opportunity_data', 'employment_market'],
      ['GLOBAL'],
      (raw, nowUtc) => {
        const payload = raw as { signals: Record<string, unknown>[] };
        return payload.signals.map((item) =>
          buildPublicIntelligence({
            providerId: 'datacube-ai',
            observationId: String(item.id),
            title: String(item.title),
            summary: String(item.description),
            category: 'HIRING_SIGNAL',
            authorityClass: 'derived_data',
            sourceUrl: String(item.source_url ?? ''),
            publishedAt: String(item.timestamp),
            nowUtc,
          }),
        );
      },
    ),
  hackernews: (options) => new HackernewsAdapter(options),
  'bluesky-public': () =>
    new IntelligenceFixtureAdapter(
      'bluesky-public',
      'bluesky-public-feed.json',
      ['public_opportunity_data', 'employment_market'],
      ['GLOBAL'],
      (raw, nowUtc) => {
        const payload = raw as { feed: Record<string, unknown>[] };
        return payload.feed.map((item, idx) => {
          const record = item.record as Record<string, unknown> | undefined;
          return buildPublicIntelligence({
            providerId: 'bluesky-public',
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
      },
    ),
};

export function createOpportunityAdapter(
  id: OpportunityAdapterId,
  options?: OpportunityAdapterFactoryOptions,
): OpportunityProvider {
  return ADAPTER_MAP[id](options);
}

export function createAllOpportunityAdapters(options?: OpportunityAdapterFactoryOptions): readonly OpportunityProvider[] {
  return Object.freeze(OPPORTUNITY_ADAPTER_IDS.map((adapterId) => createOpportunityAdapter(adapterId, options)));
}

export function setAdapterScenario(providerId: OpportunityAdapterId, scenario: import('./base.ts').AdapterScenario): void {
  const adapter = createOpportunityAdapter(providerId) as unknown as BaseOpportunityAdapter & { setScenario?: (s: import('./base.ts').AdapterScenario) => void };
  adapter.setScenario?.(scenario);
}

export {
  LiveJobOpportunityAdapter,
  FixtureOnlyJobAdapter,
  HackernewsAdapter,
  TechroleIndexAdapter,
  OpenSkillsAdapter,
};
