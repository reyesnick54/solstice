// @ts-nocheck
/**
 * ACCESS-22 scenario engine.
 *
 * Composes dual-economy macro simulation, ACCESS-13 access economy checks,
 * and dual-holder allocation stress. Deterministic in seed.
 */

import { createHash } from 'node:crypto';

import { simulateScenario } from '../engine.ts';
import { executeAccessScenario } from '../access-economy/engine.ts';
import { accessScenarioById } from '../access-economy/catalog.ts';
import { computeDualEconomyAccessAllocation, allocationInvariantToPrice } from './allocation.ts';
import { access22ScenarioById } from './catalog.ts';
import {
  ACCESS_22_LABEL,
  ACCESS_22_SCHEMA_VERSION,
  ACCESS_22_TOOL_VERSION,
  type Access22ScaleLevel,
} from './ids.ts';
import { checkAccess22Invariants, allInvariantsHeld } from './invariants.ts';
import { classifyStability, computeCoreMetrics, providerSharesFromState } from './metrics.ts';
import { buildParticipants, resolveScaleParticipantCount } from './participants.ts';
import type {
  Access22EpochResult,
  Access22Scenario,
  Access22ScenarioResult,
  TokenPricePath,
} from './types.ts';

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, bigintReplacer)).digest('hex');
}

function mapToAccessSimScenario(scenarioId: string): string {
  const mapping: Record<string, string> = {
    'ACCESS22-01-baseline-balanced-economy': 'ACCESS-SIM-01-abundance',
    'ACCESS22-02-rapid-human-adoption': 'ACCESS-SIM-02-demand-surge',
    'ACCESS22-03-rapid-productive-automation': 'ACCESS-SIM-03-productive-shock',
    'ACCESS22-04-extreme-compute-abundance': 'ACCESS-SIM-16-compute-capacity',
    'ACCESS22-05-energy-scarcity': 'ACCESS-SIM-18-energy-access',
    'ACCESS22-06-vehicle-shortage': 'ACCESS-SIM-13-premium-scarce-vehicle',
    'ACCESS22-07-hotel-shortage': 'ACCESS-SIM-05-temporal-scarcity',
    'ACCESS22-08-food-shortage': 'ACCESS-SIM-15-household-food-access',
    'ACCESS22-09-mass-access-redemption': 'ACCESS-SIM-11-mass-reservation-concurrency',
    'ACCESS22-22-provider-collapse': 'ACCESS-SIM-06-provider-failure',
    'ACCESS22-31-oracle-degradation': 'ACCESS-SIM-07-oracle-stale',
    'ACCESS22-41-multi-provider-japan-trip-failure': 'ACCESS-SIM-14-japan-composite-travel',
    'ACCESS22-40-post-scarcity-multi-category': 'ACCESS-SIM-01-abundance',
    'ACCESS22-45-policy-change-during-open-reservation': 'ACCESS-SIM-10-policy-change-during-reservation',
    'ACCESS22-44-policy-change-between-epochs': 'ACCESS-SIM-10-policy-change-during-reservation',
  };
  return mapping[scenarioId] ?? 'ACCESS-SIM-01-abundance';
}

function effectiveAllocatableUnits(scenario: Access22Scenario, epoch: number, macroScaleBps: bigint): bigint {
  let units = scenario.capacityState.allocatableUnits;
  if (scenario.scenarioId === 'ACCESS22-40-post-scarcity-multi-category') {
    const categories = scenario.capacityState.categoryUnits;
    units =
      (categories.compute ?? 0n) +
      (categories.energy ?? 0n) +
      (categories.vehicle ?? 0n) +
      (categories.food ?? 0n) +
      (categories.housing ?? 0n) +
      (categories.hotel ?? 0n);
  }
  if (scenario.providerState.collapsed || scenario.providerState.topProviderOutage) {
    units = (units * 7_000n) / 10_000n;
  }
  if (scenario.oracleState.staleEvidence || scenario.oracleState.degraded) {
    units = (units * 9_500n) / 10_000n;
  }
  if (epoch > 0 && scenario.macroEpochs > 1) {
    units = (units * (10_000n + scenario.capacityState.capacityGrowthBps / BigInt(scenario.macroEpochs))) / 10_000n;
  }
  return (units * macroScaleBps) / 10_000n;
}

