import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityCategory, OpportunityRiskLevel } from './taxonomy.ts';
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_RISK_LEVELS } from './taxonomy.ts';
import { riskRank } from './products.ts';
import type { OpportunityPreferences } from './types.ts';

export function defaultOpportunityPreferences(subjectId: string, now: UtcInstant): OpportunityPreferences {
  return Object.freeze({
    subjectId,
    excludedCategories: Object.freeze([]),
    liquidityPreference: 'NEUTRAL',
    maxRiskLevel: 'MODERATE',
    goalPriorities: Object.freeze([]),
    updatedAt: now,
    cannotOverrideSuitability: true,
  });
}

export function mergeOpportunityPreferences(input: {
  readonly current: OpportunityPreferences;
  readonly patch: {
    readonly excludedCategories?: readonly string[];
    readonly liquidityPreference?: OpportunityPreferences['liquidityPreference'];
    readonly maxRiskLevel?: string;
    readonly goalPriorities?: readonly string[];
  };
  readonly suitabilityMaxRisk: OpportunityRiskLevel;
  readonly now: UtcInstant;
}): OpportunityPreferences {
  const excluded = (input.patch.excludedCategories ?? input.current.excludedCategories).filter((item): item is OpportunityCategory =>
    (OPPORTUNITY_CATEGORIES as readonly string[]).includes(item),
  );
  let maxRisk = input.current.maxRiskLevel;
  if (input.patch.maxRiskLevel && (OPPORTUNITY_RISK_LEVELS as readonly string[]).includes(input.patch.maxRiskLevel)) {
    maxRisk = input.patch.maxRiskLevel as OpportunityRiskLevel;
  }
  if (riskRank(maxRisk) > riskRank(input.suitabilityMaxRisk)) {
    maxRisk = input.suitabilityMaxRisk;
  }
  return Object.freeze({
    subjectId: input.current.subjectId,
    excludedCategories: Object.freeze([...excluded]),
    liquidityPreference: input.patch.liquidityPreference ?? input.current.liquidityPreference,
    maxRiskLevel: maxRisk,
    goalPriorities: Object.freeze([...(input.patch.goalPriorities ?? input.current.goalPriorities)]),
    updatedAt: input.now,
    cannotOverrideSuitability: true,
  });
}

export function preferenceSuppresses(
  preferences: OpportunityPreferences,
  category: OpportunityCategory,
): boolean {
  return preferences.excludedCategories.includes(category);
}
