/**
 * Lovable Consumer BFF for Grow My Money.
 * Renders structured server state and collects customer decisions.
 * Frontend-provided financial instructions are never trusted proposal state.
 */

import type { UtcInstant } from '../../../../packages/domain/src/time.ts';
import { Money } from '../../../../packages/money/src/money.ts';
import type { EconomicGraphService } from '../../../../packages/personal-economic-graph/src/service.ts';
import type { GrowthOrchestrator } from '../../../../packages/platform/src/service.ts';
import type { GrowLifecycleService } from '../../../../packages/platform/src/grow/service.ts';
import { evaluateGrowSuitability, type SuitabilityFacts } from '../../../../packages/platform/src/grow/suitability.ts';
import type { FinancialProposal as GrowLifecycleProposal } from '../../../../packages/platform/src/grow/types.ts';
import type { InvestmentsService } from '../../../../packages/investments/src/service.ts';
import { asInvestmentAccountId } from '../../../../packages/investments/src/ids.ts';
import {
  executeGrowInvestmentCommand,
  selectSandboxInvestmentProvider,
  type GrowInvestmentAccounts,
} from '../../../../packages/investments/src/grow-adapter.ts';
import type { GrowthActionCandidate } from '../../../../packages/platform/src/growth/types.ts';
import type { UniversalProviderRuntime } from '../../../../packages/sunrey-chain/src/provider-runtime/universal/runtime.ts';
import { invokeGrowAgentTool, refusePrivilegedGrowExecution, type GrowAgentToolPort } from '../../../../packages/sunrey-agent/src/grow-tools.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import { balanceOfAccount } from '../../../accounts/src/balances.ts';
import type { Ledger } from '../../../../packages/ledger/src/journal.ts';
import type { Account } from '../../../../packages/domain/src/account.ts';
import {
  ProductGrowthService,
  type CreateGrowPlanInput,
  type FinancialProposal,
  type FinancialProposal as ProductFinancialProposal,
  type GrowProductFailure,
  type GrowRiskProfile,
  type GrowthProductActor,
  type ProductGrowthPlan,
  isGrowRiskProfile,
} from '../../../../packages/platform/src/growth/product/index.ts';
import { toLovableExperience } from '../../../../packages/platform/src/growth/product/lovable-contract.ts';

export { toLovableExperience };

export type GrowBffDeps = {
  readonly peg: EconomicGraphService;
  readonly orchestrator: GrowthOrchestrator;
  readonly grow: GrowLifecycleService;
  readonly investments: InvestmentsService;
  readonly providers: UniversalProviderRuntime;
  readonly ledger: Ledger;
  readonly accounts: { get(id: Account['id']): Account | undefined };
  readonly resolveActor: (actorId: string) => unknown;
  readonly now: () => UtcInstant;
  readonly investmentAccountsFor: (customerId: string) => GrowInvestmentAccounts | null;
  readonly suitabilityFor: (principal: BffPrincipal) => SuitabilityFacts;
};

export class GrowBffSurface {
  private readonly deps: GrowBffDeps;

  constructor(deps: GrowBffDeps) {
    this.deps = deps;
  }

  home(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const snapshot = this.snapshot(principal, requestId);
    if (isErr(snapshot)) {
      return snapshot;
    }
    const opportunities = this.opportunities(principal, requestId);
    const plan = this.plan(principal, requestId);
    const performance = this.performance(principal, requestId);
    return {
      schema: 'sunrey.consumer.grow.home.v1',
      productionMoneyMovement: false,
      snapshot,
      opportunities: isErr(opportunities) ? { items: [] } : opportunities,
      plan: isErr(plan) ? null : plan,
      performance: isErr(performance) ? null : performance,
      screens: Object.freeze([
        'GROW_HOME',
        'GOALS',
        'OPPORTUNITIES',
        'GROWTH_PLAN',
        'PROPOSAL_DETAIL',
        'APPROVAL',
        'EXECUTION_STATUS',
        'PORTFOLIO',
        'PERFORMANCE',
        'PLAN_PROGRESS',
      ]),
    };
  }

