import type { JobPostingFeatureBundle, JobPostingObservation } from './types.ts';

function growthBps(current: number, prior: number): number | null {
  if (prior <= 0) return current > 0 ? 10_000 : null;
  return Math.round(((current - prior) * 10_000) / prior);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

export function computeJobPostingFeatures(input: {
  readonly current: readonly JobPostingObservation[];
  readonly priorWeekCount: number;
  readonly priorMonthCount: number;
  readonly priorYearCount: number | null;
  readonly closedPostingCount: number;
  readonly newPostingCount: number;
}): JobPostingFeatureBundle {
  const postingCount = input.current.length;
  const titles = new Set(input.current.map((o) => o.sourceJob.title.toLowerCase()));
  const locations = new Set(
    input.current.map((o) => (o.sourceJob.location ?? 'unknown').toLowerCase()).filter(Boolean),
  );
  const seniorityMix: Record<string, number> = {};
  const durations: number[] = [];
  let reposts = 0;
  let salaryNumerator = 0;
  let salaryDenominator = 0;
  let salarySupported = false;

  for (const obs of input.current) {
    const seniority = obs.seniorityLabel ?? obs.sourceJob.experienceLevel ?? 'unknown';
    seniorityMix[seniority] = (seniorityMix[seniority] ?? 0) + 1;
    if (obs.durationDays != null) durations.push(obs.durationDays);
    if (obs.isRepost) reposts += 1;
    const salary = obs.sourceJob.salary;
    if (salary?.classification === 'EXPLICIT' && salary.minimum != null) {
      salarySupported = true;
      salaryNumerator += Number(salary.minimum);
      salaryDenominator += 1;
    }
  }

  const repostRateBps = postingCount > 0 ? Math.round((reposts * 10_000) / postingCount) : null;
  const postingVelocityPerWeek = postingCount > 0 ? Math.round((input.newPostingCount * 10) / Math.max(postingCount, 1)) / 10 : null;

  return Object.freeze({
    postingCount,
    newPostingCount: input.newPostingCount,
    closedPostingCount: input.closedPostingCount,
    postingGrowthWoWBps: growthBps(postingCount, input.priorWeekCount),
    postingGrowthMoMBps: growthBps(postingCount, input.priorMonthCount),
    postingGrowthYoYBps:
      input.priorYearCount == null ? null : growthBps(postingCount, input.priorYearCount),
    postingDurationDaysMedian: median(durations),
    postingVelocityPerWeek,
    repostRateBps,
    roleBreadth: titles.size,
    locationBreadth: locations.size,
    seniorityMix: Object.freeze({ ...seniorityMix }),
    salaryTrendBps:
      salaryDenominator > 0 && salaryNumerator > 0
        ? Math.min(5_000, Math.round(salaryNumerator / salaryDenominator / 1000))
        : null,
    salaryTrendSupported: salarySupported,
  });
}
