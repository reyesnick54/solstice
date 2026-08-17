/**
 * AI-consumable analysis memo.
 *
 * AI may explain reports and propose policy experiments. It cannot
 * alter the active protocol policy.
 */

import type { AiAnalysisMemo, DualEconomySimulationReport } from './types.ts';

export function analyzeReport(report: DualEconomySimulationReport): AiAnalysisMemo {
  const explanation = [
    `SIMULATION ${report.scenario.scenarioId} seed=${report.seed} ran ${report.epochs} abstract epochs.`,
    `Human participation index ${report.human.participationIndex} versus productive output index ${report.productive.outputIndex}.`,
    `Automation intensity ${report.automation.intensityIndex} with labor share ${report.automation.humanLaborShareBps} bps.`,
    `SunRey circulating ${report.sunrey.circulating} and MoonRey circulating ${report.moonrey.circulating} remain unmerged.`,
    `Exchange last price ${report.market.lastPriceUnits ?? 'none'} formed from order flow (${report.market.priceDiscovery}).`,
    `Primary stability signal ${report.stability.primary}.`,
  ].join(' ');
  return Object.freeze({
    reportScenarioId: String(report.scenario.scenarioId),
    seed: report.seed,
    explanation,
    riskSummary: Object.freeze([
      ...report.stability.signals.map((signal) => `signal:${signal}`),
      ...report.concentration.warnings,
      report.oracle.failClosed ? 'oracle fail-closed reduced MoonRey issuance' : 'oracle quorum available',
    ]),
    policyProposals: Object.freeze([
      'Keep MoonRey issuance on verified productive output only.',
      'Treat Exchange conversion as market discovery, never a peg.',
      'Any issuance/fee/validator parameter change remains simulator-only.',
    ]),
    canAlterActiveProtocolPolicy: false,
  });
}
