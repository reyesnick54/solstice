import { ILLUSTRATION_DISCLAIMER } from './taxonomy.ts';
import type { FinancialProposalActionType, GrowRiskProfile } from './taxonomy.ts';
import type { ProposalAlternative, ProposalExplanation, ReturnAssumption } from './types.ts';
import type { GrowMoneyAmount } from './types.ts';

export function buildExplanation(input: {
  readonly actionType: FinancialProposalActionType;
  readonly amount: GrowMoneyAmount;
  readonly risk: GrowRiskProfile;
  readonly assumption: ReturnAssumption;
  readonly liquidity: string;
  readonly feesNote: string;
  readonly alternatives: readonly ProposalAlternative[];
  readonly goalRefs: readonly string[];
  readonly target?: GrowMoneyAmount;
}): ProposalExplanation {
  return Object.freeze({
    whyThisAction: why(input.actionType, input.amount),
    whatDataSupportsIt: Object.freeze(support(input.assumption, input.goalRefs)),
    expectedEffect: effect(input.actionType, input.assumption),
    whatCouldGoWrong: wrong(input.actionType, input.assumption),
    fees: input.feesNote,
    liquidity: input.liquidity,
    alternatives: input.alternatives.map((item) => item.label).join('; ') || 'No alternative recorded.',
    goalImpact: goalImpact(input.target, input.goalRefs),
    risks: `Stated risk profile is ${input.risk}. ${ILLUSTRATION_DISCLAIMER}`,
    dataAssumptions:
      input.assumption.availability === 'AVAILABLE'
        ? `Catalog ${input.assumption.catalogId ?? 'unknown'} as of ${input.assumption.dataAsOf ?? 'unknown'}.`
        : `Return assumption unavailable (${input.assumption.unavailableReason ?? 'NO_CATALOG_ENTRY'}). No expected return was invented.`,
    inventedByModel: false,
  });
}

function why(action: FinancialProposalActionType, amount: GrowMoneyAmount): string {
  switch (action) {
    case 'KEEP_CASH':
      return 'Keep the stated cash amount uninvested.';
    case 'ALLOCATE_TO_CASH_RESERVE':
      return `Move ${amount.minorUnits} ${amount.currency} minor units into the cash reserve target.`;
    case 'RECURRING_SAVINGS':
      return 'Set a recurring savings contribution used by the growth plan illustrations.';
    case 'ALLOCATE_TO_ELIGIBLE_INVESTMENT':
      return `Propose an eligible simulation allocation of ${amount.minorUnits} ${amount.currency} minor units.`;
    case 'GOAL_CONTRIBUTION':
      return 'Propose a structured contribution toward the referenced goal. Achievement is not promised.';
    case 'DEFER':
      return 'Defer action until circumstances or assumptions are reviewed again.';
    default:
      return `Structured ${action} proposal.`;
  }
}

function support(assumption: ReturnAssumption, goalRefs: readonly string[]): readonly string[] {
  const items = [
    assumption.availability === 'AVAILABLE'
      ? `Controlled catalog ${assumption.source ?? 'SUNREY_SIMULATION_ASSUMPTION_CATALOG_V1'}`
      : 'No supported return catalog row',
    `Risk sleeve ${assumption.riskProfile}`,
  ];
  if (assumption.dataAsOf) {
    items.push(`Assumption data as of ${assumption.dataAsOf}`);
  }
  if (goalRefs.length > 0) {
    items.push(`Goal references: ${goalRefs.join(', ')}`);
  }
  return items;
}

function effect(action: FinancialProposalActionType, assumption: ReturnAssumption): string {
  if (action === 'KEEP_CASH' || action === 'DEFER' || action === 'ALLOCATE_TO_CASH_RESERVE') {
    return 'Cash position changes only. No market return is assumed.';
  }
  if (assumption.availability !== 'AVAILABLE') {
    return 'Investment effect cannot be illustrated because return assumptions are unavailable.';
  }
  return 'Illustrated range uses catalog sleeves. The range is not a guaranteed future value.';
}

function wrong(action: FinancialProposalActionType, assumption: ReturnAssumption): string {
  if (action === 'ALLOCATE_TO_ELIGIBLE_INVESTMENT') {
    return `Invested amounts can decline. Volatility sleeve is ${String(assumption.volatilityBps ?? 'unavailable')} bps. ${ILLUSTRATION_DISCLAIMER}`;
  }
  return 'Facts, liquidity needs, or policy can change before execution. A stale proposal must be superseded.';
}

function goalImpact(target: GrowMoneyAmount | undefined, goalRefs: readonly string[]): string {
  if (!target && goalRefs.length === 0) {
    return 'No goal reference is attached. This proposal does not promise a goal outcome.';
  }
  return 'Goal references are recorded. Reaching a target is not promised and is not treated as a guaranteed return.';
}
