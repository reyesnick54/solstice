import type { KillSwitchReason } from '@solstice/strategy-lab';

import type { ResearchKillDecision } from './types.ts';

/**
 * Paper runtime must halt new orders when a research kill decision fires (history stays immutable).
 */
export function researchKillHaltsPaperExecution(decision: ResearchKillDecision): boolean {
  return decision.killRequired;
}

export function researchKillPaperHaltReason(decision: ResearchKillDecision): KillSwitchReason {
  if (decision.triggers.includes('MARKET_DATA_DEGRADATION')) {
    return 'STALE_MARKET_DATA';
  }
  if (decision.triggers.includes('DRAWDOWN_LIMIT_BREACHED')) {
    return 'DRAWDOWN_GUARD';
  }
  if (decision.triggers.includes('OPERATIONAL_ANOMALY')) {
    return 'INVARIANT_FAILURE';
  }
  return 'POLICY_CHANGE';
}

export function forwardShadowStopsOnResearchKill(decision: ResearchKillDecision): boolean {
  return decision.killRequired;
}
