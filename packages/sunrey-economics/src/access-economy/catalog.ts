/**
 * ACCESS-13 Access Economy scenario catalog.
 *
 * Every scenario is pinned to a dual-economy macro scenario so that
 * abundance, automation, demand shifts, and productivity shocks come from
 * the existing Chunk 75 simulator rather than from invented numbers.
 */

import {
  ACCESS_ECONOMY_LABEL,
  ACCESS_ECONOMY_SCHEMA_VERSION,
  type AccessDecisionOutcome,
  type AccessScarcityDimension,
  type AccessScarcityMode,
  type AccessShockKind,
  type AccessSimScenarioId,
} from './ids.ts';
import type { AccessDemandProfile, AccessEconomyScenario, AccessPoolTemplate } from './types.ts';

const BASE_DEMAND: AccessDemandProfile = Object.freeze({
  subjectCount: 60,
  requestsPerSubject: 2,
  meanQuantity: 40n,
  quantityJitter: 12n,
  missingAuthorityBps: 400n,
  undeterminedEligibilityBps: 300n,
  agentProposalBps: 1_500n,
  agentSelfApprovalBps: 2_500n,
  narrowEntitlementBps: 600n,
  hotspotConcentrationBps: 2_000n,
});

function demand(overrides: Partial<AccessDemandProfile> = {}): AccessDemandProfile {
  return Object.freeze({ ...BASE_DEMAND, ...overrides });
}

function pool(
  experienceClass: string,
  category: AccessPoolTemplate['category'],
  unit: string,
  locations: readonly string[],
  dateKeys: readonly string[],
  providerIds: readonly string[],
  categoryShareBps: bigint,
  preCommittedBps = 0n,
): AccessPoolTemplate {
  return Object.freeze({
    experienceClass,
    category,
    locations: Object.freeze([...locations]),
    dateKeys: Object.freeze([...dateKeys]),
    unit,
    providerIds: Object.freeze([...providerIds]),
    categoryShareBps,
    preCommittedBps,
  });
}

function scenario(
  scenarioId: AccessSimScenarioId,
  title: string,
  seed: number,
  macroScenarioId: string,
  shocks: readonly AccessShockKind[],
  scarcityDimension: AccessScarcityDimension,
  expectedScarcityMode: AccessScarcityMode,
  poolTemplates: readonly AccessPoolTemplate[],
  demandProfile: AccessDemandProfile,
  expectedOutcomes: readonly AccessDecisionOutcome[],
  notes: string,
  macroEpochs = 2,
): AccessEconomyScenario {
  return Object.freeze({
    schemaVersion: ACCESS_ECONOMY_SCHEMA_VERSION,
    scenarioId,
    title,
    simulationLabel: ACCESS_ECONOMY_LABEL,
    seed,
    macroScenarioId,
    macroEpochs,
    shocks: Object.freeze([...shocks]),
    scarcityDimension,
    expectedScarcityMode,
    poolTemplates: Object.freeze([...poolTemplates]),
    demand: demandProfile,
    expectedOutcomes: Object.freeze([...expectedOutcomes]),
    notes,
  });
}

const VEHICLE_LOCATIONS = ['US-CA.bay-area', 'US-TX.dallas', 'DE-BY.munich'] as const;
const VEHICLE_DATES = ['2031-05-10', '2031-05-11'] as const;
const JAPAN_LOCATIONS = ['JP-13.tokyo', 'JP-26.kyoto', 'JP-01.sapporo'] as const;
const JAPAN_DATES = ['2031-11-20', '2031-11-21', '2031-11-22'] as const;

