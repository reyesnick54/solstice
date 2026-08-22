import { Money } from '../../../../money/src/money.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { lookupReturnAssumption } from './assumptions.ts';
import { catalogFees } from './fees.ts';
import {
  asGrowMoneyPlanVersion,
  growMoneyPlanIdFor,
  growPlanComponentIdFor,
  scenarioRunIdFor,
} from './ids.ts';
import { projectScenarios } from './scenarios.ts';
import type { GrowPlanComponentKind, GrowRiskProfile } from './taxonomy.ts';
import type {
  CreateGrowPlanInput,
  GrowPlanComponent,
  ProductGrowthPlan,
  ReturnAssumption,
} from './types.ts';

const PLAN_TTL_HOURS = 24 * 30;

export function buildProductGrowthPlan(input: {
  readonly request: CreateGrowPlanInput;
  readonly now: UtcInstant;
}): ProductGrowthPlan {
  const currency = input.request.currency;
  const starting = Money.fromMinorUnitsString(input.request.startingCapitalMinorUnits, currency);
  const recurring = Money.fromMinorUnitsString(input.request.recurringContributionMinorUnits ?? '0', currency);
  const liquidity = input.request.liquidityRequirementMinorUnits
    ? Money.fromMinorUnitsString(input.request.liquidityRequirementMinorUnits, currency)
    : undefined;
  const target = input.request.goalTargetMinorUnits
    ? Money.fromMinorUnitsString(input.request.goalTargetMinorUnits, currency)
    : undefined;
  const assumption = lookupReturnAssumption({
    currency,
    riskProfile: input.request.riskProfile,
    timeHorizonMonths: input.request.timeHorizonMonths,
  });
  const planId = growMoneyPlanIdFor(input.request.ownerId, input.now);
  const version = asGrowMoneyPlanVersion(1);
  const components = buildComponents({
    request: input.request,
    starting,
    recurring,
    ...(liquidity ? { liquidity } : {}),
    ...(target ? { target } : {}),
    assumption,
  });
  const fees = catalogFees(assumption, starting);
  const expires = addHours(input.now, input.request.ttlHours ?? PLAN_TTL_HOURS);
  return Object.freeze({
    planId,
    version,
    ownerId: input.request.ownerId,
    goalRefs: Object.freeze([...(input.request.goalRefs ?? [])]),
    startingSnapshot: {
      asOf: input.now,
      startingCapital: starting.toJSON(),
      recurringContribution: recurring.toJSON(),
      ...(liquidity ? { liquidityRequirement: liquidity.toJSON() } : {}),
      ...(input.request.sourceAccountId ? { sourceAccountId: input.request.sourceAccountId } : {}),
      notes: Object.freeze([
        'Starting snapshot is the caller-supplied figure, not a Ledger balance.',
        'The ledger remains authoritative for posted money.',
      ]),
    },
    ...(target ? { targetOutcome: target.toJSON() } : {}),
    timeHorizonMonths: input.request.timeHorizonMonths,
    riskProfile: input.request.riskProfile,
    ...(liquidity ? { liquidityRequirement: liquidity.toJSON() } : {}),
    components,
    assumptions: assumption,
    scenarioAnalysis: projectScenarios({
      runId: scenarioRunIdFor(planId, version),
      starting,
      monthlyContribution: recurring,
      withdrawals: Money.zero(currency),
      timeHorizonMonths: input.request.timeHorizonMonths,
      assumption,
      riskProfile: input.request.riskProfile,
    }),
    fees,
    status: 'PROPOSED',
    createdAt: input.now,
    expiresAt: expires,
    productionActive: false,
    guaranteedOutcome: false,
  });
}

