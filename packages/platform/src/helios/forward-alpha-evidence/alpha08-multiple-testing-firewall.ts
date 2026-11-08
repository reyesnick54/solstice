/**
 * ALPHA08 — multiple-testing firewall between research lanes and forward endpoints.
 */

export const HELIOS_ALPHA08_MULTIPLE_TESTING_FIREWALL = 'HELIOS_ALPHA08_MULTIPLE_TESTING_FIREWALL' as const;

export type ResearchTrialRecord = {
  readonly trialId: string;
  readonly lane: 'BACKTEST' | 'COUNTERFACTUAL' | 'FORWARD_SHADOW';
};

export function countForwardEligibleTrials(trials: readonly ResearchTrialRecord[]): number {
  return trials.filter((row) => row.lane === 'FORWARD_SHADOW').length;
}

export function blockBacktestPromotion(trial: ResearchTrialRecord): boolean {
  return trial.lane === 'BACKTEST' || trial.lane === 'COUNTERFACTUAL';
}
