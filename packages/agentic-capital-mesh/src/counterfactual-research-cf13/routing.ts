import type { CounterfactualCf13Phase, CounterfactualCf13Role } from './types.ts';

export const DEFAULT_COUNTERFACTUAL_CF13_PIPELINE: readonly CounterfactualCf13Phase[] = Object.freeze([
  'POLICY_AND_FRAME',
  'OUTCOME_AND_PROPENSITY',
  'EXECUTION_AND_PATH',
  'CAUSAL_AND_RISK',
  'ADVERSARIAL_REVIEW',
  'SYNTHESIS',
]);

export function rolesForCf13Phase(phase: CounterfactualCf13Phase): readonly CounterfactualCf13Role[] {
  switch (phase) {
    case 'POLICY_AND_FRAME':
      return Object.freeze(['COUNTERFACTUAL_POLICY']);
    case 'OUTCOME_AND_PROPENSITY':
      return Object.freeze(['OUTCOME_MODEL', 'PROPENSITY_SUPPORT']);
    case 'EXECUTION_AND_PATH':
      return Object.freeze(['EXECUTION_REALITY', 'PORTFOLIO_PATH']);
    case 'CAUSAL_AND_RISK':
      return Object.freeze(['CAUSAL_INFERENCE', 'RISK_COUNTERFACTUAL']);
    case 'ADVERSARIAL_REVIEW':
      return Object.freeze(['SKEPTIC']);
    case 'SYNTHESIS':
      return Object.freeze(['COUNTERFACTUAL_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function defaultCounterfactualCf13Roles(): readonly CounterfactualCf13Role[] {
  return Object.freeze(DEFAULT_COUNTERFACTUAL_CF13_PIPELINE.flatMap((phase) => [...rolesForCf13Phase(phase)]));
}
