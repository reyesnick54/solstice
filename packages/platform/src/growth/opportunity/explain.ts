import type { Opportunity, OpportunityExplanationInput } from './types.ts';

export const EXPLANATION_INSTRUCTIONS = Object.freeze([
  'Explain only the structured Opportunity facts supplied here.',
  'Do not invent balances, rates, fees, dates, or goal amounts.',
  'Do not promise a return, yield, APY, APR, or goal achievement.',
  'State assumptions, risks, and eligibility failures exactly as given.',
  'Starting a proposal does not move money.',
]);

export function explanationInputFor(opportunity: Opportunity): OpportunityExplanationInput {
  return Object.freeze({
    schema: 'sunrey.growth.opportunity.explanation.v1',
    opportunity,
    inventedNumbersForbidden: true,
    returnGuaranteeForbidden: true,
    instructions: EXPLANATION_INSTRUCTIONS,
  });
}

export function explanationFactsText(input: OpportunityExplanationInput): string {
  const opportunity = input.opportunity;
  const impact = opportunity.estimatedImpact
    ? `${opportunity.estimatedImpact.minorUnits} ${opportunity.estimatedImpact.currency}`
    : 'unquantified';
  return [
    `opportunityId=${opportunity.opportunityId}`,
    `detector=${opportunity.detector}`,
    `type=${opportunity.type}`,
    `status=${opportunity.status}`,
    `eligible=${String(opportunity.eligible)}`,
    `title=${opportunity.title}`,
    `summary=${opportunity.summary}`,
    `impactKind=${opportunity.impact.kind}`,
    `estimatedImpact=${impact}`,
    `assumptions=${opportunity.impact.assumptions.join(' | ')}`,
    `risks=${opportunity.riskLevel}`,
    `goals=${opportunity.goalLinks.map((item) => item.label).join(',') || 'none'}`,
    `eligibility=${opportunity.eligibility.reasons.join(' | ')}`,
    `ranking=${opportunity.ranking.reasons.join(' | ')}`,
    'returnGuaranteed=false',
    'achievementPromised=false',
  ].join('\n');
}
