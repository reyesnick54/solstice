/**
 * ACCESS-22 permanent 100 SR + 100 MR benchmark participant.
 *
 * Demonstrates that token market price alone does not directly change
 * allocation; productive capacity and relative participation do.
 */

import { computeDualEconomyAccessAllocation } from './allocation.ts';
import { access22ScenarioById } from './catalog.ts';
import { effectiveAllocatableUnitsForBenchmark } from './benchmark-capacity.ts';
import { ACCESS_22_BENCHMARK_PARTICIPANT_ID } from './ids.ts';
import { benchmarkParticipant } from './participants.ts';
import type { Access22BenchmarkRun, Access22ScenarioId, TokenPricePath } from './types.ts';

const BENCHMARK_SCENARIOS: readonly { readonly id: Access22ScenarioId; readonly label: string }[] = Object.freeze([
  { id: 'ACCESS22-01-baseline-balanced-economy', label: 'baseline' },
  { id: 'ACCESS22-03-rapid-productive-automation', label: 'rapid automation' },
  { id: 'ACCESS22-05-energy-scarcity', label: 'energy shortage' },
  { id: 'ACCESS22-02-rapid-human-adoption', label: '10x user growth' },
  { id: 'ACCESS22-40-post-scarcity-multi-category', label: '10x capacity growth' },
  { id: 'ACCESS22-14-both-tokens-crash', label: 'token price crash' },
  { id: 'ACCESS22-15-both-tokens-rapid-appreciation', label: 'token price surge' },
]);

const BASELINE_PRICE: TokenPricePath = Object.freeze({
  srPriceBps: 10_000n,
  mrPriceBps: 10_000n,
  srPriceChangeBps: 0n,
  mrPriceChangeBps: 0n,
});

const CRASH_PRICE: TokenPricePath = Object.freeze({
  srPriceBps: 1_500n,
  mrPriceBps: 1_500n,
  srPriceChangeBps: -8_500n,
  mrPriceChangeBps: -8_500n,
});

const SURGE_PRICE: TokenPricePath = Object.freeze({
  srPriceBps: 60_000n,
  mrPriceBps: 60_000n,
  srPriceChangeBps: 50_000n,
  mrPriceChangeBps: 50_000n,
});

export function runBenchmarkSuite(): readonly Access22BenchmarkRun[] {
  const participant = benchmarkParticipant();
  const baselineScenario = access22ScenarioById('ACCESS22-01-baseline-balanced-economy');
  if (!baselineScenario) {
    throw new Error('benchmark baseline scenario missing');
  }
  const baselineAllocatable = effectiveAllocatableUnitsForBenchmark(baselineScenario);
  const baselineAllocation = computeDualEconomyAccessAllocation({
    participants: [participant],
    allocatableUnits: baselineAllocatable,
    tokenPricePath: BASELINE_PRICE,
    seed: baselineScenario.seed,
  }).allocations.find((row) => row.subjectId === ACCESS_22_BENCHMARK_PARTICIPANT_ID)?.allocatedUnits ?? 0n;

  const runs: Access22BenchmarkRun[] = [];

  for (const entry of BENCHMARK_SCENARIOS) {
    const scenario = access22ScenarioById(entry.id);
    if (!scenario) {
      continue;
    }
    const allocatable = effectiveAllocatableUnitsForBenchmark(scenario);
    const pricePath =
      entry.label.includes('crash')
        ? CRASH_PRICE
        : entry.label.includes('surge')
          ? SURGE_PRICE
          : scenario.tokenPricePath;

    const stressed = computeDualEconomyAccessAllocation({
      participants: [participant],
      allocatableUnits: allocatable,
      tokenPricePath: pricePath,
      seed: scenario.seed,
    }).allocations.find((row) => row.subjectId === ACCESS_22_BENCHMARK_PARTICIPANT_ID)?.allocatedUnits ?? 0n;

    const priceOnly = computeDualEconomyAccessAllocation({
      participants: [participant],
      allocatableUnits: baselineAllocatable,
      tokenPricePath: pricePath,
      seed: scenario.seed,
    }).allocations.find((row) => row.subjectId === ACCESS_22_BENCHMARK_PARTICIPANT_ID)?.allocatedUnits ?? 0n;

    const priceChanged = pricePath.srPriceBps !== BASELINE_PRICE.srPriceBps || pricePath.mrPriceBps !== BASELINE_PRICE.mrPriceBps;
    const allocationUnchangedByPrice = priceOnly === baselineAllocation;
    const capacityOrParticipationChangedAllocation = stressed !== baselineAllocation || allocatable !== baselineAllocatable;

    runs.push(
      Object.freeze({
        participantId: ACCESS_22_BENCHMARK_PARTICIPANT_ID,
        sunreyMinor: participant.sunreyMinor,
        moonreyMinor: participant.moonreyMinor,
        scenarioId: entry.id,
        baselineAllocationUnits: baselineAllocation,
        stressedAllocationUnits: stressed,
        priceChanged,
        allocationUnchangedByPrice,
        capacityOrParticipationChangedAllocation,
      }),
    );
  }

  return Object.freeze(runs);
}

export function benchmarkTestsPassed(runs: readonly Access22BenchmarkRun[]): boolean {
  const priceShockRuns = runs.filter((row) => row.priceChanged);
  return (
    priceShockRuns.every((row) => row.allocationUnchangedByPrice) &&
    runs.some((row) => row.capacityOrParticipationChangedAllocation)
  );
}
