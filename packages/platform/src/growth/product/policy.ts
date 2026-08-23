import type { FinancialProposalActionType, GrowPolicyDecision, GrowRiskProfile } from './taxonomy.ts';
import type { GrowthProductActor } from './types.ts';

export type GrowProductPolicy = {
  evaluate(input: {
    readonly actor: GrowthProductActor;
    readonly actionType: FinancialProposalActionType;
    readonly risk: GrowRiskProfile;
    readonly amountMinorUnits: string;
  }): { readonly decision: GrowPolicyDecision; readonly reason: string };
};

export const simulationGrowPolicy: GrowProductPolicy = {
  evaluate(input) {
    if (input.actor.restricted) {
      return { decision: 'DENY', reason: 'restricted_actor' };
    }
    if (input.risk === 'GROWTH' && input.actionType === 'ALLOCATE_TO_ELIGIBLE_INVESTMENT' && denyGrowth(input.actor)) {
      return { decision: 'DENY', reason: 'high_risk_allocation_denied' };
    }
    if (input.actor.verification !== 'VERIFIED' && input.actor.verification !== 'ACTIVE') {
      return { decision: 'REVIEW', reason: 'verification_incomplete' };
    }
    return { decision: 'ALLOW', reason: 'simulation_allow' };
  },
};

export function conservativeOnlyPolicy(): GrowProductPolicy {
  return {
    evaluate(input) {
      if (input.risk !== 'CONSERVATIVE' && input.actionType === 'ALLOCATE_TO_ELIGIBLE_INVESTMENT') {
        return { decision: 'DENY', reason: 'only_conservative_allocations_permitted' };
      }
      return simulationGrowPolicy.evaluate(input);
    },
  };
}

function denyGrowth(actor: GrowthProductActor): boolean {
  return actor.capabilities.includes('GROW_DENY_HIGH_RISK');
}

export const STEP_UP_MINOR_UNITS = 100_000n;

export function requiresStepUp(input: {
  readonly actionType: FinancialProposalActionType;
  readonly amountMinorUnits: string;
  readonly requiredApprovals: readonly string[];
}): boolean {
  if (input.requiredApprovals.includes('STEP_UP_AUTH')) {
    return true;
  }
  if (input.actionType === 'ALLOCATE_TO_ELIGIBLE_INVESTMENT') {
    return true;
  }
  try {
    return BigInt(input.amountMinorUnits) >= STEP_UP_MINOR_UNITS;
  } catch {
    return true;
  }
}
