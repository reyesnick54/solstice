import type { ProductGrowthService } from '../../../../packages/platform/src/growth/product/service.ts';
import type { ConsumerBff } from './orchestrator.ts';
import type { BffPrincipal } from './ports.ts';
import type { GrowOpportunityPort } from './grow-adapter.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { actorFromPrincipal, mapGrowFailure } from './grow.ts';

/**
 * Preview-only compatibility surface for the Lovable Grow lifecycle routes.
 *
 * It adapts the canonical ProductGrowthService to the route vocabulary used by
 * the consumer UI. Financial starting capital is read from ledger-derived BFF
 * account resources; the browser never supplies or calculates it. This surface
 * never issues Execution Authority and never enables production money movement.
 */
export class PreviewGrowSurface {
  private readonly growth: ProductGrowthService;
  private readonly bff: ConsumerBff;
  private readonly opportunityPort: GrowOpportunityPort;

  constructor(growth: ProductGrowthService, bff: ConsumerBff, opportunityPort: GrowOpportunityPort) {
    this.growth = growth;
    this.bff = bff;
    this.opportunityPort = opportunityPort;
  }

  home(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const plan = this.plan(principal, requestId);
    return {
      schema: 'sunrey.consumer.grow.home.v1',
      environment: 'simulation',
      productionMoneyMovement: false,
      snapshot: this.snapshot(principal, requestId),
      opportunities: this.opportunities(principal, requestId),
      plan: isError(plan) ? null : plan,
      performance: this.performance(principal, requestId),
    };
  }

  snapshot(principal: BffPrincipal, _requestId: string): Record<string, unknown> {
    const accounts = this.bff.listAccounts(principal).items;
    const liquidAssetsByCurrency = accounts
      .filter((account) => account.type === 'CASH' || account.type === 'SAVINGS')
      .flatMap((account) => {
        const available = account.balance.value?.available;
        return available ? [available] : [];
      });
    return {
      schema: 'sunrey.preview.grow-snapshot.v1',
      generatedAt: new Date().toISOString(),
      resultKind: 'ACTUAL_RESULT',
      ledgerWins: true,
      authoritativeBalance: null,
      liquidAssetsByCurrency,
      goals: [],
      opportunities: [],
      note: 'Balances are ledger-derived. Mixed currencies are never silently combined.',
    };
  }

  goals(_principal: BffPrincipal, _requestId: string): Record<string, unknown> {
    return { items: [], environment: 'simulation' };
  }

  createGoal(_principal: BffPrincipal, _body: Record<string, unknown>, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Goal editing is not enabled in the unified preview yet');
  }

  opportunities(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const listed = this.opportunityPort.list(principal);
    if (listed && typeof listed === 'object' && !Array.isArray(listed)) {
      return listed as Record<string, unknown>;
    }
    return unavailable(requestId, 'Growth opportunities are temporarily unavailable');
  }

  dismissOpportunity(_principal: BffPrincipal, opportunityId: string, _requestId: string): Record<string, unknown> {
    return { opportunityId, dismissed: true, environment: 'simulation' };
  }

  plan(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = actorFromPrincipal(principal);
    const listed = this.growth.listPlans(actor, principal.customerId);
    if (!listed.ok) return mapGrowFailure(listed.error, requestId);
    const plan = listed.value.at(-1);
    if (!plan) {
      return {
        exists: false,
        state: 'NOT_REQUESTED',
        productionMoneyMovement: false,
        guaranteedOutcome: false,
      };
    }
    return projectPlan(plan);
  }

