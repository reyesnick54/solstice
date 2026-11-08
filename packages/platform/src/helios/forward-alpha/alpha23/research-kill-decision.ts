import { createHash } from 'node:crypto';

import {
  FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  RESEARCH_REACTIVATION_GATES,
  type ForwardDemotionTransition,
  type ForwardResearchPosture,
} from './taxonomy.ts';
import type { ForwardDemotionPolicy, ForwardStrategyHealth, ResearchKillDecision } from './types.ts';

function decisionId(strategyId: string, evaluatedAt: string, transition: ForwardDemotionTransition): string {
  const material = `${strategyId}:${evaluatedAt}:${transition}`;
  return `rkill_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
}

function resolveTransition(
  posture: ForwardResearchPosture,
  band: ForwardStrategyHealth['band'],
): { readonly transition: ForwardDemotionTransition; readonly to: ForwardResearchPosture } {
  if (band === 'FAIL_SAFE_REQUIRED') {
    return Object.freeze({ transition: 'ANY_TO_FAILED_SAFE', to: 'FAILED_SAFE' });
  }
  if (band !== 'DEMOTION_RECOMMENDED') {
    return Object.freeze({ transition: 'NONE', to: posture });
  }
  if (posture === 'PAPER') {
    return Object.freeze({ transition: 'PAPER_TO_SHADOW', to: 'SHADOW' });
  }
  if (posture === 'SHADOW') {
    return Object.freeze({ transition: 'SHADOW_TO_PAUSED', to: 'PAUSED' });
  }
  if (posture === 'CHAMPION') {
    return Object.freeze({ transition: 'ANY_TO_FAILED_SAFE', to: 'FAILED_SAFE' });
  }
  return Object.freeze({ transition: 'ANY_TO_FAILED_SAFE', to: 'FAILED_SAFE' });
}

/**
 * Prefer stopping a failing strategy over extending or re-risking it.
 */
export function evaluateResearchKillDecision(
  health: ForwardStrategyHealth,
  policy: ForwardDemotionPolicy,
): ResearchKillDecision {
  const { transition, to } = resolveTransition(health.posture, health.band);
  const killRequired = transition !== 'NONE';

  const reason = killRequired
    ? `automatic research kill: ${health.firedTriggers.join(', ')}`
    : health.band === 'WATCH'
      ? 'watch band — no automatic kill'
      : 'health within policy';

  return Object.freeze({
    schema: health.schema,
    decisionId: decisionId(health.strategyId, health.evaluatedAt, transition),
    strategyId: health.strategyId,
    decidedAt: health.evaluatedAt,
    killRequired,
    fromPosture: health.posture,
    toPosture: to,
    transition,
    triggers: health.firedTriggers,
    reason,
    failedEvidenceRetained: true,
    permitsRiskIncrease: false,
    forbiddenActionsEnforced: policy.forbiddenAutomaticActions.length
      ? policy.forbiddenAutomaticActions
      : FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
    reactivationRequires: RESEARCH_REACTIVATION_GATES,
    grantsFinancialAuthority: false,
  });
}
