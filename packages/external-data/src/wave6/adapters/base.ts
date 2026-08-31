/**
 * Shared opportunity adapter infrastructure — fixture-backed simulation only.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../../provider-sdk/src/types.ts';
import { assessJobFreshness } from '../freshness.ts';
import {
  normalizeEmploymentType,
  normalizeRemoteStatus,
  normalizeSalaryPeriod,
  normalizeSkillLabels,
} from '../normalization.ts';
import { validateApplicationUrl } from '../safe-url.ts';
import type {
  JobOpportunity,
  JobSearchQuery,
  Occupation,
  OpportunityProvenance,
  OpportunityServiceResult,
  PublicIntelligenceObservation,
  SalaryRange,
  Skill,
} from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type AdapterScenario = 'normal' | 'timeout' | 'rate_limited' | 'unavailable';

let globalScenario: AdapterScenario = 'normal';

export function setAdapterScenario(scenario: AdapterScenario): void {
  globalScenario = scenario;
}

export function getAdapterScenario(): AdapterScenario {
  return globalScenario;
}

export function loadOpportunityFixture(filename: string): unknown {
  const path = join(FIXTURES_DIR, filename);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function ok<T>(
  value: T,
  providersUsed: readonly string[],
  fromCache = false,
): OpportunityServiceResult<T> {
  return Object.freeze({ ok: true, value, fromCache, providersUsed });
}

export function fail(code: string, message: string, providerId: string): OpportunityServiceResult<never> {
  return Object.freeze({ ok: false, code, message, providerId });
}

export function buildProvenance(
  providerId: string,
  providerJobId: string | null,
  authorityClass: AuthorityClass,
  raw: unknown,
  retrievedAt: UtcInstant,
): OpportunityProvenance {
  const hash = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  return Object.freeze({
    providerId,
    providerJobId,
    authorityClass,
    sourceUrl: null,
    rawPayloadHash: hash,
    observationId: randomUUID(),
    retrievedAt,
  });
}

export function buildSalaryRange(input: {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: string | null;
  classification?: 'EXPLICIT' | 'ESTIMATED' | 'UNKNOWN';
}): SalaryRange | null {
  if (input.min == null && input.max == null) return null;
  const currency = input.currency ?? 'USD';
  const period = normalizeSalaryPeriod(input.period);
  return Object.freeze({
    minimum: input.min != null ? BigInt(Math.round(input.min * (period === 'HOURLY' ? 100 : 100))) : null,
    maximum: input.max != null ? BigInt(Math.round(input.max * (period === 'HOURLY' ? 100 : 100))) : null,
    currency,
    period,
    classification: input.classification ?? 'EXPLICIT',
    sourceAmountMin: input.min != null ? String(input.min) : null,
    sourceAmountMax: input.max != null ? String(input.max) : null,
    fxConvertedReference: null,
  });
}

export function buildJobOpportunity(
  input: {
    providerId: string;
    providerJobId: string;
    title: string;
    employer?: string | null;
    location?: string | null;
    remoteStatus?: string | null;
    remoteFlag?: boolean | null;
    employmentType?: string | null;
    description?: string | null;
    salary?: SalaryRange | null;
    skills?: readonly string[];
    experienceLevel?: string | null;
    postedAt?: string | null;
    expiresAt?: string | null;
    applicationUrl?: string | null;
    authorityClass: AuthorityClass;
    raw: unknown;
    nowUtc: UtcInstant;
  },
): JobOpportunity {
  const retrievedAt = input.nowUtc;
  const employment = normalizeEmploymentType(input.employmentType);
  const remoteStatus = normalizeRemoteStatus(input.remoteStatus, input.remoteFlag);
  const skillResult = normalizeSkillLabels(input.skills ?? []);
  const urlCheck = validateApplicationUrl(input.applicationUrl);
  const postedAt = input.postedAt ? asUtcInstant(input.postedAt) : null;
  const expiresAt = input.expiresAt ? asUtcInstant(input.expiresAt) : null;
  const freshness = assessJobFreshness({ postedAt, expiresAt, retrievedAt, nowUtc: input.nowUtc });

  return Object.freeze({
    opportunityId: `${input.providerId}:${input.providerJobId}`,
    providerJobId: input.providerJobId,
    title: input.title,
    employer: input.employer ?? null,
    location: input.location ?? null,
    remoteStatus,
    employmentType: employment.normalized,
    providerNativeEmploymentType: employment.providerNative,
    descriptionSummary: input.description?.slice(0, 500) ?? null,
    salary: input.salary ?? null,
    skills: skillResult.canonical,
    rawSkillLabels: skillResult.raw,
    experienceLevel: input.experienceLevel ?? null,
    postedAt,
    expiresAt,
    applicationUrl: urlCheck.url,
    applicationUrlSafe: urlCheck.safe,
    providerId: input.providerId,
    freshness,
    provenance: buildProvenance(input.providerId, input.providerJobId, input.authorityClass, input.raw, retrievedAt),
    mergedSourceIds: Object.freeze([]),
  });
}

export abstract class BaseOpportunityAdapter {
  abstract readonly providerId: string;
  protected scenario: AdapterScenario = 'normal';

  setScenario(scenario: AdapterScenario): void {
    this.scenario = scenario;
  }

  protected checkAvailability(): OpportunityServiceResult<never> | null {
    const s = this.scenario !== 'normal' ? this.scenario : globalScenario;
    if (s === 'timeout') return fail('TIMEOUT', 'provider timeout', this.providerId);
    if (s === 'rate_limited') return fail('RATE_LIMITED', '429 rate limited', this.providerId);
    if (s === 'unavailable') return fail('UNAVAILABLE', 'provider unavailable', this.providerId);
    return null;
  }
}

export function filterJobsByQuery(jobs: readonly JobOpportunity[], query: JobSearchQuery): JobOpportunity[] {
  let filtered = [...jobs];
  if (query.keywords) {
    const kw = query.keywords.toLowerCase();
    filtered = filtered.filter(
      (j) => j.title.toLowerCase().includes(kw) || j.descriptionSummary?.toLowerCase().includes(kw),
    );
  }
  if (query.location) {
    const loc = query.location.toLowerCase();
    filtered = filtered.filter(
      (j) => j.location?.toLowerCase().includes(loc) || j.remoteStatus === 'REMOTE',
    );
  }
  if (query.remotePreference && query.remotePreference !== 'UNKNOWN') {
    filtered = filtered.filter((j) => j.remoteStatus === query.remotePreference || j.remoteStatus === 'REMOTE');
  }
  if (query.employmentType) {
    filtered = filtered.filter((j) => j.employmentType === query.employmentType);
  }
  if (query.skills?.length) {
    const skillSet = new Set(query.skills.map((s) => s.toLowerCase()));
    filtered = filtered.filter((j) => j.skills.some((s) => skillSet.has(s.toLowerCase())));
  }
  if (query.limit) {
    filtered = filtered.slice(0, query.limit);
  }
  return filtered;
}

export function buildSkill(
  input: {
    providerId: string;
    skillId: string;
    name: string;
    aliases?: readonly string[];
    category?: string | null;
    description?: string | null;
    relatedOccupations?: readonly string[];
    authorityClass: AuthorityClass;
    raw: unknown;
    nowUtc: UtcInstant;
  },
): Skill {
  return Object.freeze({
    skillId: `skill:${input.name.toLowerCase().replace(/\s+/g, '-')}`,
    canonicalName: input.name,
    aliases: Object.freeze(input.aliases ?? []),
    category: input.category ?? null,
    description: input.description ?? null,
    providerNativeIds: Object.freeze([{ providerId: input.providerId, nativeId: input.skillId }]),
    relatedOccupations: Object.freeze(input.relatedOccupations ?? []),
    provenance: buildProvenance(input.providerId, input.skillId, input.authorityClass, input.raw, input.nowUtc),
  });
}

export function buildOccupation(
  input: {
    providerId: string;
    occupationId: string;
    title: string;
    category?: string | null;
    skills?: readonly string[];
    description?: string | null;
    salary?: SalaryRange | null;
    marketDemand?: string | null;
    geography?: string | null;
    authorityClass: AuthorityClass;
    raw: unknown;
    nowUtc: UtcInstant;
  },
): Occupation {
  const skillResult = normalizeSkillLabels(input.skills ?? []);
  return Object.freeze({
    occupationId: `${input.providerId}:${input.occupationId}`,
    title: input.title,
    category: input.category ?? null,
    skills: skillResult.canonical,
    description: input.description ?? null,
    salaryReference: input.salary ?? null,
    marketDemand: input.marketDemand ?? null,
    geography: input.geography ?? null,
    providerId: input.providerId,
    provenance: buildProvenance(input.providerId, input.occupationId, input.authorityClass, input.raw, input.nowUtc),
  });
}

export function buildPublicIntelligence(
  input: {
    providerId: string;
    observationId: string;
    title: string;
    summary: string;
    category: PublicIntelligenceObservation['category'];
    authorityClass: AuthorityClass;
    sourceUrl?: string | null;
    publishedAt?: string | null;
    nowUtc: UtcInstant;
  },
): PublicIntelligenceObservation {
  const urlCheck = validateApplicationUrl(input.sourceUrl);
  return Object.freeze({
    observationId: input.observationId,
    providerId: input.providerId,
    title: input.title,
    summary: input.summary,
    category: input.category,
    authorityClass: input.authorityClass,
    sourceUrl: urlCheck.url,
    publishedAt: input.publishedAt ? asUtcInstant(input.publishedAt) : null,
    retrievedAt: input.nowUtc,
    verifiedFact: false,
  });
}
