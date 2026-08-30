/**
 * ACCESS-22 deterministic stress scenario catalog (45 scenarios).
 *
 * Every scenario pins policy versions, seed, and expected invariants.
 * Simulation results are not forecasts.
 */

import {
  ACCESS_22_INVARIANT_IDS,
  ACCESS_22_POLICY_VERSIONS,
  ACCESS_22_SCENARIO_IDS,
  type Access22ScenarioId,
  type Access22StabilityClassification,
} from './ids.ts';
import type { Access22Scenario, CapacityState, ExchangeState, OracleState, ProviderState, ReserveState, TokenPricePath } from './types.ts';

function capacity(overrides: Partial<CapacityState> & Pick<CapacityState, 'allocatableUnits'>): CapacityState {
  return Object.freeze({
    nativeCapacityShareBps: 7_500n,
    externalProviderLiabilityUnits: 0n,
    fundedReserveUnits: 10_000n,
    capacityGrowthBps: 0n,
    productiveAbundanceIndexBps: 10_000n,
    categoryUnits: Object.freeze({
      compute: 1_000n,
      energy: 1_000n,
      vehicle: 1_000n,
      hotel: 1_000n,
      food: 1_000n,
      housing: 1_000n,
    }),
    ...overrides,
  });
}

function price(overrides: Partial<TokenPricePath> = {}): TokenPricePath {
  return Object.freeze({
    srPriceBps: 10_000n,
    mrPriceBps: 10_000n,
    srPriceChangeBps: 0n,
    mrPriceChangeBps: 0n,
    ...overrides,
  });
}

function reserve(overrides: Partial<ReserveState> = {}): ReserveState {
  return Object.freeze({
    coverageBps: 10_000n,
    depleted: false,
    refundWaveBps: 0n,
    ...overrides,
  });
}

function oracle(overrides: Partial<OracleState> = {}): OracleState {
  return Object.freeze({
    degraded: false,
    collusionRisk: false,
    controllerConcentrationBps: 2_000n,
    staleEvidence: false,
    ...overrides,
  });
}

function provider(overrides: Partial<ProviderState> = {}): ProviderState {
  return Object.freeze({
    providerCount: 8,
    topProviderShareBps: 2_500n,
    collapsed: false,
    topProviderOutage: false,
    phantomCapacityAttempted: false,
    ...overrides,
  });
}

function exchange(overrides: Partial<ExchangeState> = {}): ExchangeState {
  return Object.freeze({
    halted: false,
    illiquid: false,
    liquidityUnits: 50_000n,
    spreadBps: 120n,
    ...overrides,
  });
}

function scenario(
  scenarioId: Access22ScenarioId,
  title: string,
  seed: number,
  macroScenarioId: string,
  overrides: {
    participantCount?: number;
    providerCount?: number;
    macroEpochs?: number;
    capacityState: CapacityState;
    tokenPricePath?: TokenPricePath;
    reserveState?: ReserveState;
    oracleState?: OracleState;
    providerState?: ProviderState;
    exchangeState?: ExchangeState;
    expectedClassifications?: readonly Access22StabilityClassification[];
    notes: string;
  },
): Access22Scenario {
  return Object.freeze({
    schemaVersion: 1,
    scenarioId,
    title,
    seed,
    policyVersions: ACCESS_22_POLICY_VERSIONS,
    participantCount: overrides.participantCount ?? 1_000,
    providerCount: overrides.providerCount ?? 8,
    macroScenarioId,
    macroEpochs: overrides.macroEpochs ?? 2,
    capacityState: overrides.capacityState,
    tokenPricePath: overrides.tokenPricePath ?? price(),
    reserveState: overrides.reserveState ?? reserve(),
    oracleState: overrides.oracleState ?? oracle(),
    providerState: overrides.providerState ?? provider({ providerCount: overrides.providerCount ?? 8 }),
    exchangeState: overrides.exchangeState ?? exchange(),
    expectedInvariants: ACCESS_22_INVARIANT_IDS,
    expectedClassifications: overrides.expectedClassifications ?? Object.freeze(['HEALTHY_SIMULATION']),
    notes: overrides.notes,
  });
}

