/**
 * Wave 6 — Grow integration for income and career growth opportunities.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityService } from '../service.ts';
import type { UserMatchContext } from '../types.ts';

export type GrowOpportunityContext = {
  readonly schema: 'sunrey.grow.opportunity-context.v1';
  readonly referenceOnly: true;
  readonly autoApply: false;
  readonly generatedAt: UtcInstant;
  readonly relevantJobs: readonly {
    readonly opportunityId: string;
    readonly title: string;
    readonly employer: string | null;
    readonly location: string | null;
    readonly remoteStatus: string;
    readonly salaryMax: string | null;
    readonly salaryCurrency: string | null;
    readonly skills: readonly string[];
    readonly freshness: string;
    readonly providerId: string;
    readonly relevanceScore: number;
  }[];
  readonly skillGrowth: readonly {
    readonly skill: string;
    readonly category: string | null;
    readonly relatedOccupations: readonly string[];
  }[];
  readonly careerOptions: readonly {
    readonly title: string;
    readonly marketDemand: string | null;
    readonly salaryMin: string | null;
    readonly salaryMax: string | null;
    readonly providerId: string;
  }[];
  readonly incomeGrowthSignals: readonly {
    readonly summary: string;
    readonly providerId: string;
    readonly authorityClass: string;
  }[];
};

export async function buildGrowOpportunityContext(
  service: OpportunityService,
  context: UserMatchContext,
  nowUtc: UtcInstant,
): Promise<GrowOpportunityContext> {
  const career = await service.getCareerOpportunities(context, {}, nowUtc);
  const skills = await service.searchSkills('', nowUtc);
  const occupations = await service.searchOccupations('', nowUtc);
  const intelligence = await service.getPublicIntelligence(nowUtc);

  const relevantJobs =
    'jobs' in career
      ? career.jobs.map(({ job, relevance }) =>
          Object.freeze({
            opportunityId: job.opportunityId,
            title: job.title,
            employer: job.employer,
            location: job.location,
            remoteStatus: job.remoteStatus,
            salaryMax: job.salary?.sourceAmountMax ?? null,
            salaryCurrency: job.salary?.currency ?? null,
            skills: job.skills,
            freshness: job.freshness,
            providerId: job.providerId,
            relevanceScore: relevance.score,
          }),
        )
      : [];

  const skillGrowth = skills.ok
    ? skills.value.map((s) =>
        Object.freeze({
          skill: s.canonicalName,
          category: s.category,
          relatedOccupations: s.relatedOccupations,
        }),
      )
    : [];

  const careerOptions = occupations.ok
    ? occupations.value.map((o) =>
        Object.freeze({
          title: o.title,
          marketDemand: o.marketDemand,
          salaryMin: o.salaryReference?.sourceAmountMin ?? null,
          salaryMax: o.salaryReference?.sourceAmountMax ?? null,
          providerId: o.providerId,
        }),
      )
    : [];

  const incomeGrowthSignals = intelligence.ok
    ? intelligence.value.map((o) =>
        Object.freeze({
          summary: o.summary,
          providerId: o.providerId,
          authorityClass: o.authorityClass,
        }),
      )
    : [];

  return Object.freeze({
    schema: 'sunrey.grow.opportunity-context.v1',
    referenceOnly: true,
    autoApply: false,
    generatedAt: nowUtc,
    relevantJobs: Object.freeze(relevantJobs),
    skillGrowth: Object.freeze(skillGrowth),
    careerOptions: Object.freeze(careerOptions),
    incomeGrowthSignals: Object.freeze(incomeGrowthSignals),
  });
}