  snapshot(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const snap = this.deps.peg.getEconomicSnapshot(actor, principal.identityId);
    if (!snap.ok) {
      return this.fail(requestId, 'NOT_FOUND', snap.error.message);
    }
    return {
      snapshotId: snap.value.snapshotId,
      generatedAt: snap.value.generatedAt,
      goals: snap.value.goals,
      opportunities: snap.value.economicOpportunities,
      income: snap.value.income.map((row) => ({ label: row.label, kind: row.incomeKind })),
      obligations: snap.value.knownRecurringObligations.map((row) => ({
        label: row.label,
        amount: row.estimatedAmount,
      })),
      liquidAssetsByCurrency: snap.value.liquidAssetsByCurrency,
      authoritativeBalance: false,
      ledgerWins: true,
      resultKind: 'ACTUAL_RESULT',
    };
  }

  goals(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const snap = this.deps.peg.getEconomicSnapshot(actor, principal.identityId);
    if (!snap.ok) {
      return this.fail(requestId, 'NOT_FOUND', snap.error.message);
    }
    return { items: snap.value.goals, resultKind: 'ACTUAL_RESULT' };
  }

  createGoal(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const label = typeof body.label === 'string' ? body.label : '';
    const minorUnits = typeof body.targetMinorUnits === 'string' ? body.targetMinorUnits : '';
    const currency = typeof body.currency === 'string' ? body.currency : 'USD';
    if (!label || !/^\d+$/.test(minorUnits)) {
      return this.fail(requestId, 'VALIDATION', 'goal requires label and integer minor units');
    }
    const created = this.deps.peg.declareGoal(actor, principal.identityId, {
      goalKind: 'EMERGENCY_RESERVE',
      label,
      target: { minorUnits, currency },
      priority: 1,
      status: 'ACTIVE',
    });
    if (!created.ok) {
      return this.fail(requestId, 'VALIDATION', created.error.message);
    }
    return { goalId: created.value.nodeId, label };
  }

  opportunities(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    this.deps.peg.proposeOpportunities(principal.identityId);
    const snap = this.deps.peg.getEconomicSnapshot(actor, principal.identityId);
    if (!snap.ok) {
      return this.fail(requestId, 'NOT_FOUND', snap.error.message);
    }
    return {
      items: snap.value.economicOpportunities.map((row) => ({
        ...row,
        executable: false,
        resultKind: 'ESTIMATE',
      })),
    };
  }

  dismissOpportunity(
    principal: BffPrincipal,
    opportunityId: string,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    void principal;
    return { opportunityId, dismissed: true, requestId };
  }

  plan(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const existing = this.deps.orchestrator.store.latestPlanFor(principal.identityId);
    if (existing && existing.state === 'CURRENT') {
      return this.projectPlan(existing);
    }
    const planned = this.deps.orchestrator.plan(actor, principal.identityId);
    if (!planned.ok) {
      return this.fail(requestId, 'VALIDATION', failureMessage(planned.error));
    }
    return this.projectPlan(planned.value.plan);
  }

  requestNewPlan(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    this.deps.orchestrator.noteFactChange(principal.identityId, 'customer_requested_new_plan');
    return this.plan(principal, requestId);
  }

  scenarios(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    void requestId;
    const latest = this.deps.grow.store.latestProposalFor(principal.identityId);
    const amount = latest?.amount.minorUnits ?? '25000';
    return {
      items: this.deps.grow.scenarios('USD', amount, 12),
      methodology: 'deterministic-sandbox-bands',
      uncertainty: 'bands are projections or estimates, never promised outcomes',
    };
  }

  createProposal(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const planned = this.deps.orchestrator.store.latestPlanFor(principal.identityId);
    if (!planned || planned.state === 'STALE') {
      return this.fail(requestId, 'REFRESH_PROPOSAL_REQUIRED', 'current growth plan is required');
    }
    const actionId = typeof body.actionId === 'string' ? body.actionId : planned.orderedProposedActions[0]?.actionId;
    const candidate =
      planned.orderedProposedActions.find((row) => row.actionId === actionId) ??
      planned.candidateActions.find((row) => row.actionId === actionId);
    if (!candidate) {
      return this.fail(requestId, 'NOT_FOUND', 'growth action not found');
    }
    const created = this.deps.grow.generateProposal(
      actor,
      planned,
      this.enrichCandidate(principal, candidate),
      principal.customerId,
      this.deps.suitabilityFor(principal),
    );
    if (!created.ok) {
      return this.fail(requestId, created.error.code, created.error.message);
    }
    return this.projectProposal(created.value);
  }

