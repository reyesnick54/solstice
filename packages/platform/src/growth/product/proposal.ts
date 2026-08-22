import { Money } from '../../../../money/src/money.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { catalogFees } from './fees.ts';
import { buildAlternatives } from './alternatives.ts';
import { buildExplanation } from './explainability.ts';
import { asFinancialProposalVersion, financialProposalIdFor } from './ids.ts';
import { materialTermsHash } from './immutability.ts';
import { addHours } from './plan.ts';
import { freezeSuitability } from './suitability.ts';
import type { FinancialProposalActionType, GrowRiskProfile } from './taxonomy.ts';
import type {
  CreateGrowPlanInput,
  FinancialProposal,
  GrowPlanComponent,
  GrowthProductActor,
  ProductGrowthPlan,
} from './types.ts';

const PROPOSAL_TTL_HOURS = 72;

export function buildProposalFromComponent(input: {
  readonly plan: ProductGrowthPlan;
  readonly component: GrowPlanComponent;
  readonly actor: GrowthProductActor;
  readonly now: UtcInstant;
  readonly request: CreateGrowPlanInput;
  readonly opportunityId?: string;
  readonly version?: number;
  readonly supersedes?: FinancialProposal['supersedes'];
}): FinancialProposal {
  const amount = Money.fromMinorUnitsString(input.component.amount.minorUnits, input.component.currency);
  const actionType = actionFor(input.component.kind);
  const alternatives = buildAlternatives({
    actionType,
    amount,
    risk: input.component.risk,
  });
  const fees = catalogFees(input.plan.assumptions, amount);
  const version = asFinancialProposalVersion(input.version ?? 1);
  const proposalId = financialProposalIdFor(input.plan.planId, version, input.component.kind.toLowerCase());
  const suitability = freezeSuitability({
    proposalId,
    now: input.now,
    actor: input.actor,
    riskProfile: input.component.risk,
    timeHorizonMonths: input.plan.timeHorizonMonths,
    ...(input.plan.liquidityRequirement ? { liquidity: input.plan.liquidityRequirement } : {}),
  });
  const mid = input.plan.scenarioAnalysis.base.illustratedMid;
  const effectRange = {
    min: input.plan.scenarioAnalysis.conservative.illustratedLow,
    max: input.plan.scenarioAnalysis.upside.illustratedHigh,
  };
  const hash = materialTermsHash({
    actionType,
    instrument: input.component.instrument ?? input.component.kind,
    ...(input.component.sourceAccountId ? { sourceAccountId: input.component.sourceAccountId } : {}),
    destination: input.component.destination ?? input.component.kind,
    amountMinorUnits: amount.toJSON().minorUnits,
    currency: amount.currency,
    risk: input.component.risk,
    fees,
    assumptionSetId: input.plan.assumptions.assumptionSetId,
    assumptionAvailability: input.plan.assumptions.availability,
  });
  return Object.freeze({
    proposalId,
    version,
    planId: input.plan.planId,
    ...(input.opportunityId ?? input.request.opportunityId
      ? { opportunityId: input.opportunityId ?? input.request.opportunityId }
      : {}),
    ownerId: input.plan.ownerId,
    actionType,
    instrument: input.component.instrument ?? input.component.kind,
    ...(input.component.sourceAccountId ? { sourceAccountId: input.component.sourceAccountId } : {}),
    destination: input.component.destination ?? input.component.kind,
    amount: amount.toJSON(),
    currency: amount.currency,
    expectedEffect: {
      description:
        actionType === 'ALLOCATE_TO_ELIGIBLE_INVESTMENT'
          ? 'Illustrated investment range under catalog assumptions. Not a guaranteed future value.'
          : 'Structured cash or savings change. No market return is assumed.',
      illustratedMid: mid,
      effectRange,
      guaranteedOutcome: false as const,
      notAPromise: true as const,
    },
    effectRange,
    risk: input.component.risk,
    fees,
    liquidity: input.component.liquidity,
    reason: input.component.purpose,
    alternatives,
    assumptions: input.plan.assumptions,
    explanation: buildExplanation({
      actionType,
      amount: amount.toJSON(),
      risk: input.component.risk,
      assumption: input.plan.assumptions,
      liquidity: input.component.liquidity,
      feesNote: fees.map((fee) => `${fee.code}:${fee.certainty}`).join(', '),
      alternatives,
      goalRefs: input.plan.goalRefs,
      ...(input.plan.targetOutcome ? { target: input.plan.targetOutcome } : {}),
    }),
    requiredApprovals: Object.freeze([...input.component.requiredApproval]),
    suitability,
    policyDecision: 'ALLOW',
    policyReason: 'Simulation policy has not yet reviewed this draft.',
    approvalState: 'DRAFT',
    status: 'DRAFT',
    materialTermsHash: hash,
    createdAt: input.now,
    expiresAt: addHours(input.now, PROPOSAL_TTL_HOURS),
    executionAuthorityId: null,
    productionActive: false,
    guaranteedOutcome: false,
    serverIssued: true,
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  });
}

