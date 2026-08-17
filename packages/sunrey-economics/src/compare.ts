/**
 * Scenario comparison and Monte Carlo batching.
 */

import { SIMULATION_LABEL } from './ids.ts';
import { simulateScenario } from './engine.ts';
import type { DualEconomySimulationReport, MonteCarloBatch, ScenarioComparisonReport } from './types.ts';

export function compareReports(left: DualEconomySimulationReport, right: DualEconomySimulationReport): ScenarioComparisonReport {
  const deltas = {
    sunreyCirculating: (right.sunrey.circulating - left.sunrey.circulating).toString(),
    moonreyCirculating: (right.moonrey.circulating - left.moonrey.circulating).toString(),
    humanActivity: (right.human.totalActivity - left.human.totalActivity).toString(),
    productiveOutput: (right.productive.totalOutput - left.productive.totalOutput).toString(),
    automationIntensity: (right.automation.intensityIndex - left.automation.intensityIndex).toString(),
    lastPriceUnits: ((right.market.lastPriceUnits ?? 0n) - (left.market.lastPriceUnits ?? 0n)).toString(),
    spreadBps: ((right.market.spreadBps ?? 0n) - (left.market.spreadBps ?? 0n)).toString(),
    feeCharged: (right.fees.charged - left.fees.charged).toString(),
    moonreyRejectedClaims: String(right.oracle.rejectedClaims - left.oracle.rejectedClaims),
    productiveHhi: (right.concentration.productiveOutputHhi - left.concentration.productiveOutputHhi).toString(),
    primaryStability: `${left.stability.primary}->${right.stability.primary}`,
  };
  return Object.freeze({
    schemaVersion: 1,
    simulationLabel: SIMULATION_LABEL,
    leftId: String(left.scenario.scenarioId),
    rightId: String(right.scenario.scenarioId),
    seeds: Object.freeze([left.seed, right.seed]),
    deltas: Object.freeze(deltas),
    notes: Object.freeze([
      'Deltas are simulation diagnostics, not forecasts.',
      'Comparison output is diagnostic only and is not an investment claim.',
    ]),
    notAForecast: true,
  });
}

export function compareScenarios(leftId: string, rightId: string, epochs?: number): ScenarioComparisonReport {
  const left = simulateScenario(leftId, epochs ? { epochs } : undefined);
  const right = simulateScenario(rightId, epochs ? { epochs } : undefined);
  return compareReports(left, right);
}

export function runMonteCarlo(scenarioId: string, seeds: readonly number[], epochs?: number): MonteCarloBatch {
  const reports = seeds.map((seed) =>
    simulateScenario(scenarioId, epochs === undefined ? { seed } : { seed, epochs }),
  );
  return Object.freeze({
    baseScenarioId: scenarioId,
    seeds: Object.freeze([...seeds]),
    reports: Object.freeze(reports),
    notAFinancialPrediction: true,
  });
}
