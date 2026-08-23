import type { Opportunity, OpportunityFeed, OpportunityFeedCard } from './types.ts';
import { DETECTOR_TO_CARD } from './taxonomy.ts';

export function feedCardFor(opportunity: Opportunity): OpportunityFeedCard {
  const card =
    opportunity.detector === 'GOAL_FUNDING_GAP' && opportunity.goalLinks.every((item) => item.projectedShortfall?.minorUnits === '0')
      ? 'GOAL_ON_TRACK'
      : DETECTOR_TO_CARD[opportunity.detector];
  return Object.freeze({
    card,
    opportunityId: opportunity.opportunityId,
    title: opportunity.title,
    summary: opportunity.summary,
    category: opportunity.type,
    status: opportunity.status,
    eligible: opportunity.eligible,
    priority: opportunity.priority,
    currency: opportunity.currency,
    ...(opportunity.estimatedImpact ? { estimatedImpact: opportunity.estimatedImpact } : {}),
    ...(opportunity.impactRange ? { impactRange: opportunity.impactRange } : {}),
    impactKind: opportunity.impact.kind,
    riskLevel: opportunity.riskLevel,
    timeHorizon: opportunity.timeHorizon,
    goalLinks: opportunity.goalLinks,
    assumptions: opportunity.impact.assumptions,
    achievementPromised: false,
    immediatelyExecutable: false,
  });
}

export function opportunityFeed(input: {
  readonly subjectId: string;
  readonly generatedAt: OpportunityFeed['generatedAt'];
  readonly presented: readonly Opportunity[];
  readonly suppressedCount: number;
}): OpportunityFeed {
  return Object.freeze({
    schema: 'sunrey.consumer.grow.opportunities.v1',
    subjectId: input.subjectId,
    generatedAt: input.generatedAt,
    rankingVersion: 'OPPORTUNITY_RANKING_V1',
    cards: Object.freeze(input.presented.map(feedCardFor)),
    items: Object.freeze([...input.presented]),
    suppressedCount: input.suppressedCount,
    productionMoneyMovement: false,
  });
}
