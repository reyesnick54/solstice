/**
 * Provider-specific response parsers for live opportunity HTTP adapters.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { buildJobOpportunity, buildPublicIntelligence, buildSalaryRange } from '../adapters/base.ts';
import type { JobOpportunity, PublicIntelligenceObservation } from '../types.ts';

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseArbeitnowJobs(
  raw: { readonly data?: readonly Record<string, unknown>[] },
  providerId: string,
  nowUtc: UtcInstant,
): readonly JobOpportunity[] {
  const rows = Array.isArray(raw.data) ? raw.data : [];
  return rows.map((item) =>
    buildJobOpportunity({
      providerId,
      providerJobId: String(item.slug ?? item.id ?? ''),
      title: String(item.title ?? ''),
      employer: String(item.company_name ?? ''),
      location: String(item.location ?? ''),
      remoteFlag: Boolean(item.remote),
      employmentType: Array.isArray(item.job_types) ? String(item.job_types[0]) : null,
      description: stripHtml(String(item.description ?? '')),
      skills: Array.isArray(item.tags) ? item.tags.map(String) : [],
      postedAt: normalizePostedAt(item.created_at),
      applicationUrl: String(item.url ?? ''),
      authorityClass: 'community_data',
      raw: item,
      nowUtc,
    }),
  );
}

function normalizePostedAt(value: unknown): string | null {
  return normalizePublishedAt(value);
}

function normalizePublishedAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function parseRemoteOkJobs(
  raw: readonly Record<string, unknown>[],
  providerId: string,
  nowUtc: UtcInstant,
): readonly JobOpportunity[] {
  return raw
    .filter((item) => item.id != null && item.position != null)
    .map((item) =>
      buildJobOpportunity({
        providerId,
        providerJobId: String(item.id),
        title: String(item.position),
        employer: String(item.company ?? ''),
        location: String(item.location ?? 'Remote'),
        remoteFlag: true,
        employmentType: null,
        description: stripHtml(String(item.description ?? '')),
        skills: Array.isArray(item.tags) ? item.tags.map(String) : [],
        salary: buildSalaryRange({
          min: item.salary_min != null ? Number(item.salary_min) : null,
          max: item.salary_max != null ? Number(item.salary_max) : null,
          currency: item.salary_currency ? String(item.salary_currency) : 'USD',
          period: 'ANNUAL',
        }),
        postedAt: normalizePostedAt(item.date ? String(item.date) : null),
        applicationUrl: item.url ? String(item.url) : item.apply_url ? String(item.apply_url) : null,
        authorityClass: 'community_data',
        raw: item,
        nowUtc,
      }),
    );
}

export function parseRemotiveJobs(
  raw: { readonly jobs?: readonly Record<string, unknown>[] },
  providerId: string,
  nowUtc: UtcInstant,
): readonly JobOpportunity[] {
  const rows = Array.isArray(raw.jobs) ? raw.jobs : [];
  return rows.map((item) =>
    buildJobOpportunity({
      providerId,
      providerJobId: String(item.id ?? ''),
      title: String(item.title ?? ''),
      employer: String(item.company_name ?? ''),
      location: String(item.candidate_required_location ?? 'Remote'),
      remoteFlag: true,
      employmentType: String(item.job_type ?? ''),
      description: stripHtml(String(item.description ?? '')),
      skills: Array.isArray(item.tags) ? item.tags.map(String) : [],
      postedAt: normalizePublishedAt(item.publication_date),
      applicationUrl: String(item.url ?? ''),
      authorityClass: 'community_data',
      raw: item,
      nowUtc,
    }),
  );
}

export function parseJobicyJobs(
  raw: { readonly jobs?: readonly Record<string, unknown>[] },
  providerId: string,
  nowUtc: UtcInstant,
): readonly JobOpportunity[] {
  const rows = Array.isArray(raw.jobs) ? raw.jobs : [];
  return rows.map((item) =>
    buildJobOpportunity({
      providerId,
      providerJobId: String(item.id ?? item.jobSlug ?? ''),
      title: String(item.jobTitle ?? ''),
      employer: String(item.companyName ?? ''),
      location: String(item.jobGeo ?? 'Remote'),
      remoteFlag: true,
      employmentType: Array.isArray(item.jobType) ? String(item.jobType[0]) : String(item.jobType ?? ''),
      description: String(item.jobExcerpt ?? ''),
      skills: Array.isArray(item.jobIndustry) ? item.jobIndustry.map(String) : [],
      postedAt: normalizePublishedAt(item.pubDate),
      applicationUrl: String(item.url ?? ''),
      authorityClass: 'community_data',
      raw: item,
      nowUtc,
    }),
  );
}

export function parseHimalayasJobs(
  raw: { readonly jobs?: readonly Record<string, unknown>[] },
  providerId: string,
  nowUtc: UtcInstant,
): readonly JobOpportunity[] {
  const rows = Array.isArray(raw.jobs) ? raw.jobs : [];
  return rows.map((item) =>
    buildJobOpportunity({
      providerId,
      providerJobId: String(item.id ?? `${item.companySlug}-${item.title}`),
      title: String(item.title ?? ''),
      employer: String(item.companyName ?? ''),
      location: Array.isArray(item.locationRestrictions)
        ? item.locationRestrictions.map(String).join(', ')
        : 'Remote',
      remoteFlag: true,
      employmentType: String(item.employmentType ?? ''),
      description: String(item.excerpt ?? ''),
      skills: Array.isArray(item.categories) ? item.categories.map(String) : [],
      salary: buildSalaryRange({
        min: item.minSalary != null ? Number(item.minSalary) : null,
        max: item.maxSalary != null ? Number(item.maxSalary) : null,
        currency: item.currency ? String(item.currency) : null,
        period: item.salaryPeriod ? String(item.salaryPeriod) : 'ANNUAL',
      }),
      applicationUrl: item.applicationLink ? String(item.applicationLink) : null,
      authorityClass: 'community_data',
      raw: item,
      nowUtc,
    }),
  );
}

export function parseHackernewsIntelligence(
  raw: { readonly hits?: readonly Record<string, unknown>[] },
  providerId: string,
  nowUtc: UtcInstant,
): readonly PublicIntelligenceObservation[] {
  const rows = Array.isArray(raw.hits) ? raw.hits : [];
  return rows.map((item) =>
    buildPublicIntelligence({
      providerId,
      observationId: String(item.objectID ?? item.id ?? ''),
      title: String(item.title ?? ''),
      summary: stripHtml(String(item.story_text ?? item.comment_text ?? item.title ?? '')),
      category: 'HIRING_SIGNAL',
      authorityClass: 'community_data',
      sourceUrl: item.url ? String(item.url) : null,
      publishedAt: normalizePublishedAt(item.created_at),
      nowUtc,
    }),
  );
}

export function validateArbeitnowPayload(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { data?: unknown }).data);
}

export function validateRemoteOkPayload(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some((item) => typeof item === 'object' && item !== null && 'id' in item);
}

export function validateRemotivePayload(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { jobs?: unknown }).jobs);
}

export function validateJobicyPayload(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { jobs?: unknown }).jobs);
}

export function validateHimalayasPayload(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { jobs?: unknown }).jobs);
}

export function validateHackernewsPayload(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { hits?: unknown }).hits);
}