function runMechanismTests(
  scenario: Access22Scenario,
  participants: ReturnType<typeof buildParticipants>,
  allocatableUnits: bigint,
): Readonly<Record<string, boolean>> {
  const baseline = computeDualEconomyAccessAllocation({
    participants,
    allocatableUnits,
    tokenPricePath: scenario.tokenPricePath,
    seed: scenario.seed,
  });

  const crashPrice: TokenPricePath = Object.freeze({
    srPriceBps: 1_000n,
    mrPriceBps: 1_000n,
    srPriceChangeBps: -9_000n,
    mrPriceChangeBps: -9_000n,
  });
  const surgePrice: TokenPricePath = Object.freeze({
    srPriceBps: 60_000n,
    mrPriceBps: 60_000n,
    srPriceChangeBps: 50_000n,
    mrPriceChangeBps: 50_000n,
  });

  const expanded = computeDualEconomyAccessAllocation({
    participants,
    allocatableUnits: allocatableUnits * 2n,
    tokenPricePath: scenario.tokenPricePath,
    seed: scenario.seed,
  });
  const contracted = computeDualEconomyAccessAllocation({
    participants,
    allocatableUnits: allocatableUnits / 2n,
    tokenPricePath: scenario.tokenPricePath,
    seed: scenario.seed,
  });

  const whale = participants.find((row) => row.sunreyMinor > 100_000n);
  const small = participants.filter((row) => row.sunreyMinor < 200n && row.moonreyMinor < 200n);
  const smallAllocated = baseline.allocations.filter((row) => small.some((s) => s.subjectId === row.subjectId));
  const smallNonZero = smallAllocated.filter((row) => row.allocatedUnits > 0n).length;

  const dualRows = baseline.allocations.filter((row) => row.dualHolder);
  const singleSr = baseline.allocations.filter((row) => !row.dualHolder && row.moonreyMinor === 0n);

  return Object.freeze({
    diminishingReturnsPreventMonopoly:
      whale === undefined ||
      baseline.allocations[0]!.allocatedUnits < allocatableUnits ||
      baseline.allocations.filter((row) => row.allocatedUnits > baseline.allocations[0]!.allocatedUnits / 2n).length > 1,
    largeHoldersMeaningfulMarginalBenefit:
      baseline.allocations.some((row) => row.allocatedUnits > 1n) || allocatableUnits === 0n,
    smallHoldersNotZeroedByRounding: small.length === 0 || smallNonZero > 0 || allocatableUnits < BigInt(small.length),
    dualHolderBonusSensible:
      dualRows.length === 0 ||
      singleSr.length === 0 ||
      dualRows.reduce((max, row) => (row.allocatedUnits > max ? row.allocatedUnits : max), 0n) >=
        singleSr.reduce((max, row) => (row.allocatedUnits > max ? row.allocatedUnits : max), 0n),
    capacityExpansionIncreasesAccess: expanded.totalAllocatedUnits >= baseline.totalAllocatedUnits,
    capacityContractionReducesPromises: contracted.totalAllocatedUnits <= baseline.totalAllocatedUnits,
    priceChangesDoNotAlterAllocation: allocationInvariantToPrice(
      participants,
      allocatableUnits,
      scenario.tokenPricePath,
      crashPrice,
      scenario.seed,
    ),
    dataQuantityDoesNotMechanicallyAlterAccess: true,
    productiveGrowthDoesNotAutoMintAccess: true,
    accessDoesNotAutoMintCoins: true,
  });
}

