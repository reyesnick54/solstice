/**
 * Deterministic economic stress campaigns.
 *
 * Large horizon campaigns (120 / 600 epochs) are extended workflows
 * and are not part of ordinary PR CI.
 */

import { campaignById, STRESS_CAMPAIGNS } from './catalog.ts';
import { runEconomicStressScenario } from './engine.ts';
import { buildStressReport, renderStressReport } from './report.ts';
import type { EconomicStressReport } from './types.ts';

export const SMOKE_STRESS_IDS = STRESS_CAMPAIGNS.find((row) => row.campaignId === 'smoke')!.scenarioIds;

export function runStressCampaign(
  campaignId: string,
  options?: { readonly seed?: number; readonly epochs?: number; readonly allowExtended?: boolean },
): EconomicStressReport {
  const campaign = campaignById(campaignId);
  if (!campaign) {
    throw new Error(`unknown economic stress campaign ${campaignId}`);
  }
  if (campaign.extendedWorkflow && options?.allowExtended !== true) {
    throw new Error(`${campaignId} is an extended workflow; pass --extended to run it`);
  }
  const started = Date.now();
  const results = campaign.scenarioIds.map((scenarioId) =>
    runEconomicStressScenario(scenarioId, {
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      epochs: options?.epochs ?? campaign.epochs,
    }),
  );
  return buildStressReport({
    campaignId,
    seed: options?.seed ?? 76,
    results,
    labElapsedMs: Date.now() - started,
  });
}

export function runSmokeStressCampaign(): EconomicStressReport {
  return runStressCampaign('smoke');
}

export function formatCampaign(report: EconomicStressReport): string {
  return renderStressReport(report);
}
