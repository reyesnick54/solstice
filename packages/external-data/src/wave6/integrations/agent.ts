/**
 * Wave 6 — Financial Agent integration for income growth advisory.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityService } from '../service.ts';
import type { UserMatchContext } from '../types.ts';

export type AgentOpportunityEvidence = {
  readonly schema: 'sunrey.agent.opportunity-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly autoApply: false;
  readonly contactEmployer: false;
  readonly discloseUserIdentity: false;
  readonly discloseFinancialPosition: false;
  readonly items: readonly {
    readonly category: 'INCOME_OPPORTUNITY' | 'SKILL_GROWTH' | 'CAREER_PATH' | 'MARKET_SIGNAL';
    readonly summary: string;
    readonly providerId: string;
    readonly relevanceScore: number | null;
    readonly label: 'ADVISORY_ONLY_NOT_EXECUTION';
  }[];
  readonly recommendations: readonly {
    readonly type: 'INCOME_GROWTH' | 'SKILL_DEVELOPMENT' | 'CAREER_CHANGE';
    readonly summary: string;
    readonly rationale: string;
    readonly requiresHumanAuthorization: true;
  }[];
};

export async function buildAgentOpportunityEvidence(
  service: OpportunityService,
  context: UserMatchContext,
  financialGoal?: { readonly name: string; readonly gapMinor: bigint; readonly currency: string },
  nowUtc?: UtcInstant,
): Promise<AgentOpportunityEvidence> {
  const now = nowUtc ?? (await import('../service.ts')).defaultOpportunityNow();
  const items: AgentOpportunityEvidence['items'][number][] = [];
  const recommendations: AgentOpportunityEvidence['recommendations'][number][] = [];

  const career = await service.getCareerOpportunities(context, {}, now);
  if ('jobs' in career) {
    for (const { job, relevance } of career.jobs.slice(0, 5)) {
      items.push(
        Object.freeze({
          category: 'INCOME_OPPORTUNITY',
          summary: `${job.title} at ${job.employer ?? 'unknown employer'} — ${job.freshness}`,
          providerId: job.providerId,
          relevanceScore: relevance.score,
          label: 'ADVISORY_ONLY_NOT_EXECUTION',
        }),
      );
    }
    if (career.jobs.length > 0) {
      recommendations.push(
        Object.freeze({
          type: 'INCOME_GROWTH',
          summary: `${career.jobs.length} relevant job opportunities identified`,
          rationale: financialGoal
            ? `Projected savings gap of ${financialGoal.gapMinor} ${financialGoal.currency} for goal "${financialGoal.name}" may be addressed through income growth`
            : 'Income growth opportunities available based on permitted user attributes',
          requiresHumanAuthorization: true,
        }),
      );
    }
  }

  const skills = await service.searchSkills('', now);
  if (skills.ok) {
    for (const skill of skills.value.slice(0, 3)) {
      items.push(
        Object.freeze({
          category: 'SKILL_GROWTH',
          summary: `Skill: ${skill.canonicalName} — ${skill.category ?? 'uncategorized'}`,
          providerId: skill.provenance?.providerId ?? 'open-skills',
          relevanceScore: null,
          label: 'ADVISORY_ONLY_NOT_EXECUTION',
        }),
      );
    }
  }

  const occupations = await service.searchOccupations('', now);
  if (occupations.ok) {
    for (const occ of occupations.value.slice(0, 3)) {
      items.push(
        Object.freeze({
          category: 'CAREER_PATH',
          summary: `${occ.title} — demand: ${occ.marketDemand ?? 'unknown'}`,
          providerId: occ.providerId,
          relevanceScore: null,
          label: 'ADVISORY_ONLY_NOT_EXECUTION',
        }),
      );
    }
  }

  const intelligence = await service.getPublicIntelligence(now);
  if (intelligence.ok) {
    for (const obs of intelligence.value.slice(0, 3)) {
      items.push(
        Object.freeze({
          category: 'MARKET_SIGNAL',
          summary: obs.summary,
          providerId: obs.providerId,
          relevanceScore: null,
          label: 'ADVISORY_ONLY_NOT_EXECUTION',
        }),
      );
    }
  }

  return Object.freeze({
    schema: 'sunrey.agent.opportunity-evidence.v1',
    generatedAt: now,
    readOnly: true,
    grantsExecutionAuthority: false,
    autoApply: false,
    contactEmployer: false,
    discloseUserIdentity: false,
    discloseFinancialPosition: false,
    items: Object.freeze(items),
    recommendations: Object.freeze(recommendations),
  });
}
