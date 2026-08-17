/**
 * Human, productive, automation, and dual-asset layers.
 *
 * Human activity is aggregate and synthetic. Productive objects reuse
 * Global Productive Capacity Graph categories. Supplies stay separate.
 */

import type { ProductiveCategory } from '../../sunrey-chain/src/productive/types.ts';
import {
  HUMAN_ACTIVITY_CHANNELS,
  INDEX_SCALE,
  PRODUCTIVE_SIM_CATEGORIES,
  type HumanActivityChannel,
  type ProductiveSimCategory,
} from './ids.ts';
import { mulBps, ratioBps, ratioIndex } from './seed.ts';
import type {
  AssetSupplySlice,
  AutomationTransitionModel,
  DualAssetEconomicState,
  DualEconomyScenario,
  HumanEconomyState,
  ProductiveEconomyState,
} from './types.ts';

const ENERGY_GATED: readonly ProductiveSimCategory[] = [
  'COMPUTE',
  'AI_COMPUTE',
  'MANUFACTURING',
  'AUTOMATED_MACHINE_OUTPUT',
  'LOGISTICS_TRANSPORTATION',
];

export function evolveAutomation(scenario: DualEconomyScenario, epoch: number): AutomationTransitionModel {
  const ramp = BigInt(Math.min(epoch, 20)) * 40n;
  const penetration = scenario.automation.penetrationBps + ramp;
  const labor = scenario.human.laborShareBps > ramp ? scenario.human.laborShareBps - ramp / 2n : 500n;
  const intensity = (penetration * 40n + scenario.automation.aiProductivityBps * 35n + scenario.automation.robotDeploymentBps * 25n) / 100n;
  return Object.freeze({
    penetrationBps: penetration,
    aiProductivityBps: scenario.automation.aiProductivityBps,
    robotDeploymentBps: scenario.automation.robotDeploymentBps,
    humanLaborShareBps: labor,
    intensityIndex: (intensity * INDEX_SCALE) / 10_000n,
  });
}

export function humanState(scenario: DualEconomyScenario, automation: AutomationTransitionModel, congestionBps: bigint): HumanEconomyState {
  const congestionHaircut = 10_000n - congestionBps / 5n;
  const demandBase = mulBps(scenario.human.demandScale, congestionHaircut);
  const channels = Object.fromEntries(
    HUMAN_ACTIVITY_CHANNELS.map((channel) => [channel, channelValue(scenario, channel, automation, demandBase)]),
  ) as Record<HumanActivityChannel, bigint>;
  const demand = Object.fromEntries(
    PRODUCTIVE_SIM_CATEGORIES.map((category) => {
      const weight = scenario.productive.categoryWeightsBps[category] ?? 400n;
      return [category, mulBps(demandBase, weight)];
    }),
  ) as Record<ProductiveSimCategory, bigint>;
  const totalActivity = Object.values(channels).reduce((sum, value) => sum + value, 0n);
  const participationIndex = ratioIndex(totalActivity, scenario.human.demandScale * 8n);
  return Object.freeze({
    participants: scenario.human.participants,
    laborShareBps: automation.humanLaborShareBps,
    channels: Object.freeze(channels),
    demand: Object.freeze(demand),
    totalActivity,
    participationIndex: participationIndex > INDEX_SCALE ? INDEX_SCALE : participationIndex,
  });
}

function channelValue(
  scenario: DualEconomyScenario,
  channel: HumanActivityChannel,
  automation: AutomationTransitionModel,
  demandBase: bigint,
): bigint {
  const participants = BigInt(scenario.human.participants);
  switch (channel) {
    case 'participation':
      return participants * 40n + mulBps(demandBase, 800n);
    case 'community':
      return mulBps(participants * 30n, scenario.human.communityIntensityBps);
    case 'informationRights':
      return mulBps(participants * 20n, scenario.human.informationRightIntensityBps);
    case 'consumerDemand':
      return demandBase;
    case 'creativeContribution':
      return mulBps(participants * 25n, scenario.human.creativeIntensityBps);
    case 'entrepreneurialContribution':
      return mulBps(participants * 22n, scenario.human.entrepreneurialIntensityBps);
    case 'governedDistributions':
      return mulBps(demandBase, scenario.human.governedDistributionBps);
    case 'productiveServiceUse':
      return mulBps(demandBase, 2_000n + automation.penetrationBps / 4n);
    default: {
      const _never: never = channel;
      return _never;
    }
  }
}