function buildComponents(input: {
  readonly request: CreateGrowPlanInput;
  readonly starting: Money;
  readonly recurring: Money;
  readonly liquidity?: Money;
  readonly target?: Money;
  readonly assumption: ReturnAssumption;
}): readonly GrowPlanComponent[] {
  const items: GrowPlanComponent[] = [];
  const reserve = input.liquidity ?? Money.zero(input.starting.currency);
  items.push(
    component({
      kind: 'CASH_RESERVE_TARGET',
      purpose: 'Hold a cash reserve before any eligible investment allocation',
      amount: reserve.isZero() ? Money.zero(input.starting.currency) : reserve,
      risk: 'CONSERVATIVE',
      liquidity: 'IMMEDIATE',
      assumption: input.assumption,
      executionMethod: 'PROPOSAL_ONLY',
      requiredApproval: ['CUSTOMER_CONFIRMATION'],
      sourceAccountId: input.request.sourceAccountId,
      destination: 'CASH_RESERVE',
      dependencies: reserve.isZero() ? ['liquidity_requirement_not_supplied'] : [],
    }),
  );
  if (!input.recurring.isZero()) {
    items.push(
      component({
        kind: 'RECURRING_SAVINGS',
        purpose: 'Recurring contribution used in scenario illustrations',
        amount: input.recurring,
        risk: 'CONSERVATIVE',
        liquidity: 'MONTHLY',
        assumption: input.assumption,
        executionMethod: 'USER_CONFIRMATION_REQUIRED',
        requiredApproval: ['CUSTOMER_CONFIRMATION'],
        sourceAccountId: input.request.sourceAccountId,
        destination: 'SAVINGS',
      }),
    );
  }
  const investable = investableAmount(input.starting, reserve);
  items.push(
    component({
      kind: 'ELIGIBLE_INVESTMENT_ALLOCATION',
      purpose: 'Eligible simulation allocation after cash reserve',
      amount: investable,
      risk: input.request.riskProfile,
      liquidity: 'MARKET_DEPENDENT',
      assumption: input.assumption,
      executionMethod: 'KERNEL_AUTHORIZATION_REQUIRED',
      requiredApproval: ['CUSTOMER_CONFIRMATION', 'STEP_UP_AUTH'],
      sourceAccountId: input.request.sourceAccountId,
      destination: input.assumption.assetSleeve ?? 'UNAVAILABLE_SLEEVE',
      instrument: input.assumption.assetSleeve,
      dependencies:
        input.assumption.availability === 'AVAILABLE'
          ? ['kernel_authorization', 'customer_approval']
          : ['return_assumption_unavailable', 'kernel_authorization'],
    }),
  );
  if (input.target) {
    items.push(
      component({
        kind: 'GOAL_CONTRIBUTION',
        purpose: 'Structured contribution toward the stated goal. Achievement is not promised.',
        amount: input.recurring.isZero() ? investable : input.recurring,
        risk: input.request.riskProfile,
        liquidity: 'GOAL_LOCKED_UNTIL_HORIZON',
        assumption: input.assumption,
        executionMethod: 'PROPOSAL_ONLY',
        requiredApproval: ['CUSTOMER_CONFIRMATION'],
        destination: 'GOAL',
        dependencies: ['goal_achievement_not_promised'],
      }),
    );
  }
  return Object.freeze(items);
}

function investableAmount(starting: Money, reserve: Money): Money {
  if (reserve.isZero() || starting.cmp(reserve) <= 0) {
    return starting;
  }
  return starting.minus(reserve);
}

function component(input: {
  readonly kind: GrowPlanComponentKind;
  readonly purpose: string;
  readonly amount: Money;
  readonly risk: GrowRiskProfile;
  readonly liquidity: string;
  readonly assumption: ReturnAssumption;
  readonly executionMethod: GrowPlanComponent['executionMethod'];
  readonly requiredApproval: GrowPlanComponent['requiredApproval'];
  readonly sourceAccountId?: string;
  readonly destination?: string;
  readonly instrument?: string;
  readonly dependencies?: readonly string[];
}): GrowPlanComponent {
  return Object.freeze({
    componentId: growPlanComponentIdFor(input.kind, input.amount.minorUnits.toString()),
    kind: input.kind,
    purpose: input.purpose,
    amount: input.amount.toJSON(),
    currency: input.amount.currency,
    risk: input.risk,
    liquidity: input.liquidity,
    fees: catalogFees(input.assumption, input.amount),
    dependencies: Object.freeze([...(input.dependencies ?? [])]),
    executionMethod: input.executionMethod,
    requiredApproval: Object.freeze([...input.requiredApproval]),
    assumptionAvailability: input.kind === 'ELIGIBLE_INVESTMENT_ALLOCATION' ? input.assumption.availability : 'AVAILABLE',
    ...(input.instrument ? { instrument: input.instrument } : {}),
    ...(input.sourceAccountId ? { sourceAccountId: input.sourceAccountId } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
  });
}

export function addHours(now: UtcInstant, hours: number): UtcInstant {
  return new Date(Date.parse(now) + hours * 60 * 60 * 1000).toISOString() as UtcInstant;
}
