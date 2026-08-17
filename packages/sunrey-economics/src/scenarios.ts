/**
 * Versioned dual-economy scenario catalog.
 *
 * Important economic assumptions live in config JSON, not buried
 * code constants. Epochs are abstract unless a scenario says otherwise.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DUAL_ECONOMY_POLICY_CLASS, DUAL_ECONOMY_SCHEMA_VERSION, SCENARIO_IDS, SIMULATION_LABEL } from './ids.ts';
import type { DualEconomyScenario, PolicyExperimentParams } from './types.ts';

const CONFIG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'config', 'scenarios');

type JsonScenario = Omit<DualEconomyScenario, 'human' | 'automation' | 'productive' | 'oracle' | 'market' | 'fees' | 'validators' | 'concentration' | 'policies'> & {
  readonly human: Record<string, number | string>;
  readonly automation: Record<string, number | string>;
  readonly productive: {
    readonly energyAvailabilityBps: string;
    readonly computeAvailabilityBps: string;
    readonly manufacturingCapacityBps: string;
    readonly logisticsCapacityBps: string;
    readonly categoryWeightsBps: Record<string, string>;
  };
  readonly oracle: DualEconomyScenario['oracle'];
  readonly market: Record<string, number | string>;
  readonly fees: Record<string, number | string>;
  readonly validators: {
    readonly count: number;
    readonly unavailable: readonly string[];
    readonly penaltyValidatorId: string | null;
    readonly penaltyBps: string;
    readonly feeRevenueMode: 'low' | 'normal' | 'high';
  };
  readonly concentration: Record<string, number | string>;
  readonly policies: Record<string, number | string | false | null>;
};

function asBig(value: number | string | boolean | null | undefined, fallback = 0n): bigint {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return fallback;
  }
  return BigInt(value);
}

function hydrate(raw: JsonScenario): DualEconomyScenario {
  return Object.freeze({
    schemaVersion: DUAL_ECONOMY_SCHEMA_VERSION,
    scenarioId: raw.scenarioId,
    title: raw.title,
    parameterClass: DUAL_ECONOMY_POLICY_CLASS,
    simulationLabel: SIMULATION_LABEL,
    seed: raw.seed,
    epochs: raw.epochs,
    epochDurationLabel: 'ABSTRACT_EPOCH',
    human: Object.freeze({
      participants: Number(raw.human.participants),
      demandScale: asBig(raw.human.demandScale),
      laborShareBps: asBig(raw.human.laborShareBps),
      informationRightIntensityBps: asBig(raw.human.informationRightIntensityBps),
      creativeIntensityBps: asBig(raw.human.creativeIntensityBps),
      entrepreneurialIntensityBps: asBig(raw.human.entrepreneurialIntensityBps),
      communityIntensityBps: asBig(raw.human.communityIntensityBps),
      governedDistributionBps: asBig(raw.human.governedDistributionBps),
    }),
    automation: Object.freeze({
      penetrationBps: asBig(raw.automation.penetrationBps),
      aiProductivityBps: asBig(raw.automation.aiProductivityBps),
      robotDeploymentBps: asBig(raw.automation.robotDeploymentBps),
      productiveSystemCount: Number(raw.automation.productiveSystemCount),
    }),
    productive: Object.freeze({
      energyAvailabilityBps: asBig(raw.productive.energyAvailabilityBps),
      computeAvailabilityBps: asBig(raw.productive.computeAvailabilityBps),
      manufacturingCapacityBps: asBig(raw.productive.manufacturingCapacityBps),
      logisticsCapacityBps: asBig(raw.productive.logisticsCapacityBps),
      categoryWeightsBps: Object.freeze(
        Object.fromEntries(
          Object.entries(raw.productive.categoryWeightsBps).map(([key, value]) => [key, asBig(value)]),
        ),
      ),
    }),
    oracle: Object.freeze({ ...raw.oracle }),
    market: Object.freeze({
      volatilityBps: asBig(raw.market.volatilityBps),
      makerSpreadBps: asBig(raw.market.makerSpreadBps),
      startingPriceUnits: asBig(raw.market.startingPriceUnits),
      orderSize: asBig(raw.market.orderSize),
      makerInventorySunrey: asBig(raw.market.makerInventorySunrey),
      makerInventoryMoonrey: asBig(raw.market.makerInventoryMoonrey),
    }),
    fees: Object.freeze({
      utilizationBps: asBig(raw.fees.utilizationBps),
      txPerEpoch: Number(raw.fees.txPerEpoch),
      transferAmount: asBig(raw.fees.transferAmount),
    }),
    validators: Object.freeze({
      count: raw.validators.count,
      unavailable: Object.freeze([...raw.validators.unavailable]),
      penaltyValidatorId: raw.validators.penaltyValidatorId,
      penaltyBps: asBig(raw.validators.penaltyBps),
      feeRevenueMode: raw.validators.feeRevenueMode,
    }),
    concentration: Object.freeze({
      operatorCount: Number(raw.concentration.operatorCount),
      dominantShareBps: asBig(raw.concentration.dominantShareBps),
    }),
    policies: Object.freeze({
      sunreyIssuanceScaleBps: asBig(raw.policies.sunreyIssuanceScaleBps),
      moonreyEpochCapScaleBps: asBig(raw.policies.moonreyEpochCapScaleBps),
      feeMaxUnits: asBig(raw.policies.feeMaxUnits),
      validatorRewardBpsOverride:
        raw.policies.validatorRewardBpsOverride === null || raw.policies.validatorRewardBpsOverride === undefined
          ? null
          : asBig(raw.policies.validatorRewardBpsOverride),
      productiveNormalizationBps: asBig(raw.policies.productiveNormalizationBps),
      becomesProductionPolicy: false,
    } satisfies PolicyExperimentParams),
    assumptions: Object.freeze([...raw.assumptions]),
  });
}

const cache = new Map<string, DualEconomyScenario>();

export function scenarioConfigDir(): string {
  return CONFIG_DIR;
}

export function listScenarioIds(): readonly string[] {
  return readdirSync(CONFIG_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

export function loadScenario(id: string, overrides?: Partial<Pick<DualEconomyScenario, 'seed' | 'epochs'>>): DualEconomyScenario {
  if (!cache.has(id)) {
    const path = join(CONFIG_DIR, `${id}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf8')) as JsonScenario;
    cache.set(id, hydrate(raw));
  }
  const loaded = cache.get(id);
  if (!loaded) {
    throw new Error(`unknown dual-economy scenario: ${id}`);
  }
  if (!overrides) {
    return loaded;
  }
  return Object.freeze({
    ...loaded,
    seed: overrides.seed ?? loaded.seed,
    epochs: overrides.epochs ?? loaded.epochs,
  });
}

export function catalogScenarios(): readonly DualEconomyScenario[] {
  return listScenarioIds().map((id) => loadScenario(id));
}

export function requiredCatalogComplete(): boolean {
  return SCENARIO_IDS.every((id) => listScenarioIds().includes(id));
}