export function productiveState(
  scenario: DualEconomyScenario,
  automation: AutomationTransitionModel,
  human: HumanEconomyState,
  moonreyIssuedThisEpoch: bigint,
): ProductiveEconomyState {
  const availability = Object.fromEntries(
    PRODUCTIVE_SIM_CATEGORIES.map((category) => [category, categoryAvailability(scenario, category, automation)]),
  ) as Record<ProductiveSimCategory, bigint>;
  const output = Object.fromEntries(
    PRODUCTIVE_SIM_CATEGORIES.map((category) => {
      const capacity = availability[category] ?? 0n;
      const demand = human.demand[category] ?? 0n;
      const used = demand < capacity ? demand : capacity;
      return [category, used];
    }),
  ) as Record<ProductiveSimCategory, bigint>;
  const utilized = Object.fromEntries(
    PRODUCTIVE_SIM_CATEGORIES.map((category) => [category, ratioBps(output[category] ?? 0n, availability[category] ?? 0n)]),
  ) as Record<ProductiveSimCategory, bigint>;
  const totalOutput = Object.values(output).reduce((sum, value) => sum + value, 0n);
  const outputIndex = ratioIndex(totalOutput, 2_000_000n);
  const coverage = ratioBps(totalOutput, moonreyIssuedThisEpoch === 0n ? 1n : moonreyIssuedThisEpoch);
  return Object.freeze({
    systemCount: scenario.automation.productiveSystemCount,
    availability: Object.freeze(availability),
    output: Object.freeze(output),
    utilized: Object.freeze(utilized),
    totalOutput,
    outputIndex: outputIndex > INDEX_SCALE ? INDEX_SCALE : outputIndex,
    coverageVsIssuanceBps: coverage,
  });
}

function categoryAvailability(
  scenario: DualEconomyScenario,
  category: ProductiveSimCategory,
  automation: AutomationTransitionModel,
): bigint {
  const weight = scenario.productive.categoryWeightsBps[category] ?? 400n;
  const systems = BigInt(scenario.automation.productiveSystemCount);
  let capacity = systems * weight * 8n;
  capacity = mulBps(capacity, 5_000n + automation.aiProductivityBps / 2n);
  if (category === 'ENERGY') {
    capacity = mulBps(capacity, scenario.productive.energyAvailabilityBps);
  } else if (category === 'COMPUTE' || category === 'AI_COMPUTE') {
    capacity = mulBps(capacity, scenario.productive.computeAvailabilityBps);
    capacity = mulBps(capacity, scenario.productive.energyAvailabilityBps);
  } else if (category === 'MANUFACTURING' || category === 'AUTOMATED_MACHINE_OUTPUT') {
    capacity = mulBps(capacity, scenario.productive.manufacturingCapacityBps);
    capacity = mulBps(capacity, scenario.productive.energyAvailabilityBps);
  } else if (category === 'LOGISTICS_TRANSPORTATION') {
    capacity = mulBps(capacity, scenario.productive.logisticsCapacityBps);
  }
  if (ENERGY_GATED.includes(category)) {
    capacity = mulBps(capacity, 5_000n + scenario.productive.energyAvailabilityBps / 2n);
  }
  return mulBps(capacity, scenario.policies.productiveNormalizationBps);
}

export function emptySupply(assetId: 'SUNREY_COIN' | 'MOONREY_COIN', genesis = 0n): AssetSupplySlice {
  return Object.freeze({
    assetId,
    genesis,
    issued: genesis,
    circulating: genesis,
    locked: 0n,
    burned: 0n,
    holdings: genesis,
    velocity: 0n,
  });
}

export function applyIssuanceSlice(state: AssetSupplySlice, quantity: bigint): AssetSupplySlice {
  if (quantity < 0n) {
    throw new TypeError('issuance must be non-negative');
  }
  const issued = state.issued + quantity;
  const holdings = issued - state.burned;
  return Object.freeze({
    ...state,
    issued,
    holdings,
    circulating: holdings - state.locked,
  });
}

export function applyBurnSlice(state: AssetSupplySlice, quantity: bigint): AssetSupplySlice {
  if (quantity < 0n || quantity > state.holdings - state.locked) {
    throw new TypeError('burn is outside unlocked holdings');
  }
  const burned = state.burned + quantity;
  const holdings = state.issued - burned;
  return Object.freeze({
    ...state,
    burned,
    holdings,
    circulating: holdings - state.locked,
  });
}

export function applyLockSlice(state: AssetSupplySlice, quantity: bigint): AssetSupplySlice {
  const locked = state.locked + quantity;
  if (locked < 0n || locked > state.holdings) {
    throw new TypeError('lock is outside holdings');
  }
  return Object.freeze({
    ...state,
    locked,
    circulating: state.holdings - locked,
  });
}

export function supplyReconciles(state: AssetSupplySlice): boolean {
  return state.holdings === state.issued - state.burned && state.circulating === state.holdings - state.locked && state.locked <= state.holdings;
}

export function withVelocity(state: AssetSupplySlice, periodFlow: bigint): AssetSupplySlice {
  const velocity = state.circulating === 0n ? 0n : (periodFlow * INDEX_SCALE) / state.circulating;
  return Object.freeze({ ...state, velocity });
}

export function dualAssets(sunrey: AssetSupplySlice, moonrey: AssetSupplySlice): DualAssetEconomicState {
  if (sunrey.assetId !== 'SUNREY_COIN' || moonrey.assetId !== 'MOONREY_COIN') {
    throw new TypeError('dual asset state must keep SunRey and MoonRey distinct');
  }
  return Object.freeze({
    sunrey,
    moonrey,
    suppliesMerged: false,
    fixedExchangeRate: null,
  });
}

export function claimCategory(category: ProductiveSimCategory): ProductiveCategory {
  return category;
}
