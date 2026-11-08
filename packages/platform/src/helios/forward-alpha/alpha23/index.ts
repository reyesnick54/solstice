/**
 * HELIOS Forward Alpha ALPHA23 — automatic strategy demotion and fail-safe research control.
 */

export {
  ALPHA23_SCHEMA,
  FORWARD_RESEARCH_POSTURES,
  FORWARD_DEMOTION_TRANSITIONS,
  FORWARD_DEMOTION_TRIGGERS,
  FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  RESEARCH_REACTIVATION_GATES,
  FORWARD_STRATEGY_HEALTH_BANDS,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED,
  type ForwardResearchPosture,
  type ForwardDemotionTransition,
  type ForwardDemotionTrigger,
  type ForbiddenAutomaticResearchAction,
  type ResearchReactivationGate,
  type ForwardStrategyHealthBand,
} from './taxonomy.ts';

export type {
  ForwardDemotionPolicy,
  ForwardStrategyHealth,
  ForwardStrategyHealthSignal,
  ForwardStrategyHealthInput,
  ResearchKillDecision,
} from './types.ts';

export { defaultForwardDemotionPolicy, assertNoForbiddenAutomaticAction } from './forward-demotion-policy.ts';
export { computeForwardStrategyHealth } from './forward-strategy-health.ts';
export { evaluateResearchKillDecision } from './research-kill-decision.ts';
export { evaluateAlpha23AutomaticDemotion, type Alpha23AutomaticDemotionResult } from './engine.ts';
export { evaluateAlpha23Qualification, type Alpha23QualificationResult } from './qualification.ts';
export {
  forwardResearchPostureFromPromotion,
  promotionTargetForResearchKill,
  alpha23PrimaryDemotionTrigger,
  alpha23DemotionTriggerFromAlpha11,
  alpha23AutomaticKillEligible,
} from './strategy-lab-bridge.ts';
export {
  researchKillHaltsPaperExecution,
  researchKillPaperHaltReason,
  forwardShadowStopsOnResearchKill,
} from './paper-runtime-bridge.ts';
export {
  evaluateResearchReactivationEligibility,
  type ResearchReactivationInput,
} from './reactivation.ts';
export { buildAlpha23HealthInputFromAlpha11 } from './alpha11-bridge.ts';
