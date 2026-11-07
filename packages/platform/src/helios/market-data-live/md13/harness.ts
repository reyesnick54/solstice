/**
 * MD13 chaos qualification harness — runs full chaos matrix under simulation.
 */

import { listMd13ChaosScenarios } from './chaos.ts';
import { runMd13FabricScenario } from './fabric.ts';
import { FEED_SPECIFIC_SLO_TARGETS } from './slos.ts';
import { MD13_SLO_DIMENSIONS } from './taxonomy.ts';
import type { Md13QualificationReport } from './types.ts';

export function runMd13LiveDataResilienceHarness(): Md13QualificationReport {
  const scenarios = listMd13ChaosScenarios().map((scenarioId) => runMd13FabricScenario(scenarioId));
  const allScenariosPassed = scenarios.every((row) => row.passed);
  const feedScopedSlo = Object.keys(FEED_SPECIFIC_SLO_TARGETS).length >= 2;

  return Object.freeze({
    schema: 'sunrey.helios.market-data-live.md13.v1',
    scenarios: Object.freeze(scenarios),
    sloDimensionsDeclared: MD13_SLO_DIMENSIONS,
    feedScopedSlo,
    allScenariosPassed,
  });
}
