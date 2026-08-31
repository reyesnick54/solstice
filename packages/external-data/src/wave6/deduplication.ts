/**
 * Wave 6 — bounded duplicate job detection.
 */

import type { JobOpportunity } from './types.ts';

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function jobFingerprint(job: JobOpportunity): string {
  return [
    normalizeKey(job.employer),
    normalizeKey(job.title),
    normalizeKey(job.location),
    job.applicationUrl ?? '',
  ].join('|');
}

export function detectDuplicateJobs(jobs: readonly JobOpportunity[]): readonly JobOpportunity[] {
  const groups = new Map<string, JobOpportunity[]>();
  for (const job of jobs) {
    const key = jobFingerprint(job);
    const existing = groups.get(key) ?? [];
    existing.push(job);
    groups.set(key, existing);
  }

  const merged: JobOpportunity[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }
    // Only merge when employer + title + location match with high confidence
    const primary = group[0]!;
    const sourceIds = group.map((j) =>
      Object.freeze({ providerId: j.providerId, providerJobId: j.providerJobId ?? j.opportunityId }),
    );
    merged.push(
      Object.freeze({
        ...primary,
        mergedSourceIds: Object.freeze(sourceIds),
      }),
    );
  }
  return Object.freeze(merged);
}