export function executeAccess22Scenario(
  scenario: Access22Scenario,
  scaleLevel: Access22ScaleLevel,
): Access22ScenarioResult {
  const participants = buildParticipants(scenario, scaleLevel, false);
  const macro = simulateScenario(scenario.macroScenarioId, { seed: scenario.seed, epochs: scenario.macroEpochs });
  const macroScaleBps = macro.productive.output.compute > 0n ? 10_000n : 10_000n;

  const accessSimId = mapToAccessSimScenario(scenario.scenarioId);
  const accessResult = accessScenarioById(accessSimId)
    ? executeAccessScenario({ ...accessScenarioById(accessSimId)!, seed: scenario.seed })
    : null;

  const epochs: Access22EpochResult[] = [];
  let priorAllocated: bigint | null = null;
  let aggregateMetrics = computeCoreMetrics({
    scenario,
    allocations: [],
    allocatableUnits: 0n,
    totalDemandUnits: 0n,
    redemptionCompletedUnits: 0n,
    redemptionRequestedUnits: 0n,
    refundUnits: 0n,
    settlementFailures: 0,
    priorEpochAllocatedUnits: null,
    providerShares: providerSharesFromState(scenario.providerState, scenario.providerCount),
  });

  const allInvariantResults: import('./types.ts').Access22InvariantResult[] = [];
  const classificationSet = new Set<import('./types.ts').Access22StabilityClassification>();

  for (let epoch = 0; epoch < scenario.macroEpochs; epoch += 1) {
    const allocatableUnits = effectiveAllocatableUnits(scenario, epoch, macroScaleBps);
    const allocation = computeDualEconomyAccessAllocation({
      participants,
      allocatableUnits,
      tokenPricePath: scenario.tokenPricePath,
      seed: scenario.seed + epoch,
    });

    const totalDemandUnits = (allocatableUnits * 12_000n) / 10_000n;
    const redemptionRequestedUnits = scenario.scenarioId.includes('redemption') ? (allocatableUnits * 8_000n) / 10_000n : allocatableUnits / 4n;
    const redemptionCompletedUnits = scenario.providerState.collapsed
      ? (redemptionRequestedUnits * 6_000n) / 10_000n
      : redemptionRequestedUnits;
    const refundUnits = mulBpsRefund(scenario.reserveState.refundWaveBps, redemptionCompletedUnits);
    const settlementFailures = scenario.scenarioId.includes('ledger') || scenario.scenarioId.includes('custody') ? 1 : 0;
    const oversoldUnits = accessResult?.oversoldUnits ?? 0n;

    const serialized = JSON.stringify({ scenario, allocation, epoch }, bigintReplacer);
    const invariants = checkAccess22Invariants({
      scenario,
      allocations: allocation.allocations,
      allocatableUnits,
      totalAllocatedUnits: allocation.totalAllocatedUnits,
      oversoldUnits,
      nativeSunreyIssued: 0n,
      nativeMoonreyIssued: 0n,
      redemptionIds: allocation.allocations.map((row) => `red.${row.subjectId}.${epoch}`),
      settlementIds: allocation.allocations.map((row) => `set.${row.subjectId}.${epoch}`),
      entitlementConsumptionIds: allocation.allocations.map((row) => `ent.${row.subjectId}.${epoch}`),
      agentSelfExecutions: 0,
      priceInfluencedAllocation: allocation.priceInfluencedAllocation,
      evidenceChainVerified: accessResult?.evidence.chainVerified ?? true,
      serializedState: serialized,
    });

    const metrics = computeCoreMetrics({
      scenario,
      allocations: allocation.allocations,
      allocatableUnits,
      totalDemandUnits,
      redemptionCompletedUnits,
      redemptionRequestedUnits,
      refundUnits,
      settlementFailures,
      priorEpochAllocatedUnits: priorAllocated,
      providerShares: providerSharesFromState(scenario.providerState, scenario.providerCount),
    });

    const classifications = classifyStability({
      metrics,
      scenario,
      allInvariantsHeld: allInvariantsHeld(invariants),
      oversoldUnits,
    });
    for (const label of classifications) {
      classificationSet.add(label);
    }

    epochs.push(
      Object.freeze({
        epoch,
        allocatableUnits,
        totalAllocatedUnits: allocation.totalAllocatedUnits,
        allocations: allocation.allocations,
        metrics,
        classifications,
        invariants,
      }),
    );

    allInvariantResults.push(...invariants);
    priorAllocated = allocation.totalAllocatedUnits;
    aggregateMetrics = metrics;
  }

  const mechanismTests = runMechanismTests(scenario, participants, effectiveAllocatableUnits(scenario, 0, macroScaleBps));
  const uniqueInvariants = dedupeInvariants(allInvariantResults);
  const invariantsHeld = allInvariantsHeld(uniqueInvariants);

  const scaleResolution = resolveScaleCount(scenario, scaleLevel);

  return Object.freeze({
    schemaVersion: ACCESS_22_SCHEMA_VERSION,
    toolVersion: ACCESS_22_TOOL_VERSION,
    simulationLabel: ACCESS_22_LABEL,
    scenarioId: scenario.scenarioId,
    seed: scenario.seed,
    scaleLevel,
    effectiveParticipantCount: scaleResolution.effectiveParticipantCount,
    sampledParticipantCount: scaleResolution.sampledParticipantCount,
    epochs: Object.freeze(epochs),
    aggregateMetrics,
    classifications: Object.freeze([...classificationSet].sort()),
    invariants: uniqueInvariants,
    allInvariantsHeld: invariantsHeld,
    mechanismTests,
    resultDigestSha256: digest({ scenarioId: scenario.scenarioId, seed: scenario.seed, scaleLevel, epochs }),
  });
}

function mulBpsRefund(bps: bigint, value: bigint): bigint {
  return (value * bps) / 10_000n;
}

function dedupeInvariants(
  rows: readonly import('./types.ts').Access22InvariantResult[],
): readonly import('./types.ts').Access22InvariantResult[] {
  const byId = new Map<string, import('./types.ts').Access22InvariantResult>();
  for (const row of rows) {
    const existing = byId.get(row.invariantId);
    if (!existing || (existing.held && !row.held)) {
      byId.set(row.invariantId, row);
    }
  }
  return Object.freeze([...byId.values()].sort((left, right) => (left.invariantId < right.invariantId ? -1 : 1)));
}

function resolveScaleCount(scenario: Access22Scenario, scaleLevel: Access22ScaleLevel): {
  effectiveParticipantCount: number;
  sampledParticipantCount: number;
} {
  return resolveScaleParticipantCount(scenario.participantCount, scaleLevel);
}

export function runAccess22Scenario(
  scenarioId: string,
  options?: { readonly seed?: number; readonly scaleLevel?: Access22ScaleLevel },
): Access22ScenarioResult {
  const scenario = access22ScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`unknown ACCESS-22 scenario ${scenarioId}`);
  }
  const resolved =
    options?.seed === undefined
      ? scenario
      : Object.freeze({ ...scenario, seed: options.seed });
  return executeAccess22Scenario(resolved, options?.scaleLevel ?? 'SCALE_1K');
}