  getProposal(principal: BffPrincipal, proposalId: string, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const proposal = this.deps.grow.store.getProposal(proposalId);
    if (!proposal || proposal.customerId !== principal.customerId) {
      return this.fail(requestId, 'NOT_FOUND', 'proposal not found');
    }
    return this.projectProposal(proposal);
  }

  modifyProposal(
    principal: BffPrincipal,
    proposalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.actor(principal);
    const current = this.deps.grow.store.getProposal(proposalId);
    const planned = this.deps.orchestrator.store.latestPlanFor(principal.identityId);
    if (!current || !planned) {
      return this.fail(requestId, 'NOT_FOUND', 'proposal or plan not found');
    }
    if (typeof body.contentHash === 'string' && body.contentHash !== current.contentHash) {
      return this.fail(requestId, 'PROPOSAL_FORGED', 'frontend cannot forge trusted proposal state');
    }
    const amountMinorUnits = typeof body.amountMinorUnits === 'string' ? body.amountMinorUnits : '';
    if (!/^\d+$/.test(amountMinorUnits)) {
      return this.fail(requestId, 'VALIDATION', 'amount must be integer minor units');
    }
    const candidate =
      planned.candidateActions.find((row) => row.actionId === current.actionId) ?? planned.orderedProposedActions[0];
    if (!candidate) {
      return this.fail(requestId, 'NOT_FOUND', 'candidate not found');
    }
    const next = this.deps.grow.modifyAmount(
      actor,
      proposalId,
      planned,
      this.enrichCandidate(principal, candidate),
      { minorUnits: amountMinorUnits, currency: current.amount.currency },
      this.deps.suitabilityFor(principal),
    );
    if (!next.ok) {
      return this.fail(requestId, next.error.code, next.error.message);
    }
    return this.projectProposal(next.value);
  }

