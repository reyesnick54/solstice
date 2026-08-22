import { Money } from '../../../../money/src/money.ts';
import { RANKING_VERSION } from './taxonomy.ts';
import type { Opportunity, OpportunityPreferences, OpportunityRanking } from './types.ts';

const WEIGHTS = {
  urgency: 25,
  goalRelevance: 20,
  impact: 20,
  confidence: 15,
  liquidity: 10,
  cost: 5,
  preference: 5,
} as const;

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function impactScore(opportunity: Opportunity): number {
  if (opportunity.impact.kind === 'KNOWN_FINANCIAL_EFFECT' && opportunity.estimatedImpact) {
    const amount = Money.fromMinorUnitsString(
      opportunity.estimatedImpact.minorUnits,
      opportunity.estimatedImpact.currency,
    );
    const scaled = Number(amount.minorUnits / 1000n);
    return clamp(Math.min(100, scaled));
  }
  if (opportunity.impact.kind === 'ESTIMATED_RANGE' && opportunity.impactRange) {
    const high = Money.fromMinorUnitsString(
      opportunity.impactRange.high.minorUnits,
      opportunity.impactRange.high.currency,
    );
    return clamp(Math.min(80, Number(high.minorUnits / 2000n)));
  }
  if (opportunity.impact.kind === 'SCENARIO_RANGE') {
    return 0;
  }
  return 20;
}

function goalRelevance(opportunity: Opportunity, preferences: OpportunityPreferences): number {
  if (opportunity.goalLinks.length === 0) {
    return 10;
  }
  let best = 50;
  for (const link of opportunity.goalLinks) {
    const index = preferences.goalPriorities.indexOf(link.goalId);
    if (index === 0) {
      best = 100;
    } else if (index > 0) {
      best = Math.max(best, 80 - index * 10);
    } else {
      best = Math.max(best, 60);
    }
  }
  return clamp(best);
}

function liquidityFit(opportunity: Opportunity, preferences: OpportunityPreferences): number {
  if (preferences.liquidityPreference === 'PREFER_LIQUIDITY') {
    if (opportunity.liquidityImpact === 'INCREASES') return 100;
    if (opportunity.liquidityImpact === 'NEUTRAL') return 70;
    return 20;
  }
  if (preferences.liquidityPreference === 'ACCEPT_LESS_LIQUID') {
    return opportunity.liquidityImpact === 'DECREASES' ? 70 : 60;
  }
  return 60;
}

function costPenalty(opportunity: Opportunity): number {
  const feeTotal = opportunity.fees.reduce((sum, fee) => sum + BigInt(fee.amount.minorUnits), 0n);
  if (feeTotal <= 0n) {
    return 0;
  }
  return clamp(Number(feeTotal / 100n));
}

function preferenceFit(opportunity: Opportunity, preferences: OpportunityPreferences): number {
  if (preferences.excludedCategories.includes(opportunity.type)) {
    return 0;
  }
  if (opportunity.riskLevel === 'LOW' && preferences.maxRiskLevel === 'LOW') {
    return 90;
  }
  return 60;
}

export function rankOpportunity(
  opportunity: Omit<Opportunity, 'ranking' | 'priority'>,
  preferences: OpportunityPreferences,
  confidence: number,
  urgency: number,
): OpportunityRanking {
  const goal = goalRelevance(opportunity as Opportunity, preferences);
  const impact = impactScore(opportunity as Opportunity);
  const liquidity = liquidityFit(opportunity as Opportunity, preferences);
  const preference = preferenceFit(opportunity as Opportunity, preferences);
  const cost = costPenalty(opportunity as Opportunity);
  const total = clamp(
    (urgency * WEIGHTS.urgency +
      goal * WEIGHTS.goalRelevance +
      impact * WEIGHTS.impact +
      confidence * WEIGHTS.confidence +
      liquidity * WEIGHTS.liquidity +
      (100 - cost) * WEIGHTS.cost +
      preference * WEIGHTS.preference) /
      100,
  );
  return Object.freeze({
    version: RANKING_VERSION,
    priority: 0,
    total,
    goalRelevance: goal,
    urgency: clamp(urgency),
    confidence: clamp(confidence),
    impactScore: impact,
    liquidityFit: liquidity,
    preferenceFit: preference,
    costPenalty: cost,
    reasons: Object.freeze([
      `urgency=${String(clamp(urgency))}`,
      `goalRelevance=${String(goal)}`,
      `impact=${String(impact)}`,
      `confidence=${String(clamp(confidence))}`,
      `liquidity=${String(liquidity)}`,
      `preference=${String(preference)}`,
      `costPenalty=${String(cost)}`,
    ]),
  });
}

export function assignPriorities(items: readonly Opportunity[]): readonly Opportunity[] {
  const sorted = [...items].sort((left, right) => {
    if (left.eligible !== right.eligible) {
      return left.eligible ? -1 : 1;
    }
    if (left.ranking.total !== right.ranking.total) {
      return right.ranking.total - left.ranking.total;
    }
    return left.opportunityId.localeCompare(right.opportunityId);
  });
  return Object.freeze(
    sorted.map((item, index) =>
      Object.freeze({
        ...item,
        priority: index + 1,
        ranking: Object.freeze({ ...item.ranking, priority: index + 1 }),
      }),
    ),
  );
}

export function rankingWeights(): typeof WEIGHTS {
  return WEIGHTS;
}