export function rebuildModifiedProposal(input: {
  readonly previous: FinancialProposal;
  readonly plan: ProductGrowthPlan;
  readonly actor: GrowthProductActor;
  readonly now: UtcInstant;
  readonly amount: Money;
  readonly risk: GrowRiskProfile;
}): FinancialProposal {
  const component: GrowPlanComponent = {
    componentId: input.plan.components[0]!.componentId,
    kind:
      input.previous.actionType === 'ALLOCATE_TO_CASH_RESERVE'
        ? 'CASH_RESERVE_TARGET'
        : input.previous.actionType === 'RECURRING_SAVINGS'
          ? 'RECURRING_SAVINGS'
          : input.previous.actionType === 'GOAL_CONTRIBUTION'
            ? 'GOAL_CONTRIBUTION'
            : 'ELIGIBLE_INVESTMENT_ALLOCATION',
    purpose: input.previous.reason,
    amount: input.amount.toJSON(),
    currency: input.amount.currency,
    risk: input.risk,
    liquidity: input.previous.liquidity,
    fees: catalogFees(input.plan.assumptions, input.amount),
    dependencies: Object.freeze(['recalculated_from_modification']),
    executionMethod: 'KERNEL_AUTHORIZATION_REQUIRED',
    requiredApproval: input.previous.requiredApprovals,
    assumptionAvailability: input.plan.assumptions.availability,
    instrument: input.previous.instrument,
    ...(input.previous.sourceAccountId ? { sourceAccountId: input.previous.sourceAccountId } : {}),
    destination: input.previous.destination,
  };
  return buildProposalFromComponent({
    plan: input.plan,
    component,
    actor: input.actor,
    now: input.now,
    request: {
      ownerId: input.plan.ownerId,
      startingCapitalMinorUnits: input.plan.startingSnapshot.startingCapital.minorUnits,
      currency: input.plan.startingSnapshot.startingCapital.currency,
      timeHorizonMonths: input.plan.timeHorizonMonths,
      riskProfile: input.risk,
      ...(input.previous.opportunityId ? { opportunityId: input.previous.opportunityId } : {}),
    },
    version: input.previous.version + 1,
    supersedes: input.previous.proposalId,
  });
}

function actionFor(kind: GrowPlanComponent['kind']): FinancialProposalActionType {
  switch (kind) {
    case 'CASH_RESERVE_TARGET':
      return 'ALLOCATE_TO_CASH_RESERVE';
    case 'RECURRING_SAVINGS':
      return 'RECURRING_SAVINGS';
    case 'GOAL_CONTRIBUTION':
      return 'GOAL_CONTRIBUTION';
    case 'REBALANCE_ACTION':
      return 'REBALANCE';
    case 'CURRENCY_ACTION':
      return 'CURRENCY_MOVE';
    default:
      return 'ALLOCATE_TO_ELIGIBLE_INVESTMENT';
  }
}