  approveProposal(
    principal: BffPrincipal,
    proposalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    if (principal.sandboxPersona === 'agent_enabled' && body.actorKind === 'AGENT') {
      return this.fail(requestId, 'AGENT_CANNOT_SELF_APPROVE', 'agent cannot approve its own proposal');
    }
    const actor = this.actor(principal);
    const approved = this.deps.grow.approve(actor, proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: body.stepUpSatisfied === true ? 'STEP_UP_SATISFIED' : 'AAL1',
      stepUpSatisfied: body.stepUpSatisfied === true,
    });
    if (!approved.ok) {
      return this.fail(requestId, approved.error.code, approved.error.message);
    }
    return {
      ...this.projectProposal(approved.value.proposal),
      approvalId: approved.value.approval.approvalId,
    };
  }

  executeProposal(
    principal: BffPrincipal,
    proposalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    if (body.clientIntent && typeof body.clientIntent === 'object') {
      return this.fail(requestId, 'PROPOSAL_FORGED', 'do not execute arbitrary frontend-provided financial instructions');
    }
    const actor = this.actor(principal);
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `grow:${requestId}`;
    const command = this.deps.grow.createCommand(actor, proposalId, idempotencyKey);
    if (!command.ok) {
      return this.fail(requestId, command.error.code, command.error.message);
    }
    const existing = this.deps.grow.store.executionForCommand(command.value.commandId);
    if (
      existing &&
      (existing.state === 'COMPLETED' ||
        existing.state === 'PARTIALLY_COMPLETED' ||
        existing.state === 'FAILED' ||
        existing.state === 'REQUIRES_REVIEW')
    ) {
      return this.projectExecution(existing);
    }
    const account = this.deps.accounts.get(command.value.financialResource.sourceAccountId as Account['id']);
    const available = account
      ? balanceOfAccount(this.deps.ledger, account)
      : { ok: false as const, error: { message: 'account missing' } };
    const availableMinor = available.ok ? available.value.minorUnits.toString() : '0';
    const provider = selectSandboxInvestmentProvider(this.deps.providers, principal.jurisdiction, this.deps.now());
    const revalidated = this.deps.grow.revalidate(command.value.commandId, {
      accountStatus: principal.restricted ? 'RESTRICTED' : 'ACTIVE',
      availableMinorUnits: availableMinor,
      productAvailable: true,
      providerAvailable: provider.ok,
      suitability: evaluateGrowSuitability(this.deps.suitabilityFor(principal)),
      kernelPolicy: 'ALLOW',
      complianceClear: principal.verification === 'VERIFIED',
      marketQuoteValid: true,
    });
    if (!revalidated.ok) {
      return this.fail(requestId, revalidated.error.code, revalidated.error.message);
    }
    if (!revalidated.value.accepted) {
      return this.fail(requestId, revalidated.value.code, revalidated.value.message);
    }
    const execution = this.deps.grow.store.executionForCommand(command.value.commandId);
    if (!execution) {
      return this.fail(requestId, 'NOT_FOUND', 'execution record missing');
    }
    if (!provider.ok) {
      this.deps.grow.recordExecutionTransition(execution.executionId, 'FAILED', {
        failureCode: 'PROVIDER_UNAVAILABLE',
        notes: Object.freeze([provider.message]),
      });
      return this.fail(requestId, 'PROVIDER_UNAVAILABLE', provider.message);
    }
    if (command.value.domain !== 'INVESTMENT_EXECUTION') {
      this.deps.grow.recordExecutionTransition(execution.executionId, 'REQUIRES_REVIEW', {
        notes: Object.freeze([`domain ${command.value.domain} must execute through its canonical owner`]),
      });
      return this.fail(requestId, 'REFRESH_PROPOSAL_REQUIRED', `domain ${command.value.domain} is not auto-executed from Grow BFF`);
    }
    const accounts = this.deps.investmentAccountsFor(principal.customerId);
    if (!accounts) {
      return this.fail(requestId, 'PRODUCT_UNAVAILABLE', 'investment accounts are not provisioned');
    }
    this.deps.grow.recordExecutionTransition(execution.executionId, 'SUBMITTED', {
      providerId: provider.providerId,
    });
    const result = executeGrowInvestmentCommand({
      investments: this.deps.investments,
      command: command.value,
      actorId: principal.actorId,
      now: this.deps.now(),
      accounts,
      providerId: provider.providerId,
      openIfNeeded: true,
    });
    if (result.outcome === 'FAILED' || result.outcome === 'PROVIDER_UNAVAILABLE') {
      this.deps.grow.recordExecutionTransition(execution.executionId, 'FAILED', {
        failureCode: result.code === 'KERNEL_REFUSED' ? 'REFRESH_PROPOSAL_REQUIRED' : 'PROVIDER_REJECTION',
        notes: Object.freeze([result.message]),
        providerId: result.providerId,
        ledgerJournalId: result.journalId,
        authorityId: result.authorityId,
      });
      return this.fail(requestId, result.code === 'KERNEL_REFUSED' ? 'KERNEL_REFUSED' : 'PROVIDER_UNAVAILABLE', result.message);
    }
    const completed = this.deps.grow.recordExecutionTransition(
      execution.executionId,
      result.outcome === 'PARTIAL' ? 'PARTIALLY_COMPLETED' : 'COMPLETED',
      {
        providerId: result.providerId,
        providerResult: result.message,
        ledgerJournalId: result.journalId,
        filledMinorUnits: result.filledMinorUnits,
        authorityId: result.authorityId,
        notes: Object.freeze([result.message]),
      },
    );
    if (!completed.ok) {
      return this.fail(requestId, completed.error.code, completed.error.message);
    }
    this.deps.grow.activatePlan(actor, {
      planId: this.deps.orchestrator.store.latestPlanFor(principal.identityId)?.planId ?? 'gpl_unknown',
      planVersion: 1,
      subjectId: principal.identityId,
      customerId: principal.customerId,
      components: Object.freeze([
        {
          actionId: command.value.intendedAction,
          amount: command.value.financialResource.amount,
        },
      ]),
    });
    return this.projectExecution(completed.value);
  }

  executionStatus(principal: BffPrincipal, executionId: string, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const row = this.deps.grow.store.getExecution(executionId);
    if (!row || row.customerId !== principal.customerId) {
      return this.fail(requestId, 'NOT_FOUND', 'execution not found');
    }
    return this.projectExecution(row);
  }

  portfolio(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const accounts = this.deps.investmentAccountsFor(principal.customerId);
    if (!accounts) {
      return { holdings: [], allocation: [], performance: null, risk: 'UNKNOWN', requestId };
    }
    try {
      const investmentAccountId = asInvestmentAccountId(accounts.investmentAccountId);
      const valuation = this.deps.investments.valuePortfolio(investmentAccountId);
      const allocation = this.deps.investments.allocation(investmentAccountId);
      const risk = this.deps.investments.portfolioRiskSnapshot(investmentAccountId);
      return {
        holdings: valuation.positions,
        allocation,
        performance: {
          kind: 'ACTUAL_RESULT',
          depositsAreNotPerformance: true,
        },
        risk: risk.simulationOnly ? 'SIMULATION' : 'UNKNOWN',
        liveInvestmentExecution: false,
      };
    } catch {
      return { holdings: [], allocation: [], performance: null, risk: 'UNKNOWN', requestId };
    }
  }

  performance(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    void requestId;
    const proposal = this.deps.grow.store.latestProposalFor(principal.identityId);
    const plan = this.deps.orchestrator.store.latestPlanFor(principal.identityId);
    const executed = this.deps.grow.store.listExecutions(principal.customerId).find((row) => row.state === 'COMPLETED');
    const model = this.deps.grow.recordPerformance({
      subjectId: principal.identityId,
      planId: plan?.planId ?? 'gpl_none',
      plannedContributions: proposal?.amount ?? { minorUnits: '0', currency: 'USD' },
      executedContributions: {
        minorUnits: executed?.filledMinorUnits ?? '0',
        currency: proposal?.amount.currency ?? 'USD',
      },
      withdrawals: { minorUnits: '0', currency: 'USD' },
      currentValue: {
        minorUnits: executed?.filledMinorUnits ?? '0',
        currency: proposal?.amount.currency ?? 'USD',
      },
      fees: { minorUnits: '0', currency: 'USD' },
      goalTarget: { minorUnits: '2000000', currency: 'USD' },
      timeRemainingDays: 365,
    });
    return { ...model, resultKind: 'ACTUAL_RESULT' };
  }

  planProgress(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const activated = this.deps.grow.store.latestActivatedPlan(principal.identityId);
    if (!activated) {
      return this.fail(requestId, 'PLAN_NOT_FOUND', 'no activated plan');
    }
    return {
      lifecycle: activated.lifecycle,
      funded: activated.fundedComponentIds,
      pending: activated.pendingComponentIds,
      completed: activated.completedComponentIds,
      failed: activated.failedComponentIds,
    };
  }

  pause(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const result = this.deps.grow.pausePlan(this.actor(principal), principal.identityId);
    return result.ok ? { lifecycle: result.value.lifecycle } : this.fail(requestId, result.error.code, result.error.message);
  }

  resume(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const result = this.deps.grow.resumePlan(this.actor(principal), principal.identityId);
    return result.ok ? { lifecycle: result.value.lifecycle } : this.fail(requestId, result.error.code, result.error.message);
  }

  cancelRecurring(
    principal: BffPrincipal,
    recurringId: string,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const result = this.deps.grow.revokeRecurring(this.actor(principal), principal.identityId, recurringId);
    return result.ok ? { state: result.value.state } : this.fail(requestId, result.error.code, result.error.message);
  }

  createRecurring(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const amount = typeof body.amountMinorUnits === 'string' ? body.amountMinorUnits : '';
    if (!/^\d+$/.test(amount)) {
      return this.fail(requestId, 'VALIDATION', 'recurring amount must be integer minor units');
    }
    const created = this.deps.grow.createRecurring(this.actor(principal), {
      subjectId: principal.identityId,
      customerId: principal.customerId,
      amount: { minorUnits: amount, currency: typeof body.currency === 'string' ? body.currency : 'USD' },
      frequency: body.frequency === 'WEEKLY' || body.frequency === 'QUARTERLY' ? body.frequency : 'MONTHLY',
      sourceAccountId: typeof body.sourceAccountId === 'string' ? body.sourceAccountId : '',
      destinationAccountId: typeof body.destinationAccountId === 'string' ? body.destinationAccountId : '',
      startAt: this.deps.now(),
      maxAmountMinorUnits: typeof body.maxAmountMinorUnits === 'string' ? body.maxAmountMinorUnits : amount,
      policy: 'EACH_OCCURRENCE_REVALIDATED',
    });
    if (!created.ok) {
      return this.fail(requestId, created.error.code, created.error.message);
    }
    return {
      recurringMandateId: created.value.recurringMandateId,
      agentMayIncreaseAmount: false,
      perpetualAuthorization: false,
    };
  }

  monitor(principal: BffPrincipal): Record<string, unknown> {
    return this.deps.grow.monitor(principal.identityId, {
      cashReserveBelowTarget: false,
      driftExceeded: true,
      productAvailable: true,
    });
  }

  agentTools(): GrowAgentToolPort {
    return {
      getFinancialSnapshot: (subjectId) => ({ subjectId, tool: 'getFinancialSnapshot' }),
      getGoals: (subjectId) => ({ subjectId, tool: 'getGoals' }),
      getOpportunities: (subjectId) => ({ subjectId, tool: 'getOpportunities' }),
      getGrowthPlan: (subjectId) => ({ subjectId, tool: 'getGrowthPlan' }),
      getPortfolio: (subjectId) => ({ subjectId, tool: 'getPortfolio' }),
      explainOpportunity: (subjectId, opportunityId) => ({ subjectId, opportunityId }),
      createGrowthProposal: (subjectId, actionId) => ({ subjectId, actionId, awaitingHuman: true }),
      modifyGrowthProposal: (subjectId, proposalId, amountMinorUnits) => ({
        subjectId,
        proposalId,
        amountMinorUnits,
      }),
      submitProposalForApproval: (subjectId, proposalId) => ({
        subjectId,
        proposalId,
        awaitingHuman: true,
      }),
      getExecutionStatus: (subjectId, executionId) => ({ subjectId, executionId }),
    };
  }

  invokeAgentTool(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    if (body.tool === 'executeProposal' || body.selfApprove === true) {
      const refused = refusePrivilegedGrowExecution();
      return this.fail(requestId, refused.ok ? 'AGENT_CANNOT_EXECUTE' : refused.code, refused.ok ? 'refused' : refused.message);
    }
    const result = invokeGrowAgentTool(this.agentTools(), {
      tool: typeof body.tool === 'string' ? (body.tool as never) : 'getFinancialSnapshot',
      subjectId: principal.identityId,
      actorId: `agent_${principal.actorId}`,
      actorKind: 'AGENT',
      payload: {
        ...(typeof body.proposalId === 'string' ? { proposalId: body.proposalId } : {}),
        ...(body.selfApprove === true ? { selfApprove: 'true' } : {}),
      },
    });
    return result.ok ? { ...result.value, mayExecute: false } : this.fail(requestId, result.code, result.message);
  }

  private enrichCandidate(principal: BffPrincipal, candidate: GrowthActionCandidate): GrowthActionCandidate {
    const accounts = this.deps.investmentAccountsFor(principal.customerId);
    const proposed = candidate.proposedAmount;
    const zeroOrMissing = !proposed || proposed.minorUnits === '0';
    const destinationAccountId = candidate.destinationAccountId ?? accounts?.brokerageCashAccountId;
    const sourceAccountId = candidate.sourceAccountId ?? accounts?.demandAccountId;
    return {
      ...candidate,
      ...(sourceAccountId ? { sourceAccountId } : {}),
      ...(destinationAccountId ? { destinationAccountId } : {}),
      proposedAmount: zeroOrMissing
        ? { minorUnits: '20000', currency: proposed?.currency ?? 'USD' }
        : proposed,
    };
  }

  private actor(principal: BffPrincipal): unknown {
    return this.deps.resolveActor(principal.actorId);
  }

  private projectPlan(plan: { readonly planId: string; readonly version: number; readonly state: string; readonly orderedProposedActions: readonly { readonly actionId: string; readonly title: string; readonly action: string }[]; readonly assumptions: readonly string[]; readonly risks: readonly string[] }) {
    return {
      planId: plan.planId,
      version: plan.version,
      state: plan.state,
      actions: plan.orderedProposedActions.map((row) => ({
        actionId: row.actionId,
        title: row.title,
        action: row.action,
      })),
      assumptions: plan.assumptions,
      risks: plan.risks,
      achievementPromised: false,
    };
  }

  private projectProposal(proposal: GrowLifecycleProposal) {
    return {
      proposalId: proposal.proposalId,
      version: proposal.version,
      state: proposal.state,
      proposalType: proposal.proposalType,
      amount: proposal.amount,
      explainability: proposal.explainability,
      scenario: proposal.scenario,
      suitability: proposal.suitability,
      requiredAuthAssurance: proposal.requiredAuthAssurance,
      expiresAt: proposal.expiresAt,
      contentHash: proposal.contentHash,
      serverOwned: true,
      clientInstructionsTrusted: false,
      productionMoneyMovement: false,
    };
  }

  private projectExecution(row: { readonly executionId: string; readonly state: string; readonly providerId: string | null; readonly filledMinorUnits: string; readonly requestedMinorUnits: string; readonly authorityId: string | null; readonly ledgerJournalId: string | null }) {
    return {
      executionId: row.executionId,
      state: row.state,
      providerId: row.providerId,
      filledMinorUnits: row.filledMinorUnits,
      requestedMinorUnits: row.requestedMinorUnits,
      authorityId: row.authorityId,
      ledgerJournalId: row.ledgerJournalId,
      submittedIsNotCompleted: row.state !== 'COMPLETED',
      productionMoneyMovement: false,
    };
  }

  private fail(requestId: string, errorCode: string, message: string): BffErrorEnvelope {
    const mapped = mapGrowError(errorCode);
    return bffError({
      errorCode: mapped.code,
      category: mapped.category,
      message,
      retryable: false,
      requestId,
      detailsSafeForClient: { growCode: errorCode },
    });
  }
}

