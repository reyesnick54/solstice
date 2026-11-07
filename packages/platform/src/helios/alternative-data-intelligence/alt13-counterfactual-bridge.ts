/**
 * ALT13 — counterfactual learning may later assess alt-data-informed policies (advisory).
 */

export const HELIOS_ALT13_COUNTERFACTUAL_BRIDGE =
  'HELIOS_ALT13_COUNTERFACTUAL_BRIDGE' as const;

export type AltInformedPolicyCounterfactualRef = {
  readonly policyLabel: string;
  readonly alternativeDataStateRef: string;
  readonly counterfactualAssessmentEligible: true;
  readonly simulationOnly: true;
};

export function linkAltResearchToCounterfactualAssessment(input: {
  readonly policyLabel: string;
  readonly evidenceRef: string;
}): AltInformedPolicyCounterfactualRef {
  return Object.freeze({
    policyLabel: input.policyLabel,
    alternativeDataStateRef: input.evidenceRef,
    counterfactualAssessmentEligible: true,
    simulationOnly: true,
  });
}
