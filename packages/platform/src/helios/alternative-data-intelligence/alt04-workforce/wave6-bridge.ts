/**
 * Bridge Wave 6 opportunity/job providers into ALT04 firm-level observations.
 * Extends Wave 6; does not duplicate provider adapters.
 */

import type { JobOpportunity } from '@solstice/external-data/wave6';
import type { UtcInstant } from '@solstice/domain';
import type { JobPostingObservation } from './types.ts';
import { HELIOS_ALT04_WORKFORCE_AUTHORITY, HELIOS_ALT04_WORKFORCE_SCHEMA } from './taxonomy.ts';
import { classifyJobPostingSkills } from './skill-intelligence.ts';

export function normalizeEmployerFirmKey(employer: string | null | undefined): string | null {
  if (!employer || !employer.trim()) return null;
  return employer
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|corporation|co|company)\.?$/i, '')
    .replace(/\s+/g, '_');
}

export function groupJobsByFirm(jobs: readonly JobOpportunity[]): Readonly<Map<string, JobOpportunity[]>> {
  const map = new Map<string, JobOpportunity[]>();
  for (const job of jobs) {
    const key = normalizeEmployerFirmKey(job.employer);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(job);
    map.set(key, list);
  }
  return map;
}

function knowableAtForJob(job: JobOpportunity, fallback: UtcInstant): UtcInstant {
  return job.provenance.retrievedAt ?? job.postedAt ?? fallback;
}

function durationDays(job: JobOpportunity, evaluationTime: UtcInstant): number | null {
  if (!job.postedAt) return null;
  const posted = Date.parse(job.postedAt);
  const evalMs = Date.parse(evaluationTime);
  if (!Number.isFinite(posted) || !Number.isFinite(evalMs)) return null;
  return Math.max(0, Math.round((evalMs - posted) / 86_400_000));
}

export function jobOpportunityToPostingObservation(input: {
  readonly job: JobOpportunity;
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly isRepost?: boolean;
}): JobPostingObservation {
  const knowableAt = knowableAtForJob(input.job, input.evaluationTime);
  const base: JobPostingObservation = Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    observationId: `alt04:job:${input.job.opportunityId}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt,
    providerIds: Object.freeze([input.job.providerId]),
    grantsExecutionAuthority: false,
    sourceJob: Object.freeze({
      opportunityId: input.job.opportunityId,
      title: input.job.title,
      employer: input.job.employer,
      location: input.job.location,
      remoteStatus: input.job.remoteStatus,
      employmentType: input.job.employmentType,
      skills: Object.freeze([...input.job.skills]),
      experienceLevel: input.job.experienceLevel,
      salary: input.job.salary,
      postedAt: input.job.postedAt,
      expiresAt: input.job.expiresAt,
      freshness: input.job.freshness,
      providerId: input.job.providerId,
    }),
    skillBuckets: Object.freeze([]),
    seniorityLabel: input.job.experienceLevel,
    subsidiaryLabel: null,
    durationDays: durationDays(input.job, input.evaluationTime),
    isRepost: input.isRepost ?? false,
  });
  const skillBuckets = classifyJobPostingSkills(base);
  return Object.freeze({ ...base, skillBuckets });
}

export function materializeFirmObservations(input: {
  readonly firmKey: string;
  readonly jobs: readonly JobOpportunity[];
  readonly evaluationTime: UtcInstant;
  readonly repostKeys?: ReadonlySet<string>;
}): readonly JobPostingObservation[] {
  const titleCounts = new Map<string, number>();
  for (const job of input.jobs) {
    const k = `${job.title.toLowerCase()}|${(job.location ?? '').toLowerCase()}`;
    titleCounts.set(k, (titleCounts.get(k) ?? 0) + 1);
  }
  return Object.freeze(
    input.jobs.map((job) => {
      const k = `${job.title.toLowerCase()}|${(job.location ?? '').toLowerCase()}`;
      const isRepost = (titleCounts.get(k) ?? 0) > 1 || input.repostKeys?.has(job.opportunityId) === true;
      return jobOpportunityToPostingObservation({
        job,
        firmKey: input.firmKey,
        evaluationTime: input.evaluationTime,
        isRepost,
      });
    }),
  );
}
