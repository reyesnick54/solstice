/**
 * Development-only dual-economy dashboard view.
 *
 * Every panel is labeled SIMULATION.
 */

import { SIMULATION_LABEL } from './ids.ts';
import type { DualEconomySimulationReport } from './types.ts';

export function renderDashboard(report: DualEconomySimulationReport): string {
  const lines = [
    `=== ${SIMULATION_LABEL} SunRey / MoonRey dual-economy dashboard ===`,
    `scenario=${report.scenario.scenarioId} seed=${report.seed} epochs=${report.epochs}`,
    `SunRey supply issued=${report.sunrey.issued} circulating=${report.sunrey.circulating} locked=${report.sunrey.locked} burned=${report.sunrey.burned}`,
    `MoonRey supply issued=${report.moonrey.issued} circulating=${report.moonrey.circulating} locked=${report.moonrey.locked} burned=${report.moonrey.burned}`,
    `productive output=${report.productive.totalOutput} index=${report.productive.outputIndex}`,
    `human activity=${report.human.totalActivity} participation=${report.human.participationIndex}`,
    `automation intensity=${report.automation.intensityIndex} laborShareBps=${report.automation.humanLaborShareBps}`,
    `Exchange last=${report.market.lastPriceUnits ?? 'n/a'} spreadBps=${report.market.spreadBps ?? 'n/a'} bidDepth=${report.market.bidDepth} askDepth=${report.market.askDepth}`,
    `liquidity sunrey=${report.market.sunreyLiquidity} moonrey=${report.market.moonreyLiquidity} turnover=${report.market.turnover}`,
    `fees charged=${report.fees.charged} burned=${report.fees.burned} utilizationBps=${report.fees.utilizationBps}`,
    `concentration productiveHhi=${report.concentration.productiveOutputHhi} warnings=${report.concentration.warnings.length}`,
    `stability=${report.stability.signals.join(',')} label=${SIMULATION_LABEL}`,
    `productionActivation=false moonreyIssuanceActivated=false`,
  ];
  return lines.join('\n');
}

export function dashboardView(report: DualEconomySimulationReport): Record<string, unknown> {
  return Object.freeze({
    label: SIMULATION_LABEL,
    scenario: report.scenario.scenarioId,
    seed: report.seed,
    sunreySupply: report.sunrey,
    moonreySupply: report.moonrey,
    productiveOutput: report.productive.totalOutput,
    humanActivity: report.human.totalActivity,
    automation: report.automation.intensityIndex,
    exchangePrice: report.market.lastPriceUnits,
    liquidity: {
      spreadBps: report.market.spreadBps,
      sunrey: report.market.sunreyLiquidity,
      moonrey: report.market.moonreyLiquidity,
    },
    fees: report.fees.charged,
    concentration: report.concentration,
    stability: report.stability.signals,
  });
}