function mapGrowError(code: string): { readonly code: BffErrorEnvelope['errorCode']; readonly category: BffErrorEnvelope['category'] } {
  if (code === 'STEP_UP_REQUIRED') return { code: 'STEP_UP_REQUIRED', category: 'AUTHENTICATION' };
  if (code === 'KERNEL_REFUSED' || code === 'REFRESH_PROPOSAL_REQUIRED') return { code: 'KERNEL_REFUSED', category: 'POLICY' };
  if (code === 'NOT_FOUND' || code === 'PLAN_NOT_FOUND' || code === 'PROPOSAL_NOT_FOUND') return { code: 'NOT_FOUND', category: 'NOT_FOUND' };
  if (code === 'AGENT_CANNOT_SELF_APPROVE' || code === 'AGENT_CANNOT_EXECUTE' || code === 'PROPOSAL_FORGED') {
    return { code: 'FORBIDDEN_PROFILE_FIELD', category: 'AUTHORIZATION' };
  }
  if (code === 'PROVIDER_UNAVAILABLE' || code === 'PRODUCT_UNAVAILABLE') return { code: 'FEATURE_UNAVAILABLE', category: 'TEMPORARY_UNAVAILABLE' };
  return { code: 'VALIDATION', category: 'VALIDATION' };
}