export const ACCESS_22_CATALOG: readonly Access22Scenario[] = Object.freeze([
  scenario('ACCESS22-01-baseline-balanced-economy', 'Baseline balanced economy', 22001, 'baseline', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Balanced dual-economy baseline with moderate capacity.',
  }),
  scenario('ACCESS22-02-rapid-human-adoption', 'Rapid human adoption', 22002, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 80_000n, capacityGrowthBps: 500n }),
    expectedClassifications: Object.freeze(['DEMAND_IMBALANCE']),
    notes: 'Human participation surge without automatic SR issuance.',
  }),
  scenario('ACCESS22-03-rapid-productive-automation', 'Rapid productive automation', 22003, 'rapid-automation', {
    capacityState: capacity({ allocatableUnits: 120_000n, productiveAbundanceIndexBps: 15_000n }),
    notes: 'Automation expands productive output; access rises only via capacity.',
  }),
  scenario('ACCESS22-04-extreme-compute-abundance', 'Extreme compute abundance', 22004, 'compute-abundance', {
    capacityState: capacity({
      allocatableUnits: 400_000n,
      categoryUnits: Object.freeze({ compute: 100_000n, energy: 5_000n, vehicle: 5_000n, hotel: 5_000n, food: 5_000n, housing: 5_000n }),
      productiveAbundanceIndexBps: 40_000n,
    }),
    notes: 'Compute abundance does not mint access money.',
  }),
  scenario('ACCESS22-05-energy-scarcity', 'Energy scarcity', 22005, 'energy-scarcity', {
    capacityState: capacity({
      allocatableUnits: 25_000n,
      categoryUnits: Object.freeze({ compute: 2_000n, energy: 500n, vehicle: 3_000n, hotel: 3_000n, food: 3_000n, housing: 3_000n }),
    }),
    expectedClassifications: Object.freeze(['CAPACITY_STRESS']),
    notes: 'Energy scarcity contracts allocatable access before insolvency.',
  }),
  scenario('ACCESS22-06-vehicle-shortage', 'Vehicle shortage', 22006, 'productive-capacity-collapse', {
    capacityState: capacity({
      allocatableUnits: 30_000n,
      categoryUnits: Object.freeze({ compute: 5_000n, energy: 5_000n, vehicle: 200n, hotel: 5_000n, food: 5_000n, housing: 5_000n }),
    }),
    expectedClassifications: Object.freeze(['CAPACITY_STRESS', 'DEMAND_IMBALANCE']),
    notes: 'Vehicle class shortage with other categories abundant.',
  }),
  scenario('ACCESS22-07-hotel-shortage', 'Hotel shortage', 22007, 'human-access-demand-surge', {
    capacityState: capacity({
      allocatableUnits: 35_000n,
      categoryUnits: Object.freeze({ compute: 5_000n, energy: 5_000n, vehicle: 5_000n, hotel: 150n, food: 5_000n, housing: 5_000n }),
    }),
    expectedClassifications: Object.freeze(['CAPACITY_STRESS']),
    notes: 'Hotel scarcity on peak dates.',
  }),
  scenario('ACCESS22-08-food-shortage', 'Food shortage', 22008, 'energy-scarcity', {
    capacityState: capacity({
      allocatableUnits: 28_000n,
      categoryUnits: Object.freeze({ compute: 4_000n, energy: 4_000n, vehicle: 4_000n, hotel: 4_000n, food: 100n, housing: 4_000n }),
    }),
    expectedClassifications: Object.freeze(['CAPACITY_STRESS']),
    notes: 'Food output shock reduces household access promises.',
  }),
  scenario('ACCESS22-09-mass-access-redemption', 'Mass access redemption', 22009, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 90_000n }),
    reserveState: reserve({ refundWaveBps: 0n }),
    expectedClassifications: Object.freeze(['DEMAND_IMBALANCE']),
    notes: 'Mass redemption wave without double redemption.',
  }),
  scenario('ACCESS22-10-sr-price-plus-500pct', 'SR price +500%', 22010, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ srPriceBps: 60_000n, srPriceChangeBps: 50_000n }),
    notes: 'SR price surge must not mechanically alter access allocation.',
  }),
  scenario('ACCESS22-11-sr-price-minus-80pct', 'SR price -80%', 22011, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ srPriceBps: 2_000n, srPriceChangeBps: -8_000n }),
    notes: 'SR price crash must not mechanically alter access allocation.',
  }),
  scenario('ACCESS22-12-mr-price-plus-500pct', 'MR price +500%', 22012, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ mrPriceBps: 60_000n, mrPriceChangeBps: 50_000n }),
    notes: 'MR price surge must not mechanically alter access allocation.',
  }),
  scenario('ACCESS22-13-mr-price-minus-80pct', 'MR price -80%', 22013, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ mrPriceBps: 2_000n, mrPriceChangeBps: -8_000n }),
    notes: 'MR price crash must not mechanically alter access allocation.',
  }),
  scenario('ACCESS22-14-both-tokens-crash', 'Both tokens crash', 22014, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ srPriceBps: 1_500n, mrPriceBps: 1_500n, srPriceChangeBps: -8_500n, mrPriceChangeBps: -8_500n }),
    expectedClassifications: Object.freeze(['LIQUIDITY_STRESS']),
    notes: 'Dual token crash without access minting.',
  }),
  scenario('ACCESS22-15-both-tokens-rapid-appreciation', 'Both tokens rapidly appreciate', 22015, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ srPriceBps: 55_000n, mrPriceBps: 55_000n, srPriceChangeBps: 45_000n, mrPriceChangeBps: 45_000n }),
    notes: 'Dual appreciation does not mint access.',
  }),
  scenario('ACCESS22-16-mass-fiat-to-sr-purchase', 'Mass fiat to SR purchase', 22016, 'high-concentration', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    expectedClassifications: Object.freeze(['TOKEN_CONCENTRATION']),
    notes: 'Fiat inflow to SR does not auto-expand access capacity.',
  }),
  scenario('ACCESS22-17-mass-fiat-to-mr-purchase', 'Mass fiat to MR purchase', 22017, 'high-concentration', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    expectedClassifications: Object.freeze(['TOKEN_CONCENTRATION']),
    notes: 'Fiat inflow to MR does not auto-expand access capacity.',
  }),
  scenario('ACCESS22-18-mass-token-sell-off', 'Mass token sell-off', 22018, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    exchangeState: exchange({ illiquid: true, liquidityUnits: 500n, spreadBps: 2_500n }),
    expectedClassifications: Object.freeze(['LIQUIDITY_STRESS']),
    notes: 'Sell-off liquidity stress without issuance feedback.',
  }),
  scenario('ACCESS22-19-whale-concentration', 'Whale concentration', 22019, 'high-concentration', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    expectedClassifications: Object.freeze(['TOKEN_CONCENTRATION', 'ACCESS_ALLOCATION_STRESS']),
    notes: 'Whale holdings face diminishing returns on access.',
  }),
  scenario('ACCESS22-20-sybil-splitting', 'Sybil splitting', 22020, 'baseline', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Sybil split does not beat diminishing returns aggregate.',
  }),
  scenario('ACCESS22-21-snapshot-manipulation-attack', 'Snapshot manipulation attack', 22021, 'oracle-degradation', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    oracleState: oracle({ staleEvidence: true, degraded: true }),
    expectedClassifications: Object.freeze(['ORACLE_DEPENDENCY']),
    notes: 'Stale snapshot fails closed.',
  }),
  scenario('ACCESS22-22-provider-collapse', 'Provider collapse', 22022, 'productive-capacity-collapse', {
    capacityState: capacity({ allocatableUnits: 40_000n, externalProviderLiabilityUnits: 4_000n, fundedReserveUnits: 5_000n }),
    providerState: provider({ collapsed: true, topProviderShareBps: 8_000n }),
    reserveState: reserve({ coverageBps: 6_000n }),
    expectedClassifications: Object.freeze(['SYSTEMIC_PROVIDER_FAILURE', 'SOLVENCY_STRESS']),
    notes: 'Provider collapse refuses rather than overselling.',
  }),
  scenario('ACCESS22-23-top-provider-outage', 'Top provider outage', 22023, 'baseline', {
    capacityState: capacity({ allocatableUnits: 85_000n }),
    providerState: provider({ topProviderOutage: true, topProviderShareBps: 4_500n }),
    expectedClassifications: Object.freeze(['PROVIDER_CONCENTRATION']),
    notes: 'Top provider outage reduces available capacity.',
  }),
  scenario('ACCESS22-24-exchange-illiquidity', 'Exchange illiquidity', 22024, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    exchangeState: exchange({ illiquid: true, liquidityUnits: 200n }),
    expectedClassifications: Object.freeze(['LIQUIDITY_STRESS']),
    notes: 'Illiquid exchange does not invent conversion.',
  }),
  scenario('ACCESS22-25-exchange-halt', 'Exchange halt', 22025, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    exchangeState: exchange({ halted: true, liquidityUnits: 0n }),
    expectedClassifications: Object.freeze(['LIQUIDITY_STRESS']),
    notes: 'Exchange halt blocks pricing fallback.',
  }),
  scenario('ACCESS22-26-custody-outage', 'Custody outage', 22026, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Custody outage holds settlement; no blind resubmit.',
  }),
  scenario('ACCESS22-27-ledger-failure', 'Ledger failure', 22027, 'baseline', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Ledger failure releases reservation; no double settlement.',
  }),
  scenario('ACCESS22-28-fx-shock', 'FX shock', 22028, 'market-volatility', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    tokenPricePath: price({ srPriceChangeBps: 3_000n, mrPriceChangeBps: -2_000n }),
    notes: 'FX shock observed; access allocation unchanged by price.',
  }),
  scenario('ACCESS22-29-access-reserve-depletion', 'Access reserve depletion', 22029, 'baseline', {
    capacityState: capacity({ allocatableUnits: 70_000n, externalProviderLiabilityUnits: 8_000n, fundedReserveUnits: 8_000n }),
    reserveState: reserve({ depleted: true, coverageBps: 4_000n }),
    expectedClassifications: Object.freeze(['RESERVE_STRESS', 'SOLVENCY_STRESS']),
    notes: 'Reserve depletion tightens external liability coverage.',
  }),
  scenario('ACCESS22-30-refund-wave', 'Refund wave', 22030, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 90_000n }),
    reserveState: reserve({ refundWaveBps: 3_500n }),
    expectedClassifications: Object.freeze(['RESERVE_STRESS']),
    notes: 'Refund wave without double settlement.',
  }),
  scenario('ACCESS22-31-oracle-degradation', 'Oracle degradation', 22031, 'oracle-degradation', {
    capacityState: capacity({ allocatableUnits: 95_000n }),
    oracleState: oracle({ degraded: true, controllerConcentrationBps: 5_500n }),
    expectedClassifications: Object.freeze(['ORACLE_DEPENDENCY']),
    notes: 'Degraded oracle fail-closed on mint paths.',
  }),
  scenario('ACCESS22-32-oracle-collusion', 'Oracle collusion / controller concentration', 22032, 'oracle-degradation', {
    capacityState: capacity({ allocatableUnits: 95_000n }),
    oracleState: oracle({ collusionRisk: true, controllerConcentrationBps: 9_000n }),
    expectedClassifications: Object.freeze(['ORACLE_DEPENDENCY']),
    notes: 'Controller concentration reported; no antitrust conclusion.',
  }),
  scenario('ACCESS22-33-phantom-capacity-attack', 'Phantom capacity attack', 22033, 'baseline', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    providerState: provider({ phantomCapacityAttempted: true }),
    notes: 'Phantom capacity rejected; no oversell.',
  }),
  scenario('ACCESS22-34-double-productive-claim', 'Double productive claim', 22034, 'rapid-automation', {
    capacityState: capacity({ allocatableUnits: 110_000n }),
    notes: 'Duplicate productive claim cannot mint twice.',
  }),
  scenario('ACCESS22-35-human-data-contribution-surge', 'Human data contribution surge', 22035, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Data surge does not directly multiply access.',
  }),
  scenario('ACCESS22-36-low-quality-data-surge', 'Low-quality / fraudulent data surge', 22036, 'oracle-degradation', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    oracleState: oracle({ degraded: true }),
    notes: 'Low-quality data refused at verification gate.',
  }),
  scenario('ACCESS22-37-mass-consent-revocation', 'Mass consent revocation', 22037, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    notes: 'Consent revocation reduces eligible participation.',
  }),
  scenario('ACCESS22-38-productive-contribution-surge', 'Productive contribution surge', 22038, 'rapid-automation', {
    capacityState: capacity({ allocatableUnits: 130_000n, productiveAbundanceIndexBps: 18_000n }),
    notes: 'Productive surge does not auto-mint access.',
  }),
  scenario('ACCESS22-39-autonomous-vehicle-abundance', 'Autonomous vehicle abundance', 22039, 'post-scarcity-abundance', {
    capacityState: capacity({
      allocatableUnits: 250_000n,
      categoryUnits: Object.freeze({ compute: 10_000n, energy: 10_000n, vehicle: 50_000n, hotel: 10_000n, food: 10_000n, housing: 10_000n }),
    }),
    notes: 'Vehicle abundance raises allocatable access without coin issuance.',
  }),
  scenario('ACCESS22-40-post-scarcity-multi-category', 'Post-scarcity multi-category economy', 22040, 'post-scarcity-abundance', {
    capacityState: capacity({
      allocatableUnits: 2_000_000n,
      categoryUnits: Object.freeze({ compute: 100_000n, energy: 30_000n, vehicle: 50_000n, food: 20_000n, housing: 10_000n, hotel: 15_000n }),
      productiveAbundanceIndexBps: 100_000n,
      capacityGrowthBps: 50_000n,
    }),
    notes: 'Post-scarcity raises allocatable access without printing access money.',
  }),
  scenario('ACCESS22-41-multi-provider-japan-trip-failure', 'Multi-provider Japan trip failure', 22041, 'baseline', {
    capacityState: capacity({
      allocatableUnits: 60_000n,
      categoryUnits: Object.freeze({ compute: 5_000n, energy: 5_000n, vehicle: 2_000n, hotel: 1_000n, food: 5_000n, housing: 5_000n }),
    }),
    providerState: provider({ topProviderOutage: true }),
    expectedClassifications: Object.freeze(['PROVIDER_CONCENTRATION']),
    notes: 'Composite travel legs refuse independently on provider failure.',
  }),
  scenario('ACCESS22-42-global-demand-spike', 'Global demand spike', 22042, 'human-access-demand-surge', {
    capacityState: capacity({ allocatableUnits: 75_000n }),
    expectedClassifications: Object.freeze(['DEMAND_IMBALANCE', 'CAPACITY_STRESS']),
    notes: 'Global demand spike with deterministic allocation.',
  }),
  scenario('ACCESS22-43-geographic-capacity-imbalance', 'Geographic capacity imbalance', 22043, 'baseline', {
    capacityState: capacity({ allocatableUnits: 80_000n }),
    expectedClassifications: Object.freeze(['DEMAND_IMBALANCE']),
    notes: 'Surplus elsewhere does not satisfy location-bound demand.',
  }),
  scenario('ACCESS22-44-policy-change-between-epochs', 'Policy change between epochs', 22044, 'policy-experiment', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    macroEpochs: 3,
    notes: 'Confirmed rights honoured across epoch policy change.',
  }),
  scenario('ACCESS22-45-policy-change-during-open-reservation', 'Policy change during open reservation', 22045, 'policy-experiment', {
    capacityState: capacity({ allocatableUnits: 100_000n }),
    macroEpochs: 2,
    notes: 'Open reservations held for review; confirmed rights honoured.',
  }),
]);

export function access22ScenarioById(scenarioId: string): Access22Scenario | undefined {
  return ACCESS_22_CATALOG.find((row) => row.scenarioId === scenarioId);
}

export function access22ScenarioIds(): readonly Access22ScenarioId[] {
  return ACCESS_22_SCENARIO_IDS;
}

export function access22CatalogComplete(): boolean {
  return ACCESS_22_CATALOG.length === 45 && new Set(ACCESS_22_CATALOG.map((row) => row.scenarioId)).size === 45;
}
