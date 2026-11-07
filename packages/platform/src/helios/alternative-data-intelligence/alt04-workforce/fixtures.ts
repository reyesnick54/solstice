import type { JobOpportunity } from '@solstice/external-data/wave6';
import { createOpportunityService, defaultOpportunityNow } from '@solstice/external-data/wave6';

export const ALT04_FIXTURE_EVALUATION_TIME = defaultOpportunityNow();

export async function loadAlt04FixtureJobs(nowUtc = defaultOpportunityNow()): Promise<readonly JobOpportunity[]> {
  const service = createOpportunityService();
  const result = await service.searchJobs({}, nowUtc);
  if (!result.ok) return Object.freeze([]);
  return Object.freeze(result.value);
}

export const ALT04_DEMO_HISTORY = Object.freeze({
  firmKey: 'acme_corp',
  windowEnd: ALT04_FIXTURE_EVALUATION_TIME,
  priorWeekCount: 4,
  priorMonthCount: 6,
  priorYearCount: 8,
  industryHiringCycleIndexBps: 5_500,
});
