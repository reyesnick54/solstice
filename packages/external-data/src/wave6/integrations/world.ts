/**
 * Wave 6 — World integration for employment opportunity aggregates.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityService } from './service.ts';
import { buildOpportunityCoverageReport } from '../opportunity-coverage.ts';

export type WorldOpportunitySnapshot = {
  readonly schema: 'sunrey.world.opportunity.v1';
  readonly generatedAt: UtcInstant;
  readonly referenceOnly: true;
  readonly representsEntireLaborMarket: false;
  readonly jobCount: number;
  readonly skillCount: number;
  readonly occupationCount: number;
  readonly intelligenceCount: number;
  readonly geographicCoverage: readonly string[];
  readonly coverageNote: string;
  readonly limitations: string;
  readonly salaryTrends: readonly {
    readonly occupation: string;
    readonly salaryMin: string | null;
    readonly salaryMax: string | null;
    readonly currency: string;
    readonly period: string;
    readonly providerId: string;
  }[];
  readonly skillDemand: readonly {
    readonly skill: string;
    readonly providerId: string;
  }[];
  readonly hiringSignals: readonly {
    readonly title: string;
    readonly providerId: string;
    readonly authorityClass: string;
    readonly verifiedFact: false;
  }[];
};

export async function buildWorldOpportunitySnapshot(
  service: OpportunityService,
  nowUtc: UtcInstant,
): Promise<WorldOpportunitySnapshot> {
  const coverage = buildOpportunityCoverageReport();
  const jobs = await service.searchJobs({}, nowUtc);
  const skills = await service.searchSkills('', nowUtc);
  const occupations = await service.searchOccupations('', nowUtc);
  const intelligence = await service.getPublicIntelligence(nowUtc);

  const salaryTrends = occupations.ok
    ? occupations.value
        .filter((o) => o.salaryReference)
        .map((o) =>
          Object.freeze({
            occupation: o.title,
            salaryMin: o.salaryReference?.sourceAmountMin ?? null,
            salaryMax: o.salaryReference?.sourceAmountMax ?? null,
            currency: o.salaryReference?.currency ?? 'USD',
            period: o.salaryReference?.period ?? 'ANNUAL',
            providerId: o.providerId,
          }),
        )
    : [];

  const skillDemand = skills.ok
    ? skills.value.map((s) => Object.freeze({ skill: s.canonicalName, providerId: s.provenance?.providerId ?? 'unknown' }))
    : [];

  const hiringSignals = intelligence.ok
    ? intelligence.value.map((o) =>
        Object.freeze({
          title: o.title,
          providerId: o.providerId,
          authorityClass: o.authorityClass,
          verifiedFact: false as const,
        }),
      )
    : [];

  return Object.freeze({
    schema: 'sunrey.world.opportunity.v1',
    generatedAt: nowUtc,
    referenceOnly: true,
    representsEntireLaborMarket: false,
    jobCount: jobs.ok ? jobs.value.length : 0,
    skillCount: skills.ok ? skills.value.length : 0,
    occupationCount: occupations.ok ? occupations.value.length : 0,
    intelligenceCount: intelligence.ok ? intelligence.value.length : 0,
    geographicCoverage: coverage.geographicCoverage,
    coverageNote: coverage.jobCoverageNote,
    limitations: coverage.limitations,
    salaryTrends: Object.freeze(salaryTrends),
    skillDemand: Object.freeze(skillDemand),
    hiringSignals: Object.freeze(hiringSignals),
  });
}
