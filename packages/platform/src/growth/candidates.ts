import type { AgentProposal } from '../../../agent/src/proposal.ts';
import { Money } from '../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import { actionIdFor } from '../ids.ts';
import type { MandateGoalId } from '../ids.ts';
import type { CompiledEconomicMandate, SerializedMoney } from '../mandate/types.ts';
import type { PolicyControlPort } from '../policy-port.ts';
import { constraintAmount, liquidForCurrency } from './feasibility.ts';
import type { GrowthActionCandidate, PlanningContext } from './types.ts';

function zero(currency: string): SerializedMoney {
  return { minorUnits: '0', currency };
}

function confirmationRequired(mandate: CompiledEconomicMandate, amount: Money): boolean {
  const threshold = constraintAmount(mandate, 'REQUIRED_CONFIRMATION_THRESHOLD');
  return threshold !== undefined && amount.cmp(threshold) > 0;
}

function goalIds(mandate: CompiledEconomicMandate, kinds: readonly string[]): MandateGoalId[] {
  return mandate.goals.filter((goal) => kinds.includes(goal.kind)).map((goal) => goal.goalId);
}

function executionForAmount(
  mandate: CompiledEconomicMandate,
  amount: Money,
  movable: boolean,
): GrowthActionCandidate['executionCapability'] {
  if (!movable) {
    return 'INFORMATION_ONLY';
  }
  if (confirmationRequired(mandate, amount)) {
    return 'USER_CONFIRMATION_REQUIRED';
  }
  return 'KERNEL_AUTHORIZATION_REQUIRED';
}

