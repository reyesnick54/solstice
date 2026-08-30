import type { SerializedMoney } from '../mandate/types.ts';

/**
 * User-defined planning constraints for ACCESS-20 unified planning.
 * Agent recommendations must respect hard constraints; soft preferences may trade off.
 */
export type PersonalEconomyConstraints = {
  readonly minimumEmergencyCash?: SerializedMoney;
  readonly maximumInvestmentRisk?: 'CONSERVATIVE' | 'MODERATE' | 'BALANCED' | 'GROWTH';
  readonly maximumSunReyExposureMinorUnits?: string;
  readonly maximumMoonReyExposureMinorUnits?: string;
  readonly desiredTravelAccessUnits?: number;
  readonly desiredMobilityAccessUnits?: number;
  readonly desiredFoodEnergyAccessUnits?: number;
  readonly timeHorizonMonths?: number;
  readonly liquidityNeedsMinorUnits?: SerializedMoney;
};

export function freezeConstraints(constraints: PersonalEconomyConstraints): PersonalEconomyConstraints {
  return Object.freeze({ ...constraints });
}

export function defaultConstraints(currency = 'USD'): PersonalEconomyConstraints {
  return freezeConstraints({
    minimumEmergencyCash: { minorUnits: '0', currency },
    maximumInvestmentRisk: 'MODERATE',
    timeHorizonMonths: 12,
  });
}
