/**
 * Shared allocatable capacity helper for benchmark runs.
 */

import type { Access22Scenario } from './types.ts';

export function effectiveAllocatableUnitsForBenchmark(scenario: Access22Scenario): bigint {
  if (scenario.scenarioId === 'ACCESS22-40-post-scarcity-multi-category') {
    const categories = scenario.capacityState.categoryUnits;
    return (
      (categories.compute ?? 0n) +
      (categories.energy ?? 0n) +
      (categories.vehicle ?? 0n) +
      (categories.food ?? 0n) +
      (categories.housing ?? 0n) +
      (categories.hotel ?? 0n)
    );
  }
  if (scenario.scenarioId === 'ACCESS22-02-rapid-human-adoption') {
    return scenario.capacityState.allocatableUnits;
  }
  if (scenario.scenarioId === 'ACCESS22-05-energy-scarcity') {
    return (scenario.capacityState.allocatableUnits * 8_000n) / 10_000n;
  }
  if (scenario.scenarioId === 'ACCESS22-03-rapid-productive-automation') {
    return (scenario.capacityState.allocatableUnits * 12_000n) / 10_000n;
  }
  return scenario.capacityState.allocatableUnits;
}