export const ACCESS_ECONOMY_CATALOG: readonly AccessEconomyScenario[] = Object.freeze([
  scenario(
    'ACCESS-SIM-01-abundance',
    'autonomous production expands available capacity',
    9101,
    'post-scarcity-abundance',
    ['ACCESS_ABUNDANCE_EXPANSION'],
    'AGGREGATE',
    'ABUNDANT',
    [
      pool('regional-mobility', 'LOGISTICS_TRANSPORTATION', 't_km', ['US-CA.bay-area', 'US-TX.dallas'], ['2031-05-10'], ['provider.mobility.a', 'provider.mobility.b'], 3_000n),
      pool('managed-residence-stay', 'REAL_ESTATE_USE', 'm2_hour', ['US-CA.bay-area'], ['2031-05-10'], ['provider.stay.a'], 2_500n),
    ],
    demand(),
    ['CONFIRMED', 'REFUSED_NO_EXECUTION_AUTHORITY', 'REFUSED_ELIGIBILITY_UNDETERMINED', 'REFUSED_AI_SELF_APPROVAL'],
    'Scarcity falls and access expands strictly according to policy, not automatically.',
  ),
  scenario(
    'ACCESS-SIM-02-demand-surge',
    'large population requests the same scarce experience',
    9102,
    'human-access-demand-surge',
    ['ACCESS_DEMAND_SURGE'],
    'AGGREGATE',
    'SCARCE',
    [pool('signature-experience', 'SERVICES', 'service_hour', ['JP-13.tokyo'], ['2031-11-20'], ['provider.experience.a'], 60n, 2_000n)],
    demand({ subjectCount: 300, requestsPerSubject: 2, hotspotConcentrationBps: 10_000n }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'Allocation is deterministic and published capacity is never oversold.',
  ),
  scenario(
    'ACCESS-SIM-03-productive-shock',
    'energy, logistics, and manufacturing capacity fall together',
    9103,
    'productive-capacity-collapse',
    ['ACCESS_PRODUCTIVE_CAPACITY_FALL'],
    'AGGREGATE',
    'CONSTRAINED',
    [
      pool('regional-mobility', 'LOGISTICS_TRANSPORTATION', 't_km', ['US-CA.bay-area'], ['2031-05-10'], ['provider.mobility.a'], 1_200n),
      pool('fabricated-goods-access', 'MANUFACTURING', 'UNIT', ['US-TX.dallas'], ['2031-05-10'], ['provider.factory.a'], 1_200n),
    ],
    demand({ subjectCount: 120 }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'Quotes and reservations contract with real capacity; confirmed rights already granted stay honoured.',
  ),
  scenario(
    'ACCESS-SIM-04-geographic-scarcity',
    'global surplus with one constrained location',
    9104,
    'post-scarcity-abundance',
    ['ACCESS_ABUNDANCE_EXPANSION', 'ACCESS_GEOGRAPHIC_CONCENTRATION'],
    'GEOGRAPHIC',
    'SCARCE',
    [pool('regional-mobility', 'LOGISTICS_TRANSPORTATION', 't_km', VEHICLE_LOCATIONS, ['2031-05-10'], ['provider.mobility.a', 'provider.mobility.b', 'provider.mobility.c'], 2_400n)],
    demand({ subjectCount: 200, hotspotConcentrationBps: 8_000n }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'Surplus elsewhere never satisfies a request bound to a constrained location.',
  ),
  scenario(
    'ACCESS-SIM-05-temporal-scarcity',
    'ordinary abundance with an extraordinary peak date',
    9105,
    'post-scarcity-abundance',
    ['ACCESS_ABUNDANCE_EXPANSION', 'ACCESS_TEMPORAL_PEAK'],
    'TEMPORAL',
    'SCARCE',
    [pool('signature-experience', 'SERVICES', 'service_hour', ['JP-26.kyoto'], JAPAN_DATES, ['provider.experience.a', 'provider.experience.b'], 900n)],
    demand({ subjectCount: 220, hotspotConcentrationBps: 8_500n }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'A peak date is scarce even while the surrounding dates stay abundant.',
  ),
  scenario(
    'ACCESS-SIM-06-provider-failure',
    'one provider fails while others remain available',
    9106,
    'baseline',
    ['ACCESS_PROVIDER_OUTAGE'],
    'PROVIDER',
    'SCARCE',
    [pool('managed-residence-stay', 'REAL_ESTATE_USE', 'm2_hour', ['US-CA.bay-area', 'DE-BY.munich'], ['2031-05-10'], ['provider.stay.a', 'provider.stay.b'], 1_800n)],
    demand({ subjectCount: 140 }),
    ['CONFIRMED', 'REFUSED_PROVIDER_UNAVAILABLE'],
    'A failed provider refuses rather than silently reassigning a person to another provider.',
  ),
  scenario(
    'ACCESS-SIM-07-oracle-stale',
    'capacity evidence is stale or unavailable',
    9107,
    'oracle-degradation',
    ['ACCESS_ORACLE_STALE'],
    'AGGREGATE',
    'UNAVAILABLE',
    [pool('regional-mobility', 'LOGISTICS_TRANSPORTATION', 't_km', ['US-CA.bay-area'], ['2031-05-10'], ['provider.mobility.a'], 2_000n)],
    demand({ subjectCount: 80 }),
    ['REFUSED_STALE_EVIDENCE'],
    'Stale capacity evidence fails closed. Capacity is never assumed from an old observation.',
  ),
  scenario(
    'ACCESS-SIM-08-exchange-unavailable',
    'canonical Exchange quotes are unavailable',
    9108,
    'market-volatility',
    ['ACCESS_EXCHANGE_UNAVAILABLE'],
    'AGGREGATE',
    'UNAVAILABLE',
    [pool('signature-experience', 'SERVICES', 'service_hour', ['JP-13.tokyo'], ['2031-11-20'], ['provider.experience.a'], 1_500n)],
    demand({ subjectCount: 80 }),
    ['REFUSED_PRICING_UNAVAILABLE'],
    'No fallback price, no invented conversion, and no peg when the Exchange is unavailable.',
  ),
  scenario(
    'ACCESS-SIM-09-settlement-failure',
    'ledger or custody settlement does not complete',
    9109,
    'baseline',
    ['ACCESS_SETTLEMENT_FAILURE'],
    'AGGREGATE',
    'CONSTRAINED',
    [pool('managed-residence-stay', 'REAL_ESTATE_USE', 'm2_hour', ['US-CA.bay-area'], ['2031-05-10'], ['provider.stay.a'], 2_200n)],
    demand({ subjectCount: 90 }),
    ['CONFIRMED', 'REFUSED_SETTLEMENT_FAILED'],
    'A failed settlement releases its reservation instead of leaving capacity double-committed.',
  ),
  scenario(
    'ACCESS-SIM-10-policy-change-during-reservation',
    'policy version changes mid-reservation',
    9110,
    'baseline',
    ['ACCESS_POLICY_CHANGE_MID_RESERVATION'],
    'AGGREGATE',
    'CONSTRAINED',
    [pool('regional-mobility', 'LOGISTICS_TRANSPORTATION', 't_km', ['US-CA.bay-area'], ['2031-05-10'], ['provider.mobility.a'], 2_000n)],
    demand({ subjectCount: 100 }),
    ['CONFIRMED', 'HELD_FOR_POLICY_REVIEW'],
    'Confirmed rights are honoured; later reservations are held for review rather than auto-approved.',
  ),
  scenario(
    'ACCESS-SIM-11-mass-reservation-concurrency',
    'mass concurrent reservations against one bucket',
    9111,
    'human-access-demand-surge',
    ['ACCESS_MASS_CONCURRENCY', 'ACCESS_DEMAND_SURGE'],
    'AGGREGATE',
    'SCARCE',
    [pool('signature-experience', 'SERVICES', 'service_hour', ['JP-13.tokyo'], ['2031-11-20'], ['provider.experience.a'], 120n)],
    demand({ subjectCount: 600, requestsPerSubject: 2, hotspotConcentrationBps: 10_000n }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'Concurrency stress: 1200 requests against one bucket must not oversell a single unit.',
  ),
  scenario(
    'ACCESS-SIM-12-abundant-vehicle-class',
    'abundant mass-market vehicle class access',
    9112,
    'post-scarcity-abundance',
    ['ACCESS_ABUNDANCE_EXPANSION'],
    'AGGREGATE',
    'ABUNDANT',
    [pool('mass-market-vehicle-use', 'LOGISTICS_TRANSPORTATION', 't_km', VEHICLE_LOCATIONS, VEHICLE_DATES, ['provider.fleet.a', 'provider.fleet.b'], 3_500n)],
    demand({ subjectCount: 180, meanQuantity: 30n }),
    ['CONFIRMED'],
    'The abundant-vehicle reference case: wide availability still requires authority and eligibility.',
  ),
  scenario(
    'ACCESS-SIM-13-premium-scarce-vehicle',
    'premium scarce vehicle class access',
    9113,
    'baseline',
    ['ACCESS_DEMAND_SURGE'],
    'AGGREGATE',
    'SCARCE',
    [pool('limited-production-vehicle-use', 'LOGISTICS_TRANSPORTATION', 't_km', ['US-CA.bay-area'], ['2031-05-10'], ['provider.fleet.premium'], 20n, 3_000n)],
    demand({ subjectCount: 250, requestsPerSubject: 1, hotspotConcentrationBps: 10_000n }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'A genuinely scarce class refuses most requests. Scarcity is reported, not priced into a new unit.',
  ),
  scenario(
    'ACCESS-SIM-14-japan-composite-travel',
    'composite multi-leg travel experience across Japan',
    9114,
    'baseline',
    ['ACCESS_TEMPORAL_PEAK'],
    'TEMPORAL',
    'SCARCE',
    [
      pool('long-haul-transit', 'LOGISTICS_TRANSPORTATION', 't_km', ['JP-13.tokyo'], JAPAN_DATES, ['provider.transit.air'], 800n),
      pool('managed-residence-stay', 'REAL_ESTATE_USE', 'm2_hour', JAPAN_LOCATIONS, JAPAN_DATES, ['provider.stay.jp'], 1_400n),
      pool('signature-experience', 'SERVICES', 'service_hour', JAPAN_LOCATIONS, JAPAN_DATES, ['provider.experience.jp'], 900n),
    ],
    demand({ subjectCount: 160, requestsPerSubject: 3 }),
    ['CONFIRMED', 'REFUSED_CAPACITY_EXHAUSTED'],
    'Composite travel: each leg is a separate capacity bucket and each leg can refuse independently.',
    3,
  ),
  scenario(
    'ACCESS-SIM-15-household-food-access',
    'recurring household food and water access',
    9115,
    'baseline',
    [],
    'AGGREGATE',
    'ABUNDANT',
    [
      pool('household-food-basket', 'FOOD_AGRICULTURE', 'kg', ['US-CA.bay-area', 'US-TX.dallas'], ['2031-05-10', '2031-05-11'], ['provider.food.a', 'provider.food.b'], 3_600n),
      pool('household-water-access', 'WATER', 'L', ['US-CA.bay-area', 'US-TX.dallas'], ['2031-05-10', '2031-05-11'], ['provider.water.a'], 3_600n),
    ],
    demand({ subjectCount: 200, requestsPerSubject: 2, meanQuantity: 20n, quantityJitter: 6n }),
    ['CONFIRMED'],
    'Recurring essential access replenishes on policy windows and never becomes a transferable balance.',
  ),
]);

export function accessScenarioById(scenarioId: string): AccessEconomyScenario | undefined {
  return ACCESS_ECONOMY_CATALOG.find((row) => row.scenarioId === scenarioId);
}

export function accessScenarioIds(): readonly string[] {
  return ACCESS_ECONOMY_CATALOG.map((row) => row.scenarioId);
}

export function accessCatalogComplete(): boolean {
  return (
    ACCESS_ECONOMY_CATALOG.length === 15 &&
    new Set(accessScenarioIds()).size === ACCESS_ECONOMY_CATALOG.length
  );
}
