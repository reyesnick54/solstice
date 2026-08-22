/**
 * Controlled return-assumption catalog.
 * An LLM must not invent expected-return numbers. Missing support is UNAVAILABLE.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { asAssumptionSetId, type AssumptionSetId } from './ids.ts';
import type { GrowRiskProfile } from './taxonomy.ts';
import type { ReturnAssumption } from './types.ts';

export const ASSUMPTION_CATALOG_ID = 'SUNREY_SIMULATION_ASSUMPTION_CATALOG_V1' as const;
export const ASSUMPTION_DATA_AS_OF = asUtcInstant('2026-01-15T00:00:00.000Z');
export const ASSUMPTION_METHODOLOGY =
  'Deterministic CONSERVATIVE/BASE/UPSIDE annual basis-point sleeves plus an optional seeded monthly sampler. Simulation illustrations only.';

type CatalogRow = {
  readonly catalogId: string;
  readonly assetSleeve: string;
  readonly currency: string;
  readonly riskProfile: GrowRiskProfile;
  readonly minHorizonMonths: number;
  readonly maxHorizonMonths: number;
  readonly conservativeAnnualBps: number;
  readonly baseAnnualBps: number;
  readonly upsideAnnualBps: number;
  readonly volatilityBps: number;
  readonly feeBpsAnnual: number;
};

const CATALOG: readonly CatalogRow[] = Object.freeze([
  row('USD', 'CONSERVATIVE', 150, 300, 450, 600, 10),
  row('USD', 'BALANCED', 200, 500, 800, 1200, 15),
  row('USD', 'GROWTH', 250, 650, 1000, 1800, 20),
  row('GBP', 'CONSERVATIVE', 140, 280, 420, 600, 10),
  row('GBP', 'BALANCED', 190, 470, 760, 1200, 15),
  row('GBP', 'GROWTH', 230, 620, 960, 1800, 20),
]);

function row(
  currency: string,
  riskProfile: GrowRiskProfile,
  conservativeAnnualBps: number,
  baseAnnualBps: number,
  upsideAnnualBps: number,
  volatilityBps: number,
  feeBpsAnnual: number,
): CatalogRow {
  return Object.freeze({
    catalogId: `${ASSUMPTION_CATALOG_ID}:${currency}:${riskProfile}`,
    assetSleeve: `SIMULATION_${riskProfile}_SLEEVE`,
    currency,
    riskProfile,
    minHorizonMonths: 1,
    maxHorizonMonths: 120,
    conservativeAnnualBps,
    baseAnnualBps,
    upsideAnnualBps,
    volatilityBps,
    feeBpsAnnual,
  });
}

export function assumptionSetIdFor(currency: string, riskProfile: GrowRiskProfile): AssumptionSetId {
  return asAssumptionSetId(`asm_${currency.toLowerCase()}_${riskProfile.toLowerCase()}_v1`);
}

export function lookupReturnAssumption(input: {
  readonly currency: string;
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
}): ReturnAssumption {
  const match = CATALOG.find(
    (item) =>
      item.currency === input.currency &&
      item.riskProfile === input.riskProfile &&
      input.timeHorizonMonths >= item.minHorizonMonths &&
      input.timeHorizonMonths <= item.maxHorizonMonths,
  );
  if (!match) {
    return Object.freeze({
      assumptionSetId: assumptionSetIdFor(input.currency, input.riskProfile),
      availability: 'UNAVAILABLE',
      unavailableReason: catalogMissReason(input),
      currency: input.currency,
      riskProfile: input.riskProfile,
      guaranteed: false,
      inventedByModel: false,
      environment: 'simulation',
    });
  }
  return Object.freeze({
    assumptionSetId: assumptionSetIdFor(match.currency, match.riskProfile),
    availability: 'AVAILABLE',
    catalogId: match.catalogId,
    assetSleeve: match.assetSleeve,
    currency: match.currency,
    riskProfile: match.riskProfile,
    dataAsOf: ASSUMPTION_DATA_AS_OF,
    source: ASSUMPTION_CATALOG_ID,
    methodology: ASSUMPTION_METHODOLOGY,
    conservativeAnnualBps: match.conservativeAnnualBps,
    baseAnnualBps: match.baseAnnualBps,
    upsideAnnualBps: match.upsideAnnualBps,
    volatilityBps: match.volatilityBps,
    feeBpsAnnual: match.feeBpsAnnual,
    guaranteed: false,
    inventedByModel: false,
    environment: 'simulation',
  });
}

function catalogMissReason(input: {
  readonly currency: string;
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
}): string {
  if (input.timeHorizonMonths < 1 || input.timeHorizonMonths > 120) {
    return 'NO_CATALOG_ENTRY_FOR_HORIZON';
  }
  if (input.currency !== 'USD' && input.currency !== 'GBP') {
    return 'NO_CATALOG_ENTRY_FOR_CURRENCY';
  }
  return 'NO_CATALOG_ENTRY';
}

export function annualBpsForScenario(
  assumption: ReturnAssumption,
  kind: 'CONSERVATIVE' | 'BASE' | 'UPSIDE',
): number | undefined {
  if (assumption.availability !== 'AVAILABLE') {
    return undefined;
  }
  if (kind === 'CONSERVATIVE') return assumption.conservativeAnnualBps;
  if (kind === 'UPSIDE') return assumption.upsideAnnualBps;
  return assumption.baseAnnualBps;
}