export function generateGrowthCandidates(input: {
  readonly mandate: CompiledEconomicMandate;
  readonly snapshot: PersonalEconomicSnapshot;
  readonly ideas: readonly AgentProposal[];
  readonly policy: PolicyControlPort;
  readonly planning: PlanningContext;
}): readonly GrowthActionCandidate[] {
  const currency = input.mandate.currency;
  const liquid = liquidForCurrency(input.snapshot, currency);
  const floor = constraintAmount(input.mandate, 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR')
    ?? constraintAmount(input.mandate, 'MINIMUM_CASH_RESERVE')
    ?? Money.zero(currency);
  const available = liquid.cmp(floor) > 0 ? liquid.minus(floor) : Money.zero(currency);
  const accounts = input.planning.eligibleAccounts ?? [];
  const checking = accounts.find((item) =>
    /checking|DEMAND_DEPOSIT/i.test(`${item.accountRef} ${item.accountClass ?? ''}`),
  )?.accountRef;
  const savings = accounts.find((item) =>
    /savings|SAVINGS_DEPOSIT/i.test(`${item.accountRef} ${item.accountClass ?? ''}`),
  )?.accountRef;
  const candidates: GrowthActionCandidate[] = [];

  const subscriptions = input.snapshot.knownRecurringObligations.filter((item) =>
    /subscription|stream/i.test(`${item.kind} ${item.label}`),
  );
  if (subscriptions.length === 0 && input.ideas.some((item) => item.ideaAction === 'REVIEW_SUBSCRIPTION')) {
    subscriptions.push({
      nodeId: 'agent_subscription_idea',
      kind: 'SUBSCRIPTION',
      label: 'Subscription review idea',
      estimatedAmount: { minorUnits: '1599', currency },
      confidence: 'DERIVED',
      sourceRefs: Object.freeze([]),
    });
  }
  for (const sub of subscriptions) {
    const amount = Money.fromMinorUnitsString(sub.estimatedAmount.minorUnits, sub.estimatedAmount.currency);
    const idea = input.ideas.find((item) => item.ideaAction === 'REVIEW_SUBSCRIPTION');
    candidates.push({
      actionId: actionIdFor('REVIEW_SUBSCRIPTION', sub.nodeId),
      action: 'REVIEW_SUBSCRIPTION',
      source: idea ? 'AGENT_PROPOSAL' : 'PEG',
      title: `Review subscription ${sub.label}`,
      expectedEffect: {
        kind: 'DETERMINISTIC_EFFECT',
        amount: amount.toJSON(),
        description: 'Cancelling an unused subscription would stop this recurring outflow.',
      },
      confidenceScore: 70,
      assumptions: Object.freeze(['Subscription remains unused if cancelled.']),
      liquidityImpact: Money.zero(currency).toJSON(),
      riskClass: 'LOW',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: false,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'INFORMATION_ONLY',
      supportingFactRefs: Object.freeze([sub.nodeId, ...sub.sourceRefs]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['INCREASE_MONTHLY_SURPLUS', 'REDUCE_UNNECESSARY_FEES'])),
      agentProposalIds: Object.freeze(idea ? [idea.proposalId] : []),
      pegOpportunityIds: Object.freeze(
        input.snapshot.economicOpportunities
          .filter((item) => item.kind === 'CANCEL_UNUSED_SUBSCRIPTION')
          .map((item) => item.opportunityId),
      ),
    });
  }

  const fees = input.snapshot.knownRecurringObligations.filter((item) => /fee/i.test(item.label));
  for (const fee of fees) {
    candidates.push({
      actionId: actionIdFor('REDUCE_FEE', fee.nodeId),
      action: 'REDUCE_FEE',
      source: 'PEG',
      title: `Review fee ${fee.label}`,
      expectedEffect: {
        kind: 'DETERMINISTIC_EFFECT',
        amount: fee.estimatedAmount,
        description: 'Avoiding a known fee is a deterministic cash-flow improvement.',
      },
      confidenceScore: 60,
      assumptions: Object.freeze(['Fee is avoidable without violating obligations.']),
      liquidityImpact: zero(currency),
      riskClass: 'LOW',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: false,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'INFORMATION_ONLY',
      supportingFactRefs: Object.freeze([fee.nodeId]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['REDUCE_UNNECESSARY_FEES'])),
      agentProposalIds: Object.freeze([]),
      pegOpportunityIds: Object.freeze(
        input.snapshot.economicOpportunities.filter((item) => item.kind === 'REDUCE_FEE').map((item) => item.opportunityId),
      ),
    });
  }

  const emergencyGoal = input.mandate.goals.find((goal) => goal.kind === 'BUILD_EMERGENCY_RESERVE');
  if (emergencyGoal?.target) {
    const target = Money.fromMinorUnitsString(emergencyGoal.target.minorUnits, emergencyGoal.target.currency);
    const gap = target.cmp(liquid) > 0 ? target.minus(liquid) : Money.zero(currency);
    const allocate = gap.cmp(available) < 0 ? gap : available;
    const idea = input.ideas.find((item) => item.ideaAction === 'ALLOCATE_TO_EMERGENCY_RESERVE');
    if (allocate.isPositive()) {
      const confirm = confirmationRequired(input.mandate, allocate);
      candidates.push({
        actionId: actionIdFor('ALLOCATE_RESERVE', emergencyGoal.goalId),
        action: 'ALLOCATE_TO_EMERGENCY_RESERVE',
        source: idea ? 'AGENT_PROPOSAL' : 'MANDATE_GOAL',
        title: 'Allocate surplus toward emergency reserve',
        expectedEffect: {
          kind: 'DETERMINISTIC_EFFECT',
          amount: allocate.toJSON(),
          description: 'Moving idle cash into an existing eligible reserve account is a principal reallocation, not growth.',
        },
        confidenceScore: 80,
        assumptions: Object.freeze(['Destination remains an eligible existing account.']),
        liquidityImpact: allocate.negate().toJSON(),
        riskClass: 'LOW',
        mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
        userConfirmationRequired: confirm,
        policyRequirement: 'INTERNAL_TRANSFER requires Kernel authorization after confirmation',
        complianceRequirement: 'none',
        executionCapability: executionForAmount(input.mandate, allocate, Boolean(checking && savings)),
        ...(checking ? { sourceAccountId: checking } : {}),
        ...(savings ? { destinationAccountId: savings } : {}),
        proposedAmount: allocate.toJSON(),
        supportingFactRefs: Object.freeze(input.snapshot.liquidAssetsByCurrency.flatMap((item) => item.sourceRefs)),
        supportingGoalIds: Object.freeze([emergencyGoal.goalId]),
        agentProposalIds: Object.freeze(idea ? [idea.proposalId] : []),
        pegOpportunityIds: Object.freeze(
          input.snapshot.economicOpportunities
            .filter((item) => item.kind === 'MOVE_IDLE_CASH')
            .map((item) => item.opportunityId),
        ),
      });
    }
  }

  for (const debt of input.snapshot.debt) {
    const idea = input.ideas.find((item) => item.ideaAction === 'REDUCE_DEBT');
    const payment = available.cmp(Money.fromMinorUnits(10000n, currency)) > 0
      ? Money.fromMinorUnits(10000n, currency)
      : available;
    const confirm = confirmationRequired(input.mandate, payment);
    candidates.push({
      actionId: actionIdFor('REDUCE_DEBT', debt.nodeId),
      action: 'REDUCE_DEBT',
      source: idea ? 'AGENT_PROPOSAL' : 'PEG',
      title: `Evaluate reduction of ${debt.label}`,
      expectedEffect: {
        kind: 'ESTIMATED_EFFECT',
        low: payment.toJSON(),
        high: payment.toJSON(),
        assumptions: Object.freeze(['Payment reduces principal; cost-avoided is not income.']),
        confidenceScore: 50,
        horizonDays: 30,
      },
      confidenceScore: 50,
      assumptions: Object.freeze(['Debt balance is user-declared or derived, not a ledger posting.']),
      liquidityImpact: payment.negate().toJSON(),
      riskClass: 'MODERATE',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: confirm,
      policyRequirement: 'payment rails require Kernel authorization; beneficiary capability is absent here',
      complianceRequirement: 'HUMAN_REVIEW_REQUIRED if a payment corridor cannot be evaluated',
      executionCapability: 'PROPOSAL_ONLY',
      proposedAmount: payment.toJSON(),
      supportingFactRefs: Object.freeze([debt.nodeId]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['REDUCE_DEBT'])),
      agentProposalIds: Object.freeze(idea ? [idea.proposalId] : []),
      pegOpportunityIds: Object.freeze(
        input.snapshot.economicOpportunities
          .filter((item) => item.kind === 'REFINANCE_DEBT')
          .map((item) => item.opportunityId),
      ),
    });
  }

  const rent = input.snapshot.knownRecurringObligations.find((item) => /rent/i.test(`${item.kind} ${item.label}`));
  if (rent) {
    candidates.push({
      actionId: actionIdFor('OPTIMIZE_TIMING', rent.nodeId),
      action: 'OPTIMIZE_PAYMENT_TIMING',
      source: 'PEG',
      title: 'Review timing of essential rent payment',
      expectedEffect: {
        kind: 'DETERMINISTIC_EFFECT',
        amount: zero(currency),
        description: 'Timing review does not change the obligation amount.',
      },
      confidenceScore: 40,
      assumptions: Object.freeze(['Essential obligations stay funded.']),
      liquidityImpact: zero(currency),
      riskClass: 'LOW',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: false,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'INFORMATION_ONLY',
      supportingFactRefs: Object.freeze([rent.nodeId]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['MAINTAIN_TARGET_LIQUIDITY'])),
      agentProposalIds: Object.freeze([]),
      pegOpportunityIds: Object.freeze([]),
    });
  }

  for (const opportunity of input.snapshot.economicOpportunities.filter((item) => item.kind === 'CAPTURE_REWARD')) {
    candidates.push({
      actionId: actionIdFor('CAPTURE_REWARD', opportunity.opportunityId),
      action: 'CAPTURE_REWARD',
      source: 'PEG',
      title: opportunity.title,
      expectedEffect: {
        kind: 'ESTIMATED_EFFECT',
        low: zero(currency),
        high: zero(currency),
        assumptions: Object.freeze(['Reward capture is not income until settled.']),
        confidenceScore: 30,
        horizonDays: 30,
      },
      confidenceScore: 30,
      assumptions: Object.freeze(['Reward programs may change.']),
      liquidityImpact: zero(currency),
      riskClass: 'LOW',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: false,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'INFORMATION_ONLY',
      supportingFactRefs: Object.freeze([opportunity.opportunityId]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['IMPROVE_REWARD_CAPTURE'])),
      agentProposalIds: Object.freeze([]),
      pegOpportunityIds: Object.freeze([opportunity.opportunityId]),
    });
  }

  if (checking && savings) {
    const idle = Money.fromMinorUnits(5000n, currency);
    candidates.push({
      actionId: actionIdFor('MOVE_IDLE', `${checking}_${savings}`),
      action: 'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
      source: 'PEG',
      title: 'Move a small idle-cash amount between existing eligible accounts',
      expectedEffect: {
        kind: 'DETERMINISTIC_EFFECT',
        amount: idle.toJSON(),
        description: 'Internal reallocation of principal between existing accounts.',
      },
      confidenceScore: 65,
      assumptions: Object.freeze(['Both accounts remain open and eligible.']),
      liquidityImpact: zero(currency),
      riskClass: 'LOW',
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
      userConfirmationRequired: confirmationRequired(input.mandate, idle),
      policyRequirement: 'INTERNAL_TRANSFER requires Kernel authorization',
      complianceRequirement: 'none',
      executionCapability: executionForAmount(input.mandate, idle, true),
      sourceAccountId: checking,
      destinationAccountId: savings,
      proposedAmount: idle.toJSON(),
      supportingFactRefs: Object.freeze([checking, savings]),
      supportingGoalIds: Object.freeze(goalIds(input.mandate, ['MAINTAIN_TARGET_LIQUIDITY'])),
      agentProposalIds: Object.freeze([]),
      pegOpportunityIds: Object.freeze(
        input.snapshot.economicOpportunities
          .filter((item) => item.kind === 'MOVE_IDLE_CASH')
          .map((item) => item.opportunityId),
      ),
    });
  }

  const investIdea = input.ideas.find((item) => item.ideaAction === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE');
  const investFact = input.policy.queryControlFact({
    capability: 'INVESTMENT_EXECUTION',
    subjectId: input.mandate.subjectId,
  });
  candidates.push({
    actionId: actionIdFor('REVIEW_INVESTMENT', input.mandate.mandateId),
    action: 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE',
    source: investIdea ? 'AGENT_PROPOSAL' : 'PEG',
    title: 'Review future investment opportunity',
    expectedEffect: {
      kind: 'UNCERTAIN_MARKET_OUTCOME',
      scenario: 'PLACEHOLDER_UNTIL_INVESTMENT_SUBSYSTEM',
      low: zero(currency),
      high: zero(currency),
      assumptions: Object.freeze([
        'Investment execution is not implemented.',
        'No market method is fabricated.',
      ]),
      confidenceScore: 0,
      horizonDays: 0,
      riskClass: 'UNCERTAIN_MARKET',
      achievementPromised: false,
    },
    confidenceScore: 0,
    assumptions: Object.freeze(['Future investment opportunities remain REVIEW/PLACEHOLDER.']),
    liquidityImpact: zero(currency),
    riskClass: 'UNCERTAIN_MARKET',
    mandateEvaluation: {
      satisfied: true,
      violatedConstraintKinds: Object.freeze([]),
      notes: Object.freeze(['High-risk execution is prohibited; this remains a review placeholder.']),
    },
    userConfirmationRequired: true,
    policyRequirement: investFact.evaluable ? investFact.reason : 'HUMAN_REVIEW_REQUIRED',
    complianceRequirement: 'DEPENDENCY_NOT_IMPLEMENTED',
    executionCapability: 'DEPENDENCY_NOT_IMPLEMENTED',
    supportingFactRefs: Object.freeze([]),
    supportingGoalIds: Object.freeze(goalIds(input.mandate, ['INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER', 'AGGRESSIVE_SHORT_HORIZON_GROWTH'])),
    agentProposalIds: Object.freeze(investIdea ? [investIdea.proposalId] : []),
    pegOpportunityIds: Object.freeze(
      input.snapshot.economicOpportunities
        .filter((item) => item.kind === 'INVEST_SURPLUS')
        .map((item) => item.opportunityId),
    ),
  });

  const paperFact = input.policy.queryControlFact({
    capability: 'PAPER_INVESTMENT_REVIEW',
    subjectId: input.mandate.subjectId,
  });
  candidates.push({
    actionId: actionIdFor('INVESTMENT_ACCOUNT_AVAILABLE', input.mandate.mandateId),
    action: 'INVESTMENT_ACCOUNT_AVAILABLE',
    source: 'PEG',
    title: 'Investment account is available for simulation review',
    expectedEffect: {
      kind: 'UNCERTAIN_MARKET_OUTCOME',
      scenario: 'PAPER_INVESTMENT_ACCOUNT_REVIEW',
      low: zero(currency),
      high: zero(currency),
      assumptions: Object.freeze(['Opening still requires user confirmation and Kernel authorization.']),
      confidenceScore: 40,
      horizonDays: 0,
      riskClass: 'UNCERTAIN_MARKET',
      achievementPromised: false,
    },
    confidenceScore: 40,
    assumptions: Object.freeze(['Growth does not auto-open or auto-trade.']),
    liquidityImpact: zero(currency),
    riskClass: 'UNCERTAIN_MARKET',
    mandateEvaluation: {
      satisfied: true,
      violatedConstraintKinds: Object.freeze([]),
      notes: Object.freeze(['Simulation investment account opening remains Kernel-gated.']),
    },
    userConfirmationRequired: true,
    policyRequirement: paperFact.reason,
    complianceRequirement: 'KERNEL_AUTHORIZATION_REQUIRED',
    executionCapability: 'USER_CONFIRMATION_REQUIRED',
    supportingFactRefs: Object.freeze([]),
    supportingGoalIds: Object.freeze(goalIds(input.mandate, ['INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER'])),
    agentProposalIds: Object.freeze([]),
    pegOpportunityIds: Object.freeze([]),
  });
  candidates.push({
    actionId: actionIdFor('PAPER_INVESTMENT_REVIEW', input.mandate.mandateId),
    action: 'PAPER_INVESTMENT_REVIEW_AVAILABLE',
    source: 'AGENT_PROPOSAL',
    title: 'Paper investment review is available',
    expectedEffect: {
      kind: 'UNCERTAIN_MARKET_OUTCOME',
      scenario: 'PAPER_ORDER_REQUIRES_USER_AND_KERNEL',
      low: zero(currency),
      high: zero(currency),
      assumptions: Object.freeze(['Growth cannot submit the paper order.']),
      confidenceScore: 40,
      horizonDays: 0,
      riskClass: 'UNCERTAIN_MARKET',
      achievementPromised: false,
    },
    confidenceScore: 40,
    assumptions: Object.freeze(['No autonomous trading.']),
    liquidityImpact: zero(currency),
    riskClass: 'UNCERTAIN_MARKET',
    mandateEvaluation: {
      satisfied: true,
      violatedConstraintKinds: Object.freeze([]),
      notes: Object.freeze(['Paper order materialization still requires explicit approval.']),
    },
    userConfirmationRequired: true,
    policyRequirement: paperFact.reason,
    complianceRequirement: 'KERNEL_AUTHORIZATION_REQUIRED',
    executionCapability: 'USER_CONFIRMATION_REQUIRED',
    supportingFactRefs: Object.freeze([]),
    supportingGoalIds: Object.freeze(goalIds(input.mandate, ['INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER'])),
    agentProposalIds: Object.freeze(investIdea ? [investIdea.proposalId] : []),
    pegOpportunityIds: Object.freeze([]),
  });

  const violatingAmount = liquid.minus(Money.fromMinorUnits(1n, currency));
  if (violatingAmount.isPositive()) {
    candidates.push({
      actionId: actionIdFor('GUARD_LIQUIDITY', input.mandate.mandateId),
      action: 'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
      source: 'SYNTHETIC_GUARD',
      title: 'Rejected: move cash that would breach the liquidity floor',
      expectedEffect: {
        kind: 'DETERMINISTIC_EFFECT',
        amount: violatingAmount.toJSON(),
        description: 'Synthetic guard candidate used to prove the liquidity floor.',
      },
      confidenceScore: 100,
      assumptions: Object.freeze(['Generated only to test hard-constraint enforcement.']),
      liquidityImpact: violatingAmount.negate().toJSON(),
      riskClass: 'HIGH',
      mandateEvaluation: {
        satisfied: false,
        violatedConstraintKinds: Object.freeze(['NEVER_SPEND_BELOW_LIQUIDITY_FLOOR']),
        notes: Object.freeze(['Would leave liquidity below the mandate floor.']),
      },
      userConfirmationRequired: true,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'PROHIBITED',
      ...(checking ? { sourceAccountId: checking } : {}),
      proposedAmount: violatingAmount.toJSON(),
      supportingFactRefs: Object.freeze([]),
      supportingGoalIds: Object.freeze([]),
      agentProposalIds: Object.freeze([]),
      pegOpportunityIds: Object.freeze([]),
    });
  }

  return Object.freeze(candidates);
}
