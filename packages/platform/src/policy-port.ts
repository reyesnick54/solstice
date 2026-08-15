/**
 * Canonical policy facts only. Growth does not evaluate regulation itself.
 * If a fact cannot be evaluated, callers mark HUMAN_REVIEW_REQUIRED or
 * DEPENDENCY_NOT_IMPLEMENTED.
 */
export type PolicyControlFact = {
  readonly factId: string;
  readonly capability: string;
  readonly permitted: boolean;
  readonly evaluable: boolean;
  readonly reason: string;
};

export interface PolicyControlPort {
  readonly queryControlFact: (input: {
    readonly capability: string;
    readonly subjectId: string;
    readonly jurisdiction?: string;
  }) => PolicyControlFact;
}

export const unevaluablePolicyPort: PolicyControlPort = {
  queryControlFact(input) {
    return {
      factId: `pcf_unevaluable_${input.capability}`,
      capability: input.capability,
      permitted: false,
      evaluable: false,
      reason: "policy_fact_not_evaluable",
    };
  },
};

export const simulationPolicyPort: PolicyControlPort = {
  queryControlFact(input) {
    if (input.capability === "INVESTMENT_EXECUTION") {
      return {
        factId: "pcf_investment_absent",
        capability: input.capability,
        permitted: false,
        evaluable: false,
        reason: "investment_subsystem_not_implemented",
      };
    }
    return {
      factId: `pcf_sim_${input.capability}`,
      capability: input.capability,
      permitted: true,
      evaluable: true,
      reason: "simulation_permitted_information_action",
    };
  },
};