function isErr(value: unknown): value is BffErrorEnvelope {
  return Boolean(value && typeof value === 'object' && 'errorCode' in value);
}

function failureMessage(error: { readonly code: string; readonly message?: string; readonly issues?: readonly { readonly message?: string }[] }): string {
  if (typeof error.message === 'string') {
    return error.message;
  }
  const issue = error.issues?.[0]?.message;
  return issue ?? error.code;
}

export function availableMinorUnits(ledger: Ledger, account: Account | undefined): string {
  if (!account) {
    return '0';
  }
  const balance = balanceOfAccount(ledger, account);
  return balance.ok ? balance.value.minorUnits.toString() : '0';
}

export { Money };

export function actorFromPrincipal(principal: BffPrincipal, kind: 'HUMAN' | 'AGENT' = 'HUMAN'): GrowthProductActor {
  return {
    actorId: principal.actorId,
    subjectId: principal.customerId,
    capabilities: principal.capabilities,
    jurisdiction: principal.jurisdiction,
    verification: principal.verification,
    restricted: principal.restricted,
    principalKind: kind,
    authenticationStrength: 'STANDARD',
  };
}

export function mapGrowFailure(error: GrowProductFailure, requestId: string): BffErrorEnvelope {
  const code =
    error.code === 'CROSS_USER_DENIED' || error.code === 'CAPABILITY_DENIED'
      ? 'RESOURCE_NOT_OWNED'
      : error.code === 'STEP_UP_REQUIRED'
        ? 'STEP_UP_REQUIRED'
        : error.code === 'POLICY_DENIED' || error.code === 'SUITABILITY_DENIED' || error.code === 'AGENT_CANNOT_APPROVE'
          ? 'KERNEL_DENIED'
          : error.code === 'PLAN_NOT_FOUND' || error.code === 'PROPOSAL_NOT_FOUND' || error.code === 'FABRICATED_PROPOSAL_ID'
            ? 'NOT_FOUND'
            : error.code === 'EXPIRED'
              ? 'VALIDATION'
              : 'VALIDATION';
  const category =
    code === 'STEP_UP_REQUIRED'
      ? 'AUTHENTICATION'
      : code === 'RESOURCE_NOT_OWNED' || code === 'KERNEL_DENIED'
        ? 'AUTHORIZATION'
        : code === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'VALIDATION';
  return bffError({
    errorCode: code,
    category,
    message: error.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { growCode: error.code },
  });
}

