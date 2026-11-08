import { defaultForwardDemotionPolicy } from './forward-demotion-policy.ts';
import { computeForwardStrategyHealth } from './forward-strategy-health.ts';
import { evaluateResearchKillDecision } from './research-kill-decision.ts';
import type { ForwardDemotionPolicy, ForwardStrategyHealth, ForwardStrategyHealthInput, ResearchKillDecision } from './types.ts';

export type Alpha23AutomaticDemotionResult = {
  readonly policy: ForwardDemotionPolicy;
  readonly health: ForwardStrategyHealth;
  readonly decision: ResearchKillDecision;
};

export function evaluateAlpha23AutomaticDemotion(
  input: ForwardStrategyHealthInput,
  policy: ForwardDemotionPolicy = defaultForwardDemotionPolicy(),
): Alpha23AutomaticDemotionResult {
  const health = computeForwardStrategyHealth(input, policy);
  const decision = evaluateResearchKillDecision(health, policy);
  return Object.freeze({ policy, health, decision });
}
