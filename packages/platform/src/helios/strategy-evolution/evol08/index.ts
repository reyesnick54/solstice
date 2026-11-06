import {
  bearStrategyAdversary,
  executionRealityAdversary,
  leakageHunterAdversary,
  overfitHunterAdversary,
  runBullStrategyAgent,
} from './adversarial-agents.ts';

export {
  FALSIFICATION_ENGINE_SCHEMA,
  FALSIFICATION_REPORT_SCHEMA,
  STRESS_CHALLENGER_KINDS,
  STRUCTURAL_FALSIFICATION_QUESTIONS,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED,
  type StressChallengerKind,
  type StructuralFalsificationQuestionId,
} from './taxonomy.ts';

export type {
  FailureHypothesis,
  StressChallenge,
  StressCampaign,
  FalsificationFinding,
  PerformanceConcentrationAnalysis,
  FragilityAssessment,
  PerformanceConcentrationSnapshot,
  StrategyAdversary,
  StrategyFalsificationContext,
  StrategyFalsificationReport,
  FalsificationQualificationResult,
  FalsificationGateResult,
  StructuralQuestionAssessment,
  BullStrategyAgentView,
} from './types.ts';

export {
  StrategyFalsificationAgent,
  runStrategyFalsificationSweep,
  evaluateEvol08Qualification,
  buildDefaultStressCampaign,
} from './engine.ts';

export { DEFAULT_STRESS_SENSITIVITY_BPS } from './stress.ts';
export { analyzePerformanceConcentration, assessStructuralFalsificationQuestions } from './concentration.ts';
export { buildFragilityAssessment, defaultHealthyConcentration } from './fragility.ts';
export { evaluateFalsificationQualification, MIN_EDGE_SURVIVAL_BPS } from './gates.ts';

export {
  bearStrategyAdversary,
  leakageHunterAdversary,
  overfitHunterAdversary,
  executionRealityAdversary,
  runBullStrategyAgent,
};

/** Named agent surfaces (no qualification authority). */
export const BullStrategyAgent = Object.freeze({
  strongestCase: runBullStrategyAgent,
});

export const BearStrategyAgent = bearStrategyAdversary;

export const LeakageHunterAgent = leakageHunterAdversary;

export const OverfitHunterAgent = overfitHunterAdversary;

export const ExecutionRealityAgent = executionRealityAdversary;