  requestNewPlan(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const starting = usdCashMinorUnits(this.bff, principal);
    if (starting <= 0n) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'A positive USD cash balance is required to request a preview growth plan',
        retryable: false,
        requestId,
      });
    }
    const actor = actorFromPrincipal(principal);
    const sourceAccount = this.bff
      .listAccounts(principal)
      .items.find((account) => account.currency === 'USD' && (account.type === 'CASH' || account.type === 'SAVINGS'));
    const created = this.growth.createPlan(actor, {
      ownerId: principal.customerId,
      startingCapitalMinorUnits: starting.toString(),
      currency: 'USD',
      timeHorizonMonths: 24,
      riskProfile: 'BALANCED',
      ...(sourceAccount ? { sourceAccountId: sourceAccount.id } : {}),
    });
    if (!created.ok) return mapGrowFailure(created.error, requestId);
    const proposal = this.growth.createProposal(actor, { planId: created.value.planId });
    const experience = this.growth.lovableExperience(actor, created.value.planId);
    return {
      ...projectPlan(created.value),
      primaryProposal: proposal.ok ? proposal.value : null,
      experience: experience.ok ? experience.value : null,
    };
  }

  pause(_principal: BffPrincipal, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Preview plan pause is not enabled for ProductGrowthService plans');
  }

  resume(_principal: BffPrincipal, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Preview plan resume is not enabled for ProductGrowthService plans');
  }

  planProgress(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const plan = this.plan(principal, requestId);
    if (isError(plan)) return plan;
    return {
      exists: plan.exists !== false,
      state: typeof plan.state === 'string' ? plan.state : null,
      funded: { count: 0 },
      pending: { count: 0 },
      completed: { count: 0 },
      failed: { count: 0 },
      productionMoneyMovement: false,
    };
  }

  scenarios(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = actorFromPrincipal(principal);
    const listed = this.growth.listPlans(actor, principal.customerId);
    if (!listed.ok) return mapGrowFailure(listed.error, requestId);
    const plan = listed.value.at(-1);
    if (!plan) return { bands: [], uncertainty: 'Request a plan to generate preview scenarios.' };
    return {
      bands: [plan.scenarioAnalysis.conservative, plan.scenarioAnalysis.base, plan.scenarioAnalysis.upside],
      uncertainty: 'Illustrative simulation only; outcomes are not guaranteed.',
      productionMoneyMovement: false,
    };
  }

  createProposal(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown {
    const actor = actorFromPrincipal(principal);
    const planId = typeof body.planId === 'string' ? body.planId : latestPlanId(this.growth, actor, principal.customerId);
    if (!planId) return unavailable(requestId, 'Request a growth plan before creating a proposal');
    const created = this.growth.createProposal(actor, { planId });
    return created.ok ? created.value : mapGrowFailure(created.error, requestId);
  }

  modifyProposal(principal: BffPrincipal, proposalId: string, body: Record<string, unknown>, requestId: string): unknown {
    const actor = actorFromPrincipal(principal);
    const modified = this.growth.modifyProposal(
      actor,
      proposalId,
      {
        ...(typeof body.amountMinorUnits === 'string' ? { amountMinorUnits: body.amountMinorUnits } : {}),
      },
      body,
    );
    return modified.ok ? modified.value : mapGrowFailure(modified.error, requestId);
  }

  approveProposal(principal: BffPrincipal, proposalId: string, body: Record<string, unknown>, requestId: string): unknown {
    const actor = actorFromPrincipal(principal);
    const approved = this.growth.approveProposal(actor, proposalId, {
      ...(body.stepUpSatisfied === true ? { stepUpSatisfied: true } : {}),
    });
    return approved.ok ? approved.value : mapGrowFailure(approved.error, requestId);
  }

  executeProposal(_principal: BffPrincipal, _proposalId: string, _body: Record<string, unknown>, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Preview growth proposals do not execute financial state changes');
  }

  getProposal(principal: BffPrincipal, proposalId: string, requestId: string): unknown {
    const loaded = this.growth.getProposal(actorFromPrincipal(principal), proposalId);
    return loaded.ok ? loaded.value : mapGrowFailure(loaded.error, requestId);
  }

  executionStatus(_principal: BffPrincipal, _executionId: string, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'No preview growth execution exists');
  }

  portfolio(_principal: BffPrincipal, _requestId: string): Record<string, unknown> {
    return {
      holdings: [],
      allocation: [],
      performance: [],
      risk: {},
      depositsAreNotPerformance: true,
      liveInvestmentExecution: false,
      productionMoneyMovement: false,
    };
  }

  performance(_principal: BffPrincipal, _requestId: string): Record<string, unknown> {
    return { items: [], productionMoneyMovement: false, depositsAreNotPerformance: true };
  }

  createRecurring(_principal: BffPrincipal, _body: Record<string, unknown>, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Recurring Grow execution is not enabled in preview');
  }

  cancelRecurring(_principal: BffPrincipal, _id: string, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Recurring Grow execution is not enabled in preview');
  }

  monitor(_principal: BffPrincipal): Record<string, unknown> {
    return { environment: 'simulation', productionMoneyMovement: false, actions: [] };
  }

  invokeAgentTool(_principal: BffPrincipal, _body: Record<string, unknown>, requestId: string): BffErrorEnvelope {
    return unavailable(requestId, 'Grow agent tools are not enabled on this preview compatibility surface');
  }
}

function usdCashMinorUnits(bff: ConsumerBff, principal: BffPrincipal): bigint {
  return bff.listAccounts(principal).items.reduce((sum, account) => {
    if (account.currency !== 'USD' || (account.type !== 'CASH' && account.type !== 'SAVINGS')) return sum;
    const minor = account.balance.value?.available.minorUnits;
    if (!minor || !/^-?\d+$/.test(minor)) return sum;
    const value = BigInt(minor);
    return value > 0n ? sum + value : sum;
  }, 0n);
}

function latestPlanId(
  growth: ProductGrowthService,
  actor: ReturnType<typeof actorFromPrincipal>,
  customerId: string,
): string | null {
  const listed = growth.listPlans(actor, customerId);
  return listed.ok ? listed.value.at(-1)?.planId ?? null : null;
}

function projectPlan(plan: {
  readonly planId: string;
  readonly version: number;
  readonly status: string;
  readonly components: readonly {
    readonly componentId: string;
    readonly kind: string;
    readonly purpose: string;
    readonly amount: unknown;
  }[];
  readonly assumptions: unknown;
  readonly guaranteedOutcome: false;
  readonly productionActive: false;
}): Record<string, unknown> {
  return {
    exists: true,
    planId: plan.planId,
    version: plan.version,
    state: plan.status,
    actions: plan.components.map((component) => ({
      actionId: component.componentId,
      title: component.purpose,
      kind: component.kind,
      amount: component.amount,
      actionable: false,
    })),
    assumptions: plan.assumptions,
    risks: [],
    achievementPromised: false,
    guaranteedOutcome: false,
    productionMoneyMovement: false,
  };
}

function unavailable(requestId: string, message: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'FEATURE_UNAVAILABLE',
    category: 'TEMPORARY_UNAVAILABLE',
    message,
    retryable: false,
    requestId,
  });
}

function isError(value: unknown): value is BffErrorEnvelope {
  return Boolean(value && typeof value === 'object' && 'errorCode' in value);
}
