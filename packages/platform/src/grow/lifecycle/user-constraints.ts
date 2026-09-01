import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { OpportunityPreferences } from '../../growth/opportunity/types.ts';
import type { SuitabilityFacts } from '../suitability.ts';

/**
 * Authorized user preferences consumed by Grow proposals.
 * HIN/PEG/mandate fields are optional; only necessary data is required.
 */
export type UserGrowConstraints = {
  readonly financialGoals: readonly string[];
  readonly riskTolerance: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  readonly timeHorizon: 'IMMEDIATE' | 'NEAR_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'UNSPECIFIED';
  readonly liquidityNeeds: 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  readonly currency: string;
  readonly investmentRestrictions: readonly string[];
  readonly minimumCashReserveMinorUnits: string | null;
  readonly fullHinRequired: false;
};

export function userGrowConstraintsFrom(input: {
  readonly mandate?: CompiledEconomicMandate;
  readonly preferences?: OpportunityPreferences;
  readonly suitability?: SuitabilityFacts;
  readonly defaultCurrency?: string;
}): UserGrowConstraints {
  const goals =
    input.mandate?.goals.map((goal) => goal.label ?? goal.kind).slice(0, 8) ??
    input.preferences?.goalPriorities ??
    Object.freeze([]);
  const riskTolerance = riskFromSuitability(input.suitability?.riskProfile);
  const reserve =
    input.mandate?.hardConstraints.find((row) => row.kind === 'MINIMUM_CASH_RESERVE')?.amount?.minorUnits ?? null;
  const restrictions = input.preferences?.excludedCategories.map((row) => `EXCLUDE_${row}`) ?? Object.freeze([]);
  return Object.freeze({
    financialGoals: Object.freeze([...goals]),
    riskTolerance,
    timeHorizon: 'UNSPECIFIED',
    liquidityNeeds:
      input.preferences?.liquidityPreference === 'PREFER_LIQUIDITY'
        ? 'HIGH'
        : input.preferences?.liquidityPreference === 'ACCEPT_LESS_LIQUID'
          ? 'LOW'
          : 'MODERATE',
    currency: input.defaultCurrency ?? 'USD',
    investmentRestrictions: Object.freeze([...restrictions]),
    minimumCashReserveMinorUnits: reserve,
    fullHinRequired: false,
  });
}

function riskFromSuitability(profile: SuitabilityFacts['riskProfile'] | undefined): UserGrowConstraints['riskTolerance'] {
  if (profile === 'LOW') return 'LOW';
  if (profile === 'MODERATE') return 'MODERATE';
  if (profile === 'HIGH') return 'HIGH';
  return 'UNKNOWN';
}