export function parseCreatePlan(principal: BffPrincipal, body: Record<string, unknown>): CreateGrowPlanInput | BffErrorEnvelope {
  const currency = typeof body.currency === 'string' ? body.currency : 'USD';
  const starting = stringifyMinor(body.startingCapitalMinorUnits ?? body.iHaveMinorUnits ?? body.startingCapital);
  const horizon = Number(body.timeHorizonMonths ?? body.horizonMonths);
  const risk = body.riskProfile ?? body.risk;
  if (!starting || !Number.isInteger(horizon) || !isGrowRiskProfile(risk)) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: 'starting capital, timeHorizonMonths, and riskProfile are required',
      retryable: false,
      requestId: 'req_grow_validate',
    });
  }
  const goal = stringifyMinor(body.goalTargetMinorUnits ?? body.myGoalMinorUnits);
  const liquidity = stringifyMinor(body.liquidityRequirementMinorUnits);
  const recurring = stringifyMinor(body.recurringContributionMinorUnits);
  return {
    ownerId: principal.customerId,
    startingCapitalMinorUnits: starting,
    currency,
    timeHorizonMonths: horizon,
    riskProfile: risk,
    ...(goal ? { goalTargetMinorUnits: goal } : {}),
    ...(Array.isArray(body.goalRefs) ? { goalRefs: body.goalRefs.filter((item): item is string => typeof item === 'string') } : {}),
    ...(liquidity ? { liquidityRequirementMinorUnits: liquidity } : {}),
    ...(recurring ? { recurringContributionMinorUnits: recurring } : {}),
    ...(typeof body.sourceAccountId === 'string' ? { sourceAccountId: body.sourceAccountId } : {}),
    ...(typeof body.opportunityId === 'string' ? { opportunityId: body.opportunityId } : {}),
  };
}

export function growCatalog(service: ProductGrowthService, principal: BffPrincipal, requestId: string) {
  const actor = actorFromPrincipal(principal);
  const plans = service.listPlans(actor, principal.customerId);
  const items = plans.ok ? plans.value : [];
  const latest = items[0];
  return {
    group: 'grow',
    schema: 'sunrey.consumer.grow.v1',
    availability: 'AVAILABLE_SIMULATION',
    state: 'SIMULATION_ONLY',
    reason: 'Grow My Money plans and proposals are simulation illustrations. Production remains disabled.',
    productionActive: false,
    guaranteedOutcome: false,
    requestId,
    items,
    ...(latest ? { experience: toLovableExperience(latest) } : {}),
  };
}

export function publicPlan(plan: ProductGrowthPlan): ProductGrowthPlan {
  return plan;
}

export function publicProposal(proposal: ProductFinancialProposal): ProductFinancialProposal {
  return proposal;
}

function stringifyMinor(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'object' && value !== null && 'minorUnits' in value) {
    const minor = (value as { minorUnits: unknown }).minorUnits;
    if (typeof minor === 'string' && /^\d+$/.test(minor)) return minor;
  }
  return undefined;
}
